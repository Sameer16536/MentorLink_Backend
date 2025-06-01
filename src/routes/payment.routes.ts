import express from 'express';
import { createCheckoutSession, createStripeOnboardingLink, refundPayment, stripeWebhook } from '../controllers/payment.controller';
import { authRateLimiter } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';


const router = express.Router();


router.post('/create-checkout-session', authRateLimiter, authMiddleware as any ,createCheckoutSession);
router.post('/create-stripe-onboarding-link', authRateLimiter, authMiddleware as  any ,createStripeOnboardingLink);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
router.post("/refund", authRateLimiter,authMiddleware as any, refundPayment);


export default router;