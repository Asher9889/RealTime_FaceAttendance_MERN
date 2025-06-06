import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  upgrade: false,
});

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState("Connecting... 🔄");
  const [message, setMessage] = useState("");
  const [faceRects, setFaceRects] = useState<
    { left?: number; top?: number; x?: number; y?: number; width: number; height: number; score?: number }[]
  >([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);

  // Load available cameras
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      setVideoDevices(videoInputs);
      if (videoInputs.length > 1) {
        setSelectedDeviceId(videoInputs[1].deviceId);
      } else if (videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    });
  }, []);

  // Handle WebSocket events
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

    socket.on("face-boxes", (faceBoxes) => {
      if (Array.isArray(faceBoxes)) {
        console.log("📦 Face boxes received:", faceBoxes);
        setFaceRects(faceBoxes);
      } else {
        setFaceRects([]);
      }
    });

    const intervalId = setInterval(() => {
      emitImage();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Draw green circles on canvas
  useEffect(() => {
    if (!canvasRef.current || !webcamRef.current?.video) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const video = webcamRef.current.video;

    if (!ctx || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    faceRects.forEach((face) => {
      const x = face.x ?? face.left ?? 0;
      const y = face.y ?? face.top ?? 0;
      const width = face.width;
      const height = face.height;

      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const radius = Math.max(width, height) / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "green";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (face.score !== undefined) {
        ctx.font = "14px Arial";
        ctx.fillStyle = "green";
        ctx.fillText(`Score: ${face.score.toFixed(2)}`, x, y - 5);
      }
    });
  }, [faceRects]);

  function emitImage() {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    socket.emit("frame", { image: imageSrc });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-100 p-6 relative">
      <h1 className="text-2xl font-bold text-gray-800">{status}</h1>

      <div className="flex items-center gap-4">
        <label htmlFor="cameraSelect" className="font-semibold text-gray-700">
          Select Camera:
        </label>
        <select
          id="cameraSelect"
          className="border p-2 rounded"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
        >
          {videoDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative" style={{ width: 640, height: 480 }}>
        <Webcam
          ref={webcamRef}
          className="rounded-xl border shadow-lg"
          audio={false}
          mirrored={true}
          screenshotFormat="image/jpeg"
          width={640}
          height={480}
          videoConstraints={{
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: 640,
            height: 480,
          }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute top-0 left-0"
          style={{
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      </div>

      <div className="text-green-700 font-semibold">{message}</div>
    </div>
  );
}
