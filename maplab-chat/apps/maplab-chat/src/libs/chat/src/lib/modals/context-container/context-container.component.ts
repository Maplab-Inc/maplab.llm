import { Component } from '@angular/core';

enum AppCode {
  optimization, direction, isochrone, geoCoding
}

@Component({
  selector: 'maplab-chat-context-container',
  templateUrl: './context-container.component.html',
  standalone: false,
})
export class ContextContainerComponent {
  options = [
    { appName: "Optimization", appId: AppCode.optimization },
  ]

  selectedApp = 0;
  appCode = AppCode;
}
