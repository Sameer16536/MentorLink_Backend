import express from 'express';
import { createCheckoutSession, createStripeOnboardingLink, stripeWebhook } from '../controllers/payment.controller';


const router = express.Router();


router.post('/create-checkout-session', createCheckoutSession);
router.post('/create-stripe-onboarding-link', createStripeOnboardingLink);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

export default router;