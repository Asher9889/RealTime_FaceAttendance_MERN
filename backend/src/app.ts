import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import socketHandler from "./websocket/socketHandler";
import loadOnnxModels from "./utils/ai_models/onnxPipeline";
import { loadModels } from "./models/index";


const app = express();
app.use(cors()); 

loadModels().catch((e)=>{
  console.log("error from models",e)
})

const server = http.createServer(app);
const io:Server = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true,
  },
});


socketHandler(io);

server.listen(5000, () => {
  console.log("🚀 Server listening on port 5000");
});
