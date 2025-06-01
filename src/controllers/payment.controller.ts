import { PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import Stripe from "stripe";

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const createCheckoutSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mentorId, sessionId } = req.body;
    const user = req.user;

    if (!user || user.role !== "MENTEE") {
      res.status(403).json({ message: "Only mentees can pay" });
      return;
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
      res.status(404).json({ message: "Mentor not available for payment" });
      return;
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
    await prisma.payment.create({
      data: {
        userId: user.id,
        sessionId: sessionId,
        amount: totalAmount,
        platformFee: platformFee,
        status: "PENDING",
        method: "STRIPE",
        stripeSessionId: session.id,
        stripeIntentId: session.payment_intent?.toString() || "",
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

      // Create an onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.CLIENT_URL}/stripe/onboarding-failed`,
        return_url: `${process.env.CLIENT_URL}/dashboard`,
        type: "account_onboarding",
      });
      res.json({
        url: accountLink.url,
        message: "Stripe onboarding link created successfully",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Internal server error",
      error: error,
    });
    return;
  }
};

export const stripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const signature = req.headers["stripe-signature"] as string;
  const webHookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webHookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).send(`Webhook Error: ${err}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const mentorId = session.metadata?.mentorId;
    const menteeId = session.metadata?.menteeId;
    const sessionId = session.metadata?.sessionId;

    try {
      // Mark session as paid
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: "PAID",
          paymentStatus: "COMPLETED",
          paidAt: new Date(),
        },
      });

      console.log("✅ Session marked as paid");

      await prisma.session.update({
        where: { id: session.metadata?.sessionId },
        data: {
          status: "PAID",
          paymentStatus: "COMPLETED",
          paidAt: new Date(),
        },
      });
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error marking session as paid:", error);
    }
  }
  else if(event.type === "checkout.session.expired"){
    const session = event.data.object as Stripe.Checkout.Session;

    const sessionId = session.metadata?.sessionId;

    try {
      // Mark session as expired
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: "EXPIRED",
          paymentStatus: "FAILED",
          paidAt: null,
        },
      });

      console.log("✅ Session marked as expired");
    } catch (error) {
      console.error("Error marking session as expired:", error);
    }
  }
  else if(event.type === "payment_intent.payment_failed"){
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    const sessionId = paymentIntent.metadata?.sessionId;

    try {
      // Mark session as payment failed
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: "FAILED",
          paymentStatus: "FAILED",
          paidAt: null,
        },
      });

      console.log("✅ Session marked as payment failed");
    } catch (error) {
      console.error("Error marking session as payment failed:", error);
    }
  }
};
