import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-redes-cli-console',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './redes-cli-console.component.html',
  styleUrls: ['./redes-cli-console.component.css']
})
export class RedesCliConsoleComponent {
  @Input() configText = '';
  @Output() closeCli = new EventEmitter<void>();

  copied = false;

  copyToClipboard(): void {
    if (!this.configText) return;
    navigator.clipboard.writeText(this.configText);
    this.copied = true;
    setTimeout(() => {
      this.copied = false;
    }, 1800);
    alert('Configuración copiada');
  }
}
