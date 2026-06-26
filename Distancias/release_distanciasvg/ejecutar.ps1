# Script: ejecutar.ps1
# Propósito: Ejecutar actualizar_distanciasvg.py usando el entorno virtual del proyecto
# Uso: .\ejecutar.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$venvPython = Join-Path $scriptDir ".venv/Scripts/python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "No se encontró el entorno virtual en $scriptDir. Creándolo..." -ForegroundColor Yellow
    python -m venv .venv
    $venvPython = Join-Path $scriptDir ".venv/Scripts/python.exe"
}

if (-not (Test-Path $venvPython)) {
    Write-Error "No se pudo crear o encontrar el intérprete de Python del entorno virtual."
    exit 1
}

& $venvPython actualizar_distanciasvg.py
