FROM node:24-alpine

WORKDIR /app

# better-sqlite3 nécessite python3, make et g++ pour la compilation native
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Utiliser .env.example comme .env par défaut si aucun .env n'est monté
RUN cp -n .env.example .env 2>/dev/null || true

# Dossier de données persistant (SQLite + uploads)
RUN mkdir -p /data
VOLUME /data

ENV DATA_DIR=/data
ENV PORT=4100

EXPOSE 4100

CMD ["npm", "start"]
