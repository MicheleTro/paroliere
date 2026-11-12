# Immagine unica di Paroliere: il server Fastify serve anche il frontend compilato (API sotto /api).
# Il database NON è qui: è il Postgres condiviso di whoru (decisione #25), indicato da DATABASE_URL.

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@12.4.1
COPY . .
RUN pnpm install --frozen-lockfile
# prebuild copia il dizionario da dist/dictionary (versionato nel repo) dentro il frontend
RUN pnpm --filter @paroliere/web run build

FROM node:22-bookworm-slim AS run
ENV NODE_ENV=production
WORKDIR /app
RUN npm install -g pnpm@12.4.1
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Applica le migrazioni e avvia il server
CMD ["pnpm", "--filter", "@paroliere/server", "run", "start:prod"]
