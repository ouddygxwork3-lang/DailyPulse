FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/daypulse.db

VOLUME ["/app/data"]
EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
