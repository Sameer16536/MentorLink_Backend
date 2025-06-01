import express from 'express';
import { createCheckoutSession, createStripeOnboardingLink, stripeWebhook } from '../controllers/payment.controller';
import { authRateLimiter } from '../controllers/user.controller';


const router = express.Router();


router.post('/create-checkout-session', authRateLimiter, createCheckoutSession);
router.post('/create-stripe-onboarding-link', authRateLimiter, createStripeOnboardingLink);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

export default router;