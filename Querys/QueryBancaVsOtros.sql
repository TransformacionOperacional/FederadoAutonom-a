/*====================================================================
OBJETIVO: Extrae información de pólizas BANCASEGUROS - Ramo 081
====================================================================
DESCRIPCIÓN:
  - Obtiene listado de pólizas vigentes del grupo BANCASEGUROS
  - Filtra específicamente Ramo 081 (Ramo de Crédito Protegido)
  - Incluye datos del asegurado (cliente) y contacto directo
  - Excluye regional PANAMA
  - Solo pólizas activas (estado_poliza_cd = 4)

CAMPOS PRINCIPALES:
  - Información de Ramo y Producto
  - Número de póliza y fechas de vigencia
  - Datos del cliente asegurado (DNI, email)
  - Causa del estado de la póliza

TABLAS PRINCIPALES:
  - v_poliza_certificado: Certificados activos
  - V_POLiza: Información de pólizas
  - V_PLAN_INDIVIDUAL: Planes
  - V_CLIENTE: Datos asegurados/clientes
  
FILTROS CLAVE:
  - Ramo: 081 (Crédito Protegido)
  - Estado Póliza: 4 (Vigente)
  - Canal: BANCASEGUROS
  - Excluye: REGIONAL PANAMA
====================================================================*/

SELECT DISTINCT
r.Codigo_Ramo_Op,
r.Ramo_Desc,
pi.Codigo_Plan_Op,
pro.Producto_Desc,
ca.Causa_Estado_Desc,
po.Numero_Poliza,
po.Fecha_Inicio_Primera_Vigencia,
po.Fecha_Proxima_Renovacion,
--CL.Tipo_Identificacion_Cd,
--TD.Tipo_Identificacion_Desc,
--CL.Numero_Identificacion,
CL.Dni_Cliente,
--CL.Nombre_Completo,
--CL.Edad_Cliente,
--CLIENTE_TELEFONO.Telefono_Txt as Celular_Cliente,
CL.email_Contacto
--Coalesce (NIVP.Nivel_Prob_Desc,'Sin Informacion') as Nivel_Probabilidad_Cancelacion_Mes_3,
/*Reg.Nombre_Regional,
I.Nombre_Grupo_Canal_Comercial,
--cc.Codigo_Canal_Comercial_Op,
cc.Nombre_Canal_Comercial,
Suc.Codigo_Op as Codigo_Sucursal,
Suc.Nombre_Sucursal,
Ag.Codigo_Op as Codigo_Asesor,
Ag.Nombre_agente as Nombre_Asesor,*/
--CAST((A.Produccion ) AS DECIMAL(18,0) ) Valor_Prima_Anual
--PC.Valor_Prima as Valor_Prima
--AVERAGE ( (CAST((A.Produccion ) AS DECIMAL(18,0) ))) Valor_Prima_Anual
--SUM ( (CAST((PC.Valor_Prima*PC.valor_tasa ) AS DECIMAL(18,0) ))) Valor_Prima_Anual,

/*CASE
WHEN Valor_Prima_Anual >=900000 and Valor_Prima_Anual<= 1100000 THEN 'Clientes entre 900000 y 1100000'
WHEN Valor_Prima_Anual >1100000 and Valor_Prima_Anual<=1300000  THEN 'Clientes entre 1100001 y 1300000'
WHEN Valor_Prima_Anual >1300000 THEN 'Clientes Mayor a 1300000'
END Rango_Prima*/

/*SUM ( (CAST((PC.valor_asegurado_inicial*PC.valor_tasa ) AS DECIMAL(18,0) ))) valor_asegurado_total,
SUM(CAST (CASE WHEN PC.amparo_id=930       THEN PC.Valor_Asegurado_Inicial     *PC.valor_tasa ELSE 0 END   AS decimal (18,0))) AS valor_asegurado_vida*/

FROM mdb_Seguros_Colombia.v_poliza_certificado  v

INNER JOIN  mdb_seguros_colombia.V_POLiza po
ON (v.poliza_id  = po.poliza_id )

Inner Join mdb_seguros_colombia.V_PLAN_INDIVIDUAL pi
    On  ( v.Plan_Individual_Id = pi.Plan_Individual_Id )

Inner Join mdb_seguros_colombia.V_PRODUCTO pro
On( pi.Producto_Id = pro.Producto_Id ) 
Inner Join mdb_seguros_colombia.V_RAMO r
 On  ( pro.Ramo_Id = r.Ramo_Id ) 
    
Inner Join mdb_seguros_colombia.V_sucursal suc 
 On (po.sucursal_id = suc.sucursal_id)
    
Inner Join    mdb_Seguros_Colombia.V_REGIONAL              reg
 On (suc.Regional_Id = reg.Regional_Id)
    
Inner Join mdb_seguros_colombia.V_agente ag 
On (po.agente_lider_id = ag.agente_id)
    
Left outer  Join mdb_seguros_colombia.v_Canal_Comercial cc 
on (suc.Canal_Comercial_id=cc.Canal_Comercial_id)

Inner Join  mdb_Seguros_Colombia.v_grupo_canal_comercial I
 On  (cc.grupo_canal_comercial_id = I.grupo_canal_comercial_id)

Inner Join mdb_seguros_colombia.V_CLiente CL--Asegurado
On  (v.Asegurado_Id = CL.Cliente_id) 

LEFT Join mdb_seguros_colombia.V_CAUSA_ESTADO CA
On  (po.estado_poliza_cd = CA.Estado_Contrato_Cd and po.Causa_Estado_Cd=CA.Causa_Estado_Cd) 

LEFT OUTER JOIN mdb_Seguros_Colombia.V_CLIENTE_TELEFONO AS CLIENTE_TELEFONO
ON  (CL.Cliente_Id = CLIENTE_TELEFONO.Cliente_Id 
     AND CLIENTE_TELEFONO.Uso_Direccion_Cd IN (4)
     AND CHARACTER_LENGTH (CLIENTE_TELEFONO.Telefono_Txt) = 10)

--LEFT JOIN mdb_seguros_colombia.VM_ABI_VPC_CLIENTES VPC
--LEFT JOIN mdb_seguros_colombia.VH_ABI_VPC_CLIENTE VPC--tabla para obtener la base de clientes probabilidad de cancelacion de los clientes
--On VPC.DNI_CLiente = CL.DNI_CLiente and VPC.Ramo_Agrup_Id=pro.Ramo_id and VPC.Ind_Ramo_Canal_No_Vigente = 0 and VPC.Mes_id in (sel distinct max (Mes_id)from MDB_SEGUROS_COLOMBIA.VH_ABI_VPC_CLIENTE) 
    				
--LEFT JOIN MDB_SEGUROS_COLOMBIA.VC_ABI_NIVEL_PROBABILIDAD NIVP ON (NIVP.Nivel_Prob_Id = VPC.Nivel_Prob_Canc_Mes_12_Id )--probabilidad cancelacion a 12 meses
--LEFT JOIN MDB_SEGUROS_COLOMBIA.VC_ABI_NIVEL_PROBABILIDAD NIVP ON (NIVP.Nivel_Prob_Id = VPC.Nivel_Prob_Canc_Mes_3_Id  )--probabilidad cancelacion a 3 meses

/*LEFT JOIN (SEL DISTINCT A.Poliza_Id,A.Plan_Individual_Id,SUM ( (CAST((A.Valor_Prima*A.valor_tasa ) AS DECIMAL(18,0) ))) Produccion
FROM mdb_Seguros_Colombia.V_EVENTO_PROD_COBERTURA   A
INNER JOIN  mdb_Seguros_Colombia.V_PLAN_INDIVIDUAL  D ON ( A.Plan_Individual_Id = D.Plan_Individual_Id ) 
INNER JOIN  mdb_Seguros_Colombia.V_PRODUCTO E ON( D.Producto_Id = E.Producto_Id and E.Ramo_Id=78) 
INNER JOIN  mdb_Seguros_Colombia.v_poliza p ON (p.poliza_id = a.poliza_id) 
INNER JOIN mdb_Seguros_Colombia.V_SUCURSAL suc ON (p.Sucursal_Id = suc.Sucursal_Id AND SUC.Canal_Comercial_id in (57824668,24390656,28686321,24390669))
WHERE A.fecha_registro  BETWEEN CURRENT_DATE- INTERVAL '1' YEAR  AND CURRENT_DATE
AND A.Tipo_Coaseguro_Cd <>'C'
AND A.Tipo_Oper_Produccion_Cd IN (21,22)
GROUP BY 1,2
)A
ON A.Poliza_Id=v.Poliza_Id */

WHERE   
r.Codigo_Ramo_Op in ('081')

And   po.estado_poliza_cd  =4
	
And v.Estado_Certificado_cd = 4
       	
And Reg.Nombre_Regional not in ('REGIONAL PANAMA')

And I.Nombre_Grupo_Canal_Comercial in ('BANCASEGUROS')

--And pro.Producto_Desc in ('PLAN CREDITO PROTEGIDO','PLAN CREDITO PROTEGIDO')

--And CL.Numero_Identificacion in ()

--Group by 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18--,19
