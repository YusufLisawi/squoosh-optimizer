FROM node:20-slim

WORKDIR /app

COPY package.json bun.lock* package-lock.json* ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
