// File: workerPool.ts
import { Worker } from "worker_threads";
import path from "path";

interface WorkerJob {
    id: string;
    buffer: Buffer;
    socketId: string;
    callback: (boxes: any[]) => void;
}

export class WorkerPool {
    private workers: Worker[] = [];
    private jobQueue: WorkerJob[] = [];
    private busyWorkers: Set<Worker> = new Set();
    private readonly numWorkers: number;

    constructor(numWorkers = 2) {
        this.numWorkers = numWorkers;
        this.init();
    }

    private init() {
        for (let i = 0; i < this.numWorkers; i++) {
            const workerPath = path.join(__dirname, "faceWorker.js")
            const worker = new Worker(workerPath);

            worker.on("message", ({ id, result }) => {
                const job = this.jobQueue.find((j) => j.id === id);
                if (job) {
                    job.callback(result);
                    this.jobQueue = this.jobQueue.filter((j) => j.id !== id);
                }
                this.busyWorkers.delete(worker);
                this.checkQueue();
            });

            worker.on("error", (err) => {
                console.error("❌ Worker error:", err);
                this.busyWorkers.delete(worker);
                this.checkQueue();
            });

            this.workers.push(worker);
        }
    }

    addJob(buffer: Buffer, socketId: string, callback: (boxes: any[]) => void) {
        const id = `${socketId}-${Date.now()}`;
        const job: WorkerJob = { id, buffer, socketId, callback };
        this.jobQueue.push(job);
        this.checkQueue();
    }

    private checkQueue() {
        for (const worker of this.workers) {
            if (this.busyWorkers.has(worker)) continue;
            const job = this.jobQueue[0];
            if (!job) return;
            this.busyWorkers.add(worker);
            worker.postMessage({ id: job.id, buffer: job.buffer });
        }
    }
}
