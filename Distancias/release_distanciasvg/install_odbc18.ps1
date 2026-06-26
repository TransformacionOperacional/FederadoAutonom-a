$ErrorActionPreference = 'Stop'
$url = 'https://go.microsoft.com/fwlink/?linkid=2257021'
$out = Join-Path $env:TEMP 'msodbcsql18.msi'

Write-Host "Descargando $out"
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing

Write-Host 'Instalando ODBC Driver 18 para SQL Server...'
Start-Process -FilePath 'msiexec.exe' -Wait -ArgumentList @('/i', $out, '/quiet', 'IACCEPTMSODBCSQLLICENSETERMS=YES', 'ADDLOCAL=ALL')

Write-Host 'Instalación finalizada. Verificando drivers...'
Get-OdbcDriver | Select-Object Name | Format-Table -AutoSize
