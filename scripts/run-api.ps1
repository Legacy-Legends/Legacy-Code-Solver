$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "Virtual environment creation failed" }
}
& .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed" }
$env:USE_CACHED_DEMO = "true"
$env:USE_MOCK_AGENT = "true"
& .\.venv\Scripts\python.exe -m uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
