import { defineConfig } from 'vite';
import { Worker } from 'node:worker_threads';
import path from 'node:path';

const MAX_BODY_BYTES = 1024 * 1024;

const API_ROUTES = new Set([
  'execute',
  'analyze',
  'tokens',
  'ast',
  'symbols',
  'errors',
]);

function sendJSON(response, status, data) {
  if (response.destroyed || response.writableEnded) return;

  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(data));
}

function autoInfraApi() {
  return {
    name: 'autoinfra-api',

    configureServer(server) {
      server.middlewares.use('/api', (request, response, next) => {
        const pathname = (request.url || '/').split('?')[0];
        if (request.method === 'GET' && pathname === '/health') {
          return sendJSON(response, 200, {
            success: true,
            app: 'AutoInfra',
            apiVersion: '2.0.0',
            message: 'API disponible',
          });
        }

        const route = pathname.replace(/^\/+/, '');

        // Dejar pasar las solicitudes que no son de nuestra API.
        if (request.method !== 'POST' || !API_ROUTES.has(route)) {
          return next();
        }

        let body = '';
        let tooLarge = false;

        request.on('data', (chunk) => {
          if (tooLarge) return;

          body += chunk.toString('utf8');

          if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
            tooLarge = true;

            sendJSON(response, 413, {
              success: false,
              message: 'mas de 1mb',
            });

            request.resume();
          }
        });

        request.on('error', (error) => {
          if (!tooLarge) {
            sendJSON(response, 400, {
              success: false,
              message: `Error leyendo la solicitud: ${error.message}`,
            });
          }
        });

        request.on('end', () => {
          if (tooLarge) return;

          let payload;

          try {
            payload = JSON.parse(body || '{}');
          } catch {
            return sendJSON(response, 400, {
              success: false,
              message: 'El cuerpo de la solicitud no contiene JSON válido.',
            });
          }

          if (typeof payload.source !== 'string') {
            return sendJSON(response, 400, {
              success: false,
              message: 'El campo source debe contener texto.',
            });
          }
          const workerPath = path.resolve(
            server.config.root,
            '../backend/src/api/worker.js'
          );

          const execute = !['analyze', 'tokens', 'ast'].includes(route);

          let worker;

          try {
            worker = new Worker(workerPath, {
              workerData: {
                source: payload.source,
                execute,
              },
            });
          } catch (error) {
            return sendJSON(response, 500, {
              success: false,
              message: `No se pudo iniciar el motor AutoInfra: ${error.message}`,
            });
          }

          let finished = false;
          let timer;

          const finish = (status, data) => {
            if (finished) return;

            finished = true;
            clearTimeout(timer);
            worker.terminate().catch(() => {});

            sendJSON(response, status, data);
          };
          timer = setTimeout(() => {
            finish(408, {
              success: false,
              message:
                'La solicitud superó 30 segundos. Revisa los ciclos infinitos o la recursión.',
            });
          }, 30000);

          worker.once('message', (result) => {
            finish(200, result);
          });

          worker.once('error', (error) => {
            finish(500, {
              success: false,
              message: `Error interno del motor: ${error.message}`,
            });
          });

          worker.once('exit', (code) => {
            if (!finished) {
              finish(500, {
                success: false,
                message: `El motor terminó sin resultado (código ${code}).`,
              });
            }
          });

          request.once('aborted', () => {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              worker.terminate().catch(() => {});
            }
          });

          response.once('close', () => {
            if (!finished && !response.writableEnded) {
              finished = true;
              clearTimeout(timer);
              worker.terminate().catch(() => {});
            }
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [autoInfraApi()],
});