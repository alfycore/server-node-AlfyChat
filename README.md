# AlfyChat — Server Node

Nœud de serveur communautaire auto-hébergé pour AlfyChat.

![Node.js](https://img.shields.io/badge/Bun-1.2-black?logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![License](https://img.shields.io/badge/License-MIT-green)

## Rôle

`server-node` est le composant qui s'exécute sur chaque nœud de serveur communautaire AlfyChat. Il gère les serveurs, canaux, rôles, membres, messages de serveur, invitations et bots dans un contexte auto-hébergé ou distribué.

## Stack technique

| Catégorie | Technologies |
|-----------|-------------|
| Runtime | Bun |
| Langage | TypeScript |
| ORM | Prisma |
| Base de données | MySQL 8 |
| Auth | JWT |
| API | Express |

## Architecture globale

```
Gateway (:3000)  →  Server Node  ←  ce composant
                         │
                         └──  Base MySQL (Prisma)
```

## Démarrage

### Prérequis

- [Bun](https://bun.sh/) ≥ 1.2
- MySQL 8

### Variables d'environnement

```env
PORT=3008
DATABASE_URL=mysql://alfychat:password@localhost:3306/alfychat_node
JWT_SECRET=
GATEWAY_URL=https://gateway.alfychat.com
```

### Installation

```bash
bun install
bunx prisma migrate deploy
```

### Développement

```bash
bun run dev
```

### Build production

```bash
bun run build
bun run start
```

### Docker

```bash
docker compose up server-node
```

## Structure du projet

```
src/
├── app.ts               # Configuration Express
├── index.ts             # Point d'entrée
├── config/              # Configuration globale
├── enums/               # Énumérations TypeScript
├── gateway/             # Communication avec la gateway principale
├── middleware/           # Auth JWT, permissions
├── routes/              # Routes (servers, channels, roles, members, messages)
├── services/            # Logique métier
└── utils/               # Utilitaires
prisma/
└── schema.prisma        # Schéma de base de données
```

## Contribution

Voir [CONTRIBUTING.md](./CONTRIBUTING.md).
