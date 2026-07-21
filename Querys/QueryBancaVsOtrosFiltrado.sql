SELECT DISTINCT
    q.Codigo_Ramo_Op,
    q.Ramo_Desc,
    q.Codigo_Plan_Op,
    q.Producto_Desc,
    q.Causa_Estado_Desc,
    q.Numero_Poliza,
    q.Fecha_Inicio_Primera_Vigencia,
    q.Fecha_Proxima_Renovacion,
    q.Dni_Cliente,
    q.Email_Contacto,
    q.Telefono_Contacto,
    q.Nombre_Canal_Comercial,
    q.Nombre_Grupo_Canal_Comercial
FROM
(
    /* =========================================================
       RAMO 081
       ========================================================= */
    SELECT
        r.Codigo_Ramo_Op,
        r.Ramo_Desc,
        pi.Codigo_Plan_Op,
        pro.Producto_Desc,
        ca.Causa_Estado_Desc,
        po.Numero_Poliza,
        po.Fecha_Inicio_Primera_Vigencia,
        po.Fecha_Proxima_Renovacion,
        cl.Dni_Cliente,
        cl.Email_Contacto,
        cl.Telefono_Contacto,
        cc.Nombre_Canal_Comercial,
        i.Nombre_Grupo_Canal_Comercial
    FROM mdb_Seguros_Colombia.V_POLIZA_CERTIFICADO v

    INNER JOIN mdb_Seguros_Colombia.V_POLIZA po
        ON v.Poliza_Id = po.Poliza_Id
        AND po.Estado_Poliza_Cd = 4

    INNER JOIN mdb_Seguros_Colombia.V_PLAN_INDIVIDUAL pi
        ON v.Plan_Individual_Id = pi.Plan_Individual_Id

    INNER JOIN mdb_Seguros_Colombia.V_PRODUCTO pro
        ON pi.Producto_Id = pro.Producto_Id

    INNER JOIN mdb_Seguros_Colombia.V_RAMO r
        ON pro.Ramo_Id = r.Ramo_Id
        AND r.Codigo_Ramo_Op = '081'

    INNER JOIN mdb_Seguros_Colombia.V_SUCURSAL suc
        ON po.Sucursal_Id = suc.Sucursal_Id

    INNER JOIN mdb_Seguros_Colombia.V_REGIONAL reg
        ON suc.Regional_Id = reg.Regional_Id
        AND UPPER(TRIM(reg.Nombre_Regional)) <> 'REGIONAL PANAMA'

    INNER JOIN mdb_Seguros_Colombia.V_CANAL_COMERCIAL cc
        ON suc.Canal_Comercial_Id = cc.Canal_Comercial_Id

    INNER JOIN mdb_Seguros_Colombia.V_GRUPO_CANAL_COMERCIAL i
        ON cc.Grupo_Canal_Comercial_Id = i.Grupo_Canal_Comercial_Id

    INNER JOIN mdb_Seguros_Colombia.V_CLIENTE cl
        ON v.Asegurado_Id = cl.Cliente_Id

    INNER JOIN mdb_Seguros_Colombia.V_CAUSA_ESTADO ca
        ON po.Estado_Poliza_Cd = ca.Estado_Contrato_Cd
        AND po.Causa_Estado_Cd = ca.Causa_Estado_Cd
        AND UPPER(TRIM(ca.Causa_Estado_Desc)) = 'NUEVO'

    WHERE v.Estado_Certificado_Cd = 4

    UNION ALL

    /* =========================================================
       RAMO 083
       ========================================================= */
    SELECT
        r.Codigo_Ramo_Op,
        r.Ramo_Desc,
        pi.Codigo_Plan_Op,
        pro.Producto_Desc,
        ca.Causa_Estado_Desc,
        po.Numero_Poliza,
        po.Fecha_Inicio_Primera_Vigencia,
        po.Fecha_Proxima_Renovacion,
        cl.Dni_Cliente,
        cl.Email_Contacto,
        cl.Telefono_Contacto,
        cc.Nombre_Canal_Comercial,
        i.Nombre_Grupo_Canal_Comercial
    FROM mdb_Seguros_Colombia.V_POLIZA_CERTIFICADO v

    INNER JOIN mdb_Seguros_Colombia.V_POLIZA po
        ON v.Poliza_Id = po.Poliza_Id
        AND po.Estado_Poliza_Cd = 4

    INNER JOIN mdb_Seguros_Colombia.V_PLAN_INDIVIDUAL pi
        ON v.Plan_Individual_Id = pi.Plan_Individual_Id

    INNER JOIN mdb_Seguros_Colombia.V_PRODUCTO pro
        ON pi.Producto_Id = pro.Producto_Id

    INNER JOIN mdb_Seguros_Colombia.V_RAMO r
        ON pro.Ramo_Id = r.Ramo_Id
        AND r.Codigo_Ramo_Op = '083'

    INNER JOIN mdb_Seguros_Colombia.V_SUCURSAL suc
        ON po.Sucursal_Id = suc.Sucursal_Id

    INNER JOIN mdb_Seguros_Colombia.V_REGIONAL reg
        ON suc.Regional_Id = reg.Regional_Id
        AND UPPER(TRIM(reg.Nombre_Regional)) <> 'REGIONAL PANAMA'

    INNER JOIN mdb_Seguros_Colombia.V_CANAL_COMERCIAL cc
        ON suc.Canal_Comercial_Id = cc.Canal_Comercial_Id

    INNER JOIN mdb_Seguros_Colombia.V_GRUPO_CANAL_COMERCIAL i
        ON cc.Grupo_Canal_Comercial_Id = i.Grupo_Canal_Comercial_Id

    INNER JOIN mdb_Seguros_Colombia.V_CLIENTE cl
        ON v.Asegurado_Id = cl.Cliente_Id

    INNER JOIN mdb_Seguros_Colombia.V_CAUSA_ESTADO ca
        ON po.Estado_Poliza_Cd = ca.Estado_Contrato_Cd
        AND po.Causa_Estado_Cd = ca.Causa_Estado_Cd
        AND UPPER(TRIM(ca.Causa_Estado_Desc)) = 'NUEVO'

    WHERE v.Estado_Certificado_Cd = 4
) q
WHERE q.Fecha_Inicio_Primera_Vigencia
          BETWEEN DATE '2025-01-01' AND CURRENT_DATE
  AND UPPER(TRIM(q.Nombre_Grupo_Canal_Comercial)) = 'BANCASEGUROS';