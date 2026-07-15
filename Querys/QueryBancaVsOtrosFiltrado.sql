SELECT DISTINCT
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

INNER JOIN mdb_Seguros_Colombia.V_PLAN_INDIVIDUAL pi
    ON v.Plan_Individual_Id = pi.Plan_Individual_Id

INNER JOIN mdb_Seguros_Colombia.V_PRODUCTO pro
    ON pi.Producto_Id = pro.Producto_Id

INNER JOIN mdb_Seguros_Colombia.V_RAMO r
    ON pro.Ramo_Id = r.Ramo_Id

INNER JOIN mdb_Seguros_Colombia.V_SUCURSAL suc
    ON po.Sucursal_Id = suc.Sucursal_Id

INNER JOIN mdb_Seguros_Colombia.V_REGIONAL reg
    ON suc.Regional_Id = reg.Regional_Id

INNER JOIN mdb_Seguros_Colombia.V_AGENTE ag
    ON po.Agente_Lider_Id = ag.Agente_Id

LEFT JOIN mdb_Seguros_Colombia.V_CANAL_COMERCIAL cc
    ON suc.Canal_Comercial_Id = cc.Canal_Comercial_Id

LEFT JOIN mdb_Seguros_Colombia.V_GRUPO_CANAL_COMERCIAL i
    ON cc.Grupo_Canal_Comercial_Id = i.Grupo_Canal_Comercial_Id

INNER JOIN mdb_Seguros_Colombia.V_CLIENTE cl
    ON v.Asegurado_Id = cl.Cliente_Id

INNER JOIN mdb_Seguros_Colombia.V_CAUSA_ESTADO ca
    ON po.Estado_Poliza_Cd = ca.Estado_Contrato_Cd
    AND po.Causa_Estado_Cd = ca.Causa_Estado_Cd

WHERE r.Codigo_Ramo_Op IN ('081', '083')

    AND po.Estado_Poliza_Cd = 4

    AND v.Estado_Certificado_Cd = 4

    AND reg.Nombre_Regional <> 'REGIONAL PANAMA'

    AND (
        (
            r.Codigo_Ramo_Op = '081'
            AND i.Nombre_Grupo_Canal_Comercial = 'BANCASEGUROS'
        )
        OR r.Codigo_Ramo_Op = '083'
    )

    AND UPPER(TRIM(ca.Causa_Estado_Desc)) = 'NUEVO'
;