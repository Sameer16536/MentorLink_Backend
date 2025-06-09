import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { NextFunction } from "express";
import {
  loginInputValidation,
  menteeUpdateSchema,
  mentorUpdateSchema,
  userInputValidation,
} from "../types";
import jwt, { decode, JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { sendOtpEmail } from "../utils/sendOtpEmail";

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
      expiresIn: "7d",
    }
  );
};

//Register the user with Role : MENTOR or MENTEE
// API - "POST /user/register"
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


// API - "POST /user/login"
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


// API - "POST /user/logout"
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

// API - "POST /user/forgot-password"
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
sendOtpEmail({
  to: validatedEmail,
  otp,
  name: user.name,})

  //delete any previous OTPs
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
      used:false
    },
  })

  //saving OTP to database
  await prisma.passwordResetToken.create({
    data: { 
      userId: user.id,
      otp,
      expiredAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      used: false,
    },
  });

  res.status(200).json({
  message: "OTP sent to your email. Valid for 10 minutes.",
});

};


// API - "POST /user/requestOtp"
export const requestPasswordResetOtp  =  async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
 // validate email first
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
  //delete any previous OTPs
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
      used:false
    },
  })
  //Generate 6 digit OTP
  // e.g., "763920"
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  //send OTP to user email
  sendOtpEmail({
    to: validatedEmail,
    otp,
    name: user.name,
  });
  const recentToken = await prisma.passwordResetToken.findFirst({
  where: {
    userId: user.id,
    createdAt: {
      gte: new Date(Date.now() - 1 * 60 * 1000), // within 1 minute
    },
  },
});
if (recentToken) {
 res.status(429).json({ message: "Please wait a minute before requesting another OTP." });
  return;
}


  //saving OTP to database
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      otp,
      expiredAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      used: false,
    },
  });
  res.status(200).json({
    message: "OTP sent to your email. Valid for 10 minutes.",
  });
};


// API - "POST /user/reset-password"
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
 const { email, otp, password } = req.body;
  const validateInput = z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    password: z.string().min(8),
  });
  const parsedInput = validateInput.safeParse(req.body);
  if (!parsedInput.success) {
    res.status(400).json({
      message: "Invalid input",
      errors: parsedInput.error.flatten(),
    });
    return;
  }
  const { email: validatedEmail, otp: validatedOtp, password: validatedPassword } = parsedInput.data;
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
  //Check if OTP exists and is valid
  const passwordResetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      otp: validatedOtp,
      expiredAt: {
        gte: new Date(),
      },
      used: false,
    },
  });
  if (!passwordResetToken) {
    res.status(400).json({
      message: "Invalid or expired OTP",
    });
    return;
  }
  // Null check
    if (!user.password) {
    res.status(400).json({
      message: "User does not have a password set",
    });
    return;
  }
  //Check if password is same as old password

  const isSamePassword = await bcrypt.compare(validatedPassword, user.password);
  if (isSamePassword) {
    res.status(400).json({
      message: "New password cannot be same as old password",
    });
    return;
  }

  //Hash the new password
  const hashedPassword = await bcrypt.hash(validatedPassword, 10);
  //Update the user password
  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password: hashedPassword,
    },
  });
  //Mark OTP as used
  await prisma.passwordResetToken.update({
    where: {
      id: passwordResetToken.id,
    },
    data: {
      used: true,
    },
  });
  res.status(200).json({
    message: "Password reset successfully",
  });
};


// API - "POST /user/verify-otp"
export const verifyOtp = [authRateLimiter,async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { email, otp } = req.body;
  const validateInput = z.object({  
    email: z.string().email(),
    otp: z.string().length(6),
  });
  const parsedInput = validateInput.safeParse(req.body);
  if (!parsedInput.success) {
    res.status(400).json({
      message: "Invalid input",
      errors: parsedInput.error.flatten(),
    });
    return;
  }
  const { email: validatedEmail, otp: validatedOtp } = parsedInput.data;
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
  //Check if OTP exists and is valid
  const passwordResetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      otp: validatedOtp,
      expiredAt: {
        gte: new Date(),
      },
      used: false,
    },
  }); 
  if (!passwordResetToken) {
    res.status(400).json({
      message: "Invalid or expired OTP",
    });
    return;
  }
  res.status(200).json({
    message: "OTP verified successfully",   
  }); 
  
}];


// API - "GET /user/profile"
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
        id: req.user.id,
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

// API - "PUT /user/profile"
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
        id: req.user.id,
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


// API - "POST /user/refresh-token"
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
    try{
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ message: "No refresh token provided" });
        return;
      }
      let decoded;
      try{
        decoded = jwt.verify(refreshToken, process.env.JWT_SECRET as string);
      }catch(error){
        res.status(401).json({ message: "Invalid refresh token" });
        return;
      }

      const payload = decoded as JwtPayload & { userId: string };
      const userId = payload.userId

      const tokenDb = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId: userId,
        },
      });
      if (!tokenDb) {
        res.status(401).json({ message: "Invalid refresh token" });
        return;
      }

      if (tokenDb.revoked) {
        res.status(401).json({ message: "Refresh token revoked" });
        return;
      }
      if (tokenDb.expiresAt < new Date()) {
        res.status(401).json({ message: "Refresh token expired" });
        return;
      }

      // need to pass the user  to the generateAccessToken function
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          menteeProfile: true,
          mentorProfile: true,
        },
      });
      //Generate new access and refresh token
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      //Rotate tokens
      await prisma.refreshToken.delete({
        where: {
          token: refreshToken,
        },
      })
      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId,
          revoked: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      //cookies
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      res.status(200).json({
        message: "Access token refreshed successfully",
        accessToken: newAccessToken,
      });

    }catch(error){
      console.error(error);
      console.log("Error in refreshToken");
      res.status(500).json({
        message: "Internal Server Error",
      });
    }
};


// API - "DELETE /user/delete-account"
export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try{
    const userId = req.user?.id

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
