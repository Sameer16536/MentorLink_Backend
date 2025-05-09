import express from 'express'
import { forgotPassword, getProfile, loginUser, logoutUser, refreshToken, registerUser, resetPassword, updateProfile, verifyOtp } from '../controllers/user.controller'


const router = express.Router()

//Login & Signup
router.post('/login',loginUser)
router.post('/register',registerUser)
router.post('/logout',logoutUser)
router.post('/forgot-password',forgotPassword)
router.post('/reset-password',resetPassword)
router.post('/verify-otp',verifyOtp)

//profile
router.get('/profile',getProfile)
router.put('/profile',updateProfile)


//token
router.post('refresh-token',refreshToken)

export default router