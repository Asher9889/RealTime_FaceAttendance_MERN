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
  croppedBbox?: any;
  savedPath: string;
  qualityScore:number
};

function softmax(a: number, b: number): number {
  const expA = Math.exp(a);
  const expB = Math.exp(b);
  return expB / (expA + expB); // face probability
}

export async function detectFaces(imageBuffer: Buffer): Promise<Box[]> {
  try {
    const mat = cv.imdecode(imageBuffer);
    const originalHeight = mat.rows;
    const originalWidth = mat.cols;
    
    // Resize to model input size
    const modelSize = 224;
    const resizedMat = mat.resize(new cv.Size(modelSize, modelSize));
    const rgbMat = resizedMat.cvtColor(cv.COLOR_BGR2RGB);

    const rows = rgbMat.rows;
    const cols = rgbMat.cols;
    const rgbData = rgbMat.getData();
    const inputData = new Float32Array(3 * rows * cols);

    // HWC → CHW and normalize
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const index = (y * cols + x) * 3;
        const r = rgbData[index];
        const g = rgbData[index + 1];
        const b = rgbData[index + 2];

        const pixelIndex = y * cols + x;
        inputData[0 * rows * cols + pixelIndex] = r / 255.0;
        inputData[1 * rows * cols + pixelIndex] = g / 255.0;
        inputData[2 * rows * cols + pixelIndex] = b / 255.0;
      }
    }

    const inputTensor = new ort.Tensor("float32", inputData, [1, 3, rows, cols]);
    const { retina } = await getFaceModels();
    const results = await retina.run({ input: inputTensor });

    const confidence = results["confidence"].data as Float32Array;
    const bbox = results["bbox"].data as Float32Array;
    const landmark = results["landmark"].data as Float32Array;

    console.log('Raw confidence shape:', results["confidence"].dims);
    console.log('Raw bbox shape:', results["bbox"].dims);
    console.log('Raw landmark shape:', results["landmark"].dims);

    // CRITICAL: Use much lower threshold based on your actual scores
    const threshold = 0.0005; // Start with half your lowest score
    const output: Box[] = [];

    // Debug: Find max confidence scores
    let maxScore = 0;
    let maxScoreIndex = -1;
    const numDetections = confidence.length / 2;
    
    console.log(`Processing ${numDetections} detections`);
    
    // First pass: find the highest confidence scores
    const allScores: Array<{score: number, index: number}> = [];
    for (let i = 0; i < numDetections; i++) {
      const bgScore = confidence[i * 2 + 0];
      const faceScore = confidence[i * 2 + 1];
      
      allScores.push({score: faceScore, index: i});
      
      if (faceScore > maxScore) {
        maxScore = faceScore;
        maxScoreIndex = i;
      }
    }
    
    // Sort by confidence to see the distribution
    allScores.sort((a, b) => b.score - a.score);
    
    console.log('\n=== Top 20 Detection Scores ===');
    for (let i = 0; i < Math.min(20, allScores.length); i++) {
      console.log(`${i + 1}. Score: ${allScores[i].score.toFixed(8)} (index: ${allScores[i].index})`);
    }
    
    console.log(`\nMax face confidence: ${maxScore.toFixed(8)} at index ${maxScoreIndex}`);
    
    // Try multiple thresholds to see what works
    const testThresholds = [0.0001, 0.0003, 0.0005, 0.001, 0.002];
    
    for (const testThreshold of testThresholds) {
      const validCount = allScores.filter(s => s.score > testThreshold).length;
      console.log(`Threshold ${testThreshold}: ${validCount} valid detections`);
    }

    // Apply softmax to confidence scores (in case they're logits)
    const softmaxScores = new Float32Array(confidence.length);
    for (let i = 0; i < numDetections; i++) {
      const bgScore = confidence[i * 2 + 0];
      const faceScore = confidence[i * 2 + 1];
      
      // Apply softmax
      const expBg = Math.exp(bgScore);
      const expFace = Math.exp(faceScore);
      const sum = expBg + expFace;
      
      softmaxScores[i * 2 + 0] = expBg / sum;
      softmaxScores[i * 2 + 1] = expFace / sum;
    }
    
    console.log('\n=== After Softmax - Top 10 Scores ===');
    const softmaxScoreList: Array<{score: number, index: number}> = [];
    for (let i = 0; i < numDetections; i++) {
      softmaxScoreList.push({score: softmaxScores[i * 2 + 1], index: i});
    }
    softmaxScoreList.sort((a, b) => b.score - a.score);
    
    for (let i = 0; i < Math.min(10, softmaxScoreList.length); i++) {
      console.log(`${i + 1}. Softmax Score: ${softmaxScoreList[i].score.toFixed(6)} (index: ${softmaxScoreList[i].index})`);
    }

    // Process detections with both raw and softmax scores
    const processWithScores = (scores: Float32Array, scoreType: string, threshold: number) => {
      console.log(`\n=== Processing with ${scoreType} scores, threshold: ${threshold} ===`);
      
      for (let i = 0; i < numDetections; i++) {
        const faceScore = scores[i * 2 + 1];

        if (faceScore > threshold) {
          console.log(`${scoreType} face confidence score: ${faceScore.toFixed(8)}`);

          // Get bounding box coordinates
          let x1 = bbox[i * 4 + 0];
          let y1 = bbox[i * 4 + 1];
          let x2 = bbox[i * 4 + 2];
          let y2 = bbox[i * 4 + 3];

          console.log(`Raw bbox: [${x1}, ${y1}, ${x2}, ${y2}]`);

          // Check if coordinates are normalized or absolute
          if (Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2)) <= 1.0) {
            // Normalized coordinates
            x1 = Math.max(0, Math.round(x1 * originalWidth));
            y1 = Math.max(0, Math.round(y1 * originalHeight));
            x2 = Math.min(originalWidth, Math.round(x2 * originalWidth));
            y2 = Math.min(originalHeight, Math.round(y2 * originalHeight));
          } else {
            // Absolute coordinates - scale from model size to original
            const scaleX = originalWidth / modelSize;
            const scaleY = originalHeight / modelSize;
            
            x1 = Math.max(0, Math.round(x1 * scaleX));
            y1 = Math.max(0, Math.round(y1 * scaleY));
            x2 = Math.min(originalWidth, Math.round(x2 * scaleX));
            y2 = Math.min(originalHeight, Math.round(y2 * scaleY));
          }

          console.log(`Scaled bbox: [${x1}, ${y1}, ${x2}, ${y2}]`);

          const width = x2 - x1;
          const height = y2 - y1;

          // More lenient validation for testing
          const minFaceSize = 20; // Reduced minimum
          const maxAspectRatio = 5.0; // More lenient
          
          if (width < minFaceSize || height < minFaceSize) {
            console.log(`Face ${i} too small: ${width}x${height}`);
            continue;
          }

          const aspectRatio = Math.max(width / height, height / width);
          if (aspectRatio > maxAspectRatio) {
            console.log(`Face ${i} invalid aspect ratio: ${aspectRatio}`);
            continue;
          }

          // Add padding around face
          const padding = 0.1; // 10% padding
          const padX = Math.round(width * padding);
          const padY = Math.round(height * padding);

          const cropX1 = Math.max(0, x1 - padX);
          const cropY1 = Math.max(0, y1 - padY);
          const cropX2 = Math.min(originalWidth, x2 + padX);
          const cropY2 = Math.min(originalHeight, y2 + padY);

          const cropWidth = cropX2 - cropX1;
          const cropHeight = cropY2 - cropY1;

          if (cropWidth > 0 && cropHeight > 0) {
            try {
              const faceRegion = mat.getRegion(new cv.Rect(cropX1, cropY1, cropWidth, cropHeight));
              const standardSize = 224;
              const resizedFace = faceRegion.resize(new cv.Size(standardSize, standardSize));
              const faceJPG = cv.imencode(".jpg", resizedFace, [cv.IMWRITE_JPEG_QUALITY, 95]);

              const outputPath = path.join(__dirname, "../faces", `face_${scoreType}_${i}_${Date.now()}.jpg`);
              fs.writeFileSync(outputPath, faceJPG);

              console.log(`SUCCESS: Saved ${scoreType} face ${output.length + 1}: ${cropWidth}x${cropHeight}, score: ${faceScore.toFixed(8)}`);

              output.push({ 
                score: faceScore, 
                qualityScore: faceScore,
                bbox: [x1, y1, x2, y2], 
                croppedBbox: [cropX1, cropY1, cropX2, cropY2],
                landmarks: Array.from(landmark.slice(i * 10, (i + 1) * 10)),
                savedPath: outputPath
              });
            } catch (cropError) {
              console.error(`Error cropping face ${i}:`, cropError);
            }
          }
        }
      }
    };

    // Try with raw scores first (very low threshold)
    processWithScores(confidence, "raw", 0.0005);
    
    // If no results, try with softmax scores
    if (output.length === 0) {
      processWithScores(softmaxScores, "softmax", 0.1); // Higher threshold for softmax
    }

    // If still no results, try the highest confidence detections regardless of threshold
    if (output.length === 0) {
      console.log("\n=== No faces found with thresholds, trying top 5 detections ===");
      const topDetections = allScores.slice(0, 5);
      
      for (const detection of topDetections) {
        const i = detection.index;
        const faceScore = detection.score;
        
        console.log(`Processing top detection ${i} with score: ${faceScore.toFixed(8)}`);
        // ... (same processing logic as above)
      }
    }

    console.log(`\nFinal result: Found ${output.length} faces`);
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




