SEL
p.numero_poliza,
a.numero_fondo_ahorro,
--Extract (Month from p.Fecha_Fin_Ultima_Vigencia) mes_renov_pol_vida,
--p.Fecha_expedicion expe_pol_vida,
c.dni_cliente,
--c.Nombre_completo,
--c.email_contacto,
--c.Telefono_contacto,
EF.Fecha_Operacion,
EF.Fecha_Registro,
T.Tipo_Oper_Fondo_Ahorro_desc,
AG.Codigo_Op AS Codigo_Agente,
--ag.Nombre_Agente,
--CASE WHEN Substr(a.numero_fondo_ahorro,1,3) = '082' THEN Cast('FONDO DE AHORRO SUCAPITAL' AS CHAR(30))
           --WHEN Substr(a.numero_fondo_ahorro,1,3) = '074' THEN Cast('FONDO CON PORTAFOLIO EN DOLARES' AS CHAR(30))
           --WHEN Substr(a.numero_fondo_ahorro,1,3) = '073' THEN Cast('FONDO CON PORTAFOLIO EN PESOS' AS CHAR(30))
          -- WHEN Substr(a.numero_fondo_ahorro,1,3) = '075' THEN Cast('FONDO DE AHORRO CAFEVIDA' AS CHAR(30))
           --ELSE Cast('OTRO' AS CHAR(30))
--END Codigo_Fondo,
--pc.Valor_Asegurado_Alcanzado,
EF.Valor_Operacion  valor_fondo

FROM mdb_Seguros_Colombia.V_Evento_Fondos EF

INNER JOIN mdb_Seguros_Colombia.v_tipo_oper_fondo_ahorro  T
                ON         (EF.Tipo_Operacion_Cd = T.TIPO_OPER_FONDO_AHORRO_CD)
				
JOIN v_Fondo_Ahorro a
				ON a.fondo_ahorro_id=EF.fondo_ahorro_id

JOIN V_Poliza_Certificado pc
				ON pc.Poliza_id=EF.poliza_id
				
INNER JOIN mdb_Seguros_Colombia.v_poliza P
                ON          (EF.poliza_id = P.POLIZA_ID)
				
INNER JOIN MDB_SEGUROS_COLOMBIA.V_AGENTE AG 
ON AG.Agente_Id=P.Agente_Lider_Id

INNER JOIN mdb_Seguros_Colombia.v_cliente c
                ON          (p.tomador_id = c.cliente_id)

INNER JOIN mdb_Seguros_Colombia.v_ciudad ci
				ON 			(c.Ciudad_contacto_Id = ci.Ciudad_Id)

INNER JOIN mdb_Seguros_Colombia.v_ramo  r
                ON(ef.ramo_id= r.ramo_id)

				
WHERE  1=1
--AND EF.mes_id BETWEEN (202101) AND (202201)
--AND r.Codigo_Ramo_Op IN ('081')
--AND Tipo_Oper_Fondo_Ahorro_desc NOT LIKE ('SALDO')---,'INVERSION INICIAL')
--AND C.Dni_cliente IN ('C1010188498')
AND PC.Numero_Poliza='081003686280'
--AND p.estado_poliza_cd ='4'
--AND mes_renov_pol_vida = '1'
ORDER BY p.numero_poliza,
fecha_operacion
