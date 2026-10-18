import { parentPort, workerData } from 'node:worker_threads';
import { executeSource } from '../interpreter/Engine.js';
parentPort.postMessage(executeSource(workerData.source, workerData.execute));