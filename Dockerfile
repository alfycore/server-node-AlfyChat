FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb* ./
COPY prisma/ ./prisma/
RUN bun install

# DB_PROVIDER est passé au build pour générer le bon client Prisma
# mysql par défaut dans ce Dockerfile (pour le docker-compose avec MySQL)
ARG DB_PROVIDER=mysql
ENV DB_PROVIDER=${DB_PROVIDER}

# Prisma 6+ n'accepte pas env() dans le champ provider :
# on substitue la valeur réelle avant de générer, puis on restaure
RUN sed -i "s|provider = env(\"DB_PROVIDER\")|provider = \"${DB_PROVIDER}\"|" prisma/schema.prisma && \
    DATABASE_URL="file:/tmp/dummy.db" bunx prisma generate && \
    sed -i "s|provider = \"${DB_PROVIDER}\"|provider = env(\"DB_PROVIDER\")|" prisma/schema.prisma

COPY tsconfig.json ./
COPY src/ ./src/

VOLUME /data
ENV DATA_DIR=/data
ENV PORT=4100

EXPOSE 4100

CMD ["bun", "src/index.ts", "start"]
