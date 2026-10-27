import express from 'express';
import cors from 'cors';
import { Worker } from 'node:worker_threads';

export const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (request, response) => response.json({ success: true, message: 'AutoInfra esta disponible' }));

function processSource(request, response) {
  const source = request.body?.source;
  if (typeof source !== 'string') return response.status(400).json({ success: false, message: 'el source debe ser un string.' });
  const execute = !['/api/analyze', '/api/tokens', '/api/ast'].includes(request.path);
  const worker = new Worker(new URL('./worker.js', import.meta.url), { workerData: { source, execute } });
  let finished = false;
  const finish = (status, data) => {
    if (finished) return;
    finished = true; clearTimeout(timer); worker.terminate();
    if (!response.destroyed) response.status(status).json(data);
  };
  const timer = setTimeout(() => finish(408, { success: false,
    message: 'La solicitud superó 30 segundos. Revisa ciclos infinitos o recursión sin caso base.' }), 30000);
  worker.once('message', result => finish(200, result));
  worker.once('error', error => finish(500, { success: false, message: error.message }));
  worker.once('exit', code => {
    if (!finished) finish(500, { success: false, message: `El proceso terminó sin resultado (${code}).` });
  });
  response.once('close', () => { if (!finished) { finished = true; clearTimeout(timer); worker.terminate(); } });
}
for (const route of ['execute', 'analyze', 'tokens', 'ast', 'symbols', 'errors']) app.post(`/api/${route}`, processSource);
app.use((error, request, response, next) => {
  response.status(error.status ?? 500).json({ success: false, message: error.status === 413 ? 'Archivo demasiado grande (máximo 1 MB).' : 'Solicitud JSON inválida.' });
});