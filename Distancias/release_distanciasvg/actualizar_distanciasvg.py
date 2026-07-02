from __future__ import annotations

import argparse
import datetime
import os
import re
from decimal import Decimal
from pathlib import Path

import math
import numpy as np

import pandas as pd
import pyodbc

SCRIPT_DIR = Path(__file__).resolve().parent


def _connect_with_diagnostics(conn_string: str, context: str):
    if context.startswith("Conectar a Teradata"):
        try:
            import teradatasql
        except ImportError as exc:
            raise RuntimeError(
                "No se pudo importar teradatasql. Instala la dependencia con: pip install -r requirements.txt"
            ) from exc

        host = _get_setting("TERADATA_HOST", "teradata.suranet.com")
        user = _get_setting("TERADATA_USER", "FREDARAN")
        password = _get_setting("TERADATA_PASSWORD", "Articuno930618*")
        database = _get_setting("TERADATA_DATABASE", "").strip()
        connect_kwargs = {
            "host": host,
            "user": user,
            "password": password,
        }
        if database:
            connect_kwargs["database"] = database
        return teradatasql.connect(**connect_kwargs)

    try:
        return pyodbc.connect(conn_string)
    except pyodbc.Error as exc:
        installed_drivers = ", ".join(pyodbc.drivers()) if pyodbc.drivers() else "(ninguno)"
        driver_name = "(no especificado)"
        if "DRIVER={" in conn_string:
            driver_name = conn_string.split("DRIVER={", 1)[1].split("}", 1)[0]
        raise RuntimeError(
            f"{context} falló. Driver esperado: {driver_name}. "
            f"Drivers ODBC instalados: {installed_drivers}. "
            f"Detalle: {exc}"
        ) from exc


def _load_env() -> dict[str, str]:
    env_values: dict[str, str] = {}
    env_path = SCRIPT_DIR / ".env"
    if env_path.exists():
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env_values[key.strip()] = value.strip().strip('"').strip("'")
    return env_values


ENV_VALUES = _load_env()


def _get_setting(name: str, default: str) -> str:
    return os.getenv(name, ENV_VALUES.get(name, default))


def _build_teradata_conn() -> str:
    driver = _get_setting("TERADATA_DRIVER", "Teradata Database ODBC Driver 20.00")
    host = _get_setting("TERADATA_HOST", "teradata.suranet.com")
    user = _get_setting("TERADATA_USER", "FREDARAN")
    password = _get_setting("TERADATA_PASSWORD", "Articuno930618*")
    return (
        f"DRIVER={{{driver}}};"
        f"DBCName={host};"
        f"Username={user};"
        f"Password={password};"
    )


def _select_sqlserver_driver(preferred_driver: str | None = None) -> str:
    installed_drivers = [driver for driver in pyodbc.drivers() if driver]
    candidates = []
    if preferred_driver:
        candidates.append(preferred_driver)
    candidates.extend([
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
        "SQL Server",
    ])

    for candidate in candidates:
        if candidate in installed_drivers:
            return candidate

    if installed_drivers:
        return installed_drivers[0]

    if preferred_driver:
        return preferred_driver

    return "SQL Server"


def _build_sqlserver_conn() -> str:
    preferred_driver = _get_setting("SQLSERVER_DRIVER", "").strip()
    driver = _select_sqlserver_driver(preferred_driver or None)
    host = _get_setting("SQLSERVER_HOST", "surapilotos.database.windows.net")
    database = _get_setting("SQLSERVER_DATABASE", "SuraPilotos")
    user = _get_setting("SQLSERVER_USER", "fredaran")
    password = _get_setting("SQLSERVER_PASSWORD", "Sura2025*")
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={host};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )


def _resolve_sql_path(query_file: str | Path) -> Path:
    path = Path(query_file)
    if path.is_absolute():
        return path

    script_candidate = SCRIPT_DIR / path
    if script_candidate.exists():
        return script_candidate

    cwd_candidate = Path.cwd() / path
    if cwd_candidate.exists():
        return cwd_candidate

    return script_candidate

# ---------------------------------------------------------------------------
# TERADATA  (fuente del query)
# ---------------------------------------------------------------------------
TERADATA_CONN = _build_teradata_conn()

# ---------------------------------------------------------------------------
# SQL SERVER  (destino de la carga)
# ---------------------------------------------------------------------------
SQLSERVER_CONN = _build_sqlserver_conn()

TABLE_NAME = "dbo.DistanciasVG"

TARGET_COLUMNS = [
    "GRUPO_EMPRESARIAL_DESC",
    "DNI_TOMADOR",
    "NOMBRE_TOMADOR",
    "FECHA_INICIO_PRIMERA_VIGENCIA",
    "NUMERO_POLIZA",
    "POLIZA_ID",
    "GRUPO_PRODUCTO",
    "CLASIFICACION",                   # Copia de GRUPO_PRODUCTO
    "NOMBRE_CANAL_COMERCIAL",
    "NOMBRE_GRUPO_CANAL_COMERCIAL",
    "CODIGO_OFICINA",
    "NOMBRE_SUCURSAL",
    "CODIGO_ASESOR",
    "NOMBRE_ASESOR",
    "VALOR_ASEGURADO_TOTAL",
    "VALOR_PRIMA_TOTAL",
    "VALOR_ASEGURADO_VIDA",
    "VALOR_ASEGURADO_EG",
    "VALOR_ASEGURADO_ITP",
    "NUMERO_ASEGURADOS",
    "EDAD_PROMEDIO",
    "SIN_ESPERADA_TOTAL",
    "SIN_ESPERADA_VIDA",
    "SIN_ESPERADA_VIDA_EG_ITP",
    "TASA_ACTUAL",
    "TPR_PONDERADA_POR_PERSONA",
    "TPR_SOLO_VIDA",
    "TPR_SOLO_VIDA_EG_ITP",
    # ── Campos calculados ──────────────────────────────────────────────────
    "TPR_PONDERADA_REDUCCION_20PCT",   # = TPR_PONDERADA_POR_PERSONA * (1 - 20%)
    "NUEVA_O_RENOVADA",                 # NUEVA si FECHA_INICIO_PRIMERA_VIGENCIA es 2025 o 2026
    "FECHA_CORTE",                      # Calculado como fecha fija 31/12/2025
    "AÑOS_VIGENCIA",                    # Diferencia de años entre FECHA_CORTE y FECHA_INICIO_PRIMERA_VIGENCIA, máximo 4
    "CANT_ASEGURADOS",                  # viene de NUMERO_ASEGURADOS
    "CLASIFICACION_ASEGURADOS",         # Regla por canal y cantidad de asegurados
    "RANGO_EMPLEADOS",                  # Rango por cantidad de asegurados
    "ASEG_AÑOS_VIGENCIA",                # AÑOS_VIGENCIA * CANT_ASEGURADOS
    "VALOR_INCURRIDO",                   # Traido de valor incurrido de siniestros agregados por póliza
    "TPR_REAL",                          # 1000 * VALOR_INCURRIDO / (AÑOS_VIGENCIA * VALOR_ASEGURADO_VIDA)
    "SIN_ESPERADA_TPR_REAL",             # TPR_REAL * VALOR_ASEGURADO_VIDA / 1000
    "Z6",                                # raiz de (ASEG_AÑOS_VIGENCIA / 1905)
    "RANGO_Z6",                           # rango de z6 de acuerdo a rangos porcentuales (0%-10%, 10%-20%, 20%-40%, 40%-60%, 60%-80%, 80%-100%)
    "TP_CREDIBILIDAD_ESC6",                 # Z6*TPR_REAL + (1-Z6)*TPR_PONDERADA_REDUCCION_20PCT
    "SIN_ESPERADA_TPCRED_ESC6",         # TP_CREDIBILIDAD_ESC6 * VALOR_ASEGURADO_VIDA / 1000
    "TC6",                              # TP_CREDIBILIDAD_ESC6 ajustado por grupo comercial (ASESORES, CORREDORES) GF = 51.52
    "AJUSTE_ESC6",                        # TC6 / TASA_ACTUAL - 1
    "RANGO_ESC6",                         # Rango porcentual de AJUSTE_ESC6 (Menor que -50%, -50% a -20%, -20% a -5%, -5% a 0%, 0%-10%, 10%-20%, 20%-50%, 50%-100%, 100%+)
    "DIF_ENTRE_TPR_REAL_Y_TEORICA",      # TPR_REAL - TPR_PONDERADA_REDUCCION_20PCT
    "DIF_PCT_RESPECTO_TEORICA_ESC6",        # TP_CREDIBILIDAD_ESC6 - TPR_PONDERADA_POR_PERSONA / TP_CREDIBILIDAD_ESC6
    # ──────────────────────────────────────────────────────────────────────
]

SOURCE_TO_TARGET_COLUMNS = {
    "Grupo_Empresarial_Desc": "GRUPO_EMPRESARIAL_DESC",
    "Fecha_Inicio_Primera_Vigencia": "FECHA_INICIO_PRIMERA_VIGENCIA",
    "Nombre_Canal_Comercial": "NOMBRE_CANAL_COMERCIAL",
    "Nombre_Grupo_Canal_Comercial": "NOMBRE_GRUPO_CANAL_COMERCIAL",
    "Nombre_Sucursal": "NOMBRE_SUCURSAL",
    "ANIOS_VIGENCIA": "AÑOS_VIGENCIA",
    "ASEG_ANIOS_VIGENCIA": "ASEG_AÑOS_VIGENCIA",
}


def _ejecutar_en_teradata(conn_string: str, query_file: str) -> pd.DataFrame:
    sql_path = _resolve_sql_path(query_file)
    if not sql_path.exists():
        raise FileNotFoundError(f"No existe el archivo SQL: {query_file}")
    sql = sql_path.read_text(encoding="utf-8")
    print(f"Usando archivo SQL: {sql_path}")
    print("Conectando a Teradata y ejecutando query...")
    conn = _connect_with_diagnostics(conn_string, "Conectar a Teradata")
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [col[0] for col in cursor.description] if cursor.description else []
        rows = cursor.fetchall()
        df = pd.DataFrame(rows, columns=columns)
    finally:
        conn.close()
    print(f"  Filas obtenidas de Teradata: {len(df):,}")
    return df


def _calcular_campos(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula todos los campos derivados sobre el DataFrame de BaseCalculos.
    Agrega aquí los nuevos campos calculados a medida que se definan.
    """
    df = df.copy()

    # CLASIFICACION replica GRUPO_PRODUCTO.
    df["CLASIFICACION"] = df.get("GRUPO_PRODUCTO")

    # ── Campo 1: TPR_PONDERADA_REDUCCION_20PCT ────────────────────────────
    # Fórmula: TPR_PONDERADA_POR_PERSONA * (1 - 20%)
    # Se normaliza a numérico porque Teradata puede devolver Decimal y pandas
    # no permite multiplicar ese tipo directamente por un float.
    base_tpr = pd.to_numeric(df["TPR_PONDERADA_POR_PERSONA"], errors="coerce")
    df["TPR_PONDERADA_REDUCCION_20PCT"] = base_tpr * 0.80
    # ─────────────────────────────────────────────────────────────────────

    # ── Campo 2: NUEVA_O_RENOVADA ─────────────────────────────────────────
    # Se basa en FECHA_INICIO_PRIMERA_VIGENCIA. Fechas con año 2025/2026 son NUEVA.
    def calcular_nueva_o_renovada(fecha_valor: object) -> str | None:
        if pd.isna(fecha_valor):
            return None
        fecha_texto = str(fecha_valor).strip()
        if not fecha_texto:
            return None
        match = re.search(r"(\d{4})$", fecha_texto)
        if not match:
            return "RENOVADA"
        year = int(match.group(1))
        return "NUEVA" if year in {2025, 2026} else "RENOVADA"

    df["NUEVA_O_RENOVADA"] = df["FECHA_INICIO_PRIMERA_VIGENCIA"].apply(calcular_nueva_o_renovada)
    df["FECHA_CORTE"] = datetime.date(2025, 12, 31)

    def calcular_anos_vigencia(inicio: object, corte: object) -> float | None:
        if pd.isna(inicio) or pd.isna(corte):
            return None
        if not isinstance(inicio, (datetime.date, datetime.datetime)):
            try:
                inicio = pd.to_datetime(str(inicio), dayfirst=True).date()
            except Exception:
                return None
        if not isinstance(corte, (datetime.date, datetime.datetime)):
            try:
                corte = pd.to_datetime(str(corte), dayfirst=True).date()
            except Exception:
                return None
        anos = (corte - inicio).days / 365.0
        return 4.0 if anos > 4.0 else anos

    df["ANIOS_VIGENCIA"] = df.apply(
        lambda row: calcular_anos_vigencia(row["FECHA_INICIO_PRIMERA_VIGENCIA"], row["FECHA_CORTE"]),
        axis=1,
    )
    df["ANIOS_VIGENCIA"] = pd.to_numeric(df["ANIOS_VIGENCIA"], errors="coerce").fillna(0.0)

    df["CANT_ASEGURADOS"] = pd.to_numeric(df["NUMERO_ASEGURADOS"], errors="coerce").fillna(0.0)

    def clasificar_asegurados(nombre_grupo: object, cant_asegurados: object) -> str:
        grupo = str(nombre_grupo).strip().upper() if not pd.isna(nombre_grupo) else ""
        cantidad = pd.to_numeric(cant_asegurados, errors="coerce")
        cantidad = 0.0 if pd.isna(cantidad) else float(cantidad)

        if grupo == "ASESORES":
            return ">200" if cantidad > 200 else "<200"
        if grupo == "CORREDORES":
            return "CORREDORES"
        return "Otro"

    df["CLASIFICACION_ASEGURADOS"] = df.apply(
        lambda row: clasificar_asegurados(row.get("NOMBRE_GRUPO_CANAL_COMERCIAL"), row.get("CANT_ASEGURADOS")),
        axis=1,
    )

    def calcular_rango_empleados(cant_asegurados: object) -> str:
        cantidad = pd.to_numeric(cant_asegurados, errors="coerce")
        cantidad = 0.0 if pd.isna(cantidad) else float(cantidad)

        # Equivalente a BUSCARV(CANT_ASEGURADOS, tabla_rangos, 3, VERDADERO)
        if cantidad <= 10:
            return "0 a 10"
        if cantidad <= 30:
            return "10 a 30"
        if cantidad <= 50:
            return "30 a 50"
        if cantidad <= 100:
            return "50 a 100"
        if cantidad <= 500:
            return "100 a 500"
        if cantidad <= 1000:
            return "500 a 1000"
        return "1000+"

    df["RANGO_EMPLEADOS"] = df["CANT_ASEGURADOS"].apply(calcular_rango_empleados)

    df["ASEG_ANIOS_VIGENCIA"] = df["ANIOS_VIGENCIA"] * df["CANT_ASEGURADOS"]

    def calcular_z6(aseg_anios_vigencia: object) -> float:
        valor = pd.to_numeric(aseg_anios_vigencia, errors="coerce")
        if pd.isna(valor) or valor <= 0.0:
            return 0.0
        resultado = float(np.sqrt(max(valor, 0.0) / 1905.0))
        return 1.0 if resultado > 1.0 else resultado

    df["Z6"] = df["ASEG_ANIOS_VIGENCIA"].apply(calcular_z6)
    df["Z6"] = pd.to_numeric(df["Z6"], errors="coerce").fillna(0.0)

    def calcular_rango_z6(z6_val: object) -> str:
        if isinstance(z6_val, str):
            z6_val = z6_val.strip().replace(",", ".")
            if z6_val == "":
                z6_val = 0.0

        z6 = pd.to_numeric(z6_val, errors="coerce")
        if pd.isna(z6):
            z6 = 0.0
        z6 = float(z6)
        if z6 < 0.0:
            z6 = 0.0

        # Rangos del lookup de Z6 del Excel
        if z6 < 0.1:
            return "0%-10%"
        if z6 < 0.2:
            return "10%-20%"
        if z6 < 0.4:
            return "20%-40%"
        if z6 < 0.6:
            return "40%-60%"
        if z6 < 0.8:
            return "60%-80%"
        return "80%-100%"

    df["RANGO_Z6"] = df["Z6"].apply(calcular_rango_z6)

    def _normalizar_valor_numerico(valor: object) -> float:
        if pd.isna(valor):
            return 0.0
        if isinstance(valor, str):
            valor = valor.strip().replace(" ", "").replace(",", "")
            if valor == "":
                return 0.0
        try:
            return float(valor)
        except (ValueError, TypeError):
            return 0.0

    df["VALOR_INCURRIDO"] = df.get("VALOR_INCURRIDO", 0.0).apply(_normalizar_valor_numerico) if isinstance(df.get("VALOR_INCURRIDO", 0.0), pd.Series) else 0.0

    def calcular_tpr_real(valor_incurrido: object, anos_vigencia: object, valor_vida: object) -> float:
        valor_incurrido_val = pd.to_numeric(valor_incurrido, errors="coerce")
        anos_val = pd.to_numeric(anos_vigencia, errors="coerce")
        valor_vida_val = pd.to_numeric(valor_vida, errors="coerce")
        if pd.isna(valor_incurrido_val) or pd.isna(anos_val) or pd.isna(valor_vida_val):
            return 0.0
        if anos_val <= 0 or valor_vida_val <= 0:
            return 0.0
        return 1000.0 * valor_incurrido_val / (anos_val * valor_vida_val)

    df["TPR_REAL"] = df.apply(
        lambda row: calcular_tpr_real(row.get("VALOR_INCURRIDO"), row.get("ANIOS_VIGENCIA"), row.get("VALOR_ASEGURADO_VIDA")),
        axis=1,
    )

    df["SIN_ESPERADA_TPR_REAL"] = (
        pd.to_numeric(df["TPR_REAL"], errors="coerce") * pd.to_numeric(df["VALOR_ASEGURADO_VIDA"], errors="coerce") / 1000.0
    ).fillna(0.0)

    df["TP_CREDIBILIDAD_ESC6"] = (
        pd.to_numeric(df["Z6"], errors="coerce") * pd.to_numeric(df["TPR_REAL"], errors="coerce")
        + (1.0 - pd.to_numeric(df["Z6"], errors="coerce")) * pd.to_numeric(df["TPR_PONDERADA_REDUCCION_20PCT"], errors="coerce")
    ).fillna(0.0)

    df["SIN_ESPERADA_TPCRED_ESC6"] = (
        pd.to_numeric(df["TP_CREDIBILIDAD_ESC6"], errors="coerce") * pd.to_numeric(df["VALOR_ASEGURADO_VIDA"], errors="coerce") / 1000.0
    ).fillna(0.0)

    df["DIF_ENTRE_TPR_REAL_Y_TEORICA"] = (
        pd.to_numeric(df["TPR_REAL"], errors="coerce")
        - pd.to_numeric(df["TPR_PONDERADA_REDUCCION_20PCT"], errors="coerce")
    ).fillna(0.0)

    FG = 0.5152

    def calcular_tc6(nombre_grupo: object, tp_credibilidad: object) -> float:
        tp_cred = pd.to_numeric(tp_credibilidad, errors="coerce")
        if pd.isna(tp_cred):
            return 0.0
        grupo = str(nombre_grupo).strip().upper() if not pd.isna(nombre_grupo) else ""
        if grupo == "ASESORES":
            return tp_cred / (1.0 - 0.13)
        if grupo == "CORREDORES":
            return tp_cred / (1.0 - FG)
        return 0.0

    df["TC6"] = df.apply(
        lambda row: calcular_tc6(row.get("NOMBRE_GRUPO_CANAL_COMERCIAL"), row.get("TP_CREDIBILIDAD_ESC6")),
        axis=1,
    )

    df["AJUSTE_ESC6"] = (
        pd.to_numeric(df["TC6"], errors="coerce") / pd.to_numeric(df["TASA_ACTUAL"], errors="coerce") - 1.0
    ).replace([np.inf, -np.inf], np.nan).fillna(0.0)

    def calcular_rango_esc6(ajuste_val: object) -> str:
        ajuste = pd.to_numeric(ajuste_val, errors="coerce")
        if pd.isna(ajuste):
            ajuste = 0.0
        ajuste = float(ajuste)

        # Equivalente a BUSCARV(AJUSTE_ESC6, tabla_rangos, 3, VERDADERO)
        if ajuste <= -0.5:
            return "Menor que -50%"
        if ajuste <= -0.2:
            return "-50% a -20%"
        if ajuste <= -0.05:
            return "-20% a -5%"
        if ajuste <= 0.0:
            return "-5% a 0%"
        if ajuste <= 0.1:
            return "0%-10%"
        if ajuste <= 0.2:
            return "10%-20%"
        if ajuste <= 0.5:
            return "20%-50%"
        if ajuste <= 1.0:
            return "50%-100%"
        return "100%+"

    df["RANGO_ESC6"] = df["AJUSTE_ESC6"].apply(calcular_rango_esc6)

    df["DIF_PCT_RESPECTO_TEORICA_ESC6"] = (
        pd.to_numeric(df["TP_CREDIBILIDAD_ESC6"], errors="coerce") - pd.to_numeric(df["TPR_PONDERADA_POR_PERSONA"], errors="coerce")
    ) / pd.to_numeric(df["TPR_PONDERADA_POR_PERSONA"], errors="coerce")
    df["DIF_PCT_RESPECTO_TEORICA_ESC6"] = df["DIF_PCT_RESPECTO_TEORICA_ESC6"].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    # ─────────────────────────────────────────────────────────────────────

    print("  ✓ Campos calculados aplicados:")
    print(
        df[[
            "NUMERO_POLIZA",
            "TPR_PONDERADA_POR_PERSONA",
            "TPR_PONDERADA_REDUCCION_20PCT",
            "NUEVA_O_RENOVADA",
            "FECHA_CORTE",
            "ANIOS_VIGENCIA",
        ]]
        .head(5)
        .to_string(index=False)
    )

    return df


def _limpiar_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza nulos y no-finitos para insercion segura en SQL Server."""
    df = df.copy()
    df = df.where(pd.notna(df), None)

    for col in df.columns:
        series = df[col]
        if pd.api.types.is_numeric_dtype(series):
            df[col] = series.apply(
                lambda x: None
                if x is None or (isinstance(x, (float, np.floating)) and (math.isnan(float(x)) or not np.isfinite(float(x))))
                else x
            )

    return df


def _to_db_value(value: object) -> object:
    """Normaliza un valor individual para pyodbc/SQL Server."""
    if pd.isna(value):
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (np.floating, float)):
        v = float(value)
        if not np.isfinite(v):
            return None
        return v
    if isinstance(value, np.integer):
        return int(value)
    return value


def _ensure_sqlserver_column_exists(conn_string: str, table_name: str, column_name: str, column_type: str = "DECIMAL(18,2)") -> None:
    schema_name, object_name = (table_name.split(".", 1) if "." in table_name else ("dbo", table_name))
    if schema_name.startswith("[") and schema_name.endswith("]"):
        schema_name = schema_name[1:-1]
    if object_name.startswith("[") and object_name.endswith("]"):
        object_name = object_name[1:-1]

    check_sql = """
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    """

    with pyodbc.connect(conn_string) as conn:
        cursor = conn.cursor()
        cursor.execute(check_sql, (schema_name, object_name, column_name))
        exists = cursor.fetchone()[0] > 0
        if not exists:
            cursor.execute(f"ALTER TABLE {table_name} ADD {column_name} {column_type} NULL")
            print(f"  Columna agregada en SQL Server: {column_name} ({column_type})")


def _drop_sqlserver_column_if_exists(conn_string: str, table_name: str, column_name: str) -> None:
    schema_name, object_name = (table_name.split(".", 1) if "." in table_name else ("dbo", table_name))
    if schema_name.startswith("[") and schema_name.endswith("]"):
        schema_name = schema_name[1:-1]
    if object_name.startswith("[") and object_name.endswith("]"):
        object_name = object_name[1:-1]

    check_sql = """
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    """

    with pyodbc.connect(conn_string) as conn:
        cursor = conn.cursor()
        cursor.execute(check_sql, (schema_name, object_name, column_name))
        exists = cursor.fetchone()[0] > 0
        if exists:
            cursor.execute(f"ALTER TABLE {table_name} DROP COLUMN {column_name}")
            print(f"  Columna removida en SQL Server: {column_name}")


def _cargar_en_sqlserver(conn_string: str, df: pd.DataFrame, table_name: str) -> int:
    print(f"Conectando a SQL Server y cargando {len(df):,} filas en {table_name}...")
    df = _limpiar_df(df)

    df = df.rename(columns=SOURCE_TO_TARGET_COLUMNS)

    missing_cols = [c for c in TARGET_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Faltan columnas requeridas para carga: {missing_cols}")

    df = df[TARGET_COLUMNS]

    cols = ", ".join(TARGET_COLUMNS)
    placeholders = ", ".join(["?"] * len(TARGET_COLUMNS))
    insert_sql = f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"
    rows = [tuple(_to_db_value(v) for v in r) for r in df.itertuples(index=False, name=None)]

    with pyodbc.connect(conn_string) as conn:
        conn.autocommit = False
        cursor = conn.cursor()
        cursor.fast_executemany = True
        try:
            cursor.execute("SET XACT_ABORT ON;")
            cursor.execute("BEGIN TRANSACTION;")
            try:
                cursor.execute(f"TRUNCATE TABLE {table_name};")
            except pyodbc.Error:
                cursor.execute(f"DELETE FROM {table_name};")

            try:
                cursor.executemany(insert_sql, rows)
            except pyodbc.Error:
                cursor.fast_executemany = False
                for idx, row in enumerate(rows, start=1):
                    try:
                        cursor.execute(insert_sql, row)
                    except pyodbc.Error as row_err:
                        raise RuntimeError(
                            f"Fallo en fila {idx}. Valores: {row}"
                        ) from row_err
                raise

            cursor.execute("COMMIT TRANSACTION;")
        except Exception:
            cursor.execute("IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;")
            raise
        cursor.execute(f"SELECT COUNT(1) FROM {table_name};")
        total = int(cursor.fetchone()[0])
    return total


def _traer_siniestros_agregados(conn_string: str, query_file: str = "SiniestrosAgregado.sql") -> pd.DataFrame:
    """Ejecuta SiniestrosAgregado.sql en Teradata y trae NUMERO_POLIZA + VALOR_INCURRIDO."""
    sql_path = _resolve_sql_path(query_file)
    if not sql_path.exists():
        raise FileNotFoundError(f"No existe el archivo SQL: {query_file}")
    sql = sql_path.read_text(encoding="utf-8")
    print("Conectando a Teradata para obtener siniestros agregados por póliza...")

    conn = _connect_with_diagnostics(
        conn_string,
        "Conectar a Teradata para obtener siniestros agregados",
    )
    try:
        cursor = conn.cursor()

        parts = sql.split("SELECT *\nFROM (")
        if len(parts) == 2:
            ddl_part = parts[0]
            select_part = "SELECT *\nFROM (" + parts[1]

            for statement in ddl_part.split(";"):
                stmt = statement.strip()
                if not stmt:
                    continue
                if stmt.startswith("--") or stmt.startswith("/*"):
                    continue
                if "/*" in stmt or "--" in stmt:
                    continue

                normalized_stmt = " ".join(stmt.split())
                if normalized_stmt.upper() in {"ET", "ET;", "END TRANSACTION", "END TRANSACTION;"}:
                    continue

                cursor.execute(normalized_stmt)

            df_sin = pd.read_sql(select_part, conn)
        else:
            df_sin = pd.read_sql(sql, conn)
    finally:
        conn.close()

    print(f"  Filas obtenidas de Teradata (siniestros): {len(df_sin):,}")

    df_sin.columns = df_sin.columns.str.upper()

    if "NUMERO_POLIZA" not in df_sin.columns or "VALOR_INCURRIDO" not in df_sin.columns:
        print(f"  ERROR: Columnas inesperadas. Se encontraron: {list(df_sin.columns)}")
        raise ValueError(
            f"El query debe retornar NUMERO_POLIZA y VALOR_INCURRIDO. "
            f"Columnas obtenidas: {list(df_sin.columns)}"
        )

    return df_sin


def refrescar_distanciasvg(
    teradata_conn: str,
    sqlserver_conn: str,
    query_file: str = "BaseCalculos.sql",
    table_name: str = TABLE_NAME,
) -> int:
    """Extrae datos de Teradata, calcula campos derivados y los carga en SQL Server."""
    sql_path = _resolve_sql_path(query_file)
    if not sql_path.exists():
        raise FileNotFoundError(f"No existe el archivo SQL: {query_file}")

    # Paso A: traer datos crudos de Teradata
    df = _ejecutar_en_teradata(teradata_conn, sql_path)

    # Paso B: calcular campos derivados antes de cargar a SQL Server
    print("\n  Calculando campos derivados...")
    df = _calcular_campos(df)

    # Paso C: eliminar cualquier columna obsoleta y garantizar columna destino antes de cargar
    _drop_sqlserver_column_if_exists(sqlserver_conn, table_name, "SIN_REAL")
    _ensure_sqlserver_column_exists(sqlserver_conn, table_name, "VALOR_INCURRIDO")
    return _cargar_en_sqlserver(sqlserver_conn, df, table_name)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ejecuta BaseCalculos.sql en Teradata y carga el resultado en SQL Server"
    )
    parser.add_argument("--td-conn",      default=TERADATA_CONN,  help="Connection string de Teradata")
    parser.add_argument("--ss-conn",      default=SQLSERVER_CONN, help="Connection string de SQL Server")
    parser.add_argument("--query-file",   default="BaseCalculos.sql",  help="Ruta al SQL fuente")
    parser.add_argument("--table",        default=TABLE_NAME,     help="Tabla destino en SQL Server")
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    # Paso 1: Cargar datos de pólizas (con campos calculados) desde BaseCalculos.sql
    total = refrescar_distanciasvg(
        teradata_conn=args.td_conn,
        sqlserver_conn=args.ss_conn,
        query_file=args.query_file,
        table_name=args.table,
    )
    print(f"✓ Carga de pólizas completada en {args.table}. Filas: {total:,}")


if __name__ == "__main__":
    main()