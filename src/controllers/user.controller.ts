import rateLimit from "express-rate-limit";
import { PrismaClient } from "../generated/prisma";
import { Request, Response } from "express";
import { NextFunction } from "express";
import { userInputValidation } from "../types";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";


const prisma = new PrismaClient()

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25, // Limit each IP to 25 requests per windowMs
    message: "Too many requests, please try again later.",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
})

const generateAccessToken  = (user:any)=>{
    return jwt.sign({ id: user.id, email: user.email , name:user.name }, process.env.JWT_SECRET as string, {
        expiresIn: "2h",
    });
}

const generateRefreshToken  = (user:any)=>{
    return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET as string, {
        expiresIn: "2h",
    });
}

//Register the user with Role : MENTOR or MENTEE
export  const registerUser = async(req:Request,res:Response,next:NextFunction): Promise<void>=>{
   try {
     const validadteInput = userInputValidation.parse(req.body)
    const {email,password,name,role} = validadteInput

    const existingUser = await prisma.user.findUnique({
        where:{
            email
        }
    })
    if (existingUser){
        res.status(409).json({
            message:"User already exists"
        })
        return
    }

    //Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
        data:{
            email,
            password:hashedPassword,
            name,
            role
        }
    })
    if(role === "MENTOR"){
        await prisma.mentorProfile.create({
            data:{
                userId:user.id,
                skills:[],
                tag:[],
                experience:0,
                bio:"",
                rating:0,
            }
        })
    }
    if(role === "MENTEE"){
        await prisma.menteeProfile.create({
            data:{
                userId:user.id,
                interests:[],
            }
        })
    }
   } catch (error) {
    console.error(error)
    console.log("Error in registerUser")
   }
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


