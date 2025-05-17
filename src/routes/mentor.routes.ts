import express from 'express'
import { searchMentors, submitReview } from '../controllers/mentor.controller'
import { authMiddleware } from '../middlewares/auth.middleware'


const router = express.Router()


router.get('/search',searchMentors)
router.post('/:mentorId/review',authMiddleware as any, submitReview)

export default router


