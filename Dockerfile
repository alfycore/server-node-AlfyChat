FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
COPY prisma/ ./prisma/
RUN bun install
RUN bunx prisma generate
RUN bunx prisma db push --skip-generate
COPY tsconfig.json ./
COPY src/ ./src/

# Data volume for DB + uploads
VOLUME /data
ENV DATA_DIR=/data
ENV PORT=4100

EXPOSE 4100

CMD ["bun", "src/index.ts", "start"]
