import app from "./app";
import {configDotenv} from "dotenv"
import { startServer } from "./webrtc-server/mediasoup-server";


configDotenv();

const PORT = process.env.PORT || 3000;


 app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})


//SFU server
startServer()