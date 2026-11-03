# 7. Ejemplo numérico completo

> Las tasas de la API usadas aquí son **ilustrativas** para poder seguir la mecánica; no corresponden a tasas reales.

## Datos de entrada

| Dato | Valor |
|------|-------|
| Modalidad | Patronal (No Contributiva) |
| Canal comercial | Sucursales, comisión 10 % |
| Asegurado | Afiliado principal, 40 años |
| Valor de Vida (`WET`) | \$100.000.000 |
| Coberturas del plan | Vida (`WET`) y Enfermedades Graves (`WEU`, 60 %, con Cáncer in Situ) |
| Tasa API Vida a los 40 años | 0,002 |
| Tasa API Enfermedades Graves a los 40 años | 0,001 |
| Recargo por actividad en Vida (`field_3`) | 0,20 (20 %) |
| Recargo por actividad en Enfermedades Graves | No aplica (0) |
| Forma de pago | Anual |

## Paso 1: factor de gasto

Sucursales, comisión 10 %: $10 + 0 + 0 + 1{,}64 + 1{,}90 + 13 + 1{,}6 = 28{,}14\%$, es decir $FG = 0{,}2814$ y $1 - FG = 0{,}7186$.

## Paso 2: valor asegurado

| Cobertura | Cálculo | Valor asegurado |
|-----------|---------|-----------------|
| Vida | Captura directa | \$100.000.000 |
| Enfermedades Graves | $100.000.000 \times 0{,}60$ | \$60.000.000 |

## Paso 3: tasa pura

**Vida**

$$
T_{pura} = 0{,}002 \times (1 + 0{,}20) = 0{,}0024
$$

**Enfermedades Graves** (con Cáncer in Situ)

$$
R_{CIS} = \frac{0{,}678}{1000} \times \frac{0{,}60}{0{,}50} \times 0{,}10 = 0{,}00008136
$$

$$
T_{pura} = (0{,}001 + 0{,}00008136) \times (1 + 0) = 0{,}00108136
$$

## Paso 4: tasa comercial

| Cobertura | Cálculo | Tasa comercial |
|-----------|---------|----------------|
| Vida | $0{,}0024 / 0{,}7186$ | 0,00333983 |
| Enfermedades Graves | $0{,}00108136 / 0{,}7186$ | 0,00150481 |

## Paso 5: prima por cobertura y por asegurado

| Cobertura | Cálculo | Prima |
|-----------|---------|-------|
| Vida | $100.000.000 \times 0{,}00333983$ | \$333.982,74 |
| Enfermedades Graves | $60.000.000 \times 0{,}00150481$ | \$90.288,90 |
| **Prima anual del asegurado** | | **\$424.271,64** |

## Paso 6: forma de pago

| Forma | Cálculo | Valor por pago |
|-------|---------|----------------|
| Anual | $424.271,64 \times 1 / 1$ | \$424.271,64 |
| Semestral | $424.271,64 \times 1{,}522 / 2$ | \$322.870,72 |
| Trimestral | $424.271,64 \times 1{,}267 / 4$ | \$134.388,04 |
| Mensual | $424.271,64 \times 1{,}091 / 12$ | \$38.573,36 |

## Paso 7: tasa única (póliza con solo este asegurado)

$$
T_{única} = \frac{424.271{,}64}{100.000.000} \times 1000 = 4{,}242716 \text{ por mil}
$$

---

## Ejemplo de credibilidad (solo Vida)

Datos adicionales de la póliza: escenario 2, 100 asegurados con \$100.000.000 de Vida cada uno ($VA = 10.000.000.000$), 3 años de exposición, siniestros totales \$50.000.000 y tasa pura teórica de 0,002 para todos.

| Magnitud | Cálculo | Resultado |
|----------|---------|-----------|
| Siniestralidad esperada $E$ | $0{,}002 \times 10.000.000.000$ | \$20.000.000 |
| Peso $P$ (única cobertura) | $20.000.000 / 20.000.000$ | 1 |
| Observada $O$ | $50.000.000 \times 1$ | \$50.000.000 |
| Tasa real | $50.000.000 / (10.000.000.000 \times 3)$ | 0,00166667 |
| Factor $Z$ | $\min(1, \sqrt{100 \times 3 / 1900})$ | 0,39736 |
| Tasa con credibilidad | $0{,}00166667 \times 0{,}39736 + 0{,}60264 \times 0{,}002$ | 0,00186755 |
| Variación | $0{,}00186755 / 0{,}002 - 1$ | −6,62 % |
| Tasa comercial | $0{,}00186755 / 0{,}7186$ | 0,00259887 |
| Prima de un asegurado (Vida) | $100.000.000 \times 0{,}00259887$ | \$259.886,83 |

Frente a la prima sin credibilidad (\$333.982,74), la siniestralidad observada baja la prima de Vida de este asegurado.
