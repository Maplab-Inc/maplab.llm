import { Component, Input } from '@angular/core';

@Component({
  selector: 'maplab-chat-panel-child',
  templateUrl: './panel-child.component.html',
  styleUrl: './panel-child.component.scss',
  standalone: false,
})
export class PanelChildComponent {
  @Input({ required: true }) title = '';
  @Input() collapsed = false;

  hideContent = false;

  onBeforeToggle(): void {
    if (this.collapsed) {
      this.hideContent = false;
    }
  }

  onAfterToggle(): void {
    this.hideContent = this.collapsed;
  }
}
