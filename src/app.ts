import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import userRouter from "./routes/user.routes"
import mentorRouter from "./routes/mentor.routes"
import helmet from "helmet";

const app = express();


app.use((req,res,next)=>{
    if(req.headers['x-forwarded-proto'] === 'http'){
        res.redirect(`https://${req.headers.host}${req.url}`)
        return
    }
    next();
})
app.use(helmet())
app.use(cors({
    origin: "http://localhost:8000",
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser())



app.use("/user",userRouter)
app.use("/mentor",mentorRouter)

export default app;
