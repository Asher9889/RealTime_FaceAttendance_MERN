import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import socketHandler from "./websocket/socketHandler";
import loadOnnxModels from "./utils/ai_models/onnxPipeline";
import { loadModels } from "./models/index";
import connectMongoDB from "./db/connectMongoDB";
import { upload } from "./controllers/face.controller";

connectMongoDB().catch((err)=> {console.log(err)})

const app = express();
app.use(cors()); 
app.use(express.json({ limit: "10mb" }));


// loadModels().catch((e)=>{
//   console.log("error from models",e)
// })

const server = http.createServer(app);
const io:Server = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.post("/api/v1/face/upload", upload as any);

socketHandler(io);

server.listen(5000, () => {
  console.log("🚀 Server listening on port 5000");
});
