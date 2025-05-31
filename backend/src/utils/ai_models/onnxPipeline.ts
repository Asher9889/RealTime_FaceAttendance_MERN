// src/facePipeline.js
import * as ort from 'onnxruntime-node';
import path from 'node:path';

let retina;
let arc;
export default async function loadOnnxModels() {
    const EP = ['CPUExecutionProvider'];            // or 'CUDAExecutionProvider'
    retina = await ort.InferenceSession.create(
        path.resolve('models/retinaface.onnx'), { executionProviders: EP }
    );
    arc = await ort.InferenceSession.create(
        path.resolve('models/arcface.onnx'), { executionProviders: EP }
    );
}

export const faceModels = {
    retina, arc
}
