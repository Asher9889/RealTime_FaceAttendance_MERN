import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  upgrade: false,
});

interface IFaceReacts {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState("Connecting... 🔄");
  const [message, setMessage] = useState("");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);

  const faceRectsRef = useRef<IFaceReacts[]>([]);
  const prevRectsRef = useRef<IFaceReacts[]>([]);
  const sending = useRef(false);

  // Get video devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      setSelectedDeviceId(videoInputs[0]?.deviceId);
    });
  }, []);

  // Socket logic
  useEffect(() => {
    socket.on("connect", () => setStatus("Connected ✅"));
    socket.on("disconnect", () => setStatus("Disconnected ❌"));
    socket.on("welcome", (data) => setMessage(data));

    socket.on("face-boxes", (boxes: IFaceReacts[]) => {
      if (hasSignificantChange(prevRectsRef.current, boxes)) {
        prevRectsRef.current = boxes;
        faceRectsRef.current = boxes;
      }
      sending.current = false;
    });

    const captureInterval = setInterval(() => {
      if (!sending.current) emitImage();
    }, 300);

    return () => {
      clearInterval(captureInterval);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("welcome");
      socket.off("face-boxes");
    };
  }, []);

  // Draw loop with requestAnimationFrame
  useEffect(() => {
    let frameId: number;

    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const video = webcamRef.current?.video;

      if (!canvas || !ctx || !video) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      faceRectsRef.current.forEach((face) => {
        const { x, y, width, height, score } = face;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.strokeStyle = "green";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "green";
        ctx.font = "14px Arial";
        ctx.fillText(`Score: ${score.toFixed(2)}`, x, y - 5);
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Send image to backend
  function emitImage() {
    if (!webcamRef.current) return;
    const image = webcamRef.current.getScreenshot();
    if (image) {
      sending.current = true;
      socket.emit("frame", { image });
    }
  }

  // Compare previous and current boxes
  function hasSignificantChange(prev: IFaceReacts[], next: IFaceReacts[]) {
    if (prev.length !== next.length) return true;
    return next.some((curr, i) => {
      const prevFace = prev[i];
      return (
        Math.abs(prevFace.x - curr.x) > 5 ||
        Math.abs(prevFace.y - curr.y) > 5 ||
        Math.abs(prevFace.width - curr.width) > 5 ||
        Math.abs(prevFace.height - curr.height) > 5
      );
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-100 p-6 relative">
      <h1 className="text-2xl font-bold text-gray-800">{status}</h1>

      <div className="flex items-center gap-4">
        <label className="font-semibold text-gray-700">Select Camera:</label>
        <select
          className="border p-2 rounded"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
        >
          {videoDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId}`}
            </option>
          ))}
        </select>
      </div>

      <div className="relative" style={{ width: 640, height: 480 }}>
        <Webcam
          ref={webcamRef}
          mirrored
          audio={false}
          screenshotFormat="image/jpeg"
          className="rounded-xl border shadow-lg"
          videoConstraints={{
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            width: 640,
            height: 480,
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          style={{ pointerEvents: "none", zIndex: 10 }}
        />
      </div>

      <div className="text-green-700 font-semibold">{message}</div>
    </div>
  );
}
