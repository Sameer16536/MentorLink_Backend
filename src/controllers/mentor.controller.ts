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


export const submitReview = async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const {mentorId} = req.params
    const {rating,comment} = req.body 
    const user = req.user

    if(user?.role !== "MENTEE"){
       res.status(403).json({
        message: "Only mentee can submit review"
      })
      return
    }
    // Check if the mentor exists
    const mentor = await prisma.user.findUnique({
      where: {
        id: mentorId
      },
    include: {mentorProfile: true}
    
    })  
    if(!mentor){
      res.status(404).json({
        message: "Mentor not found"
      })
      return
    }
  //Check for existing review and rating
  const existingReview = await prisma.review.findFirst({
    where:{
      fromId:user?.id,
    }
  })
  if(existingReview){
     res.status(400).json({
      message: "You have already submitted a review"
    })
    return
  }

  // Create a new review
  const review = await prisma.review.create({
    data:{
      rating,
      comment,
      fromId:user?.id,
      toId:mentorId
    }
  })

  // Update the mentor's rating
 const reviews  = await prisma.review.findMany({
  where:{
    toId:mentorId
  }
})

const avgRating  = reviews.reduce((sum,r)=>sum + r.rating,0) / reviews.length
  await prisma.mentorProfile.update({
    where:{
      id:mentorId
    },
    data:{
      rating:avgRating
    }
  })
res.status(201).json({
  message: "Review submitted successfully",
  review,
  rating:avgRating
})
  }catch(error){ 
    console.log(error)
     res.status(500).json({
      message: "Internal server error",
      error: error
    })
    return
  }
}