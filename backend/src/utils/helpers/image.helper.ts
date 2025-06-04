import * as ort from 'onnxruntime-node';
import { getFaceModels } from '../ai_models/onnxPipeline';
import sharp from 'sharp';
import cv from 'opencv4nodejs-prebuilt-install';
import path from "path";
import fs from "fs";



type Box = {
  score: number;
  bbox: [number, number, number, number]; // x1, y1, x2, y2
  landmarks: number[]; // [x1, y1, x2, y2, ..., x5, y5]
};


export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}



export async function detectFaces(imageBuffer: Buffer): Promise<Box[]> {
  try {
    const mat = cv.imdecode(imageBuffer);
    const resizedMat = mat.resizeToMax(640);
    const rgbMat = resizedMat.cvtColor(cv.COLOR_BGR2RGB);

    const rows = rgbMat.rows;
    const cols = rgbMat.cols;

    // Convert image to Float32Array in CHW format
    const rgbData = rgbMat.getData();
    const inputData = new Float32Array(3 * rows * cols);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 3;
        const r = rgbData[idx];
        const g = rgbData[idx + 1];
        const b = rgbData[idx + 2];

        const pixelIndex = y * cols + x;
        inputData[0 * rows * cols + pixelIndex] = r / 255;
        inputData[1 * rows * cols + pixelIndex] = g / 255;
        inputData[2 * rows * cols + pixelIndex] = b / 255;
      }
    }

    const inputTensor = new ort.Tensor('float32', inputData, [1, 3, rows, cols]);

    const { retina } = await getFaceModels();
    const results = await retina.run({ input: inputTensor });

    const confidence = results['confidence'].data as Float32Array;
    const bbox = results['bbox'].data as Float32Array;
    const landmark = results['landmark'].data as Float32Array;

    const numAnchors = confidence.length / 2;
    const threshold = 0.9;
    const output: Box[] = [];

    for (let i = 0; i < numAnchors; i++) {
      const score = confidence[i * 2]; // correct: face prob at index 0

      if (score > threshold) {
        let [x1, y1, x2, y2] = bbox.slice(i * 4, i * 4 + 4);

        // Handle normalized coordinates (some might be < 0)
        x1 = Math.max(0, Math.min(Math.round(x1 * cols), cols));
        y1 = Math.max(0, Math.min(Math.round(y1 * rows), rows));
        x2 = Math.max(0, Math.min(Math.round(x2 * cols), cols));
        y2 = Math.max(0, Math.min(Math.round(y2 * rows), rows));

        const width = x2 - x1;
        const height = y2 - y1;

        if (width <= 0 || height <= 0) continue;

        const faceBox: [number, number, number, number] = [x1, y1, x2, y2];
        const faceLandmarks = Array.from(landmark.slice(i * 10, (i + 1) * 10));

        output.push({ score, bbox: faceBox, landmarks: faceLandmarks });

        const faceRegion = resizedMat.getRegion(new cv.Rect(x1, y1, width, height));
        const faceJPG = cv.imencode('.jpg', faceRegion);

        const outputDir = path.join(__dirname, '../faces');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputPath = path.join(outputDir, `face_${i}.jpg`);
        fs.writeFileSync(outputPath, faceJPG);

        console.log(`✅ Face saved: ${outputPath}`);
      }
    }

    return output;
  } catch (err) {
    console.error('Face detection error:', err);
    return [];
  }
}

/**
 * Decodes a base64 image string into a Buffer
 * @param {string} base64Image - The base64 image string (data:image/jpeg;base64,...)
 * @returns {Buffer}
 */
export function decodeBase64Image(base64Image: string): Buffer | null {
  try {
    // Remove "data:image/jpeg;base64," or similar prefix
    const matches = base64Image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 image string');
    }

    const base64Data = matches[2];
    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    console.log(error);
    return null;
  }
}


export async function cropFace(
  imageBuffer: Buffer,
  faceBox: any
): Promise<{
  faceBuffer: Buffer;
  faceRect: { left: number; top: number; width: number; height: number };
} | null> {
  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width!;
  const originalHeight = metadata.height!;

  const modelInputSize = 320;

  const scaleX = originalWidth / modelInputSize;
  const scaleY = originalHeight / modelInputSize;

  const [x1, y1, x2, y2] = faceBox;

  // Scale box back to original image dimensions
  const left = Math.max(0, Math.min(x1, x2) * scaleX);
  const right = Math.min(originalWidth, Math.max(x1, x2) * scaleX);
  const top = Math.max(0, Math.min(y1, y2) * scaleY);
  const bottom = Math.min(originalHeight, Math.max(y1, y2) * scaleY);

  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    console.warn(`Invalid crop area. Width: ${width}, Height: ${height}`);
    return null;
  }

  const croppedFace = await sharp(imageBuffer)
    .extract({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    })
    .resize(112, 112) // Normalize to standard size
    .removeAlpha()
    .toBuffer();

  return {
    faceBuffer: croppedFace,
    faceRect: {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    },
  };
}





export async function generateEmbedding(buffer: Buffer): Promise<Float32Array> {

  const { data, info } = await sharp(buffer)
    .resize(112, 112)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log("data==", data, info)

  const chw: number[][] = [[], [], []];

  for (let i = 0; i < 112 * 112; i++) {
    chw[0].push((data[i * 3] - 127.5) / 128);
    chw[1].push((data[i * 3 + 1] - 127.5) / 128);
    chw[2].push((data[i * 3 + 2] - 127.5) / 128);
  }

  const input = new ort.Tensor('float32', new Float32Array([...chw[0], ...chw[1], ...chw[2]]), [1, 3, 112, 112]);

  const { arc } = await getFaceModels();
  const result = await arc.run({ input }); // 'input' is usually the input name
  console.log("result:", result)
  const outputKey = arc.outputNames[0];
  return result[outputKey].data as Float32Array;
}


// It is convert retina tensor to boxes of four x1, y1, x2, y2
// function parseRetinaBBoxes(bboxData: Float32Array): Box[] {
//   const boxes: Box[] = [];

//   for (let i = 0; i < bboxData.length; i += 4) {
//     const x1 = bboxData[i];
//     const y1 = bboxData[i + 1];
//     const x2 = bboxData[i + 2];
//     const y2 = bboxData[i + 3];

//     // Optional filtering (skip invalid or negative boxes)
//     if (x2 > x1 && y2 > y1 && x1 >= 0 && y1 >= 0) {
//       boxes.push({
//         x: x1,
//         y: y1,
//         width: x2 - x1,
//         height: y2 - y1,
//       });
//     }
//   }

//   return boxes;
// }




