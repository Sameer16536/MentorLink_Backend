import rateLimit from "express-rate-limit";
import { PrismaClient } from "../generated/prisma";
import { Request, Response } from "express";
import { NextFunction } from "express";
import {
  loginInputValidation,
  menteeUpdateSchema,
  mentorUpdateSchema,
  userInputValidation,
} from "../types";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";

const prisma = new PrismaClient();

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Limit each IP to 25 requests per windowMs
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
});

const generateAccessToken = (user: any) => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "2h",
    }
  );
};

const generateRefreshToken = (user: any) => {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET as string,
    {
      expiresIn: "2h",
    }
  );
};

//Register the user with Role : MENTOR or MENTEE
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validadteInput = userInputValidation.parse(req.body);
    const { email, password, name, role } = validadteInput;

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (existingUser) {
      res.status(409).json({
        message: "User already exists",
      });
      return;
    }

    //Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const { user, accessToken, refreshToken } = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            role,
          },
        });
        //Generate access and refresh token
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        await tx.refreshToken.create({
          data: {
            token: refreshToken,
            userId: user.id,
            revoked: false,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        });

        if (role === "MENTOR") {
          await tx.mentorProfile.create({
            data: {
              userId: user.id,
              skills: [],
              tag: [],
              experience: 0,
              bio: "",
              rating: 0,
            },
          });
        }
        if (role === "MENTEE") {
          await tx.menteeProfile.create({
            data: {
              userId: user.id,
              interests: [],
            },
          });
        }
        return { user, accessToken, refreshToken };
      }
    );

    //Status code 201 for new resource created
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
    });
  } catch (error) {
    console.error(error);
    console.log("Error in registerUser");
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: "Invalid input",
        errors: error.errors,
      });
    } else {
      res.status(500).json({
        message: "Internal Server Error",
      });
    }
  }
};

export const loginUser = [authRateLimiter,async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const validateInput = loginInputValidation.parse(req.body);
    const { email, password } = validateInput;

    //Check if user exists
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (
      !user ||
      !user.password ||
      !(await bcrypt.compare(password, user.password))
    ) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    //Generate access and refresh token
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        revoked: false,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: "User logged in successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
    });
  } catch (error) {
    console.error(error);
    console.log("Error in loginUser");
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
}];

export const logoutUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ message: "No refresh token provided" });
      return;
    }
    //Revoking the refresh token
    await prisma.refreshToken.updateMany({
      where: {
        token: refreshToken,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
    });

    res.status(200).json({
      message: "User logged out successfully",
    });
  } catch (error) {
    console.error(error);
    console.log("Error in logoutUser");
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {

  //validate email first
  const {email} = req.body
  const validateInput = z.object({
    email: z.string().email(),
  });
  const parsedInput = validateInput.safeParse(req.body);
  if (!parsedInput.success) {
    res.status(400).json({
      message: "Invalid email",
      errors: parsedInput.error.flatten(),
    });
    return;
  }
  const { email: validatedEmail } = parsedInput.data;
  //Check if user exists
  const user = await prisma.user.findUnique({
    where: {
      email: validatedEmail,
    },
  });
  if (!user) {
    res.status(404).json({
      message: "User not found",
    });
    return;
  }
//Generate 6 digit OTP
// e.g., "763920"
const otp = Math.floor(100000 + Math.random() * 900000).toString(); 

//send OTP to user email
// Function to send OTP to user's email



};


export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {};



export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {};



export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      include: {
        menteeProfile: true,
        mentorProfile: true,
      },
    });
    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      message: "User profile fetched successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile:
          user.role === "MENTOR" ? user.mentorProfile : user.menteeProfile,
      },
    });
  } catch (error) {
    console.error(error);
    console.log("Error in getProfile");
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      include: {
        menteeProfile: true,
        mentorProfile: true,
      },
    });
    if (!user) {
      res.status(404).json({
        message: "User not found",
      });
      return;
    }

    if (user.role == "MENTOR") {
      const validateInput = mentorUpdateSchema.safeParse(req.body);
      if (!validateInput.success) {
        res.status(400).json({
          message: "Invalid mentor profile data",
          errors: validateInput.error.flatten(),
        });
        return;
      }

      const updatedMentorProfile = await prisma.mentorProfile.update({
        where: {
          userId: user.id,
        },
        data: validateInput.data,
      });

      res.status(200).json({
        message: "Mentor profile updated successfully",
        profile: updatedMentorProfile,
      });
    } else if (user.role == "MENTEE") {
      const validateInput = menteeUpdateSchema.safeParse(req.body);
      if (!validateInput.success) {
        res.status(400).json({
          message: "Invalid mentee profile data",
          errors: validateInput.error.flatten(),
        });
        return;
      }

      const updatedMenteeProfile = await prisma.menteeProfile.update({
        where: {
          userId: user.id,
        },
        data: validateInput.data,
      });

      res.status(200).json({
        message: "Mentee profile updated successfully",
        profile: updatedMenteeProfile,
      });
    }
  } catch (error) {
    console.error(error);
    console.log("Error in updateProfile");
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {};

export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try{
    const userId = req.user?.userId

    if (!userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }
    const user = await prisma.user.findUnique({
      where:{
        id:userId
      }
    })
    if(!user){
      res.status(404).json({
        message: "User not found",
      });
      return;
    }

    await prisma.user.delete({
      where:{ 
        id:userId
      } 
    })
    res.status(200).json({
      message: "User deleted successfully",
    });


  }catch(error){
    console.error(error);
    console.log("Error in deleteAccount");
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
