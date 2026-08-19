FROM node:20-slim

# Coolify's healthcheck runs curl inside the container against /health.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
