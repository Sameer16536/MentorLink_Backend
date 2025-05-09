import rateLimit from "express-rate-limit";
import { PrismaClient } from "../generated/prisma";
import { Request, Response } from "express";
import { NextFunction } from "express";


const prisma = new PrismaClient()

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25, // Limit each IP to 25 requests per windowMs
    message: "Too many requests, please try again later.",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
})




export  const registerUser = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

} 


export  const loginUser = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}

export  const logoutUser =async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}

export  const forgotPassword =async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}
export  const resetPassword = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}
export  const verifyOtp = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}
export const getProfile = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}
export const updateProfile = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}
export  const refreshToken =async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}
export  const deleteAccount = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{

}


