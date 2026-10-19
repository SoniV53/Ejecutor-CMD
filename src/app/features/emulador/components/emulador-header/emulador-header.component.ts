import {
  Component,
  EventEmitter,
  Input,
  Output,
  AfterViewInit,
  OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-emulador-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './emulador-header.component.html',
  styleUrls: ['./emulador-header.component.css']
})
export class EmuladorHeaderComponent implements AfterViewInit, OnChanges {
  @Input() url = '';
  @Input() history: string[] = [];
  @Input() isHistoryOpen = false;
  @Input() isMenuVisible = true;
  @Input() currentZoom = 1.0;
  @Input() currentDeviceKey = 'iphone14';
  @Input() isLandscape = false;
  @Input() isTouchEnabled = true;
  @Input() isConsoleOpen = false;

  @Output() urlChange = new EventEmitter<string>();
  @Output() navigate = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() toggleHistory = new EventEmitter<boolean>();
  @Output() clearHistory = new EventEmitter<void>();
  @Output() deleteHistoryItem = new EventEmitter<string>();
  @Output() toggleMenu = new EventEmitter<void>();
  @Output() updateZoom = new EventEmitter<number>();
  @Output() autoFit = new EventEmitter<void>();
  @Output() resetZoom = new EventEmitter<void>();
  @Output() toggleDeviceMode = new EventEmitter<void>();
  @Output() changeDevice = new EventEmitter<string>();
  @Output() toggleRotation = new EventEmitter<void>();
  @Output() toggleTouch = new EventEmitter<void>();
  @Output() toggleConsole = new EventEmitter<void>();

  private blurTimeout: any;

  constructor(
    private router: Router,
    private lucideService: LucideIconService
  ) {}

  ngAfterViewInit(): void {
    this.lucideService.refresh();
  }

  ngOnChanges(): void {
    this.lucideService.refresh();
  }

  get zoomPercentage(): string {
    return `${Math.round(this.currentZoom * 100)}%`;
  }

  goHome(): void {
    this.router.navigate(['/hub']);
  }

  onUrlInputChange(value: string): void {
    this.url = value;
    this.urlChange.emit(value);
  }

  onEnterKey(): void {
    this.navigate.emit(this.url);
  }

  onInputFocus(): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    this.toggleHistory.emit(true);
  }

  onInputBlur(): void {
    this.blurTimeout = setTimeout(() => {
      this.toggleHistory.emit(false);
    }, 200);
  }

  selectHistoryUrl(selectedUrl: string): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    this.url = selectedUrl;
    this.urlChange.emit(selectedUrl);
    this.navigate.emit(selectedUrl);
  }

  onDeleteHistoryItem(event: MouseEvent, itemUrl: string): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    this.deleteHistoryItem.emit(itemUrl);
  }

  onClearHistory(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
    this.clearHistory.emit();
  }

  onDeviceSelectChange(deviceKey: string): void {
    this.changeDevice.emit(deviceKey);
  }
}
