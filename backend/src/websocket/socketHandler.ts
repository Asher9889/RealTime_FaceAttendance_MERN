import { Server, Socket } from "socket.io";
import { faceController } from "../controllers";

export default function socketHandler(io: Server) {

  io.on("connection", (socket: Socket) => {
    console.log("✅ Client connected:", socket.id);


    socket.emit("message", "Hello from backend! 🎉");


    socket.on("frame", (data: { image: string }) => {
      faceController.onFrame(socket, data)
    })

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });
}