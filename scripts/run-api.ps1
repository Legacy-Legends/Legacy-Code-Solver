param(
    [switch]$Live,
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [switch]$NoReload
)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "Virtual environment creation failed" }
}
& .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed" }
& .\.venv\Scripts\python.exe -c "import networkx"
if ($LASTEXITCODE -ne 0) { throw "NetworkX is unavailable in the project virtual environment" }

# Exported variables win over .env. -Live explicitly overrides an earlier demo run.
if ($Live) { $env:USE_MOCK_AGENT = "false" }
$serverArgs = @("-m", "uvicorn", "backend.api.main:app", "--host", "127.0.0.1", "--port", "$Port")
if (-not $NoReload) { $serverArgs += "--reload" }
Write-Host "Starting API at http://127.0.0.1:$Port"
if ($Port -ne 8000) {
    Write-Host "In the frontend PowerShell terminal, set this before restarting Vite:"
    Write-Host ('  $env:API_PROXY_TARGET = "http://127.0.0.1:' + $Port + '"')
    Write-Host "  npm run dev -- --host 127.0.0.1 --port 5173"
}
if (Test-Path ".env") { $serverArgs += @("--env-file", ".env") }
& .\.venv\Scripts\python.exe @serverArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "For WinError 10013 or 10048, try another port with -Port 8765 -NoReload."
    Write-Host "Check listeners: Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue"
    Write-Host "Check Windows reservations: netsh interface ipv4 show excludedportrange protocol=tcp"
    throw "API startup failed on port $Port. See the Uvicorn error above."
}
