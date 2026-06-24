# SETUP RÁPIDO

## Instalación en 4 Pasos

### 1. Crear Virtual Environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Instalar Dependencias

```powershell
pip install -r requirements.txt
```

Instala: pandas, pyodbc, streamlit, openpyxl

### 3. Configurar Credenciales

```powershell
cp .env.example .env
notepad .env
```

Edita `.env` con tus credenciales Teradata y SQL Server.

### 4. Ejecutar

```powershell
.\ejecutar.ps1
```

O manualmente:
```powershell
.\.venv\Scripts\Activate.ps1
python actualizar_distanciasvg.py
```

---

## Checklist de Verificación

- [ ] Python 3.8+ instalado
- [ ] ODBC Driver 20.00 (Teradata) instalado
- [ ] `.env` creado y completado
- [ ] Virtual environment activado
- [ ] `pip list` contiene: pandas, pyodbc
- [ ] Conectividad a bases de datos verificada

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| "Cannot open cursor" | Verificar credenciales en `.env` |
| "No module named 'pyodbc'" | Ejecutar `pip install -r requirements.txt` |
| "Cannot find ODBC driver" | Instalar ODBC Driver 20.00 para Teradata |

---

## Primera Ejecución

Esperado: ~8-10 minutos
- Extrae 16,166 pólizas desde Teradata
- Carga en SQL Server
- Procesa 37,585 siniestros
- Actualiza 11,654 pólizas con SIN_REAL > 0

Ver README.md para documentación completa.
