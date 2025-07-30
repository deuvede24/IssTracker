/*import { Component } from '@angular/core';

@Component({
  selector: 'app-bottom-nav',
  imports: [],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss'
})
export class BottomNavComponent {

}
*/
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrls: ['./bottom-nav.component.scss'],
})
export class BottomNavComponent {
  // Si más adelante quieres lógica (por ejemplo, notificaciones pendientes),
  // la pones aquí.
}
