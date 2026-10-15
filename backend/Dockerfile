FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --omit=dev --no-audit --no-fund
COPY backend/src backend/src
USER node
EXPOSE 3000
CMD ["node", "backend/src/server.js"]
