import * as ort from 'onnxruntime-node';
import { getFaceModels } from '../ai_models/onnxPipeline';
import sharp from 'sharp';


interface Box {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  score: number;
  landmarks: number[];
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}



export async function detectFaces(imageBuffer: Buffer): Promise<Box[]> {
  try {
    // Save original size for rescaling later


    // Resize + preprocess
    const { data, info } = await sharp(imageBuffer)
      .resize(320, 320, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const chwData = new Float32Array(3 * 320 * 320);
    const mean = [104, 117, 123]; // B, G, R

    for (let h = 0; h < 320; h++) {
      for (let w = 0; w < 320; w++) {
        for (let c = 0; c < 3; c++) {
          const hwcIndex = h * 320 * 3 + w * 3 + c;
          const chwIndex = c * 320 * 320 + h * 320 + w;
          chwData[chwIndex] = data[hwcIndex] - mean[2 - c]; // RGB → BGR
        }
      }
    }

    const inputTensor = new ort.Tensor('float32', chwData, [1, 3, 320, 320]);

    // console.log("input tensor: ", inputTensor)

    // Load model and run inference
    const { retina } = await getFaceModels();
    const output = await retina.run({ input: inputTensor });



    const threshold = 0.9;

    const boxes = output.bbox.data;      // [4200 x 4]
    const scores = output.confidence.data; // [4200 x 2]
    const landmarks = output.landmark.data; // [4200 x 10]

    const numAnchors = 4200;
    const results = [];

    if (
      boxes instanceof Float32Array &&
      landmarks instanceof Float32Array &&
      scores instanceof Float32Array
    ) {
      for (let i = 0; i < numAnchors; i++) {
        const score = scores[i * 2 + 1];

        if (typeof score === 'number' && score >= threshold) {
          const box = boxes.slice(i * 4, i * 4 + 4);
          const lmark = landmarks.slice(i * 10, i * 10 + 10);

          results.push({
            score,
            bbox: Array.from(box) as [number, number, number, number],
            landmarks: Array.from(lmark),
          });
        }
      }
    }



    if (results.length === 0) return [];

    return results;


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
  faceBox: Box
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

  const [x1, y1, x2, y2] = faceBox.bbox;

  // Model output is based on resized 320x320, scale back to original
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
    .resize(112, 112)
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




