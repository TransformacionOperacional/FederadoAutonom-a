import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  correo = '';
  clave = '';
  mensaje = '';
  cargando = false;
  invalido = false;

  async enviar(): Promise<void> {
    this.mensaje = '';
    this.invalido = false;
    this.cargando = true;
    try {
      const error = await this.auth.iniciarSesion(this.correo.trim(), this.clave);
      if (error) {
        this.mensaje = error;
        this.invalido = error.startsWith('El correo o contraseña');
        return;
      }
      await this.router.navigateByUrl('/', { replaceUrl: true });
    } finally {
      this.cargando = false;
    }
  }
}
