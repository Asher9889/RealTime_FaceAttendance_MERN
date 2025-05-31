import { cropFace } from "../utils/helpers/image.helper";
import { decodeBase64Image, detectFaces } from "../utils/helpers/index";

export async function  processImageFrame(base64Image:string){
  
    const imageBuffer = decodeBase64Image(base64Image); // returns a Uint8Array or Buffe
    if(!imageBuffer) return;
    // Detect face
    const faceBoxes = await detectFaces(imageBuffer);
    if (!faceBoxes) return;
    console.log("faceBoxes",faceBoxes)
    // For simplicity, assume first face only
    const alignedFace = await cropFace(imageBuffer, faceBoxes[0]);

    console.log("alignedFace", alignedFace)
  
    // // Generate embedding
    // const embedding = await generateEmbedding(alignedFace);
  
    // // Compare embedding with DB
    // const match = await findMatchFromDB(embedding);
  
    // // Send result back
    // socket.emit('recognition-result', match);
}