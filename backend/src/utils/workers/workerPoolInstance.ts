import { WorkerPool } from "./workerPool";

const workerPool = new WorkerPool(2);  // 2 workers, adjust based on your CPU cores

export default workerPool;
