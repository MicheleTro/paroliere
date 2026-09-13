import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();

app.listen({ port: config.PORT, host: '0.0.0.0' }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
