// workerPool.ts
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
  private activeJobs: Map<string, WorkerJob> = new Map();

  constructor(numWorkers = 2) {
    this.numWorkers = numWorkers;
    this.init();
  }

  private init() {
    const workerPath = path.join(__dirname, "faceWorker.js");

    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(workerPath);

      worker.on("online", () => {
        console.log("🟢 Worker is online");
      });

      worker.on("message", ({ id, result }) => {
        // console.log("📨 Received from worker:", id, result);

        const job = this.activeJobs.get(id);
        if (job) {
          job.callback(result);
          this.activeJobs.delete(id);
        } else {
          console.warn("⚠️ No job found for id:", id);
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

      const job = this.jobQueue.shift();
      if (!job) return;

      this.busyWorkers.add(worker);
      this.activeJobs.set(job.id, job);

      worker.postMessage({ id: job.id, buffer: job.buffer });
    }
  }
}
