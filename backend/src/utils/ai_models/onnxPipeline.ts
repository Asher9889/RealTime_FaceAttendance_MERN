// src/facePipeline.js
import * as ort from 'onnxruntime-node';
import path from 'node:path';


let retina: ort.InferenceSession | null = null;
let arc: ort.InferenceSession | null = null;


export default async function loadOnnxModels() {

    console.log("path", path.resolve())
    // const EP = ['CPUExecutionProvider'];            // or 'CUDAExecutionProvider'
    const EP = ['cpu']; // or ['CPUExecutionProvider'] if supported

    if (!retina) {
        retina = await ort.InferenceSession.create(
            path.resolve(__dirname, 'retinaface.onnx'),
            { executionProviders: EP }
        );
    }
    if (!arc) {
        arc = await ort.InferenceSession.create(
            path.resolve(__dirname, 'arcface.onnx'),
            { executionProviders: EP }
        );
    }
}



export async function getFaceModels(): Promise<{ retina: ort.InferenceSession; arc: ort.InferenceSession }> {
    if (!retina || !arc) {
      await loadOnnxModels();
    }
  
    if (!retina || !arc) {
      throw new Error('Failed to load one or more ONNX models');
    }
  
    return { retina, arc };
  }
