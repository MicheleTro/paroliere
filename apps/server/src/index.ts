import { buildApp } from './app.js';
import { config } from './config.js';
import { regradeLegacyDuelPlays } from './plays/legacy.js';

const app = buildApp();

// Prima di accettare richieste: le parole delle sfide della versione precedente (una volta sola, poi non fa nulla)
regradeLegacyDuelPlays((message) => app.log.info(message))
  .then(() => app.listen({ port: config.PORT, host: '0.0.0.0' }))
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
