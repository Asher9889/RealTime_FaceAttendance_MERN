import { Socket } from "socket.io";
import { decodeBase64Image, detectFaces } from "../utils/helpers";
import { cosineSimilarity, workerPool } from "../utils";
import fs from "fs";
import { loadKnownFacesFromDB } from "../db";
import { IfaceBoxes } from "../utils/workers/faceWorker";
import * as faceapi from "@vladmandic/face-api";

interface IKnownFace {
  name: string;
  embedding: number[]; // or Float32Array
}

export async function run(socket: Socket, base64Image: string) {
  try {
    const buffer = decodeBase64Image(base64Image);
    if (!buffer) return;

    const knownFaceData: IKnownFace[] = await loadKnownFacesFromDB() || []; // [{ name, embadding }]

    workerPool.addJob(buffer, socket.id, (faceBoxes: IfaceBoxes[]) => {
      // if (faceBoxes.length === 0 || knownFaceData?.length === 0 || !knownFaceData ) return;

      const labeledFaces = faceBoxes.map((faceBox) => {
        let bestMatchName = "Unknown";
        let bestDistance = Infinity;

        knownFaceData.forEach((known) => {
          if (!known.embedding) return;
        
          const knownVector = new Float32Array(known.embedding);
          const inputVector = new Float32Array(faceBox.descriptor || []);
        
          if (knownVector.length !== 128 || inputVector.length !== 128) return;
        
          const distance = faceapi.euclideanDistance(inputVector, knownVector);
        
          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatchName = known.name;
          }
        });

        // Reject if distance is too high (i.e., not similar enough)
        if (bestDistance > 0.45) {
          bestMatchName = "Unknown";
        }

        return {
          ...faceBox,
          name: bestMatchName,
          score: bestDistance,
        };
      });
      // console.log("labeledFaces: ", labeledFaces)
      socket.emit("face-boxes", labeledFaces); 
    });

  } catch (err) {
    console.error("run() error:", err);
  }
}



// export async function run(socket: Socket, base64Image: string) {
//   try {
//     const buffer = decodeBase64Image(base64Image); // You already have this utility
//     if (!buffer) return;

//     const worker = new Worker(path.join(__dirname, "../utils/workers/faceWorker.js"));

//     // sending buffer data to worker.
//     worker.postMessage({ buffer });

//     // listen the event, .once fn creats a new event.
//     worker.once("message", (faceBoxes) => {
//       console.log("👨‍🏭 Worker responded with boxes:", faceBoxes);
//       socket.emit("face-boxes", faceBoxes);
//       worker.terminate(); // Terminate after response
//     });

//     // when error occurs
//     worker.once("error", (err) => {
//       console.error("❌ Worker error:", err);
//       worker.terminate();
//     });


//     worker.once("exit", (code) => {
//       if (code !== 0) {
//         console.error("❗Worker stopped with exit code", code);
//       }
//     });
//   } catch (error) {
//     console.error("Error running worker:", error);
//   }
// }






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