# Contribuer a AlfyChat - Server Node

Merci de l'interet que vous portez a ce projet ! Voici les regles a suivre.

## Prerequis

- [Bun](https://bun.sh/) >= 1.2
- MySQL 8 + Redis 7 en local (ou via Docker)
- Connaissances en TypeScript / Node.js

## Mise en place de l'environnement

```bash
git clone https://github.com/alfycore/server-node-AlfyChat.git
cd server-node-AlfyChat
bun install
cp .env.example .env
# Remplir les variables dans .env
bun run dev
```

## Workflow

1. **Forker** le depot
2. Creer une branche descriptive : `feat/nom-feature` ou `fix/nom-bug`
3. Faire des commits atomiques avec des messages clairs (voir ci-dessous)
4. Ouvrir une **Pull Request** vers `main` avec une description detaillee

## Convention de commits

Utiliser le format [Conventional Commits](https://www.conventionalcommits.org/) :

```
feat: ajouter une nouvelle fonctionnalite
fix: corriger un bug
refactor: ameliorer la structure du code sans changer le comportement
docs: mettre a jour la documentation
```

## Regles de code

- TypeScript strict - pas de `any` sans justification
- Pas de secrets dans le code (utiliser `.env`)
- Nommer les variables et fonctions en anglais
- Tester manuellement les routes ajoutees

## Signaler un bug

Ouvrir une issue avec :
- La version du service
- Les etapes pour reproduire
- Le comportement attendu vs observe
- Les logs pertinents (sans donnees sensibles)

## Licence

En contribuant, vous acceptez que vos modifications soient soumises a la [licence AlfyChat](./LICENSE).
