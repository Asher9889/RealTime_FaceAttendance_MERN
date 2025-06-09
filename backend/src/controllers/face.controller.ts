import { Socket } from "socket.io";
import { faceService } from "../services";
import { NextFunction, Request, Response } from "express";
import * as faceapi from "@vladmandic/face-api"
import { Face, loadModels } from "../models";
import { decodeBase64Image } from "../utils/helpers";
import { bufferToCanvas } from "../utils/workers/faceWorker";

export async function onFrame(socket: Socket,
  data: { image: string }): Promise<void> {
  try {
    // console.log(" i am executed")
    const result = await faceService.run(socket, data.image)

  } catch (error) {

  }
}

export async function upload(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  try {
    const { image, name } = req.body;
    if (!image || !name) return res.status(400).json({ error: "Missing image or name" });

    await loadModels();
    const buffer = decodeBase64Image(image);
    if (!buffer) return;

    const img = await bufferToCanvas(buffer);

    const detection = await faceapi
      .detectSingleFace(img as any)
      .withFaceLandmarks()
      .withFaceDescriptor();

    console.log("detection", detection);

    if (!detection) {
      return res.status(404).json({ error: "No face detected" });
    }

    const descriptor = Array.from(detection.descriptor); // Float32Array → number[]

    const newFace = new Face({ name, embedding: descriptor });
    await newFace.save();

    return res.status(200).json({ message: "Face saved successfully", id: newFace._id });
  } catch (err: any) {
    console.error("Face API error:", err);
    res.status(500).json({ error: err.message });
  }

}