import { Injectable, signal } from '@angular/core';
import { AGRUPACIONES_SINIESTROS, TASA_BASE_SISTEMA } from './config';
import { Estado, Flujo, GrupoSalarial, Cobertura } from './models';
import {
  esCanalPromotora,
  generarUUID,
  normalizarCanalComercial,
  obtenerAmparoResumidoDefinitivo,
} from './utils';

export const CLAVE_ESTADO = 'cotizadorEstado';
export const CLAVE_PASO = 'pasoActual';

export function crearEstadoInicial(coberturasCatalogo: Cobertura[] = []): Estado {
  return {
    poliza: {
      id: generarUUID(),
      tomador: '',
      tipoIdentificacion: 'NIT',
      numeroIdentificacion: '',
      modalidadPlan: 'Patronal (No Contributiva)',
      actividad: '',
      actividadDetalle: null,
      vigenciaDesde: '',
      vigenciaHasta: '',
      oficina: '',
      formaPago: 'Anual',
      tipoPagoMensual: 'Vencida',
      condicionesEspeciales: '',
      esContinuidad: false,
      numeroPolizaAnterior: '',
      companiaAnterior: '',
      fechaCobro: '',
      numeroPoliza: '',
      segmento: '',
      direccionCorrespondencia: '',
      validezOferta: '',
      comision: 20,
      retorno: 0,
      honorarioPromotora: 10,
      aplicaCredibilidad: false,
      valorSiniestrosTotales: 0,
      anosExposicion: 0,
      siniestrosPromedio: 0,
      siniestrosInformados: false,
      detalleSiniestrosCobertura: false,
      gruposSiniestrosPoliza: [],
      siniestrosPorCobertura: [],
      codigoAsesor: '',
      asesor: '',
      regional: '',
      oficinasAsesor: [],
      oficinaAsesor: '',
      codigoOficinaAsesor: '',
      canalComercial: '',
    },
    coberturasCatalogo,
    tasasPorCoberturaEdad: {},
    tasasPorCoberturaEdadDeducible: {},
    porcentajesFactorPorCoberturaEdad: {},
    valoresMaximosPorCoberturaEdad: {},
    edadesMaximasPorCobertura: {},
    asegurados: [],
    subgrupos: [],
    planes: [],
    sugerencias: [],
    historial: [],
  };
}

/**
 * Estado global del cotizador (equivale a las variables globales `estado`, `pasoActual`,
 * `flujo`, `gruposSalariales`, `coberturasDisponibles`, ... del app.js original).
 *
 * REGLA: `estado` puede reemplazarse por completo (cargarEstado / reiniciar), por eso los
 * servicios y componentes SIEMPRE deben leer `this.store.estado` y nunca guardar una
 * referencia a `estado` o `estado.poliza` a largo plazo.
 */
@Injectable({ providedIn: 'root' })
export class CotizadorStore {
  /** Cobertura Vida (WET) que siempre existe aunque la API de tasas no responda. */
  readonly coberturaVidaPredeterminada: Cobertura = {
    codigo: 'WET',
    codigoAmparo: 63717,
    nombre: 'VIDA',
    tasaBase: TASA_BASE_SISTEMA,
    obligatoria: true,
  };

  /** Catálogo que entrega la API de tasas (se llena en CatalogoService). */
  coberturasDisponibles: Cobertura[] = [this.coberturaVidaPredeterminada];
  catalogoCoberturasCompleto: Cobertura[] = [...this.coberturasDisponibles];
  actividadesEconomicas: any[] = [];

  estado: Estado = crearEstadoInicial(this.crearCatalogoInicial());
  pasoActual = 1;
  flujo: Flujo = { tipo: null, subtipo: null, polizaSeleccionada: null };
  gruposSalariales: GrupoSalarial[] = [
    { rango: '< 2 SMMLV', porcentaje: 40, salarioRef: 1.5 },
    { rango: '2 - 5 SMMLV', porcentaje: 35, salarioRef: 3.5 },
    { rango: '> 5 SMMLV', porcentaje: 25, salarioRef: 8 },
  ];
  /** Resultado del cálculo del paso 5 (equivale a `resumenCotizacion`). */
  resumenCotizacion: any = null;

  /** Emite un tick cada vez que el estado cambia y las vistas calculadas deben refrescarse. */
  readonly version = signal(0);
  notificarCambio(): void {
    this.version.update((v) => v + 1);
  }

  crearCatalogoInicial(): Cobertura[] {
    const vida = this.coberturasDisponibles?.find((c) => c.codigo === 'WET') ?? this.coberturaVidaPredeterminada;
    return [{ ...vida, tasaBase: TASA_BASE_SISTEMA, obligatoria: true }];
  }

  /** Estado nuevo y limpio (no toca localStorage). */
  reiniciarEstado(): void {
    this.estado = crearEstadoInicial(this.crearCatalogoInicial());
    this.pasoActual = 1;
    this.flujo = { tipo: null, subtipo: null, polizaSeleccionada: null };
    this.resumenCotizacion = null;
  }

  /* ---------- Persistencia (localStorage) ---------- */

  guardarEstado(): boolean {
    try {
      localStorage.setItem(CLAVE_ESTADO, JSON.stringify(this.estado));
      localStorage.setItem(CLAVE_PASO, JSON.stringify(this.pasoActual));
      return true;
    } catch (err) {
      console.error('Error al guardar:', err);
      return false;
    }
  }

  borrarEstadoGuardado(): void {
    localStorage.removeItem(CLAVE_ESTADO);
    localStorage.removeItem(CLAVE_PASO);
  }

  cargarEstado(): boolean {
    try {
      const estadoGuardado = localStorage.getItem(CLAVE_ESTADO);
      const pasoGuardado = localStorage.getItem(CLAVE_PASO);

      if (estadoGuardado) {
        const estado = JSON.parse(estadoGuardado);
        this.estado = estado;
        estado.edadesMaximasPorCobertura = estado.edadesMaximasPorCobertura || {};
        estado.tasasPorCoberturaEdadDeducible = estado.tasasPorCoberturaEdadDeducible || {};
        estado.valoresMaximosPorCoberturaEdad = estado.valoresMaximosPorCoberturaEdad || {};
        estado.asegurados = (estado.asegurados || []).map((asegurado: any) => ({
          ...asegurado,
          tipoAsegurado: asegurado.tipoAsegurado === 'Empleado' ? 'Afiliado principal' : asegurado.tipoAsegurado,
        }));
        const p = estado.poliza;
        p.modalidadPlan = p.modalidadPlan || 'Voluntaria (Contributiva)';
        p.tipoPagoMensual = p.tipoPagoMensual || (p.pagoMensualAnticipado === true ? 'Anticipada' : 'Vencida');
        p.condicionesEspeciales = String(p.condicionesEspeciales || '');
        p.esContinuidad = p.esContinuidad === true;
        p.numeroPolizaAnterior = String(p.numeroPolizaAnterior || '');
        p.companiaAnterior = String(p.companiaAnterior || '');
        delete p.pagoMensualAnticipado;
        p.canalComercial = normalizarCanalComercial(p.canalComercial);
        p.comision = Math.min(Math.max(Math.round(Number(p.comision) || 10), 10), 30);
        p.retorno = Math.min(Math.max(Number(p.retorno) || 0, 0), Math.min(30, 40 - p.comision));
        p.honorarioPromotora = Math.min(Math.max(Number(p.honorarioPromotora) || 0, 0), 10);
        if (!esCanalPromotora(p.canalComercial)) p.honorarioPromotora = 0;
        p.aplicaCredibilidad = p.aplicaCredibilidad === true;
        p.valorSiniestrosTotales = Number(p.valorSiniestrosTotales) || 0;
        p.anosExposicion = Math.min(4, Math.max(0, Math.round(Number(p.anosExposicion) || 0)));
        p.siniestrosPromedio = Number(p.siniestrosPromedio) || 0;
        p.detalleSiniestrosCobertura = p.detalleSiniestrosCobertura === true;
        const gruposPrevios: string[] = Array.isArray(p.gruposSiniestrosPoliza) ? p.gruposSiniestrosPoliza : [];
        const siniestrosPrevios: any[] = Array.isArray(p.siniestrosPorCobertura) ? p.siniestrosPorCobertura : [];
        p.gruposSiniestrosPoliza = AGRUPACIONES_SINIESTROS.map((g) => g.codigo).filter(
          (codigo) => gruposPrevios.includes(codigo) || siniestrosPrevios.some((item) => item && item.codigo === codigo),
        );
        p.siniestrosPorCobertura = siniestrosPrevios
          .filter((item) => item && AGRUPACIONES_SINIESTROS.some((g) => g.codigo === item.codigo))
          .map((item) => ({
            codigo: String(item.codigo),
            nombre: AGRUPACIONES_SINIESTROS.find((g) => g.codigo === item.codigo)!.nombre,
            valor: item.valor === null || item.valor === undefined || item.valor === '' ? null : Number(item.valor) || 0,
          }));
        p.siniestrosInformados =
          p.aplicaCredibilidad && (p.siniestrosInformados === true || p.valorSiniestrosTotales > 0);
      }

      if (pasoGuardado) {
        this.pasoActual = Math.min(Math.max(Number(JSON.parse(pasoGuardado)) || 1, 1), 5);
      }
      return true;
    } catch (err) {
      console.error('Error al cargar estado:', err);
      return false;
    }
  }

  /* ---------- Sincronización con el catálogo de coberturas ---------- */

  sincronizarVidaObligatoria(): void {
    const vida = this.coberturasDisponibles.find((c) => c.codigo === 'WET');
    if (!vida) return;
    const estado = this.estado;

    estado.coberturasCatalogo = estado.coberturasCatalogo
      .filter((c) => c.codigo !== 'VID')
      .map((c) => ({ ...c, obligatoria: c.codigo === 'WET' || c.obligatoria }));

    if (!estado.coberturasCatalogo.some((c) => c.codigo === 'WET')) {
      estado.coberturasCatalogo.unshift({ ...vida, tasaBase: TASA_BASE_SISTEMA, obligatoria: true });
    }

    estado.asegurados.forEach((asegurado: any) => {
      const vidaAnterior = asegurado.coberturas?.find((c: any) => c.codigo === 'VID');
      asegurado.coberturas = (asegurado.coberturas || []).filter((c: any) => c.codigo !== 'VID');
      if (!asegurado.coberturas.some((c: any) => c.codigo === 'WET')) {
        asegurado.coberturas.push({
          codigo: vida.codigo,
          codigoAmparo: vida.codigoAmparo,
          nombre: vida.nombre,
          activa: true,
          valorAsegurado: vidaAnterior?.valorAsegurado || 0,
          tasa: TASA_BASE_SISTEMA,
          prima: 0,
        });
      }
    });
  }

  sincronizarNombresVisiblesCoberturas(): void {
    const nombrePorCodigo = new Map(this.coberturasDisponibles.map((c) => [c.codigo, c.nombre]));
    this.estado.coberturasCatalogo.forEach((cobertura) => {
      const original = nombrePorCodigo.get(cobertura.codigo) || cobertura.nombre;
      cobertura.nombre = obtenerAmparoResumidoDefinitivo(original);
    });
    this.estado.asegurados.forEach((asegurado: any) => {
      (asegurado.coberturas || []).forEach((cobertura: any) => {
        cobertura.nombre = nombrePorCodigo.get(cobertura.codigo) || cobertura.nombre;
      });
    });
  }
}
