import mongoose, { Document } from "mongoose";

export interface IFace extends Document  {
    name: string;
    embedding: number[]; // 128 or 512-dim vector depending on model
    imageUrl?: string;   // Optional: reference to stored image
    label?: string;      // Optional: employee, guest, etc.
    verified: boolean;   // Whether face has been verified by human
    createdAt: Date;
    updatedAt: Date;
  }

const faceSchema = new mongoose.Schema<IFace>({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    embedding: {
        type: [Number],
        required: true,
    },
    imageUrl: {
        type: String,
        default: '',
    },
    label: {
        type: String,
        enum: ['employee', 'guest', 'vip', 'unknown'],
        default: 'unknown',
    },
    verified: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true })

const Face = mongoose.model<IFace>("Face", faceSchema);

export default Face;