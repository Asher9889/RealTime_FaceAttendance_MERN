## Flow of the Software

[ User Camera Input ]
         ↓
  [Frontend: React/Webcam]
         ↓
   →→ POST image/frame →→
         ↓
[Backend: Node.js Server]
         ↓
  [ONNX Runtime Pipeline]
     ├─ Load RetinaFace model (.onnx)
     ├─ Detect face(s)
     ├─ Crop & Align face
     ├─ Load ArcFace model (.onnx)
     ├─ Generate 512-d embedding
         ↓
[ Compare with embeddings in DB ]
         ↓
       Match Found? → Yes/No
         ↓
[ Send Response to Frontend ]
         ↓
[ UI shows Match Name / Confidence ]


<img src="./src/images/image.png" alt="Flow of the Software" width="400"/>


## New updated flow

[ User Camera Input ]
         ↓
  [Frontend: React/Webcam]
         ↓
  →→ Open Socket.io connection →→
         ↓
  →→ Stream image frames via Socket.io →→
         ↓
[Backend: Node.js Server with Socket.io Server]
         ↓
  [ONNX Runtime Pipeline]
     ├─ Load RetinaFace model (.onnx)
     ├─ Detect face(s)
     ├─ Crop & Align face (sharp)
     ├─ Load ArcFace model (.onnx)
     ├─ Generate 512-d embedding
         ↓
[ Compare with embeddings in DB ]
         ↓
       Match Found? → Yes/No
         ↓
[ Send recognition results back to frontend via WebSocket ]
         ↓
[ Frontend UI updates instantly with Match Name / Confidence ]   
