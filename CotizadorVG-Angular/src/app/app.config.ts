import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // El estado del cotizador es un objeto mutable (igual que el original): se usa zone.js
    // para que cualquier evento / promesa / timer dispare la detección de cambios.
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
  ],
};
