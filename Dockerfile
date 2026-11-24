# Production Dockerfile for MU Legends Online (Node 22 + Built-in SQLite + Vite SPA + WebSocket)
FROM node:22-slim

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy project source and build frontend bundle
COPY . .
RUN npm run build

# Ensure persistent SQLite data directory exists
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/mu_continent.sqlite

EXPOSE 3000

CMD ["npm", "start"]
