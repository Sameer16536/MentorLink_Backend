import { PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import Stripe from "stripe";

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const createCheckoutSession = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { mentorId, sessionId } = req.body;
        const user = req.user;

        if (!user || user.role !== "MENTEE") {
            return res.status(403).json({ message: "Only mentees can pay" });
        }

        //FInd the mentor
        const mentor = await prisma.mentorProfile.findUnique({
            where: {
                id: mentorId,
            },
            include: {
                user: true,
            },
        });
        if (!mentor || !mentor.hourlyRate || !mentor.stripeAccountId) {
            return res
                .status(404)
                .json({ message: "Mentor not available for payment" });
        }

        const platformfeePercentage = 0.1; //10%
        const amountInRupees = mentor.hourlyRate;
        const platformFee = Math.floor(
            amountInRupees * platformfeePercentage * 100
        );
        const totalAmount = amountInRupees * 100;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            line_items: [
                {
                    price_data: {
                        currency: "inr",
                        product_data: {
                            name: `Mentorship session with ${mentor.user.name}`,
                            description: `Mentorship session with ${mentor.user.name}`,
                        },
                        unit_amount: totalAmount,
                    },
                    quantity: 1,
                },
            ],
            payment_intent_data: {
                application_fee_amount: platformFee,
                transfer_data: {
                    destination: mentor.stripeAccountId,
                },
            },
            success_url: `${process.env.CLIENT_URL}/mentee/mentorship/${mentorId}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/mentee/mentorship/${mentorId}/cancel`,
            metadata: {
                mentorId: mentorId,
                menteeId: user.id,
                sessionId: sessionId,
            },
        });

        res.json({
            url: session.url,
            message: "Checkout session created successfully",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error",
            error: error,
        });
        return;
    }
};

export const createStripeOnboardingLink = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = req.user;
        if (!user || user.role !== "MENTOR") {
            res.status(403).json({
                message: "Only mentor can Onboard to stripe",
            });
            return;
        }
        //Check if mentor already has stripe account
        const mentor = await prisma.mentorProfile.findUnique({
            where: {
                id: user.id,
            },
        });

        if (!mentor) {
            res.status(404).json({
                message: "Mentor not found",
            });
            return;
        }

        if (mentor.stripeAccountId) {
            res.status(400).json({
                message: "Mentor already has stripe account",
            });
            return;
        }

        if (!mentor.stripeAccountId) {
            const account = await stripe.accounts.create({
                type: "express",
                country: "IN",
                email: user.email,
                capabilities: {
                    transfers: {
                        requested: true,
                    },
                },
            });
            //save the account id to the mentor profile
            const updatedMentor = await prisma.mentorProfile.update({
                where: {
                    id: user.id,
                },
                data: {
                    stripeAccountId: account.id,
                },
            });
        }

        // Create an onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: user.id,
            refresh_url: `${process.env.CLIENT_URL}/stripe/onboarding-failed`,
            return_url: `${process.env.CLIENT_URL}/dashboard`,
            type: "account_onboarding",
        });
        res.json({
            url: accountLink.url,
            message: "Stripe onboarding link created successfully",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error",
            error: error,
        });
        return;
    }
};
