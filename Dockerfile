FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma/ ./prisma/
RUN npm install
RUN npx prisma generate

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production stage ──
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma/ ./prisma/
RUN npm install --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Data volume for DB + uploads
VOLUME /data
ENV DATA_DIR=/data
ENV PORT=4100

EXPOSE 4100

CMD ["npm", "start"]
