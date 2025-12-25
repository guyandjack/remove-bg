# WizPix ML Service

## Installation
1. `cd wizpix-ml-service`
2. Create venv (already done): `python -m venv venv`
3. Activate it:
   - PowerShell: `venv\\Scripts\\Activate.ps1`
4. Install dependencies: `pip install -r requirements.txt`

## Run dev server
```
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open http://127.0.0.1:8000/docs to test the API.
