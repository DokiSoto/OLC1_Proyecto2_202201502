import { app } from './app.js';
const port = Number(process.env.PORT ?? 8080);
app.listen(port, '127.0.0.1', () => console.log(`AutoInfra backend: http://localhost:${port}`));