# One-command launcher for FlowChat on Windows.
#
# If PowerShell blocks unsigned scripts, run with:
#   powershell -ExecutionPolicy Bypass -File run.ps1
# or, once per session:
#   Set-ExecutionPolicy -Scope Process Bypass
# then:
#   .\run.ps1

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# --- Resolve a Python interpreter (prefer the py launcher) ------------------
function Get-Python {
    $pyOut = $null
    try { $pyOut = py -3 -c "import sys; print(sys.executable)" 2>$null } catch { }
    if ($pyOut) { return ($pyOut -split "`n")[0].Trim() }
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$python = Get-Python
if (-not $python) {
    throw "python not found. Install Python 3 (https://www.python.org/downloads/) then re-run .\run.ps1."
}

# --- Ensure a working venv (create if missing, recreate if stale/broken) ---
$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    & $python -m venv ".venv"
    if ($LASTEXITCODE -ne 0) {
        throw "failed to create .venv. Check that the Python 'venv' module is available."
    }
}

# Recreate a stale/broken venv (e.g. interpreter upgraded since creation).
& $venvPython -c "pass"
if ($LASTEXITCODE -ne 0) {
    Write-Host "note: .venv appears broken, recreating it."
    Remove-Item -Recurse -Force ".venv"
    & $python -m venv ".venv"
    if ($LASTEXITCODE -ne 0) {
        throw "failed to recreate .venv."
    }
}

# Install/refresh backend deps (idempotent).
$venvPip = Join-Path $PSScriptRoot ".venv\Scripts\pip.exe"
& $venvPip install -q -r "backend\requirements.txt"
if ($LASTEXITCODE -ne 0) {
    throw "pip install of backend requirements failed."
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    throw "npm not found. Install Node.js + npm (https://nodejs.org/) then re-run .\run.ps1."
}

# Bootstrap frontend runtime deps on first run (--omit=dev skips puppeteer).
if (-not (Test-Path "frontend\node_modules")) {
    Push-Location "frontend"
    try { & npm install --omit=dev; if ($LASTEXITCODE -ne 0) { throw "npm install of frontend deps failed." } }
    finally { Pop-Location }
}

& $venvPython "backend\app.py"