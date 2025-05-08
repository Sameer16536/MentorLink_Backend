import app from "./app";
import {configDotenv} from "dotenv"


configDotenv();

const PORT = process.env.PORT || 3000;


const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})



