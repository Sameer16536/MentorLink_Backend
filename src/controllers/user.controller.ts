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
    

 const {user, accessToken, refreshToken}  = await prisma.$transaction(async (tx) => {
     const user = await tx.user.create({
        data:{
            email,
            password:hashedPassword,
            name,
            role
        }
    })
    //Generate access and refresh token
    const accessToken = generateAccessToken(user)
    const refreshToken = generateRefreshToken(user)
    await tx.refreshToken.create({
        data:{
            token:refreshToken,
            userId:user.id,
            revoked:false,
            createdAt:new Date(),
            expiresAt:new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        }
    })

    if(role === "MENTOR"){
        await tx.mentorProfile.create({
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
        await tx.menteeProfile.create({
            data:{
                userId:user.id,
                interests:[],
            }
        })
    }
    return {user, accessToken, refreshToken}
    
})

    //Status code 201 for new resource created
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.status(201).json({
        message:"User created successfully",
        user:{
            id:user.id,
            email:user.email,
            name:user.name,
            role:user.role,
        }
    })
    
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


