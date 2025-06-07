import { Socket } from "socket.io";
import { decodeBase64Image, detectFaces } from "../utils/helpers";
import { workerPool } from "../utils";
import fs from "fs";



export async function run(socket: Socket, base64Image: string) {
  try {
    const buffer = decodeBase64Image(base64Image);
    
    if (!buffer) return;
    
    fs.writeFileSync("temp1.jpg", buffer);
    // console.log("buffer from base64Image", buffer)

     // Add the job to the pool with callback to emit results
     workerPool.addJob(buffer, socket.id, (faceBoxes) => {
      // console.log("Worker pool starts")
      socket.emit("face-boxes", faceBoxes);
      // console.log("face-boxes emitted")
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