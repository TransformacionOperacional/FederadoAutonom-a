SELECT
    AG.Agente_Id                         AS AGENTE_ID,
    AG.Codigo_Op                         AS CODIGO_ASESOR,
    AG.Nombre_Agente                     AS NOMBRE_ASESOR,
    AG.Estado                            AS ESTADO_ASESOR,
    SUC.Codigo_Op                        AS CODIGO_OFICINA,
    SUC.Nombre_Sucursal                  AS SUCURSAL,
    REG.Nombre_Regional                  AS REGIONAL,
    K.Nombre_Canal_Comercial             AS CANAL_COMERCIAL,
    I.Nombre_Grupo_Canal_Comercial       AS GRUPO_CANAL,
    COUNT(DISTINCT POL.Poliza_Id)        AS POLIZAS_VIGENTES,
    MAX(POL.Fecha_Fin_Ultima_Vigencia)   AS FIN_VIGENCIA_MAS_RECIENTE
FROM mdb_Seguros_Colombia.v_agente AG
INNER JOIN mdb_Seguros_Colombia.v_poliza POL
    ON POL.Agente_Lider_Id = AG.Agente_Id
INNER JOIN mdb_Seguros_Colombia.v_sucursal SUC
    ON SUC.Sucursal_Id = POL.Sucursal_Id
INNER JOIN mdb_Seguros_Colombia.v_regional REG
    ON REG.Regional_Id = SUC.Regional_Id
INNER JOIN mdb_Seguros_Colombia.v_canal_comercial K
    ON K.Canal_Comercial_Id = SUC.Canal_Comercial_Id
INNER JOIN mdb_Seguros_Colombia.v_grupo_canal_comercial I
    ON I.Grupo_Canal_Comercial_Id = K.Grupo_Canal_Comercial_Id
WHERE POL.Estado_Poliza_Cd = 4
  AND POL.Fecha_Fin_Ultima_Vigencia >= CURRENT_DATE
  AND POL.Fecha_Cancelacion IS NULL
GROUP BY
    AG.Agente_Id, AG.Codigo_Op, AG.Nombre_Agente, AG.Estado,
    SUC.Codigo_Op, SUC.Nombre_Sucursal,
    REG.Nombre_Regional,
    K.Nombre_Canal_Comercial,
    I.Nombre_Grupo_Canal_Comercial
ORDER BY AG.Nombre_Agente;