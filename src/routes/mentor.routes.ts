import express from 'express'
import { getPresignedUrl, searchMentors, submitReview, uploadProfilePicture } from '../controllers/mentor.controller'
import { authMiddleware } from '../middlewares/auth.middleware'


const router = express.Router()


router.get('/search',searchMentors)
router.post('/:mentorId/review',authMiddleware as any, submitReview)
router.get('/presigned-url',authMiddleware as any, getPresignedUrl)
router.post('/:mentorId/upload-profile-picture', authMiddleware as any, uploadProfilePicture)

export default router


