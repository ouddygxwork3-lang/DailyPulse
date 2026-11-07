FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
COPY server ./server
COPY tests ./tests

RUN npm run build && mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Bangkok
ENV DB_PATH=/app/data/daypulse.db

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
