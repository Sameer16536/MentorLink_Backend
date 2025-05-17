import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import userRouter from "./routes/user.routes"
import mentorRouter from "./routes/mentor.routes"

const app = express();


app.use(cors({
    origin: "http://localhost:8000",
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser())


app.use("/user",userRouter)
app.use("/mentor",mentorRouter)

export default app;
