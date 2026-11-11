/**
 * Modelos del dominio. Se mantienen deliberadamente flexibles (index signature) porque el
 * estado original es un objeto mutable cuya forma crece durante el flujo y se persiste
 * tal cual en localStorage y en la API de cotizaciones.
 */

export interface Cobertura {
  codigo: string;
  codigoAmparo?: number | string;
  nombre: string;
  tasaBase?: number;
  obligatoria?: boolean;
  [clave: string]: any;
}

export interface Poliza {
  id: string;
  tomador: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  modalidadPlan: string;
  actividad: string;
  actividadDetalle: any;
  vigenciaDesde: string;
  vigenciaHasta: string;
  formaPago: string;
  tipoPagoMensual: string;
  canalComercial: string;
  [clave: string]: any;
}

export interface Asegurado {
  id: string;
  [clave: string]: any;
}

export interface Subgrupo {
  id: string;
  nombre: string;
  [clave: string]: any;
}

export interface Plan {
  id: string;
  subgrupoId?: string | null;
  nombre: string;
  [clave: string]: any;
}

export interface Estado {
  poliza: Poliza;
  coberturasCatalogo: Cobertura[];
  tasasPorCoberturaEdad: Record<string, any>;
  tasasPorCoberturaEdadDeducible: Record<string, any>;
  porcentajesFactorPorCoberturaEdad: Record<string, any>;
  valoresMaximosPorCoberturaEdad: Record<string, any>;
  edadesMaximasPorCobertura: Record<string, any>;
  asegurados: Asegurado[];
  subgrupos: Subgrupo[];
  planes: Plan[];
  sugerencias: any[];
  historial: any[];
}

export interface Flujo {
  tipo: 'nuevo' | 'renovacion' | null;
  subtipo: 'simulacion' | 'cotizacion' | null;
  polizaSeleccionada: any;
}

export interface GrupoSalarial {
  rango: string;
  porcentaje: number;
  salarioRef: number;
}

export type TipoToast = 'info' | 'success' | 'warning' | 'error';
