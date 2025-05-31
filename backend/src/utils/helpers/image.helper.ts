import * as ort from 'onnxruntime-node';
import { getFaceModels } from '../ai_models/onnxPipeline';
import sharp from 'sharp';

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

export async function detectFaces(imageBuffer: Buffer) {

    const resized = await sharp(imageBuffer)
        .resize(640, 480) // Adjust based on model expected size
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { data, info } = resized; // data: Buffer, info: { width, height, channels }

    // Step 2: Convert Buffer (HWC) to Float32Array (CHW)
    const chw = new Float32Array(info.width * info.height * info.channels);
    let ptr = 0;
    for (let c = 0; c < 3; c++) {
        for (let i = 0; i < info.width * info.height; i++) {
            chw[ptr++] = data[i * 3 + c] / 255.0;
        }
    }


    const inputTensor = new ort.Tensor('float32', chw, [1, 3, info.height, info.width]);

    const { retina } = await getFaceModels();
    const result = await retina.run({ input: inputTensor });


    // Assuming output is a tensor with shape [N, 4] -> [x1, y1, x2, y2]
    const boxesTensor = result['bbox']; // OR change key if needed
    if (!boxesTensor || !boxesTensor.dims || !boxesTensor.data) {
        console.error("Model did not return valid 'boxes'");
        return;
    }

    const boxCount = boxesTensor.dims[0]; // N
    const boxes: { x1: number, y1: number, x2: number, y2: number }[] = [];

    for (let i = 0; i < boxCount; i++) {
        const idx = i * 4;
        const x1 = Number(boxesTensor.data[idx]);
        const y1 = Number(boxesTensor.data[idx + 1]);
        const x2 = Number(boxesTensor.data[idx + 2]);
        const y2 = Number(boxesTensor.data[idx + 3]);
        boxes.push({ x1, y1, x2, y2 });
    }

    return boxes;
}

export async function cropFace(imageBuffer: Buffer, bbox: any) {
    // Use sharp / jimp to crop face from buffer
    const cropped = await sharp(imageBuffer).extract({
        left: bbox[0], top: bbox[1],
        width: bbox[2] - bbox[0], height: bbox[3] - bbox[1]
    }).resize(112, 112).toBuffer();

    return cropped;
}