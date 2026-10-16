# Ejecuta actualizar_asesores.py con un entorno virtual local.
# Uso: .\ejecutar.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$venvPython = Join-Path $scriptDir ".venv/Scripts/python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Creando entorno virtual e instalando dependencias..." -ForegroundColor Yellow
    python -m venv .venv
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r requirements.txt
}

& $venvPython actualizar_asesores.py
