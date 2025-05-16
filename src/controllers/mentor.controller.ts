import { Prisma, PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";


const prisma = new PrismaClient()


export const searchMentors = async(req:Request,res:Response,next:NextFunction)=>{
    const {skills,tags,minExperience,available,rating,name}  = req.query

      const filters: any = {
    ...(minExperience && { experience: { gte: Number(minExperience) } }),
    ...(available && { availability: available === "true" }),
  };

  if(skills){
    const skillsArray = (skills as string).split(',')
    filters.skills = {
        hasSome :skillsArray
    }
  }

  if (skills) {
    const skillsArray = (skills as string).split(",");
    filters.skills = {
      hasSome: skillsArray,
    };
  }

  if (tags) {
    const tagsArray = (tags as string).split(",");
    filters.tag = {
      hasSome: tagsArray,
    };
  }

  if (name) {
    filters.user = {
      name: {
        contains: name as string,
        mode: "insensitive",
      },
    };
  }
  const mentors = await prisma.mentorProfile.findMany({
    where: filters,
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      rating: "desc",
    },
    take: 20,
  });
  res.status(200).json({
    mentors
  })

}