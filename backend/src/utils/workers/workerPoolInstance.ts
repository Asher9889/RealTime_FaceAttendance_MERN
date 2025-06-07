import { WorkerPool } from "./workerPool";

const workerPool = new WorkerPool(1);  // 2 workers, adjust based on your CPU cores

export default workerPool;
