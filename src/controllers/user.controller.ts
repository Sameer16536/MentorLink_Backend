import rateLimit from "express-rate-limit";
import { PrismaClient } from "../generated/prisma";
import zod from "zod";
import { NextFunction } from "express";


const prisma = new PrismaClient()

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25, // Limit each IP to 25 requests per windowMs
    message: "Too many requests, please try again later.",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
})

const userInputValidation = zod.object({
    email: zod.string().email(),
    password: zod.string().min(8),
    name: zod.string().min(3).max(50),
})


export  const registerUser = async(req:Request,res:Response,next:NextFunction)=>{

} 


export  const loginUser = async()=>{

}

export  const logoutUser = async()=>{

}

export  const forgotPassword = async()=>{

}
export  const resetPassword = async()=>{

}
export  const verifyOtp = async()=>{

}
export const getProfile = async()=>{

}
export const updateProfile = async()=>{

}
export  const refreshToken = async()=>{

}
export  const deleteAccount = async()=>{

}


