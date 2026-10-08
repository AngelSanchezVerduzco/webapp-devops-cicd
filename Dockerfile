FROM node:20-bookworm-slim

WORKDIR /app

# Dependencias nativas para better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js app.js db.js socket.js ./
RUN mkdir -p /app/data/backups \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

ENV PORT=80
ENV SOCKET_PORT=6061
ENV DATA_DIR=/app/data
ENV NODE_ENV=production

EXPOSE 80
EXPOSE 6061

CMD ["npm", "start"]
