# remove-bg

Ce dépôt contient une application web (front + back) qui permet de **supprimer l’arrière‑plan d’une image**.
Le traitement d’image est fait par un **microservice Python (FastAPI)** dans `wizpix-ml-service`, et le front passe par un **backend Node.js (Express)** dans `backend`.

## Vue d’ensemble (débutant)

Flux typique en développement local :

1. Le front (Vite / Preact) tourne sur `http://localhost:5173`.
2. Il envoie une image au backend sur `http://localhost:3000/api/services/remove-bg`.
3. Le backend appelle le microservice Python sur `http://localhost:8000/remove-bg`.
4. Le microservice renvoie une image PNG (fond supprimé), que le backend renvoie au front.

## Structure du dépôt

Résumé de l’arborescence (un ancien `tree.txt` a été supprimé au profit de ce README) :

- `src/`, `public/` : front-end (Vite + Preact + Tailwind/DaisyUI).
- `backend/` : API Node.js (Express) qui sert d’API “métier” et fait l’intégration avec le service Python.
- `wizpix-ml-service/` : microservice Python FastAPI qui fait réellement la suppression de fond (mode rapide `rembg` ou pipeline ONNX “pro”).
- `docker-compose.dev.yml`, `Dockerfile`, `backend/Dockerfile`, `wizpix-ml-service/Dockerfile` : support Docker (principalement orienté développement).
- `.env` (racine) : variables d’environnement du front (Vite).
- `backend/.env` : variables d’environnement du backend.

## Prérequis

### Pour lancer en local (sans Docker)

- Node.js + npm
  - Le dépôt contient un fichier `.nvmrc` (version Node attendue : `22.20.0`).
  - Attention : les `Dockerfile` utilisent `node:20-alpine` (écart à connaître si vous comparez “local” vs “Docker”).
- Python `3.11+` recommandé (le service Docker Python part d’une image `python:3.11-slim`).
  - `pip` et `venv` (inclus avec Python).

### Pour lancer avec Docker

- Docker Desktop
- Docker Compose (commande `docker compose`)

## Lancement en local (sans Docker)

Le projet se lance en **3 serveurs** (Python + backend + frontend). Ouvrez idéalement **3 terminaux**.

### 1) Lancer le microservice Python (`wizpix-ml-service`)

```powershell
cd wizpix-ml-service
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Télécharger les modèles ONNX (recommandé si vous voulez le mode `quality=pro`) :

```powershell
python scripts/fetch_models.py
```

Démarrer l’API FastAPI :

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Vérifier que le service répond :

```powershell
curl http://localhost:8000/health
```

Notes importantes :

- Endpoint principal : `POST /remove-bg` avec la query `quality=fast|pro`.
- Si les modèles “pro” ne sont pas disponibles, le service peut basculer automatiquement en “fast” selon la configuration (voir `wizpix-ml-service/services/pipeline.py`).

### 2) Lancer le backend Node.js (`backend`)

Installer les dépendances :

```powershell
cd backend
npm ci
```

Démarrer le serveur en mode dev avec la configuration Nodemon du projet :

```powershell
npx nodemon --config nodemon.json
```

Le backend démarre par défaut sur `http://localhost:3000` (voir `backend/server.ts` + `backend/.env`).

Point d’attention (important) :

- Le backend appelle le service Python via `SERVICE_URL_DEV` (en mode `NODE_ENV=development`) ou `SERVICE_URL_PROD` (sinon), voir `backend/controleur/services/removeBg.controler.ts`.
- En local (sans Docker), la valeur attendue est typiquement `SERVICE_URL_DEV=http://localhost:8000` (c’est le cas dans `backend/.env`).

### 3) Lancer le front (racine du dépôt)

Dans un autre terminal :

```powershell
cd ..
npm ci
npm run dev
```

Le front Vite écoute par défaut sur `http://localhost:5173`.

Variables d’environnement front :

- Le code lit `VITE_BASE_DEV_URL`, `VITE_API_DEV_URL`, `VITE_BASE_PROD_URL`, `VITE_API_PROD_URL` (voir `src/utils/localOrProd.ts`).
- Ces variables sont définies dans `.env` à la racine.

## Lancement avec Docker (développement)

Le fichier `docker-compose.dev.yml` démarre 3 services :

- `ml` : FastAPI (Python) sur `http://localhost:8000`
- `backend` : API Express sur `http://localhost:3000`
- `frontend` : Vite dev server sur `http://localhost:5173`

Démarrer l’ensemble :

```powershell
docker compose -f docker-compose.dev.yml up --build
```

Télécharger les modèles ONNX dans le volume `wizpix-ml-service/models/` (optionnel mais recommandé pour `quality=pro`) :

```powershell
docker compose -f docker-compose.dev.yml run --rm ml python scripts/fetch_models.py
```

Pourquoi Docker peut être utile ici :

- Vous évitez d’installer Python/Node localement (ou vous isolez les versions).
- Les volumes montés permettent un “live reload” :
  - Python : `uvicorn --reload`
  - Backend : `nodemon`
  - Front : `vite dev`

### État “fonctionnel” de la configuration Docker

Ce qui semble cohérent d’après les fichiers :

- Le service Python (`ml`) a un `Dockerfile` propre et un `healthcheck` dans `docker-compose.dev.yml`.
- Le `docker-compose.dev.yml` orchestre bien l’ordre de démarrage (`backend` dépend de `ml`, `frontend` dépend de `backend`).

Limites / points à vérifier :

- Les `Dockerfile` racine (front) et `backend/Dockerfile` lancent des serveurs de développement (Vite/Nodemon) : ce n’est pas adapté à une mise en production “sérieuse” telle quelle.
- Le dépôt contient des dossiers `node_modules/` et `wizpix-ml-service/venv/` : en général on évite de versionner ces dossiers. Ils peuvent rendre les builds/l’IDE lourds et la maintenance plus difficile.

## Docker “production” (ce qui existe, et ce qui manque)

Il n’y a **pas** de fichier `docker-compose.yml` orienté production dans ce dépôt : uniquement `docker-compose.dev.yml`.

### Service Python (plutôt proche prod)

Le `wizpix-ml-service/Dockerfile` lance `uvicorn` sans `--reload`, ce qui est déjà plus proche d’un usage production.

Build :

```powershell
docker build -t remove-bg-ml .\wizpix-ml-service
```

Run (exemple minimal) :

```powershell
docker run --rm -p 8000:8000 remove-bg-ml
```

Note : pour le mode “pro”, il faut que les modèles ONNX existent dans le conteneur (ou soient montés en volume). Dans cette base de code, le script `scripts/fetch_models.py` télécharge depuis Internet (URLs par défaut dans `wizpix-ml-service/scripts/fetch_models.py`).

### Backend et frontend (dev-only dans l’état)

- `backend/Dockerfile` démarre `nodemon` : c’est pratique en dev mais pas recommandé en prod.
- `Dockerfile` (racine) démarre `vite dev` : pareil, pas un serveur de production.

Conclusion : pour une vraie prod, il faudrait au minimum :

- Un build front (`npm run build`) et un serveur statique (ou un serveur Node/NGINX) au lieu de `vite dev`.
- Un build backend (TS -> JS) et un `node dist/...` (ou `tsx` sans nodemon) au lieu de nodemon.
- Une gestion propre des variables d’environnement (pas de secrets commités, voir section suivante).

## Sécurité / secrets (important)

Le fichier `backend/.env` contient des **secrets** (clés API, tokens, mots de passe). Dans un contexte professionnel, ce fichier ne devrait généralement pas être commité dans le dépôt.

## Docs backend

- Annulation SaaS / consentement marketing / demande de suppression: `docs/backend-subscription-cancel.md`
- Dashboard Billing & Account (UX + endpoints): `docs/dashboard-billing-account.md`
- Stripe upgrade/downgrade (plan change): `docs/stripe-plan-change.md`

À confirmer / à faire selon votre contexte :

- Remplacer les valeurs sensibles par des placeholders.
- Mettre en place un vrai `.env.example` (sans secrets) et un stockage sécurisé des secrets (CI/CD, vault, variables d’environnement).

## Dépannage rapide

- `backend` renvoie une erreur “service indisponible” :
  - Vérifier que `wizpix-ml-service` tourne bien sur `http://localhost:8000/health`.
  - Vérifier `SERVICE_URL_DEV` dans `backend/.env` (local) ou dans `docker-compose.dev.yml` (Docker).
- Le mode `quality=pro` renvoie des erreurs :
  - Télécharger les modèles : `python scripts/fetch_models.py` (local) ou via Docker compose (voir plus haut).
- Port déjà utilisé :
  - Python : `8000`, Backend : `3000`, Front : `5173`.
