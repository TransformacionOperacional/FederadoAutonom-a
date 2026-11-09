# Abre el tablero con un servidor local para que lea data/Devolucion.csv y se actualice solo.
# Uso: .\iniciar.ps1   (detener con Ctrl+C)
$puerto = 8090
Set-Location -Path $PSScriptRoot
Start-Process "http://localhost:$puerto/index.html"
python -m http.server $puerto
