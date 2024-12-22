import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'maplab-chat',
  templateUrl: './app.component.html'
})
export class AppComponent {
  title = 'maplab.llm.ui';
}
