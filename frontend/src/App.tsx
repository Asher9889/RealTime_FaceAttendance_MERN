// App.tsx
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { io, Socket } from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  upgrade: false,
});

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const [status, setStatus] = useState("Connecting... 🔄");
  const [message, setMessage] = useState("");

  useEffect(() => {

    socket.on("connect", () => {
      console.log("✅ Connected to WebSocket", socket.id);
      setStatus("Connected ✅");
    });

    socket.on("message", (data: string) => {
      console.log("📩 Message from server:", data);
      setMessage(data);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from WebSocket");
      setStatus("Disconnected ❌");
    });

    const intervalId = setInterval(() => {
      emitImage();
    }, 1000);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };

    
  }, []);

  function emitImage(){
    if(!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    socket.emit("frame", { image: imageSrc });
  }


  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-100 p-6">
      <h1 className="text-2xl font-bold text-gray-800">{status}</h1>
      <Webcam
        ref={webcamRef}
        className="rounded-xl border shadow-lg"
        audio={false}
        mirrored={true}
        screenshotFormat="image/jpeg"
        width={320}
      />
      <div className="text-green-700 font-semibold">{message}</div>
    </div>
  );
}
