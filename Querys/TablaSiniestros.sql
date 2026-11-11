-- 1. Columnas de las tablas de siniestros
SELECT TableName, ColumnId, ColumnName, ColumnType, ColumnLength
FROM DBC.ColumnsV
WHERE DatabaseName = 'mdb_seguros_colombia'
  AND TableName IN ('v_siniestro_consolidado', 'V_Siniestro', 'V_SINIESTROS_PAGOS_SAP', 'V_SINIESTRO_AJUSTADOR')
ORDER BY TableName, ColumnId;

-- Alternativa rapida por tabla:
-- HELP COLUMN mdb_seguros_colombia.v_siniestro_consolidado.*;

-- 2. Todas las columnas de los siniestros de la poliza 81005022783
SELECT si.*, s2.*
FROM mdb_seguros_colombia.v_siniestro_consolidado si
INNER JOIN mdb_seguros_colombia.V_Siniestro s2
  ON si.siniestro_id = s2.siniestro_id
INNER JOIN mdb_seguros_colombia.v_poliza p
  ON si.poliza_id = p.poliza_id
WHERE p.numero_poliza = '81005022783';
