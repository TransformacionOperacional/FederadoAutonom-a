import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface UsuarioSesion {
  correo: string;
  nombreCompleto: string;
  primerNombre: string;
}

/** Sesión: login contra Power Automate, validación de tokens y cierre de sesión. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  /** Devuelve null si se autenticó, o el mensaje de error a mostrar. */
  async iniciarSesion(correo: string, clave: string): Promise<string | null> {
    try {
      const response = await fetch(environment.apis.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Correo: correo.trim(), Clave: clave, origenSolicitud: 'Pagina Web' }),
      });
      if (response.status === 402) return 'El correo o contraseña no es válido. Intenta de nuevo.';
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.validacion !== 'OK' || !data.token || !data.token2) {
        throw new Error('La respuesta de autenticación no contiene una sesión válida.');
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('token2', data.token2);
      return null;
    } catch (error) {
      console.error('No fue posible iniciar sesión:', error);
      return 'No fue posible validar las credenciales. Intenta nuevamente.';
    }
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('token2');
    localStorage.removeItem('correoElectronico');
    this.router.navigateByUrl('/login');
  }

  async validarToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(environment.apis.validarToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) return false;
      return (await response.json()).EsValido === true;
    } catch (error) {
      console.error('No fue posible validar la sesión:', error);
      return false;
    }
  }

  /** true si la sesión es válida (equivale a protegerPagina de auth-guard.js). */
  async sesionValida(): Promise<boolean> {
    const token = localStorage.getItem('token');
    const token2 = localStorage.getItem('token2');
    if (!token && !token2) return false;

    const [tokenValido, token2Valido] = await Promise.all([
      token ? this.validarToken(token) : false,
      token2 ? this.validarToken(token2) : false,
    ]);
    if (!tokenValido && !token2Valido) return false;
    if (!tokenValido && token2Valido) localStorage.setItem('token', token2!);
    return true;
  }

  private decodificarToken(token: string | null): any {
    if (!token) return null;
    const candidatos = [token, ...String(token).split('.')];
    for (const candidato of candidatos) {
      try {
        const base64 = candidato.replace(/-/g, '+').replace(/_/g, '/');
        const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
        const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
        const datos = JSON.parse(new TextDecoder('utf-8').decode(bytes));
        if (datos && typeof datos === 'object') return datos;
      } catch {
        // se prueba con el siguiente candidato
      }
    }
    return null;
  }

  obtenerUsuario(): UsuarioSesion | null {
    const datos = this.decodificarToken(localStorage.getItem('token')) || this.decodificarToken(localStorage.getItem('token2'));
    if (!datos) return null;
    const nombreCompleto = String(datos.NombreCompleto || '').trim();
    const primero = nombreCompleto.split(/\s+/)[0] || '';
    return {
      correo: String(datos.CorreoElectronico || '').trim(),
      nombreCompleto,
      primerNombre: primero ? primero.charAt(0).toLocaleUpperCase('es') + primero.slice(1).toLocaleLowerCase('es') : '',
    };
  }
}
