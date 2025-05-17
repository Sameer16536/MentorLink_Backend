import {Request, NextFunction , Response } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
    id: string;
    email: string;
    role: "MENTOR" | "MENTEE";
}

declare global{
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}


export const authMiddleware = (req:Request, res:Response, next:NextFunction) => {
    const authHeader = req.headers.authorization;
        if(!authHeader){
            return res.status(401).json({
                message: "Unauthorized",
            })
        }

        const token = authHeader.split(" ")[1]
        
    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

        req.user = decoded
        next()
    }
    catch(error){
        console.log(error)
        return res.status(500).json({
            message: "Verification failed",
            error: error,   
        })
    }
}