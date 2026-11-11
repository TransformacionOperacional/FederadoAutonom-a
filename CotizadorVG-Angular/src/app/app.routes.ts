import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { CotizadorComponent } from './pages/cotizador/cotizador.component';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Iniciar sesión | Cotizador Vida Grupo' },
  { path: '', component: CotizadorComponent, canActivate: [authGuard], title: 'Cotizador Vida Grupo - Seguros SURA' },
  { path: '**', redirectTo: '' },
];
