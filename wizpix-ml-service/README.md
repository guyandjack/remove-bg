# WizPix ML Service

Microservice FastAPI qui expose `POST /remove-bg` avec deux modes :

- `quality=fast` : rendu classique rembg (U2Net).
- `quality=pro` : pipeline ONNX 100 % local. Vous pouvez choisir entre InSPyReNet (`isnet-general-use.onnx`) ou BiRefNet portrait (`BiRefNet-portrait-epoch_150.onnx`) sans dépendances PyTorch. Les modèles sont chargés une seule fois puis réutilisés.

Le service publie aussi `GET /health` (état des modèles, warmup, device) et peut basculer automatiquement sur `fast` si le mode pro est indisponible.

## Installation

1. `cd wizpix-ml-service`
2. Créer/activer la venv :
   - Windows PowerShell : `python -m venv venv && .\venv\Scripts\Activate.ps1`
3. Installer les dépendances : `pip install -r requirements.txt`
4. Télécharger les modèles ONNX (InSPyReNet + BiRefNet) :
   ```bash
   python scripts/fetch_models.py
   ```
   Les fichiers sont sauvegardés dans `wizpix-ml-service/models/`.
5. Lancer le serveur :
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

Test rapide :
```bash
curl -X POST "http://localhost:8000/remove-bg?quality=pro" \
  -F "file=@mon_image.png" --output output.png
```

## Modèles & cache

```
wizpix-ml-service/models/
 ├─ isnet-general-use.onnx            # InSPyReNet (général)
 └─ BiRefNet-portrait-epoch_150.onnx  # BiRefNet (portraits)
%USERPROFILE%\.u2net\                 # poids hérités de rembg (u2net, etc.)
```

Par défaut aucun téléchargement n’est déclenché au runtime. Si un modèle manque, `GET /health` renverra `status=degraded` et `quality=pro` basculera vers `fast` (sauf si `AUTO_FALLBACK_FAST=false`, qui renvoie alors `503`). Pour autoriser un téléchargement à la volée exceptionnel, définissez `ALLOW_REMOTE_DOWNLOAD=true`, sinon utilisez le script `fetch_models.py`.

## Paramètres importants

- `quality=pro|fast` (query) côté API.
- `MODEL_DIR` / `PIPELINE_MODEL_DIR` pour déplacer le dossier modèles.
- `FAST_MODEL_NAME` (par défaut `u2net`) pour changer le modèle rembg.
- `PRO_MODEL_NAME=inspyrenet|birefnet-portrait|mock` pour sélectionner le pipeline pro.
- `ALLOW_REMOTE_DOWNLOAD=true|false` (défaut `false`) autorise un téléchargement HTTP si le modèle manque.
- `AUTO_FALLBACK_FAST=true|false` (défaut `true`) redirige vers rembg fast si le mode pro échoue.
- `WARMUP_ON_STARTUP` / `WARMUP_BLOCKING` pour charger les modèles au démarrage (non bloquant par défaut).
- `SAM_*` n’est plus requis : toute la logique pro est ONNX.

## Warmup & intégration Node

Les modèles InSPyReNet/BiRefNet sont chargés en tâche de fond lors du démarrage (warmup). Tant que `GET /health` retourne `status=warming_up`, les requêtes `quality=pro` basculent automatiquement sur le mode fast (ou renvoient `503` si `AUTO_FALLBACK_FAST=false`). Côté API Node, vous pouvez patienter avant d’accepter des uploads :

```ts
import axios from "axios";

export async function waitForPythonService(url: string) {
  while (true) {
    const { data } = await axios.get(`${url}/health`);
    if (data.status === "ok") break;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
```

## Health probe CLI

Un script simple (`python scripts/health_probe.py`) renvoie `0` si le service est `status=ok`, sinon un code non nul (utilisable en CI/CD). Vars optionnelles : `HEALTH_URL`, `HEALTH_TIMEOUT`.

## Tests

Des tests basiques (bbox + composition + intégration mockée) sont disponibles dans `wizpix-ml-service/tests`. Exécution :

```bash
pytest wizpix-ml-service/tests
```
