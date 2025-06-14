import { Server, Socket } from "socket.io";
import { faceController } from "../controllers";
import ffmpeg from "fluent-ffmpeg";



export default function socketHandler(io: Server) {

  const username = 'admin';
  const password = 'msspl1234';
  // const rtspUrl = `rtsp://${username}:${password}@192.168.1.229:554/1/1`;

  const rtspUrl = `rtsp://admin:msspl1234@192.168.1.229:554/1/1`;

  const command = ffmpeg(rtspUrl)
  .inputOptions([
    "-rtsp_transport", "tcp",
    "-loglevel", "debug" // <-- show full logs
  ])
    // .addInputOption("-stimeout", "5000000") // optional timeout
    .outputOptions("-vf", "fps=5") // 5 frames per second
    .outputOptions("-qscale:v", "2")
    .format("image2pipe")
    .on("start", () => console.log("📽️ RTSP stream started"))
    .on("error", (err) => console.error("❌ FFmpeg error:", err.message));

  const ffmpegStream = command.pipe();
  let bufferChunks: Buffer[] = [];

  ffmpegStream.on("data", (chunk: Buffer) => {
    bufferChunks.push(chunk);

    // JPEG images end with FF D9
    if (chunk.slice(-2).toString("hex") === "ffd9") {
      const image = Buffer.concat(bufferChunks);
      bufferChunks = [];

      const base64 = `data:image/jpeg;base64,${image.toString("base64")}`;

      // 🔁 Send to all clients for live preview
      io.sockets.sockets.forEach((client) => {
        client.emit("frame-cctv", base64);
        faceController.onFrame(client, { image: base64 }); // optional: face detection
      });
    }
  });


  // For frontend based camera.

  io.on("connection", (socket: Socket) => {
    console.log("✅ Client connected:", socket.id);


    socket.emit("welcome", "Hello from backend! 🎉");


    socket.on("frame", (data: { image: string }) => {
      faceController.onFrame(socket, data)
    })


    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });
}