import { parentPort } from "worker_threads";
import * as faceapi from "@vladmandic/face-api";
import canvas from "canvas";
import path from "path";

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({
  Canvas: Canvas as unknown as typeof HTMLCanvasElement,
  Image: Image as unknown as typeof HTMLImageElement,
  ImageData: ImageData as unknown as typeof globalThis.ImageData,
});

const faceDetectionPath = path.join(__dirname, "../ai_models/face_detection_model");
const landmarkDetectionPath = path.join(__dirname, "../ai_models/face_landmark_model");
const faceRecognitionPath = path.join(__dirname, "../ai_models/face_recognition_model");

(async () => {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(faceDetectionPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(landmarkDetectionPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(faceRecognitionPath);
  console.log("✅ Worker models loaded");
})();


if (parentPort) {
  parentPort.on("message", async (data) => {
    const { id, buffer } = data;
    const img = await canvas.loadImage(buffer);
    const detections = await faceapi.detectAllFaces(img as unknown as faceapi.TNetInput).withFaceLandmarks();

    const faceBoxes = detections.map((d) => {
      const box = d.detection.box;
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        score: d.detection.score,
      };
    });

    parentPort?.postMessage({ id, result: faceBoxes });
  })
} 
