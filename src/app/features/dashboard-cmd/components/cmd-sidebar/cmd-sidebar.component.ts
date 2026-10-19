import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CmdProject } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-cmd-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cmd-sidebar.component.html',
  styleUrls: ['./cmd-sidebar.component.css']
})
export class CmdSidebarComponent implements OnChanges, AfterViewInit {
  @Input() projects: CmdProject[] = [];
  @Input() selectedProjId: string | null = null;
  @Input() serverOnline = false;
  @Input() sidebarOpenMobile = false;
  @Input() sidebarOpenDesktop = true;

  @Output() selectProject = new EventEmitter<string>();
  @Output() editProject = new EventEmitter<string>();
  @Output() deleteProject = new EventEmitter<string>();
  @Output() openNewProject = new EventEmitter<void>();
  @Output() toggleSidebar = new EventEmitter<void>();

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.lucide.refresh();
  }

  onSelectProj(id: string): void {
    this.selectProject.emit(id);
    if (window.innerWidth < 768) {
      this.toggleSidebar.emit();
    }
  }

  onEditProj(event: Event, id: string): void {
    event.stopPropagation();
    this.editProject.emit(id);
  }

  onDeleteProj(event: Event, id: string): void {
    event.stopPropagation();
    this.deleteProject.emit(id);
  }
}
