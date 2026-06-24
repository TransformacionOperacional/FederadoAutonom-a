# DistanciasVG - ETL Actualización Diaria

Sistema automatizado que extrae datos de pólizas Vida Grupo desde Teradata y los carga en SQL Server, actualizando siniestros reales para análisis actuarial.

---

## Instalación Rápida

### 1. Crear Virtual Environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Instalar Dependencias

```powershell
pip install -r requirements.txt
```

### 3. Configurar Credenciales

```powershell
# Copiar plantilla
cp .env.example .env

# Editar con tus credenciales Teradata y SQL Server
notepad .env
```

### 4. Ejecutar

```powershell
# Opción 1 (Recomendado): Ejecutar wrapper
.\ejecutar.ps1

# Opción 2: Ejecutar directamente
python actualizar_distanciasvg.py
```

---

## Flujo de Ejecución

### Fase 1: Extracción y Carga de Pólizas (5 min)
```
BaseCalculos.sql (Teradata) 
    ↓ 
Extract 1M+ certificados, calcular TPR
    ↓
actualizar_distanciasvg.py
    ↓
TRUNCATE + INSERT 16,166 pólizas en dbo.DistanciasVG
```

### Fase 2: Extracción de Siniestros (1 min)
```
Siniestros.sql (Teradata)
    ↓
Crear tabla volátil POLIZAS_VIDAGRUPO_TRADICIONAL
    ↓
UNION ALL de CEDIDOS + BRUTOS
    ↓
Retornar 37,585 filas (NUMERO_POLIZA, VALOR_INCURRIDO)
```

### Fase 3: Actualización de SIN_REAL (2 min)
```
DataFrame de siniestros
    ↓
UPDATE dbo.DistanciasVG SET SIN_REAL = ?
    ↓
11,654 pólizas actualizadas con valores reales
```

**Tiempo Total:** 8-10 minutos

---

## Archivos

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `actualizar_distanciasvg.py` | 300+ | Script principal - orquesta 3 fases |
| `BaseCalculos.sql` | 9,999 | Extrae pólizas con cálculo de TPR |
| `Siniestros.sql` | 370 | Extrae siniestros cedidos + brutos |
| `requirements.txt` | 4 | Dependencias (pandas, pyodbc, streamlit) |
| `ejecutar.ps1` | 10 | Wrapper para Windows |
| `.env.example` | 20 | Plantilla de credenciales |

---

## SQL Queries

### BaseCalculos.sql
**Extrae pólizas con análisis actuarial:**
- 14 Common Table Expressions (CTEs)
- Join de certificados, coberturas, tasas
- Calcula TPR (Tasa Prima Riesgo), VA por amparo, edad promedio
- Salida: 28 columnas nivel póliza

**Filtros Clave:**
- RAMO_ID = 274 (Vida Grupo)
- Canales: 24390648, 24390649
- Mes: 202512 (modificable)

### Siniestros.sql
**Extrae siniestros reales por póliza:**
- Crea tabla volátil de pólizas filtradas
- UNION de dos selectos:
  1. CEDIDOS (reaseguros cedidos)
  2. BRUTOS (siniestros directos, TIPO_OPER_SINIESTRO_CD IN 128,129,130)
- Filtra registros sin valor significativo
- Retorna: NUMERO_POLIZA, VALOR_INCURRIDO

---

## Configuración (.env)

Copiar `.env.example` a `.env` y completar:

```ini
# Teradata
TERADATA_DRIVER=Teradata Database ODBC Driver 20.00
TERADATA_HOST=teradata.suranet.com
TERADATA_USER=tu_usuario
TERADATA_PASSWORD=tu_password

# SQL Server
SQLSERVER_DRIVER=ODBC Driver 17 for SQL Server
SQLSERVER_HOST=surapilotos.database.windows.net
SQLSERVER_DATABASE=SuraPilotos
SQLSERVER_USER=tu_usuario
SQLSERVER_PASSWORD=tu_password
```

**⚠️ SEGURIDAD:** No comitear `.env`. Ya está en `.gitignore`.

---

## Script Python

### Funciones Principales

```python
_ejecutar_en_teradata()
    # Lee .sql, conecta Teradata, retorna DataFrame

_limpiar_df()
    # Normaliza NaN/NaT/pandas.NA → None

_cargar_en_sqlserver()
    # TRUNCATE tabla, INSERT batch

_traer_siniestros_agregados()
    # Ejecuta Siniestros.sql, normaliza columnas

_actualizar_sin_real_en_sqlserver()
    # UPDATE SET SIN_REAL por NUMERO_POLIZA

main()
    # Orquesta 3 fases
```

### Features
✅ Batch operations con `cursor.fast_executemany`  
✅ Control transaccional (BEGIN/COMMIT/ROLLBACK)  
✅ Normalización valores NULL/NaN  
✅ Fallback diagnostico (row-by-row en caso de falla)  
✅ Manejo robusto de errores ODBC  

---

## Troubleshooting

### "Cannot open cursor"
- Verificar `.env` con credenciales correctas
- Probar conectividad: `nslookup teradata.suranet.com`
- Verificar ODBC Drivers: `Get-OdbcDriver`

### "VALOR_INCURRIDO no retorna datos"
- Verificar que `Siniestros.sql` está en la carpeta
- Revisar filtros MES_ID en Siniestros.sql
- Ejecutar Siniestros.sql directamente en Teradata

### Script cuelga
- Aumentar timeout en actualizar_distanciasvg.py:
  ```python
  pyodbc.connect(conn_string, timeout=60)
  ```
- O filtrar período en BaseCalculos.sql

### "Table or view does not exist"
- Verificar que dbo.DistanciasVG existe en SQL Server
- Crear tabla si no existe

---

## Cambios Comunes

### Cambiar Mes de Cálculo

**BaseCalculos.sql:**
```sql
WHERE MCER.MES_ID = 202512  -- Cambiar a 202511, 202510, etc.
```

**Siniestros.sql:**
```sql
AND ERSC.MES_ID BETWEEN 201501 AND 202602  -- Ajustar rango
```

### Cambiar Canales

**BaseCalculos.sql:**
```sql
AND GPC.GRUPO_CANAL_COMERCIAL_ID IN (24390648,24390649)
```

**Siniestros.sql:**
```sql
AND CANAL.CANAL_COMERCIAL_ID IN (24390656, 28686321, ...)
```

---

## Ejecución Automática (Windows)

Abrir **Task Scheduler** (taskschd.msc):

```
Name: DistanciasVG-ETL
Trigger: Daily @ 2:00 AM
Action:
  Program: powershell.exe
  Arguments: -Command "cd 'C:\path\to\project' & .\ejecutar.ps1"
```

---

## FAQ

**P: ¿Cuánto tarda?**  
R: 8-10 minutos total.

**P: ¿Por qué SIN_REAL = 0 en muchas pólizas?**  
R: Normal - muchas pólizas no tienen siniestros en el período.

**P: ¿Puedo ejecutar solo una fase?**  
R: Sí - comentar las fases que no necesites en main().

**P: ¿Dónde están los logs?**  
R: En stdout. Para guardar:
```bash
python actualizar_distanciasvg.py > logs/etl_$(Get-Date -Format 'yyyyMMdd_HHmmss').log 2>&1
```

---

## Contacto

**Autor:** Analítica Seguros Suramericana  
**Versión:** 1.0.0  

Para reportar bugs o sugerencias, contactar al equipo de Analítica.

---

**Licencia:** Uso Interno - Confidencial
