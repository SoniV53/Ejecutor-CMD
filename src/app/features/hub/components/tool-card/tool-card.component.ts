import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface HubToolCard {
  route: string;
  title: string;
  description: string;
  icon: string;
  color: 'indigo' | 'purple' | 'orange' | 'sky' | 'emerald' | 'blue';
}

@Component({
  selector: 'app-tool-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tool-card.component.html',
  styleUrls: ['./tool-card.component.css']
})
export class ToolCardComponent {
  @Input({ required: true }) tool!: HubToolCard;

  get hoverShadowClass(): string {
    const map: Record<string, string> = {
      indigo: 'hover:shadow-indigo-500/10',
      purple: 'hover:shadow-purple-500/10',
      orange: 'hover:shadow-orange-500/10',
      sky: 'hover:shadow-sky-500/10',
      emerald: 'hover:shadow-emerald-500/10',
      blue: 'hover:shadow-blue-500/10'
    };
    return map[this.tool.color] || 'hover:shadow-indigo-500/10';
  }

  get iconBoxClass(): string {
    const map: Record<string, string> = {
      indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
      sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
      emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400'
    };
    return map[this.tool.color] || map['indigo'];
  }
}

