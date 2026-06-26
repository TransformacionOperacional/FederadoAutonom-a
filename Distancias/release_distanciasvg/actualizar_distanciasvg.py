from __future__ import annotations

import argparse
import os
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
# IMPORTANTE: Reemplaza DBCName, UID y PWD con tus credenciales
# ---------------------------------------------------------------------------
TERADATA_CONN = _build_teradata_conn()

# ---------------------------------------------------------------------------
# SQL SERVER  (destino de la carga)
# IMPORTANTE: Reemplaza SERVER, UID y PWD con tus credenciales
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
]

SOURCE_TO_TARGET_COLUMNS = {
    "Grupo_Empresarial_Desc": "GRUPO_EMPRESARIAL_DESC",
    "Fecha_Inicio_Primera_Vigencia": "FECHA_INICIO_PRIMERA_VIGENCIA",
    "Nombre_Canal_Comercial": "NOMBRE_CANAL_COMERCIAL",
    "Nombre_Grupo_Canal_Comercial": "NOMBRE_GRUPO_CANAL_COMERCIAL",
    "Nombre_Sucursal": "NOMBRE_SUCURSAL",
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


def _limpiar_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza nulos y no-finitos para insercion segura en SQL Server."""
    df = df.copy()

    # Convierte NaN/NaT/pandas.NA a None en todas las columnas.
    df = df.where(pd.notna(df), None)

    for col in df.columns:
        series = df[col]

        # En columnas numericas, reemplaza +/-inf y cualquier no-finito por None.
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
    if isinstance(value, (np.floating, float)):
        v = float(value)
        if not np.isfinite(v):
            return None
        return v
    if isinstance(value, np.integer):
        return int(value)
    return value


def _cargar_en_sqlserver(conn_string: str, df: pd.DataFrame, table_name: str) -> int:
    print(f"Conectando a SQL Server y cargando {len(df):,} filas en {table_name}...")
    df = _limpiar_df(df)

    # Homologa nombres de salida de Teradata a nombres fisicos de SQL Server.
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
                # Fallback diagnostico: identifica la primera fila que rompe la carga.
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


def _traer_siniestros_agregados(conn_string: str, query_file: str = "Siniestros.sql") -> pd.DataFrame:
    """Ejecuta Siniestros.sql en Teradata y trae NUMERO_POLIZA + VALOR_INCURRIDO."""
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

        # Divide el SQL en sentencias individuales para evitar el error de DDL en Teradata
        # Ejecuta las sentencias DDL primero, luego el SELECT
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
    
    # Normaliza nombres de columnas a mayúsculas para consistencia
    df_sin.columns = df_sin.columns.str.upper()
    
    # Valida que tenga las columnas esperadas
    if "NUMERO_POLIZA" not in df_sin.columns or "VALOR_INCURRIDO" not in df_sin.columns:
        print(f"  ERROR: Columnas inesperadas. Se encontraron: {list(df_sin.columns)}")
        raise ValueError(
            f"El query debe retornar NUMERO_POLIZA y VALOR_INCURRIDO. "
            f"Columnas obtenidas: {list(df_sin.columns)}"
        )
    
    return df_sin


def _actualizar_sin_real_en_sqlserver(
    conn_string: str,
    df_siniestros: pd.DataFrame,
    table_name: str = TABLE_NAME
) -> int:
    """Actualiza SIN_REAL en SQL Server con los valores incurridos por póliza."""
    print(f"Actualizando columna SIN_REAL en {table_name}...")
    
    if df_siniestros.empty:
        print("  ADVERTENCIA: No se obtuvieron datos de siniestros. SIN_REAL se inicializa a 0.")
        df_siniestros = pd.DataFrame({"NUMERO_POLIZA": [], "VALOR_INCURRIDO": []})
    
    # Normaliza nulos en la columna de incurridos
    df_siniestros = df_siniestros.copy()
    df_siniestros["VALOR_INCURRIDO"] = df_siniestros["VALOR_INCURRIDO"].fillna(0)
    df_siniestros["VALOR_INCURRIDO"] = df_siniestros["VALOR_INCURRIDO"].apply(_to_db_value)
    
    with pyodbc.connect(conn_string) as conn:
        conn.autocommit = False
        cursor = conn.cursor()
        try:
            cursor.execute("SET XACT_ABORT ON;")
            cursor.execute("BEGIN TRANSACTION;")
            
            # Primero inicializa SIN_REAL a 0 en todas las filas
            cursor.execute(f"UPDATE {table_name} SET SIN_REAL = 0;")
            print("  SIN_REAL inicializado a 0 en todas las filas.")
            
            # Luego actualiza con los valores de siniestros (si hay datos)
            if not df_siniestros.empty:
                update_sql = f"UPDATE {table_name} SET SIN_REAL = ? WHERE NUMERO_POLIZA = ?"
                rows_update = [
                    (row["VALOR_INCURRIDO"], row["NUMERO_POLIZA"])
                    for _, row in df_siniestros.iterrows()
                ]
                
                cursor.fast_executemany = True
                cursor.executemany(update_sql, rows_update)
                print(f"  {len(rows_update):,} pólizas actualizadas con valores de siniestros.")
            else:
                print("  Sin datos de siniestros para actualizar.")
            
            cursor.execute("COMMIT TRANSACTION;")
        except Exception:
            cursor.execute("IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;")
            raise
        
        cursor.execute(f"SELECT COUNT(1) FROM {table_name} WHERE SIN_REAL > 0;")
        total_con_sin = int(cursor.fetchone()[0])
    
    return total_con_sin


def refrescar_distanciasvg(
    teradata_conn: str,
    sqlserver_conn: str,
    query_file: str = "BaseCalculos.sql",
    table_name: str = TABLE_NAME,
) -> int:
    """Extrae datos de Teradata y los carga en SQL Server."""
    sql_path = _resolve_sql_path(query_file)
    if not sql_path.exists():
        raise FileNotFoundError(f"No existe el archivo SQL: {query_file}")
    df = _ejecutar_en_teradata(teradata_conn, sql_path)
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
    
    # Paso 1: Cargar datos de pólizas desde BaseCalculos.sql
    total = refrescar_distanciasvg(
        teradata_conn=args.td_conn,
        sqlserver_conn=args.ss_conn,
        query_file=args.query_file,
        table_name=args.table,
    )
    print(f"✓ Carga de pólizas completada en {args.table}. Filas: {total:,}")
    
    # Paso 2: Traer siniestros agregados
    print("\n" + "="*70)
    df_siniestros = _traer_siniestros_agregados(
        conn_string=args.td_conn,
        query_file="Siniestros.sql"
    )
    print(f"  Columnas recibidas: {list(df_siniestros.columns)}")
    if len(df_siniestros) > 0:
        print(f"  Primeras 3 filas de siniestros:")
        print(df_siniestros.head(3).to_string())
    
    # Paso 3: Actualizar SIN_REAL en SQL Server
    print("\n" + "="*70)
    total_con_sin = _actualizar_sin_real_en_sqlserver(
        conn_string=args.ss_conn,
        df_siniestros=df_siniestros,
        table_name=args.table,
    )
    print(f"✓ Actualización de SIN_REAL completada. Pólizas con siniestros: {total_con_sin:,}")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
