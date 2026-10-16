from __future__ import annotations

import os
from decimal import Decimal
from pathlib import Path

import pandas as pd
import pyodbc

SCRIPT_DIR = Path(__file__).resolve().parent
QUERY_FILE = "Asesores.sql"
TABLE_NAME = "dbo.AsesoresVigentes"

TARGET_COLUMNS = [
    "AGENTE_ID",
    "CODIGO_ASESOR",
    "NOMBRE_ASESOR",
    "ESTADO_ASESOR",
    "CODIGO_OFICINA",
    "SUCURSAL",
    "REGIONAL",
    "CANAL_COMERCIAL",
    "GRUPO_CANAL",
    "POLIZAS_VIGENTES",
    "FIN_VIGENCIA_MAS_RECIENTE",
]


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


def _get_setting(name: str, default: str = "") -> str:
    return os.getenv(name, ENV_VALUES.get(name, default))


def _require_setting(name: str) -> str:
    value = _get_setting(name)
    if not value:
        raise RuntimeError(f"Falta la variable {name}. Defínela en .env o como variable de entorno.")
    return value


def _select_sqlserver_driver(preferred_driver: str | None = None) -> str:
    installed = [d for d in pyodbc.drivers() if d]
    candidates = [preferred_driver] if preferred_driver else []
    candidates += ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server", "SQL Server"]
    for candidate in candidates:
        if candidate in installed:
            return candidate
    if installed:
        return installed[0]
    return preferred_driver or "SQL Server"


def _build_sqlserver_conn() -> str:
    driver = _select_sqlserver_driver(_get_setting("SQLSERVER_DRIVER").strip() or None)
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


def _traer_asesores_teradata() -> pd.DataFrame:
    try:
        import teradatasql
    except ImportError as exc:
        raise RuntimeError(
            "No se pudo importar teradatasql. Instala la dependencia con: pip install -r requirements.txt"
        ) from exc

    sql_path = SCRIPT_DIR / QUERY_FILE
    if not sql_path.exists():
        raise FileNotFoundError(f"No existe el archivo SQL: {sql_path}")
    sql = sql_path.read_text(encoding="utf-8").strip().rstrip(";")

    connect_kwargs = {
        "host": _get_setting("TERADATA_HOST", "teradata.suranet.com"),
        "user": _get_setting("TERADATA_USER", "fredaran"),
        "password": _get_setting("TERADATA_PASSWORD", "Dragonite5161*"),
    }
    database = _get_setting("TERADATA_DATABASE").strip()
    if database:
        connect_kwargs["database"] = database

    print("Conectando a Teradata y ejecutando el query de asesores vigentes...")
    conn = teradatasql.connect(**connect_kwargs)
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [col[0].upper() for col in cursor.description]
        rows = cursor.fetchall()
    finally:
        conn.close()

    df = pd.DataFrame([list(r) for r in rows], columns=columns)
    print(f"  Filas obtenidas de Teradata: {len(df):,}")

    missing = [c for c in TARGET_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"El query no retornó las columnas esperadas: {missing}. Obtenidas: {list(df.columns)}")
    return df[TARGET_COLUMNS]


def _to_db_value(value: object) -> object:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    if hasattr(value, "item"):  # tipos numpy
        return value.item()
    return value


def _cargar_en_sqlserver(df: pd.DataFrame) -> int:
    conn_string = _build_sqlserver_conn()
    print(f"Conectando a SQL Server y cargando {len(df):,} filas en {TABLE_NAME}...")

    cols = ", ".join(f"[{c}]" for c in TARGET_COLUMNS)
    placeholders = ", ".join("?" * len(TARGET_COLUMNS))
    insert_sql = f"INSERT INTO {TABLE_NAME} ({cols}) VALUES ({placeholders})"
    rows = [tuple(_to_db_value(v) for v in r) for r in df.itertuples(index=False, name=None)]

    with pyodbc.connect(conn_string) as conn:
        conn.autocommit = False
        cursor = conn.cursor()
        try:
            try:
                cursor.execute(f"TRUNCATE TABLE {TABLE_NAME};")
            except pyodbc.Error:
                cursor.execute(f"DELETE FROM {TABLE_NAME};")

            cursor.fast_executemany = True
            try:
                cursor.executemany(insert_sql, rows)
            except pyodbc.Error:
                cursor.fast_executemany = False
                cursor.executemany(insert_sql, rows)

            conn.commit()
        except Exception:
            conn.rollback()
            raise

        cursor.execute(f"SELECT COUNT(1) FROM {TABLE_NAME};")
        return int(cursor.fetchone()[0])


def main() -> None:
    df = _traer_asesores_teradata()
    if df.empty:
        raise RuntimeError("El query no retornó filas; no se modifica la tabla destino.")

    total = _cargar_en_sqlserver(df)
    print(f"Listo. {TABLE_NAME} ahora tiene {total:,} filas.")


if __name__ == "__main__":
    main()
