Select  
compa.Codigo_Op as cod_compania,
ra3.Codigo_Ramo_Op as codigo_ramo_op_admin,
ra3.Ramo_Desc as ramo_desc_admin,
r2.codigo_ramo_Op Ramo, 
r2.Ramo_desc,
pl.Nombre_Comercial Nombre_plan,
cco1.Codigo_Canal_Comercial_Op,
cco1.Nombre_Canal_Comercial,
am1.amparo_desc,
p.numero_poliza POLIZA,
si.siniestro_id SINIESTRO,
pc.numero_certificado,
si.fecha_primera_vigencia_cert,
p.fecha_inicio_primera_vigencia fecha_primera_vigencia_pol,
c.nombre_completo  tomador,
c.numero_identificacion IDENTIFICACION_tomador, 
ca.nombre_completo  asegurado,
ca.numero_identificacion IDENTIFICACION_asegurado, 
ca.sexo_cd SEXO_asegurado,
((CAST (pc.fecha_inicio_primera_vigencia AS DATE ) - CA.fecha_nacimiento )/365) edad_ingreso_asegurado,
((date - CA.fecha_nacimiento )/365) edad_actual_asegurado,
((CAST (coalesce(p.fecha_cancelacion, p.fecha_fin_ultima_vigencia) AS DATE) - p.fecha_inicio_primera_vigencia )/365) vigencia_poliza,
((CAST (coalesce(pc.fecha_cancelacion, pc.fecha_fin_ultima_vigencia) AS DATE ) - pc.fecha_inicio_primera_vigencia )/365) vigencia_certificado,
p.Fecha_Expedicion FEXPEDICION,
suc.codigo_op CODSUC,
SUC.Nombre_Sucursal SUCURSAL,
reg.Nombre_Regional REGIONAL,
AG.nombre_agente AGENTE, 
AG.codigo_op CODAG,
e.causa_siniestro_cd CAUSASTRO, 
e.causa_siniestro_desc DESCAUSA, 
si.diagnostico_desc DIAGNOSTICO,
AJ.Nombre_Ajustador AJUSTADOR,
s2.Tipo_Estado_Siniestro_Cd ESTADO,
si.Fecha_Siniestro FSINIESTRO,
si.Fecha_Aviso_Siniestro F_Notificacion, 
s2.Fecha_Apertura_Siniestro Fecha_Recepcion,
s2.Fecha_ultima_actualizacion Fecha_Apertura,
s2.fecha_primer_cierre_siniestro,
vcau.Causa_Estado_Siniestro_Desc,
r1.reclamacion_desc Cod_Reclamacion,  
ta1.tipo_Atencion_Desc Ind_Tipo_Atencion,  
as1.apertura_siniestro_Desc Tipo_Apertura_Siniestro, 
ca1.Numero_Identificacion Nm_Iden_Apertura,
ca1.Nombre_completo Nombre_Cliente_Apertura,
s2.Ind_Pago_Automatico,
su1.subsituacion_sini_desc Pendiente_de,
SUM(si.Valor_RESERVAs_INICIAL),
SUM(si.Valor_RESERVAS),
SUM(si.Valor_PAGOS)
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
where s2.Fecha_ultima_actualizacion Between '2025-09-01' And '2025-09-16'   
And       r2.codigo_ramo_Op in ('081','084','086','083','181','085', 'BAN')  
Group    By  
compa.Codigo_Op,
ra3.Codigo_Ramo_Op ,
ra3.Ramo_Desc,
r2.codigo_ramo_Op , 
r2.Ramo_Desc,
pl.Nombre_Comercial ,
cco1.Codigo_Canal_Comercial_Op,
cco1.Nombre_Canal_Comercial,
am1.amparo_desc,
p.numero_poliza,
si.siniestro_id,
pc.numero_certificado,
si.fecha_primera_vigencia_cert,
p.fecha_inicio_primera_vigencia ,
c.nombre_completo,
c.numero_identificacion,
ca.nombre_completo ,
ca.numero_identificacion,
ca.sexo_cd ,
((CAST (pc.fecha_inicio_primera_vigencia AS DATE ) - CA.fecha_nacimiento )/365) ,
((date - CA.fecha_nacimiento )/365) ,
((CAST (coalesce(p.fecha_cancelacion, p.fecha_fin_ultima_vigencia) AS DATE) - p.fecha_inicio_primera_vigencia )/365),
((CAST (coalesce(pc.fecha_cancelacion, pc.fecha_fin_ultima_vigencia) AS DATE ) - pc.fecha_inicio_primera_vigencia )/365) ,
p.Fecha_Expedicion ,
suc.codigo_op,
SUC.Nombre_Sucursal ,
reg.Nombre_Regional ,
AG.nombre_agente , 
AG.codigo_op ,
e.causa_siniestro_cd , 
e.causa_siniestro_desc, 
si.diagnostico_desc ,
AJ.Nombre_Ajustador ,
s2.Tipo_Estado_Siniestro_Cd,
si.Fecha_Siniestro,
si.Fecha_Aviso_Siniestro, 
s2.Fecha_Apertura_Siniestro ,
s2.Fecha_ultima_actualizacion,
s2.fecha_primer_cierre_siniestro,
vcau.Causa_Estado_Siniestro_Desc,
r1.reclamacion_desc ,  
ta1.tipo_Atencion_Desc,  
as1.apertura_siniestro_Desc , 
ca1.Numero_Identificacion,
ca1.Nombre_completo,
s2.Ind_Pago_Automatico,
su1.subsituacion_sini_desc
