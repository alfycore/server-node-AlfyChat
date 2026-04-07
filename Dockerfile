FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lockb* ./
COPY prisma/ ./prisma/
RUN bun install
RUN bunx prisma generate

COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

# ── Production stage ──
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
COPY prisma/ ./prisma/
RUN bun install --production
RUN bunx prisma generate

COPY --from=builder /app/dist ./dist

# Data volume for DB + uploads
VOLUME /data
ENV DATA_DIR=/data
ENV PORT=4100

EXPOSE 4100

CMD ["bun", "run", "start"]
