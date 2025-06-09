// faceWorker.ts
import { parentPort } from "worker_threads";
import * as faceapi from "@vladmandic/face-api";
import { createCanvas, Image, Canvas, ImageData, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import sharp = require("sharp");



async function loadModels() {

  faceapi.env.monkeyPatch({
    Canvas: Canvas as unknown as typeof HTMLCanvasElement,
    Image: Image as unknown as typeof HTMLImageElement,
    ImageData: ImageData as unknown as typeof globalThis.ImageData,
  });

  const faceDetectionPath = path.join(__dirname, "../ai_models/face_detection_model");
  const landmarkDetectionPath = path.join(__dirname, "../ai_models/face_landmark_model");
  const faceRecognitionPath = path.join(__dirname, "../ai_models/face_recognition_model");

  await faceapi.nets.ssdMobilenetv1.loadFromDisk(faceDetectionPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(landmarkDetectionPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(faceRecognitionPath);
  console.log("✅ All face-api models loaded");
}

export async function bufferToCanvas(buffer: Buffer) {
  const jpegBuffer = await sharp(buffer).jpeg().toBuffer(); // or .png() if needed

  const img = new Image();
  img.src = jpegBuffer;

  if (!img.width || !img.height) {
    throw new Error("Image has invalid dimensions");
  }

  const cnv = createCanvas(img.width, img.height);
  const ctx = cnv.getContext("2d");
  ctx.drawImage(img, 0, 0);

  return cnv;
}

export async function bufferToImage(buffer: Buffer): Promise<faceapi.TNetInput> {
  const img = await loadImage(buffer);
  if (!img || !img.width || !img.height) {
    throw new Error("Invalid image loaded");
  }
  return img as unknown as faceapi.TNetInput;
}

async function main() {
  try {
    await loadModels();
    console.log("📦 Worker ready for messages");

    parentPort?.on("message", async ({ id, buffer }) => {

      const img = await bufferToCanvas(buffer);
      
      const detections = await faceapi
        .detectAllFaces(img as any)
        .withFaceLandmarks()
      // .withAgeAndGender();

      console.log("✅ Detection complete. Faces:", detections.length);

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

    });
  } catch (err) {
    console.error("❌ Failed to load models in worker:", err);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise rejection in worker:", reason);
});

main();
