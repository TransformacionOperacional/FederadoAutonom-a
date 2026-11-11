import { Injectable, signal } from '@angular/core';
import { TipoToast } from './models';

export interface ConfirmacionCotizador {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  accion: () => void;
  esDestructiva?: boolean;
}

export const UMBRAL_ASEGURADOS_CARGA = 200;

/**
 * Estado de la UI transversal: toast, confirmación genérica y overlay de carga.
 * Lo renderiza el componente raíz (ver `ui-overlays`). Reemplaza a mostrarToast,
 * mostrarConfirmacionCotizador, mostrarCargando/ocultarCargando y ejecutarConCarga.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  readonly toast = signal<{ mensaje: string; tipo: TipoToast; visible: boolean }>({
    mensaje: '',
    tipo: 'info',
    visible: false,
  });
  readonly confirmacion = signal<ConfirmacionCotizador | null>(null);
  readonly cargando = signal<{ visible: boolean; mensaje: string }>({ visible: false, mensaje: '' });

  private cargasActivas = 0;
  private temporizadorToast: ReturnType<typeof setTimeout> | null = null;

  mostrarToast(mensaje: string, tipo: TipoToast = 'info'): void {
    this.toast.set({ mensaje, tipo, visible: true });
    if (this.temporizadorToast) clearTimeout(this.temporizadorToast);
    this.temporizadorToast = setTimeout(() => this.toast.update((t) => ({ ...t, visible: false })), 3000);
  }

  mostrarConfirmacionCotizador(datos: ConfirmacionCotizador): void {
    this.confirmacion.set({ esDestructiva: true, ...datos });
  }

  cancelarConfirmacionCotizador(): void {
    this.confirmacion.set(null);
  }

  confirmarAccionCotizador(): void {
    const accion = this.confirmacion()?.accion;
    this.confirmacion.set(null);
    if (typeof accion !== 'function') throw new Error('No hay una acción pendiente de confirmación.');
    accion();
  }

  mostrarCargando(mensaje = 'Calculando, por favor espera...'): void {
    this.cargasActivas++;
    this.cargando.set({ visible: true, mensaje });
  }

  ocultarCargando(): void {
    this.cargasActivas = Math.max(0, this.cargasActivas - 1);
    if (this.cargasActivas === 0) this.cargando.update((c) => ({ ...c, visible: false }));
  }

  /**
   * Con pocos asegurados el cálculo es inmediato y se ejecuta sin indicador. Con muchos,
   * se muestra el indicador y se cede el control al navegador para que lo pinte.
   * `totalAsegurados` es `store.estado.asegurados.length`.
   */
  ejecutarConCarga<T>(
    totalAsegurados: number,
    mensaje: string,
    funcion: () => T,
    opciones: { forzar?: boolean } = {},
  ): T | Promise<T> {
    if (!opciones.forzar && totalAsegurados < UMBRAL_ASEGURADOS_CARGA) return funcion();

    this.mostrarCargando(mensaje);
    return new Promise<T>((resolver, rechazar) => {
      requestAnimationFrame(() =>
        setTimeout(() => {
          try {
            resolver(funcion());
          } catch (error) {
            rechazar(error);
          } finally {
            this.ocultarCargando();
          }
        }, 0),
      );
    });
  }
}
