import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiOverlaysComponent } from './components/ui-overlays/ui-overlays.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UiOverlaysComponent],
  template: '<router-outlet /><app-ui-overlays />',
})
export class App {}
