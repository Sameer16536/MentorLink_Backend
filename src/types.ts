import zod from "zod";

export const userInputValidation = zod.object({
    email: zod.string().email(),
    password: zod.string().min(8),
    name: zod.string().min(3).max(50),
    role:zod.enum(["MENTEE","MENTOR"]),
})

export const loginInputValidation = zod.object({
    email: zod.string().email(),
    password: zod.string().min(8),
})

export const mentorUpdateSchema = zod.object({
  bio: zod.string().optional(),
  skills: zod.array(zod.string()).optional(),
  tag: zod.array(zod.string()).optional(),
  experience: zod.number().optional(),
});

export const menteeUpdateSchema = zod.object({
  interests: zod.array(zod.string()).optional(),
});