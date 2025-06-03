import { Prisma, PrismaClient } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { v4 as uuidv4, v4 } from "uuid";
import { createPresignedPost } from  "@aws-sdk/s3-presigned-post";
import { S3Client } from "@aws-sdk/client-s3";

const prisma = new PrismaClient()

//API - "GET /mentor/search-mentors?skills=JavaScript,NodeJS&tags=Backend&minExperience=2&available=true&rating=4.5&name=John"
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

// API - "POST /mentor/:mentorId/review"
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

// API - "POST /mentor/:mentorId/upload-profile-picture"
export const uploadProfilePicture = async (req: Request, res: Response, next: NextFunction) => {
  try{
    const {mentorId} = req.params
    const {image} = req.body
    const user = req.user
    if(user?.role !== "MENTOR"){
      res.status(403).json({
        message: "Only mentor can upload profile picture"
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
    // Update the mentor's profile picture
    const updatedMentor = await prisma.mentorProfile.update({
      where:{
        id:mentorId
      },
      data:{
        imageProfileUrl:image
      }

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

const s3Client  = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})


// API - "GET /mentor/presigned-url"
export const getPresignedUrl = async (req: Request, res: Response, next: NextFunction) => {
  try{
    const user = req.user
    if(!user || user.role !== "MENTOR"){
      res.status(403).json({
        message: "Only mentor can get presigned url"
      })
      return
    }
    const uniqueId = v4()
    const fileKey = `Images/${user.id}/${uniqueId}.jpg`

    const {url,fields} =  await createPresignedPost(s3Client,{
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: fileKey,
      Expires: 300, // 5 minutes
      Conditions:[["content-length-range",0 , 5 * 1024 * 1024]], // 5MB
    })

    res.status(200).json({
      msg:"Presigned URL generated successfully",
      preSignedUrl:url,
      fields,
      fileKey
    })
  }
  catch(error){
    console.log(error)
     res.status(500).json({
      message: "Internal server error",
      error: error
    })
    return
  }
}

//Mentor Availability
//API - "POST /mentor/setAvailability"
export const setAvailability = async (req: Request, res: Response, next: NextFunction):Promise<void> => {
  const user = req.user
  const { startTime, endTime } = req.body;  
  if (user?.role !== "MENTOR") {
    res.status(403).json({
      message: "You are not authorized to set availability",
    });
    return;
  }

  const availability = await prisma.mentorAvailability.create({
    data: {
      mentorId: user.id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isBooked: false,
    },
  });
  res.status(201).json({
    message: "Availability set successfully",
    availability,
  });

}

export const getScheduledSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const user = req.user;
  if (user?.role !== "MENTOR") {
    res.status(403).json({
      message: "You are not authorized to view scheduled sessions",
    });
    return;
  }

 const schedule = await prisma.mentorAvailability.findMany({
  where: {
    mentorId: user.id, 
    startTime: {
      gte: new Date(), 
    },
  },
  orderBy: {
    startTime: 'asc',
  },
  include:{
    session: {
      include: {
        mentees:true
      }
    }
  }
 })
  res.status(200).json({
    message: "Scheduled sessions retrieved successfully",
    schedule,
  });
}