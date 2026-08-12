SELECT
    pc.Numero_Poliza,
    pc.Numero_Certificado,
    pc.Poliza_Certificado_Id,
    pc.Estado_Certificado_Cd,

    pol.Poliza_Id,
    pol.Estado_Poliza_Cd,
    pol.Agente_Lider_Id,
    pol.Unidad_Comercial_Id,
    pol.Sucursal_Id,

    b.Beneficiario_Id,
    b.Tipo_Beneficiario_Cd,
    b.Descripcion_Beneficiario,
    b.Pct_Derecho_Beneficiario,
    b.Nombre_Beneficiario_Contingent,
    b.Ind_Beneficiario_Contingente,
    b.Num_Orden,

    cl.Numero_Identificacion,
    cl.Tipo_Identificacion_Cd,
    cl.Email_Contacto AS Correo_Cliente,
    cl.Telefono_Contacto AS Telefono_Cliente,
    cl.Nombre_Completo AS Nombre_Cliente,
    clt.Telefono_Txt AS Celular_Cliente,

    ag.Agente_Id,
    ag.Codigo_Op AS Codigo_Asesor,
    ag.Nombre_Agente AS Nombre_Asesor,
    ag.Email_Contacto AS Correo_Asesor,

    uncom.Unidad_Comercial_Id AS Unidad_Comercial_Id_Detalle,
    uncom.Nombre_Unidad_Comercial,

    suc.Sucursal_Id,
    suc.Nombre_Sucursal,
    suc.Tipo_Sucursal_Cd,
    suc.Regional_Id,
    suc.Ciudad_Sucursal_Id,
    suc.Direccion_Sucursal,
    suc.Telefono_Sucursal,
    suc.Codigo_Op AS Codigo_Oficina,
    suc.Estado AS Estado_Oficina,
    suc.Grupo_Sucursal_Id,
    suc.Canal_Comercial_Id

FROM MDB_SEGUROS_COLOMBIA.V_POLIZA_CERTIFICADO pc

INNER JOIN MDB_SEGUROS_COLOMBIA.V_POLIZA pol
    ON pc.Poliza_Id = pol.Poliza_Id

INNER JOIN MDB_SEGUROS_COLOMBIA.V_POLIZA_BENEFICIARIO b
    ON pc.Poliza_Certificado_Id = b.Poliza_Certificado_Id

LEFT JOIN MDB_SEGUROS_COLOMBIA.V_CLIENTE cl
    ON pc.Asegurado_Id = cl.Cliente_Id

LEFT JOIN MDB_SEGUROS_COLOMBIA.V_CLIENTE_TELEFONO clt
    ON cl.Cliente_Id = clt.Cliente_Id
    AND clt.Uso_Direccion_Cd = 4
    AND CHARACTER_LENGTH(clt.Telefono_Txt) = 10

LEFT JOIN MDB_SEGUROS_COLOMBIA.V_AGENTE ag
    ON pol.Agente_Lider_Id = ag.Agente_Id

LEFT JOIN MDB_SEGUROS_COLOMBIA.V_UNIDAD_COMERCIAL uncom
    ON pol.Unidad_Comercial_Id = uncom.Unidad_Comercial_Id

LEFT JOIN MDB_SEGUROS_COLOMBIA.V_SUCURSAL suc
    ON pol.Sucursal_Id = suc.Sucursal_Id

WHERE pol.Estado_Poliza_Cd = 4
  AND pc.Numero_Poliza LIKE '081%'
  AND (
        UPPER(b.Descripcion_Beneficiario) LIKE '%TUTOR%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%REPRESENTANTE%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%APODERADO%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%CUSTODIO%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%ADMINISTRADOR%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%ACUDIENTE%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%RESPONSABLE%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%LEGAL%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%APOYO%'
     OR UPPER(b.Descripcion_Beneficiario) LIKE '%CURADOR%'
  );