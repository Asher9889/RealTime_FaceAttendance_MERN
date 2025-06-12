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
  name: string;
}

export default function App() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState("Connecting... 🔄");
  const [message, setMessage] = useState("");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");

  const faceRectsRef = useRef<IFaceReacts[]>([]);
  const prevRectsRef = useRef<IFaceReacts[]>([]);
  const sending = useRef(false);

  // 🔍 Get list of video input devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      setSelectedDeviceId(videoInputs[0]?.deviceId);
    });
  }, []);

  // 🔌 WebSocket logic
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

  // 🎨 Draw loop
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
        const { x, y, width, height, score, name } = face;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.strokeStyle = "green";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Set common styles for text
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.textBaseline = "top";

        // Draw name above the box
        ctx.fillText(`Name: ${name}`, x, y - 20);

        // Draw score just above the box
        ctx.fillText(`Score: ${score.toFixed(2)}`, x, y - 5);
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // 📤 Emit frame to backend via socket
  function emitImage() {
    if (!webcamRef.current) return;
    const image = webcamRef.current.getScreenshot();
    if (image) {
      sending.current = true;
      socket.emit("frame", { image });
    }
  }

  // 📸 Capture photo manually for API
  async function handleCapturePhoto() {
    const image = webcamRef.current?.getScreenshot();
    if (!image) return;

    if (!name.trim()) {
      alert("Please enter a name before capturing.");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/v1/face/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: image,
          name: name.trim()
        }),
      });

      const result = await response.json();
      alert("Photo sent! ✅\nResponse: " + JSON.stringify(result));
    } catch (err) {
      console.error("Error sending captured photo:", err);
      alert("❌ Failed to send photo");
    }
  }

  // 🔁 Check if face has significantly moved
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

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        className="border px-4 py-2 rounded w-64"
      />

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

      <button
        onClick={handleCapturePhoto}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
      >
        📸 Capture Photo
      </button>

      <div className="text-green-700 font-semibold">{message}</div>
    </div>
  );
}
