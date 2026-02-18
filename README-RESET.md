# Reset Dev Guide

Ce guide sert a remettre rapidement le projet dans un etat sain quand:
- le backend ne demarre plus (`tsx`, `esbuild`, `ECANCELED`, process bloques),
- le frontend affiche une page blanche,
- `node_modules` est incomplet/corrompu.

## Script de reset

Le script est ici:

`scripts/reset-dev.sh`

## Modes disponibles

### 1. Reset rapide (recommande)

Conserve les lockfiles, reinstalle les dependances, et tue les process dev bloques.

```bash
./scripts/reset-dev.sh
```

### 2. Reset complet

Supprime `node_modules` + `package-lock.json` dans `backend` et `frontend`, puis reinstalle tout.

```bash
./scripts/reset-dev.sh full
```

## Ce que fait le script

- stoppe les process `tsx`/`vite` potentiellement bloques,
- force l'installation backend avec devDependencies,
- reinstalle `esbuild` et `tsx` cote backend,
- force l'installation frontend avec devDependencies.

## Lancement apres reset

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

## Verification rapide

- Backend: `http://127.0.0.1:3000/health`
- Frontend: `http://127.0.0.1:30001`

## Si ca bloque encore

### `tsx` ne se ferme pas / `Ctrl+C` inefficace

```bash
pkill -9 -f "tsx.*src/app.ts"
pkill -9 -f "node.*src/app.ts"
```

### Port backend occupe

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -ti :3000 | xargs kill -9
```

### Frontend page blanche

- verifier que le backend tourne,
- hard refresh navigateur (`Cmd+Shift+R`),
- reouvrir `http://127.0.0.1:30001`.

## Note importante macOS/iCloud

Si le projet est dans un dossier synchronise (iCloud/Drive), des fichiers npm peuvent devenir `dataless`, ce qui peut casser `tsx`/`vite`.

Si les erreurs reviennent souvent:
- deplacer le projet hors dossier synchronise (ex: `~/Developer/...`),
- relancer un reset complet:

```bash
./scripts/reset-dev.sh full
```

