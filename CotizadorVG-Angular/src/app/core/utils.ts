/**
 * Funciones puras (sin estado ni DOM). Portadas de "FUNCIONES AUXILIARES" y utilidades
 * de fecha / moneda del app.js original. Los nombres se conservan.
 */
import { NOMBRES_AMPARO_RESUMIDO } from './config';

export function generarUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatearDinero(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(valor);
}

export function parsearValorAsegurado(valor: any): number {
  if (typeof valor === 'number') return valor;
  return Number(String(valor ?? '').replace(/[^0-9]/g, ''));
}

export function obtenerValorAseguradoBase(asegurado: any): number {
  const coberturaVida = asegurado.coberturas?.find(
    (c: any) => c.codigo === 'WET' || c.codigo === 'VID' || c.codigo === 'VIDA',
  );
  return coberturaVida?.valorAsegurado || 0;
}

export function normalizarTexto(valor: any): string {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function obtenerAmparoResumidoDefinitivo(nombre: string): string {
  const nombreNormalizado = normalizarTexto(nombre);
  const equivalencia = Object.entries(NOMBRES_AMPARO_RESUMIDO).find(
    ([nombreAnterior]) => normalizarTexto(nombreAnterior) === nombreNormalizado,
  );
  return equivalencia?.[1] || nombre;
}

export function escaparHTML(valor: any): string {
  const mapa: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
  return String(valor ?? '').replace(/[&<>'"]/g, (c) => mapa[c]);
}

/** Devuelve solo los dígitos como número, o null si no hay dígitos. */
export function obtenerValorMonetario(valor: any): number | null {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return digitos === '' ? null : Number(digitos);
}

export function formatearValorMonetario(valor: any): string {
  if (valor === null || valor === undefined || valor === '') return '';
  return `$ ${Number(valor).toLocaleString('es-CO')}`;
}

/* ---------- Fechas (formato ISO yyyy-mm-dd) ---------- */

export function sumarUnAnioISO(fechaISO: string): string {
  const [anio, mes, dia] = String(fechaISO || '').slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return '';
  const fecha = new Date(anio + 1, mes - 1, dia);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function formatearFechaISO(fechaISO: string): string {
  const [anio, mes, dia] = String(fechaISO || '').slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—';
}

export function desplazarAnioFecha(fechaISO: string, anios: number): string {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO || '');
  if (!coincidencia) return '';
  const anio = Number(coincidencia[1]) + anios;
  const mes = Number(coincidencia[2]);
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dia = Math.min(Number(coincidencia[3]), diasDelMes);
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function obtenerFechaActualISO(): string {
  const ahora = new Date();
  const diferenciaZonaHoraria = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - diferenciaZonaHoraria).toISOString().slice(0, 10);
}

export function sumarDiasISO(fechaISO: string, dias: number): string {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO || '');
  if (!coincidencia) return '';
  const fecha = new Date(
    Date.UTC(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]) + dias),
  );
  return fecha.toISOString().slice(0, 10);
}

/* ---------- Canal comercial ---------- */

export function normalizarCanalComercial(valor: any): string {
  const texto = String(valor || '').trim().toUpperCase();
  if (texto === 'PROMOTORA' || texto === 'PROMOTORAS') return 'PROMOTORAS';
  if (texto === 'SUCURSAL' || texto === 'SUCURSALES') return 'SUCURSALES';
  if (texto === 'CORREDOR' || texto === 'CORREDORES') return 'CORREDORES';
  return '';
}

export function esCanalPromotora(valor: any): boolean {
  return normalizarCanalComercial(valor) === 'PROMOTORAS';
}
