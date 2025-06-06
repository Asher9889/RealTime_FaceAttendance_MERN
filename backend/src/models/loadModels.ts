import path from "path";
import canvas from "canvas";
import * as faceapi from '@vladmandic/face-api';


export default  async function loadModels() {
  try {
    const { Canvas, Image, ImageData } = canvas;
    faceapi.env.monkeyPatch({
      Canvas: Canvas as unknown as typeof HTMLCanvasElement,
      Image: Image as unknown as typeof HTMLImageElement,
      ImageData: ImageData as unknown as typeof globalThis.ImageData,
    });
  
    const faceDetectionPath = path.join(__dirname, "../utils/ai_models/face_detection_model");
    const landmarkDetectionPath = path.join(__dirname, "../utils/ai_models/face_landmark_model");
    const faceRecognitionPath = path.join(__dirname, "../utils/ai_models/face_recognition_model");
  
    await faceapi.nets.ssdMobilenetv1.loadFromDisk((faceDetectionPath));
    await faceapi.nets.faceLandmark68Net.loadFromDisk(landmarkDetectionPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(faceRecognitionPath);
  
    console.log("🔄 Loading models...");
    console.log("✅ All face-api models loaded");
  } catch (error) {
    console.log(error);
  }
}