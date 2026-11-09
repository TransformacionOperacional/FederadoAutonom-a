Select distinct
p.numero_poliza as poliza,
ca.numero_identificacion as dni_asegurado,
si.siniestro_id as Siniestro,
s2.Fecha_ultima_actualizacion as "Fecha apertura",
ca.nombre_completo as Asegurado,
p.Fecha_Expedicion as Expedicion,
AG.codigo_op as CODAG,
AG.nombre_agente as AGENTE,
pl.Nombre_Comercial as Nombre_plan
from  mdb_seguros_colombia.v_siniestro_consolidado si
inner join mdb_seguros_colombia.V_Siniestro S2
on (si.siniestro_id = s2.siniestro_id)
Inner Join mdb_seguros_colombia.v_poliza p
On (si.poliza_id = p.poliza_id)
Inner Join mdb_seguros_colombia.v_plan pl
On (pl.plan_id = p.plan_id)
inner join MDB_SEGUROS_COLOMBIA.V_PLAN_INDIVIDUAL as plan
on plan.Plan_Individual_Id = si.Plan_Individual_Id
inner join MDB_SEGUROS_COLOMBIA.V_PRODUCTO as produ
on produ.Producto_Id = plan.Producto_Id
inner join MDB_SEGUROS_COLOMBIA.V_RAMO as ra3
on ra3.Ramo_Id = produ.Ramo_Id
inner join MDB_SEGUROS_COLOMBIA.V_COMPANIA as compa
on compa.Compania_Id = produ.Compania_Id
Inner Join mdb_seguros_colombia.v_plan_ramo_matriz ra1
On (pl.plan_id = ra1.plan_id)
Inner Join mdb_seguros_colombia.v_ramo r2
On (ra1.ramo_id = r2.ramo_id)
Inner Join mdb_seguros_colombia.v_poliza_certificado_etl pc
On (si.poliza_certificado_id = pc.poliza_certificado_id)
Inner Join mdb_seguros_colombia.v_cliente c
On (c.cliente_id = si.tomador_id)
Inner Join mdb_seguros_colombia.v_cliente ca
On (ca.cliente_id = si.asegurado_id)
Inner Join mdb_seguros_colombia.v_sucursal suc
On (suc.sucursal_id=p.sucursal_id )
Inner Join mdb_seguros_colombia.v_regional reg
On (reg.regional_id = suc.regional_id)
Inner Join mdb_seguros_colombia.v_canal_venta K
On  K.canal_venta_id = reg.canal_venta_id
Inner Join mdb_seguros_colombia.v_canal_comercial cco1
On  suc.canal_comercial_id = cco1.canal_comercial_id
left outer Join mdb_seguros_colombia.v_amparo am1
On  si.amparo_id = coalesce(am1.amparo_id,cast(-1 as integer))
left outer Join mdb_seguros_colombia.V_SINIESTRO_AJUSTADOR AJ
On  (coalesce(AJ.Siniestro_Id,'-1') = Si.Siniestro_Id)
INNER JOIN mdb_seguros_colombia.v_agente AG
ON  (AG.agente_id= P.agente_lider_id)
left outer Join mdb_seguros_colombia.v_reclamacion r1
                On          (r1.reclamacion_id = coalesce(si.reclamacion_id, cast('-1' as char(1))) )              
left outer Join mdb_seguros_colombia.V_tipo_atencion ta1
                On          (ta1.tipo_atencion_id = coalesce(si.tipo_atencion_id, cast('-1' as char(1))))
left outer Join mdb_seguros_colombia.v_apertura_siniestro as1
                On          (as1.apertura_siniestro_id = coalesce(si.apertura_siniestro_id, cast('-1' as char(1))) )
Inner Join mdb_seguros_colombia.v_causa_siniestro e
  On   (si.causa_siniestro_cd = e.causa_siniestro_cd)
Left Outer Join mdb_seguros_colombia.v_convenio_pago vcon
On   p.contrato_id = vcon.contrato_id
 
left outer join  mdb_seguros_colombia.V_CAUSA_ESTADO_SINIESTRO vcau
On si.Causa_Estado_Siniestro_Cd = vcau.Causa_Estado_Siniestro_Cd
inner join mdb_seguros_colombia.v_cliente ca1
on (coalesce(s2.cliente_apertura_siniestro_id,cast(-1 as integer)) = ca1.cliente_id)    
LEFT OUTER JOIN mdb_seguros_colombia.V_subsituacion_sini su1
          ON (s2.subsituacion_sini_id  = su1.subsituacion_sini_id)
where s2.Fecha_ultima_actualizacion >= DATE '2026-03-01'
And       s2.Fecha_ultima_actualizacion < CURRENT_DATE + 1  
And       r2.codigo_ramo_Op in ('081')  
And lower(pl.Nombre_Comercial) like 'plan vive%'
And exists (
    Select 1
    From mdb_Seguros_Colombia.V_EVENTO_PROD_COBERTURA A
    Inner Join MDB_SEGUROS_COLOMBIA.V_PLAN_INDIVIDUAL D
        On D.Plan_Individual_Id = A.Plan_Individual_Id
    Inner Join MDB_SEGUROS_COLOMBIA.V_PRODUCTO PR
        On PR.Producto_Id = D.Producto_Id
    Where A.Poliza_Certificado_Id = si.Poliza_Certificado_Id
      And A.Tipo_Coaseguro_Cd <> 'C'
      And PR.Ramo_Id = 78
      And A.Amparo_Id = 64359
      And A.Mes_Id >= 202307
)