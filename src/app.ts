import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
const app = express();


app.use(cors({
    origin: "http://localhost:8000",
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser())


app.use("/")

export default app;
