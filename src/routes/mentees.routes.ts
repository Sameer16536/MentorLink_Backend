import express from 'express';
import { bookSession, getAvailableSlots } from '../controllers/mentees.controller';
import { authMiddleware } from '../middlewares/auth.middleware';


const router = express.Router();


router.post("/book-session", authMiddleware as any, bookSession);
router.get('/available-slots', authMiddleware as any , getAvailableSlots)
