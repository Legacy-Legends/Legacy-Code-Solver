$ErrorActionPreference = "Stop"

if (-not (Get-Command uvicorn -ErrorAction SilentlyContinue)) {
    python -m pip install -r backend\requirements.txt
}

python demo-repos\cache_demo.py
$env:USE_CACHED_DEMO = "true"
python -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
