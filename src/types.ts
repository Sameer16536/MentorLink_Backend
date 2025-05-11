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