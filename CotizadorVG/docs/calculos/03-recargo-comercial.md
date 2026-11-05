# 3. Recargo comercial y tasa comercial

**Funciones:** `obtenerRecargoComercial()` y `aplicarRecargoATasa(tasaPura)` en [`js/app.js`](../../js/app.js).

La tasa pura se «infla» para cubrir los gastos de la operación. El cotizador lo hace **dividiendo**, no sumando:

$$
T_{comercial} = \frac{T_{pura}}{1 - FG}
\qquad FG = \frac{\text{Factor de gasto total (\%)}}{100}
$$

Si $FG \ge 1$ no se aplica el ajuste y se devuelve la tasa pura.

## Componentes del factor de gasto (en puntos porcentuales)

| Concepto | Valor | Regla |
|----------|-------|-------|
| Comisión | Variable | Se redondea y se limita entre **10 y 30** (si falta, 10) |
| Honorario promotora | Variable | Entre 0 y 10; **solo** si el canal es `PROMOTORAS`, en otro caso 0 |
| Retorno | Variable | Entre 0 y 30; se incorpora al factor de gasto. Comisión + retorno no puede superar 40% |
| Costo de contrato | 1,64 | Fijo |
| IVA | Calculado | $(\text{Comisión} + \text{Honorario} + \text{Retorno}) \times 19\%$ |
| Gasto administrativo | 8 o 13 | 8 para `PROMOTORAS`; 13 para los demás canales |
| Utilidad | 1,6 | Fijo |

$$
FG_{\%} = Comisión + Honorario + Retorno + CostoContrato + IVA + GastoAdmin + Utilidad
$$

El valor de Retorno se suma al factor de gasto y participa en el cálculo del IVA. La validación del formulario limita Retorno a 30% y Comisión + Retorno a 40%.

## Canal comercial

El canal se normaliza con `normalizarCanalComercial`; los valores válidos son `SUCURSALES`, `PROMOTORAS` y `CORREDORES`. Si no hay canal definido se usa `SUCURSALES`.

## Ejemplos del factor de gasto

| Canal | Comisión | Honorario | IVA | Total |
|-------|----------|-----------|-----|-------|
| Sucursales | 10 | 0 | 1,90 | $10 + 0 + 0 + 1{,}64 + 1{,}90 + 13 + 1{,}6 = 28{,}14\%$ |
| Promotoras | 10 | 10 | 3,80 | $10 + 10 + 0 + 1{,}64 + 3{,}80 + 8 + 1{,}6 = 35{,}04\%$ |

La ventana de confirmación `mostrarConfirmacionRecargoComercial()` presenta este mismo desglose antes de pasar al siguiente paso.
