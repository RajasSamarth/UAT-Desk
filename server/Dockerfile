FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /data/storage

EXPOSE 3000
CMD ["sh", "-c", "node src/migrate.js && node src/index.js"]
