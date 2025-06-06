import { Socket } from "socket.io";
import fs from "fs";
import path from "path";
import canvas from "canvas";
import * as faceapi from '@vladmandic/face-api';
import { decodeBase64Image, detectFaces } from "../utils/helpers";





export async function run(socket: Socket, base64Image: string) {
  try {

   const imgBuffer = decodeBase64Image(base64Image);
    if(!imgBuffer) return;
    const img = await canvas.loadImage(imgBuffer);
    const detections = await faceapi.detectAllFaces(img as unknown as faceapi.TNetInput).withFaceLandmarks().withFaceDescriptors();
    console.log("detections", detections);
    const faceBoxes = detections.map((d) => {
      const box = d.detection.box;
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        score: d.detection.score, // optional: detection confidence
      };
    });

    return socket.emit("face-boxes", faceBoxes)

  } catch (error) {
    console.log("error is:", error)
  }
}






// // import { cropFace, generateEmbedding } from "../utils/helpers/image.helper";
// import { decodeBase64Image, detectFaces, cropFace, generateEmbedding } from "../utils/helpers/index";

export async function processImageFrame(socket: Socket, base64Image: string) {

  const imageBuffer = decodeBase64Image(base64Image); // returns a Uint8Array or Buffe
  if (!imageBuffer) return;

  // Detect face
  const faceBoxes = await detectFaces(imageBuffer);
  // console.log("faceBoxes: ",faceBoxes)
  if (!faceBoxes || faceBoxes.length === 0) {
    return socket.emit('recognition-result', {
      success: false,
      message: 'No face detected',
    });
  }

  // Crop & align the first detected face
  // const alignedFace = await cropFace(imageBuffer, faceBoxes[0]);
  // // console.log("alignedFace: ", alignedFace)
  // if (!Buffer.isBuffer(alignedFace?.faceBuffer)) {
  //     return socket.emit('recognition-result', {
  //         success: false,
  //         message: 'Face alignment failed',
  //         data: null
  //     });
  // }
  // socket.emit('recognition-result', {
  //     success: true,
  //     message: 'Face alignment success',
  //     data: alignedFace
  // });




  // Generate embedding
  // const embedding = await generateEmbedding(alignedFace);
  // console.log("embedding: ",embedding)  

  // // Compare embedding with DB
  // const match = await findMatchFromDB(embedding);

  // // Send result back
  // socket.emit('recognition-result', match);
}