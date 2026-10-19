import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepoFolder, RepoBranch, RepoCommit } from '../../models/repo-doc.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

declare const html2pdf: any;

@Component({
  selector: 'app-repo-branch-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './repo-branch-detail.component.html',
  styleUrls: ['./repo-branch-detail.component.css']
})
export class RepoBranchDetailComponent implements OnChanges, AfterViewInit {
  @Input() currentFolder: RepoFolder | null = null;
  @Input() currentBranch: RepoBranch | null = null;
  @Input() parentBranchName: string | null = null;
  @Input() commits: RepoCommit[] = [];

  @Output() editFolder = new EventEmitter<void>();
  @Output() deleteFolder = new EventEmitter<void>();

  @Output() editBranch = new EventEmitter<void>();
  @Output() deleteBranch = new EventEmitter<void>();
  @Output() openCommitModal = new EventEmitter<void>();
  @Output() deleteCommit = new EventEmitter<string>();

  @ViewChild('branchContentRef') branchContentRef!: ElementRef<HTMLElement>;

  sortedCommits: RepoCommit[] = [];

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    if (!this.currentBranch) {
      this.sortedCommits = [];
    } else {
      this.sortedCommits = (this.commits || [])
        .filter(c => c.branchId === this.currentBranch!.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    this.lucide.refresh();
  }

  formatDate(dateStr: string): string {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }

  exportBranchPDF(): void {
    if (!this.currentBranch || !this.branchContentRef) return;
    const element = this.branchContentRef.nativeElement.cloneNode(true) as HTMLElement;
    const noPrintElements = element.querySelectorAll('.no-print');
    noPrintElements.forEach(el => el.remove());

    const opt = {
      margin: 10,
      filename: `Rama_${this.currentBranch.name.replace(/\//g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(opt).from(element).save();
    } else {
      window.print();
    }
  }
}
