# WizPix ML Service

Microservice FastAPI qui expose `POST /remove-bg` avec deux modes :
- `quality=fast` (par defaut fallback) : detourage via rembg / U²-Net.
- `quality=pro` : pipeline multi-etapes (segmentation IS-Net ONNX + matting MODNet ONNX + post-processing bords).

## Installation
1. `cd wizpix-ml-service`
2. Creer l''environnement virtuel (si besoin) : `python -m venv venv`
3. Activer la venv :
   - PowerShell : `venv\Scripts\Activate.ps1`
4. Installer les dependances : `pip install -r requirements.txt`
5. Telecharger les modeles (sans lancer le serveur) : `python scripts/fetch_models.py`

## Modeles & cache
Les modeles open-source sont recuperes automatiquement lors du premier appel et stockes dans :
```
%USERPROFILE%\.u2net\            # poids historiques de rembg
wizpix-ml-service/models/         # isnet-general-use.onnx & modnet_webcam_portrait_matting.onnx
```
Par defaut, les modeles doivent etre presents localement avant de lancer le serveur. Utilisez `python scripts/fetch_models.py` ou, si le serveur n''a pas acces a Internet, telechargez manuellement :
- IS-Net : https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
- MODNet : https://github.com/ZHKKKe/MODNet/releases/download/modnet_webcam_portrait_matting/modnet_webcam_portrait_matting.onnx
puis copiez les fichiers dans `wizpix-ml-service/models/`.

## Lancement du serveur
```
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Parametres utiles :
- `quality=pro|fast` (Query param) pour choisir la qualite.
- `PIPELINE_DEVICE=cpu|cuda` (variable d''environnement) pour forcer le backend ONNXRuntime. Par defaut : auto.
- `MODEL_DIR` (ou `PIPELINE_MODEL_DIR`) pour changer le dossier de telechargement des modeles (defaut `./models`).
- `ISNET_MODEL_URL` / `MODNET_MODEL_URL` si vous souhaitez forcer un mirroir des poids.
- `ALLOW_REMOTE_DOWNLOAD=true|false` (defaut `false`) autorise exceptionnellement le telechargement automatique lorsqu'un modele manque.
- `AUTO_FALLBACK_FAST=true|false` pour autoriser (defaut) ou interdire le fallback vers rembg quand la qualite `pro` est indisponible.
- `WARMUP_ON_STARTUP=true|false` lance (defaut: true) le pre-chargement des modeles au demarrage.
- `WARMUP_BLOCKING=true|false` force (optionnel) a attendre la fin du warmup avant d''accepter des requetes (defaut: false).
- `GET /health` renvoie l''etat des modeles charges (utilisable par le backend Node pour un health check). Tant que le warmup tourne, `status=warming_up`.
- Lorsqu'un fallback automatique est declenche, la reponse inclut l'en-tete `X-Wizpix-Fallback: fast`.

L''endpoint retourne un PNG RGBA. Test rapide :
```
curl -X POST "http://localhost:8000/remove-bg?quality=pro" \
  -F "file=@mon_image.png" --output output.png
```

## Warmup & Node integration

Au demarrage, le service lance un warmup (IS-Net + MODNet) en tache de fond pour eviter le pic de latence lors du premier `quality=pro`. Vous pouvez:
- desactiver ce pre-chargement via `WARMUP_ON_STARTUP=false`
- le rendre bloquant (utile en prod) via `WARMUP_BLOCKING=true`

Pendant le warmup, une requete `quality=pro` :
- bascule automatiquement sur `fast` si `AUTO_FALLBACK_FAST=true` (defaut) + en-tete `X-Wizpix-Fallback: fast`
- renvoie `503 Models warming up` si `AUTO_FALLBACK_FAST=false`
Les requetes `quality=fast` fonctionnent toujours.

### Health check cote Node
Optionnellement, l'API Node peut patienter au boot:
```ts
const axios = require("axios");
async function waitForPython() {
  const url = `${process.env.PY_SERVICE_URL}/health`;
  for (;;) {
    const { data } = await axios.get(url);
    if (data.status === "ok") break;
    await new Promise((r) => setTimeout(r, 1500));
  }
}
```

## Health probe CLI

Un script simple est fourni pour les pipelines CI/CD :
```
python scripts/health_probe.py --url http://127.0.0.1:8000/health
```
- retourne `0` si `status=ok`
- retourne `!=0` si le service est degrade ou inaccessible

Variables optionnelles : `HEALTH_URL`, `HEALTH_TIMEOUT`.
