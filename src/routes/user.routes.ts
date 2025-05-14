import express from 'express'
import { forgotPassword, getProfile, loginUser, logoutUser, refreshToken, registerUser, requestPasswordResetOtp, resetPassword, updateProfile, verifyOtp } from '../controllers/user.controller'
import { authMiddleware } from '../middlewares/auth.middleware'


const router = express.Router()

//Login & Signup
router.post('/login',loginUser)
router.post('/register',registerUser)
router.post('/logout',logoutUser)
router.post('/forgot-password',forgotPassword)
router.post('/reset-password',resetPassword)
router.post('/verify-otp',verifyOtp)
router.post('/requestOtp',requestPasswordResetOtp)

//profile
router.get('/profile',authMiddleware  as any ,getProfile)
router.put('/profile',authMiddleware as any,updateProfile)


//token
router.post('refresh-token',refreshToken)

export default router