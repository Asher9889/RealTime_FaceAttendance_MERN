import { Socket } from "socket.io";
// import { cropFace, generateEmbedding } from "../utils/helpers/image.helper";
import { decodeBase64Image, detectFaces, cropFace, generateEmbedding } from "../utils/helpers/index";

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
    const alignedFace = await cropFace(imageBuffer, faceBoxes[0]);
    console.log("alignedFace: ", alignedFace)
    if (!Buffer.isBuffer(alignedFace?.faceBuffer)) {
        return socket.emit('recognition-result', {
            success: false,
            message: 'Face alignment failed',
            data: null
        });
    }
    socket.emit('recognition-result', {
        success: true,
        message: 'Face alignment success',
        data: alignedFace
    });




    // Generate embedding
    // const embedding = await generateEmbedding(alignedFace);
    // console.log("embedding: ",embedding)  

    // // Compare embedding with DB
    // const match = await findMatchFromDB(embedding);

    // // Send result back
    // socket.emit('recognition-result', match);
}