import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import {
  BranchLifecycleState,
  GravityLeadWorkspace,
  ReleaseBlockRecord,
  SubBranchContext,
  TrackedBranch
} from './models/gravity-lead.models';

declare const jspdf: any;
declare const XLSX: any;

const STORAGE_KEY = 'consoleflow_gravity_lead_v1';

@Component({
  selector: 'app-gravity-lead',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gravity-lead.component.html',
  styleUrls: ['./gravity-lead.component.css']
})
export class GravityLeadComponent implements OnInit, AfterViewInit {
  // Vista activa: 'branches' (Módulo 1 y 2), 'versions' (Diccionario QA), 'blocks' (Módulo 3 Release Blocks)
  activeSection: 'branches' | 'versions' | 'blocks' = 'branches';

  // Estado limpio sin datos precargados
  branches: TrackedBranch[] = [];
  releaseBlocks: ReleaseBlockRecord[] = [];

  // Catálogo global de tags de Desarrolladores y Flujos para asignar con un solo clic
  availableDevs: string[] = [];
  availableFlows: string[] = [];

  // Selección activa
  selectedBranchId: string | null = null;

  // Búsqueda rápida (ramas, flujos o versión QA ej. 6.10.13)
  searchQuery = '';
  stateFilter: 'ALL' | BranchLifecycleState = 'ALL';
  categoryFilter = 'ALL';
  collapsedCategories = new Set<string>();

  // Creación rápida de Categoría (Módulo / Flujo) separada para barra lateral y detalle
  showAddCategorySidebar = false;
  sidebarCategoryInput = '';
  showAddCategoryInput = false;
  categoryInput = '';

  // Modal Nueva Rama
  showNewBranchModal = false;
  newBranchName = '';
  newBranchFlow = '';
  newBranchTitle = '';
  newBranchState: BranchLifecycleState = 'En desarrollo';
  newBranchVersionInput = '';
  newBranchSelectedDevs: string[] = [];
  newBranchCustomDevInput = '';
  newBranchLinkedBranchIds: string[] = [];

  // Inputs auxiliares en el detalle de la rama seleccionada
  versionInput = '';
  devInput = '';
  showAddDevInput = false;
  subBranchNameInput = '';
  subBranchDevInput = '';
  subBranchNotesInput = '';
  showPullExistingBranchSelector = false;
  pullBranchSearchQuery = '';
  editingSubBranchId: string | null = null;
  editSubBranchName = '';
  editSubBranchDev = '';
  editSubBranchNotes = '';

  // Resultado del MR generado en vista individual
  generatedSingleMr = '';

  // Módulo 3: Release Blocks (Consolidación de Ramas)
  selectedBlockBranchIds = new Set<string>();
  blockModuleFlow = '';
  blockFeatureTitle = '';
  generatedBlockMr = '';

  // Toast minimalista
  toastVisible = false;
  toastMsg = '';
  private toastTimer: any;
  copiedKey: string | null = null;
  private copiedTimer: any;

  // Notificación interactiva de descarga completada (clic para abrir carpeta)
  downloadNotificationVisible = false;
  downloadFileName = '';
  downloadFilePath = '';
  private downloadTimer: any;

  // Modal de configuración de secciones antes de generar el PDF
  showPdfConfigModal = false;
  pdfTargetBranch: TrackedBranch | null = null;
  pdfCustomHeaderTitle = '';
  pdfOptions = {
    includeHeader: true,
    includeTechSheet: true,
    fieldBranch: true,
    fieldCategory: true,
    fieldFeature: true,
    fieldState: true,
    fieldQaVersions: true,
    fieldDevs: true,
    fieldUpdatedAt: true,
    includeObjectives: true,
    includeSubBranches: true,
    includeMrPreview: true
  };
  pdfSelectableObjectives: { text: string; selected: boolean }[] = [];
  pdfSelectableSubBranches: { sub: SubBranchContext; selected: boolean }[] = [];

  readonly lifecycleStates: BranchLifecycleState[] = ['En desarrollo', 'QA', 'Certificada'];

  constructor(private lucide: LucideIconService) {}

  ngOnInit(): void {
    this.loadWorkspace();
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  // --- PERSISTENCIA LIMPIA ---

  private formatCanonicalFlowName(name: string): string {
    const clean = name.trim();
    if (!clean) return '';
    // Si tiene mezcla accidental de dos mayúsculas al inicio como "PEndo", normalizar a "Pendo"
    if (/^[A-Z]{2}[a-z]+$/.test(clean)) {
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return clean;
  }

  private loadWorkspace(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: GravityLeadWorkspace = JSON.parse(raw);
        const rawBranches = Array.isArray(parsed.branches) ? parsed.branches : [];
        this.releaseBlocks = Array.isArray(parsed.releaseBlocks) ? parsed.releaseBlocks : [];
        const rawDevs = Array.isArray(parsed.availableDevs) ? parsed.availableDevs : [];
        const rawFlows = Array.isArray(parsed.availableFlows) ? parsed.availableFlows : [];

        // 1. Limpiar categorías accidentales (números de fecha/ticket o prefijos truncados al escribir) y deduplicar sin importar mayúsculas/minúsculas
        const filteredFlows = rawFlows.filter(f => {
          const clean = (f || '').trim();
          if (!clean || clean.toLowerCase() === 'general' || /^\d+$/.test(clean)) return false;
          // Descartar si es un sub-prefijo exacto de otra categoría existente (ej. P, PE, PEn, PEnd -> Pendo)
          const isPrefixOfLonger = rawFlows.some(
            other =>
              other &&
              other.trim().length > clean.length &&
              other.trim().toLowerCase().startsWith(clean.toLowerCase())
          );
          return !isPrefixOfLonger;
        });

        const flowMap = new Map<string, string>();
        for (const fl of filteredFlows) {
          const normalized = this.formatCanonicalFlowName(fl);
          const key = normalized.toLowerCase();
          if (!flowMap.has(key)) {
            flowMap.set(key, normalized);
          }
        }
        this.availableFlows = Array.from(flowMap.values());

        // 2. Deduplicar catálogo de desarrolladores sin importar mayúsculas/minúsculas
        this.availableDevs = [];
        for (const d of rawDevs) {
          this.ensureGlobalDev(d);
        }

        // 3. Deduplicar ramas con el mismo nombre exacto y normalizar su categoría y devs
        const branchByName = new Map<string, TrackedBranch>();
        for (const b of rawBranches) {
          if (!b || !b.name) continue;
          const cleanName = b.name.trim();
          if (!cleanName) continue;
          const nameKey = cleanName.toLowerCase();

          let rawMod = (b.moduleFlow || 'General').trim();
          if (!rawMod || /^\d+$/.test(rawMod) || rawMod.toLowerCase() === 'general') {
            b.moduleFlow = 'General';
          } else {
            b.moduleFlow = this.ensureGlobalFlow(this.formatCanonicalFlowName(rawMod));
          }

          // Deduplicar devs y versiones dentro de la rama
          const uniqueDevs: string[] = [];
          for (const d of b.devs || []) {
            const canonicalDev = this.ensureGlobalDev(d);
            if (canonicalDev && !uniqueDevs.some(ud => ud.toLowerCase() === canonicalDev.toLowerCase())) {
              uniqueDevs.push(canonicalDev);
            }
          }
          b.devs = uniqueDevs;
          b.qaVersions = Array.from(new Set((b.qaVersions || []).map(v => v.trim()).filter(Boolean)));

          if (!branchByName.has(nameKey)) {
            b.name = cleanName;
            branchByName.set(nameKey, b);
          } else {
            // Si había una rama duplicada con el mismo nombre, fusionar su información sin perder nada
            const existing = branchByName.get(nameKey)!;
            for (const v of b.qaVersions) {
              if (!existing.qaVersions.includes(v)) existing.qaVersions.push(v);
            }
            for (const d of b.devs) {
              if (!existing.devs.some(ed => ed.toLowerCase() === d.toLowerCase())) {
                existing.devs.push(d);
              }
            }
            if (!existing.objectivesSummary && b.objectivesSummary) {
              existing.objectivesSummary = b.objectivesSummary;
            }
            if (!existing.rawCommitsOrDiff && b.rawCommitsOrDiff) {
              existing.rawCommitsOrDiff = b.rawCommitsOrDiff;
            }
            if (existing.moduleFlow === 'General' && b.moduleFlow !== 'General') {
              existing.moduleFlow = b.moduleFlow;
            }
          }
        }

        this.branches = Array.from(branchByName.values());
        this.saveWorkspace();
      }
    } catch {
      this.branches = [];
      this.releaseBlocks = [];
      this.availableDevs = [];
      this.availableFlows = [];
    }
  }

  saveWorkspace(): void {
    try {
      const payload: GravityLeadWorkspace = {
        branches: this.branches,
        releaseBlocks: this.releaseBlocks,
        availableDevs: this.availableDevs,
        availableFlows: this.availableFlows
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignorar errores de cuota
    }
  }

  private ensureGlobalDev(name: string): string {
    const clean = (name || '').trim();
    if (!clean) return '';
    const existing = this.availableDevs.find(d => d.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    this.availableDevs.push(clean);
    return clean;
  }

  private ensureGlobalFlow(flow: string): string {
    const clean = this.formatCanonicalFlowName(flow || '');
    if (!clean || clean.toLowerCase() === 'general' || /^\d+$/.test(clean)) return 'General';
    const existing = this.availableFlows.find(f => f.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    this.availableFlows.push(clean);
    return clean;
  }

  // --- GETTERS Y FILTROS ---

  get selectedBranch(): TrackedBranch | null {
    if (!this.selectedBranchId) return null;
    return this.branches.find(b => b.id === this.selectedBranchId) || null;
  }

  get filteredBranches(): TrackedBranch[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.branches.filter(b => {
      if (this.stateFilter !== 'ALL' && b.state !== this.stateFilter) {
        return false;
      }
      if (
        this.categoryFilter !== 'ALL' &&
        (b.moduleFlow || 'General').toLowerCase() !== this.categoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      const matchName = b.name.toLowerCase().includes(q);
      const matchFlow = (b.moduleFlow || '').toLowerCase().includes(q);
      const matchTitle = (b.featureTitle || '').toLowerCase().includes(q);
      const matchVersion = (b.qaVersions || []).some(v => v.toLowerCase().includes(q));
      const matchDev = (b.devs || []).some(d => d.toLowerCase().includes(q));
      return matchName || matchFlow || matchTitle || matchVersion || matchDev;
    });
  }

  get groupedFilteredBranches(): { category: string; branches: TrackedBranch[] }[] {
    const groupsMap = new Map<string, TrackedBranch[]>();

    for (const b of this.filteredBranches) {
      const cat = (b.moduleFlow || 'General').trim() || 'General';
      const existingKey = Array.from(groupsMap.keys()).find(k => k.toLowerCase() === cat.toLowerCase()) || cat;
      if (!groupsMap.has(existingKey)) {
        groupsMap.set(existingKey, []);
      }
      groupsMap.get(existingKey)!.push(b);
    }

    return Array.from(groupsMap.entries()).map(([category, branches]) => ({
      category,
      branches
    }));
  }

  trackByCategory(_index: number, group: { category: string; branches: TrackedBranch[] }): string {
    return group.category.toLowerCase();
  }

  trackByBranchId(_index: number, branch: TrackedBranch): string {
    return branch.id;
  }

  toggleCategoryCollapse(category: string): void {
    const key = category.toLowerCase();
    if (this.collapsedCategories.has(key)) {
      this.collapsedCategories.delete(key);
    } else {
      this.collapsedCategories.add(key);
    }
    this.lucide.refresh();
  }

  isCategoryCollapsed(category: string): boolean {
    return this.collapsedCategories.has(category.toLowerCase());
  }

  // --- GESTIÓN DE CATEGORÍAS (MÓDULO / FLUJO) ---

  getCategoryBranchCount(category: string): number {
    const target = (category || '').trim().toLowerCase();
    if (!target) return 0;
    return this.branches.filter(
      b => (b.moduleFlow || 'General').trim().toLowerCase() === target
    ).length;
  }

  createCategoryFromSidebar(): void {
    const raw = this.sidebarCategoryInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    let lastCanonical = '';
    for (const p of parts) {
      lastCanonical = this.ensureGlobalFlow(p);
    }
    this.sidebarCategoryInput = '';
    this.showAddCategorySidebar = false;
    this.saveWorkspace();
    if (lastCanonical && lastCanonical !== 'General') {
      this.showToast(`Categoría "${lastCanonical}" lista`);
    }
    this.lucide.refresh();
  }

  createAndSelectCategory(branch?: TrackedBranch): void {
    const raw = this.categoryInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    let lastCanonical = '';
    for (const p of parts) {
      lastCanonical = this.ensureGlobalFlow(p);
    }
    if (branch && lastCanonical) {
      branch.moduleFlow = lastCanonical;
      branch.updatedAt = new Date().toISOString();
    }
    this.categoryInput = '';
    this.showAddCategoryInput = false;
    this.saveWorkspace();
    this.showToast(`Categoría "${lastCanonical}" asignada`);
    this.lucide.refresh();
  }

  selectCategoryForBranch(branch: TrackedBranch, category: string): void {
    const current = (branch.moduleFlow || 'General').trim().toLowerCase();
    const target = (category || '').trim().toLowerCase();
    if (current === target && target !== 'general') {
      // Clic en la categoría activa la desasocia de la rama (vuelve a General)
      branch.moduleFlow = 'General';
      branch.updatedAt = new Date().toISOString();
      this.saveWorkspace();
      this.showToast(`Categoría "${category}" desasociada de la rama`);
      this.lucide.refresh();
      return;
    }
    branch.moduleFlow = category;
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  deleteGlobalCategory(category: string, event: Event): void {
    event.stopPropagation();
    const associatedCount = this.getCategoryBranchCount(category);
    if (associatedCount > 0) {
      this.showToast(
        `No puedes eliminar "${category}" porque está asociada a ${associatedCount} rama(s)`
      );
      return;
    }
    this.availableFlows = this.availableFlows.filter(
      f => f.toLowerCase() !== category.toLowerCase()
    );
    if (this.categoryFilter.toLowerCase() === category.toLowerCase()) {
      this.categoryFilter = 'ALL';
    }
    this.saveWorkspace();
    this.showToast(`Categoría "${category}" eliminada`);
    this.lucide.refresh();
  }

  // Diccionario de Mapeo de Versiones QA -> Rama y Flujo
  get versionDictionary(): {
    version: string;
    branch: TrackedBranch;
  }[] {
    const q = this.searchQuery.trim().toLowerCase();
    const entries: { version: string; branch: TrackedBranch }[] = [];
    for (const b of this.branches) {
      for (const v of b.qaVersions || []) {
        if (
          !q ||
          v.toLowerCase().includes(q) ||
          b.name.toLowerCase().includes(q) ||
          (b.moduleFlow || '').toLowerCase().includes(q)
        ) {
          entries.push({ version: v, branch: b });
        }
      }
    }
    return entries;
  }

  get totalVersionMappings(): number {
    return this.branches.reduce((acc, b) => acc + (b.qaVersions?.length || 0), 0);
  }

  get certifiedCount(): number {
    return this.branches.filter(b => b.state === 'Certificada').length;
  }

  // --- GESTIÓN DE TAGS DE DESARROLLADORES (UN SOLO CLIC) ---

  getDevBranchCount(dev: string): number {
    return this.branches.filter(b => this.isDevSelectedInBranch(b, dev)).length;
  }

  isDevSelectedInBranch(branch: TrackedBranch, dev: string): boolean {
    return (branch.devs || []).some(d => d.toLowerCase() === dev.toLowerCase());
  }

  toggleDevTagInBranch(branch: TrackedBranch, dev: string): void {
    const exists = this.isDevSelectedInBranch(branch, dev);
    if (exists) {
      branch.devs = branch.devs.filter(d => d.toLowerCase() !== dev.toLowerCase());
    } else {
      branch.devs.push(dev);
    }
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  createAndSelectDevTag(branch?: TrackedBranch): void {
    const raw = this.devInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      const canonical = this.ensureGlobalDev(p);
      if (branch && canonical && !this.isDevSelectedInBranch(branch, canonical)) {
        branch.devs.push(canonical);
      }
    }
    if (branch) {
      branch.updatedAt = new Date().toISOString();
    }
    this.devInput = '';
    this.showAddDevInput = false;
    this.saveWorkspace();
    this.lucide.refresh();
  }

  deleteGlobalDevTag(dev: string, event: Event): void {
    event.stopPropagation();
    const associatedCount = this.getDevBranchCount(dev);
    if (associatedCount > 0) {
      this.showToast(
        `No puedes eliminar "${dev}" porque está asociado a ${associatedCount} rama(s)`
      );
      return;
    }
    this.availableDevs = this.availableDevs.filter(d => d.toLowerCase() !== dev.toLowerCase());
    this.newBranchSelectedDevs = this.newBranchSelectedDevs.filter(d => d.toLowerCase() !== dev.toLowerCase());
    this.saveWorkspace();
    this.showToast(`Tag "${dev}" eliminado`);
    this.lucide.refresh();
  }

  // En el modal de Nueva Rama: clic en tag de dev
  isDevSelectedInModal(dev: string): boolean {
    return this.newBranchSelectedDevs.some(d => d.toLowerCase() === dev.toLowerCase());
  }

  toggleDevTagInModal(dev: string): void {
    if (this.isDevSelectedInModal(dev)) {
      this.newBranchSelectedDevs = this.newBranchSelectedDevs.filter(
        d => d.toLowerCase() !== dev.toLowerCase()
      );
    } else {
      this.newBranchSelectedDevs.push(dev);
    }
  }

  addCustomDevInModal(): void {
    const raw = this.newBranchCustomDevInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      const canonical = this.ensureGlobalDev(p);
      if (canonical && !this.isDevSelectedInModal(canonical)) {
        this.newBranchSelectedDevs.push(canonical);
      }
    }
    this.newBranchCustomDevInput = '';
    this.saveWorkspace();
  }

  // --- CREACIÓN Y AUTOCOMPLETADO DE FORMATO feature/[fecha]/[flujo]/[desarrollo] ---

  openNewBranchModal(): void {
    this.newBranchName = '';
    this.newBranchFlow = '';
    this.newBranchTitle = '';
    this.newBranchState = 'En desarrollo';
    this.newBranchVersionInput = '';
    this.newBranchSelectedDevs = [];
    this.newBranchCustomDevInput = '';
    this.newBranchLinkedBranchIds = [];
    this.showNewBranchModal = true;
    this.lucide.refresh();
  }

  isBranchLinkedInNewModal(branchId: string): boolean {
    return this.newBranchLinkedBranchIds.includes(branchId);
  }

  toggleLinkedBranchInNewModal(sourceBranch: TrackedBranch): void {
    const idx = this.newBranchLinkedBranchIds.indexOf(sourceBranch.id);
    if (idx >= 0) {
      this.newBranchLinkedBranchIds.splice(idx, 1);
    } else {
      this.newBranchLinkedBranchIds.push(sourceBranch.id);
      // Sumar automáticamente los devs de la rama jalada al modal
      for (const dev of sourceBranch.devs || []) {
        if (!this.isDevSelectedInModal(dev)) {
          this.newBranchSelectedDevs.push(dev);
        }
      }
      if (!this.newBranchFlow && sourceBranch.moduleFlow && sourceBranch.moduleFlow !== 'General') {
        this.newBranchFlow = sourceBranch.moduleFlow;
      }
    }
  }

  onNewBranchNameChange(value: string): void {
    this.newBranchName = value;
    // Autodetectar título descriptivo a partir del último segmento de la rama
    const parts = value.trim().split('/').filter(Boolean);
    if (parts.length >= 2) {
      const lastSegment = parts[parts.length - 1];
      if (!this.newBranchTitle && lastSegment && !/^\d+$/.test(lastSegment)) {
        const cleanTitle = lastSegment.replace(/[-_]+/g, ' ').trim();
        this.newBranchTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
      }
      // Si algún segmento coincide con una categoría ya existente, seleccionarla automáticamente
      if (!this.newBranchFlow) {
        const matchedFlow = this.availableFlows.find(fl =>
          parts.some(p => p.toLowerCase().includes(fl.toLowerCase()))
        );
        if (matchedFlow) {
          this.newBranchFlow = matchedFlow;
        }
      }
    }
  }

  createBranch(): void {
    const cleanName = this.newBranchName.trim();
    if (!cleanName) {
      this.showToast('Ingresa el nombre de la rama');
      return;
    }

    // Evitar duplicados con el mismo nombre de rama
    const existingBranch = this.branches.find(
      b => b.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingBranch) {
      this.selectedBranchId = existingBranch.id;
      this.showNewBranchModal = false;
      this.showToast('Esta rama ya existe; se seleccionó el registro existente');
      this.lucide.refresh();
      return;
    }

    // Si escribió algún dev en el input sin presionar "+", sumarlo también
    if (this.newBranchCustomDevInput.trim()) {
      this.addCustomDevInModal();
    }

    const versions = this.newBranchVersionInput
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    const rawFlow = this.newBranchFlow.trim();
    const canonicalFlow = rawFlow ? this.ensureGlobalFlow(rawFlow) : 'General';

    const now = new Date().toISOString();
    const initialSubBranches: SubBranchContext[] = [];
    for (const linkedId of this.newBranchLinkedBranchIds) {
      const src = this.branches.find(b => b.id === linkedId);
      if (src) {
        initialSubBranches.push({
          id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          branchName: src.name,
          devName: (src.devs || []).join(', '),
          notesOrCommits: src.featureTitle || (src.objectivesSummary || '').split(/\r?\n/)[0] || '',
          linkedBranchId: src.id
        });
        for (const d of src.devs || []) {
          if (!this.newBranchSelectedDevs.some(nd => nd.toLowerCase() === d.toLowerCase())) {
            this.newBranchSelectedDevs.push(d);
          }
        }
      }
    }

    const branch: TrackedBranch = {
      id: 'gbr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      moduleFlow: canonicalFlow,
      featureTitle: this.newBranchTitle.trim() || cleanName,
      state: this.newBranchState,
      qaVersions: Array.from(new Set(versions)),
      devs: [...this.newBranchSelectedDevs],
      objectivesSummary: '',
      rawCommitsOrDiff: '',
      subBranches: initialSubBranches,
      createdAt: now,
      updatedAt: now
    };

    this.branches.unshift(branch);
    this.selectedBranchId = branch.id;
    this.generatedSingleMr = '';
    this.showNewBranchModal = false;
    this.saveWorkspace();
    this.showToast('Rama registrada');
    this.lucide.refresh();
  }

  selectBranch(branchId: string): void {
    this.selectedBranchId = branchId;
    this.generatedSingleMr = '';
    this.activeSection = 'branches';
    this.lucide.refresh();
  }

  deleteBranch(branchId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.branches = this.branches.filter(b => b.id !== branchId);
    this.selectedBlockBranchIds.delete(branchId);
    if (this.selectedBranchId === branchId) {
      this.selectedBranchId = this.branches[0]?.id || null;
      this.generatedSingleMr = '';
    }
    this.saveWorkspace();
    this.showToast('Rama eliminada');
    this.lucide.refresh();
  }

  // --- TRAZABILIDAD DE RAMAS UNIFICADAS (PADRE <-> SUB-RAMA EXISTENTE) ---

  /**
   * Devuelve las ramas "Padre" (ej. ramaUnion) donde esta rama (ej. rama1) fue jalada como sub-rama.
   */
  getParentBranches(branch: TrackedBranch): TrackedBranch[] {
    if (!branch) return [];
    const targetName = (branch.name || '').trim().toLowerCase();
    return this.branches.filter(
      parent =>
        parent.id !== branch.id &&
        (parent.subBranches || []).some(
          sub =>
            sub.linkedBranchId === branch.id ||
            (sub.branchName || '').trim().toLowerCase() === targetName
        )
    );
  }

  /**
   * Si una sub-rama corresponde a una rama registrada en el workspace, la retorna.
   */
  getLinkedBranch(sub: SubBranchContext): TrackedBranch | null {
    if (!sub) return null;
    if (sub.linkedBranchId) {
      const byId = this.branches.find(b => b.id === sub.linkedBranchId);
      if (byId) return byId;
    }
    const cleanName = (sub.branchName || '').trim().toLowerCase();
    if (!cleanName) return null;
    return this.branches.find(b => b.name.trim().toLowerCase() === cleanName) || null;
  }

  getAvailableBranchesToPull(currentBranch: TrackedBranch): TrackedBranch[] {
    if (!currentBranch) return [];
    const q = this.pullBranchSearchQuery.trim().toLowerCase();
    return this.branches.filter(b => {
      if (b.id === currentBranch.id) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.featureTitle || '').toLowerCase().includes(q) ||
        (b.moduleFlow || '').toLowerCase().includes(q)
      );
    });
  }

  isBranchPulledIn(parentBranch: TrackedBranch, candidate: TrackedBranch): boolean {
    if (!parentBranch || !candidate) return false;
    const candName = candidate.name.trim().toLowerCase();
    return (parentBranch.subBranches || []).some(
      s =>
        s.linkedBranchId === candidate.id ||
        (s.branchName || '').trim().toLowerCase() === candName
    );
  }

  togglePullExistingBranch(parentBranch: TrackedBranch, sourceBranch: TrackedBranch): void {
    if (!parentBranch || !sourceBranch || parentBranch.id === sourceBranch.id) return;

    if (this.isBranchPulledIn(parentBranch, sourceBranch)) {
      const candName = sourceBranch.name.trim().toLowerCase();
      parentBranch.subBranches = (parentBranch.subBranches || []).filter(
        s =>
          s.linkedBranchId !== sourceBranch.id &&
          (s.branchName || '').trim().toLowerCase() !== candName
      );
      parentBranch.updatedAt = new Date().toISOString();
      this.saveWorkspace();
      this.showToast(`Rama desvinculada de ${parentBranch.name}`);
      this.lucide.refresh();
      return;
    }

    const sub: SubBranchContext = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      branchName: sourceBranch.name,
      devName: (sourceBranch.devs || []).join(', '),
      notesOrCommits:
        sourceBranch.featureTitle ||
        (sourceBranch.objectivesSummary || '').split(/\r?\n/)[0] ||
        '',
      linkedBranchId: sourceBranch.id
    };
    parentBranch.subBranches.push(sub);

    // Sincronizar desarrolladores de la rama jalada hacia la rama padre
    for (const d of sourceBranch.devs || []) {
      if (!this.isDevSelectedInBranch(parentBranch, d)) {
        parentBranch.devs.push(d);
      }
    }

    parentBranch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast(`Rama "${sourceBranch.name}" jalada como sub-rama`);
    this.lucide.refresh();
  }

  // --- MÓDULO 1: CONTROL ESTRICTO DE ESTADOS Y VERSIONES QA ---

  setBranchState(branch: TrackedBranch, targetState: BranchLifecycleState): void {
    branch.state = targetState;
    branch.updatedAt = new Date().toISOString();
    if (branch.state !== 'Certificada') {
      this.generatedSingleMr = '';
    }
    this.saveWorkspace();
    this.showToast(`Estado actualizado: ${targetState}`);
    this.lucide.refresh();
  }

  advanceBranchState(branch: TrackedBranch): void {
    const idx = this.lifecycleStates.indexOf(branch.state);
    if (idx < this.lifecycleStates.length - 1) {
      this.setBranchState(branch, this.lifecycleStates[idx + 1]);
    }
  }

  addQaVersion(branch: TrackedBranch): void {
    const clean = this.versionInput.trim();
    if (!clean) return;
    if (!branch.qaVersions.includes(clean)) {
      branch.qaVersions.push(clean);
      branch.updatedAt = new Date().toISOString();
      this.saveWorkspace();
      this.showToast(`Versión QA ${clean} vinculada a ${branch.name}`);
    }
    this.versionInput = '';
    this.lucide.refresh();
  }

  removeQaVersion(branch: TrackedBranch, version: string): void {
    branch.qaVersions = branch.qaVersions.filter(v => v !== version);
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  addSubBranch(branch: TrackedBranch): void {
    const name = this.subBranchNameInput.trim();
    const dev = this.subBranchDevInput.trim();
    const notes = this.subBranchNotesInput.trim();
    if (!name && !notes) return;

    const canonicalDev = dev ? this.ensureGlobalDev(dev) : '';
    const matchedExisting = name
      ? this.branches.find(
          b => b.id !== branch.id && b.name.trim().toLowerCase() === name.toLowerCase()
        )
      : undefined;

    const sub: SubBranchContext = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      branchName: matchedExisting ? matchedExisting.name : name || 'sub-rama',
      devName: canonicalDev || (matchedExisting ? (matchedExisting.devs || []).join(', ') : ''),
      notesOrCommits: notes || (matchedExisting ? matchedExisting.featureTitle : ''),
      linkedBranchId: matchedExisting?.id
    };
    branch.subBranches.push(sub);

    if (canonicalDev && !this.isDevSelectedInBranch(branch, canonicalDev)) {
      branch.devs.push(canonicalDev);
    }
    if (matchedExisting) {
      for (const d of matchedExisting.devs || []) {
        if (!this.isDevSelectedInBranch(branch, d)) {
          branch.devs.push(d);
        }
      }
    }

    this.subBranchNameInput = '';
    this.subBranchDevInput = '';
    this.subBranchNotesInput = '';
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  startEditSubBranch(sub: SubBranchContext): void {
    this.editingSubBranchId = sub.id;
    this.editSubBranchName = sub.branchName || '';
    this.editSubBranchDev = sub.devName || '';
    this.editSubBranchNotes = sub.notesOrCommits || '';
    this.lucide.refresh();
  }

  saveEditSubBranch(branch: TrackedBranch, sub: SubBranchContext): void {
    const cleanName = this.editSubBranchName.trim() || 'sub-rama';
    const cleanDev = this.editSubBranchDev.trim();
    const cleanNotes = this.editSubBranchNotes.trim();

    const canonicalDev = cleanDev ? this.ensureGlobalDev(cleanDev) : '';
    const matchedExisting = this.branches.find(
      b => b.id !== branch.id && b.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    sub.branchName = matchedExisting ? matchedExisting.name : cleanName;
    sub.devName = canonicalDev;
    sub.notesOrCommits = cleanNotes;
    sub.linkedBranchId = matchedExisting?.id;

    if (canonicalDev && !this.isDevSelectedInBranch(branch, canonicalDev)) {
      branch.devs.push(canonicalDev);
    }

    this.editingSubBranchId = null;
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast('Sub-rama actualizada');
    this.lucide.refresh();
  }

  cancelEditSubBranch(): void {
    this.editingSubBranchId = null;
    this.lucide.refresh();
  }

  removeSubBranch(branch: TrackedBranch, subId: string): void {
    branch.subBranches = branch.subBranches.filter(s => s.id !== subId);
    if (this.editingSubBranchId === subId) {
      this.editingSubBranchId = null;
    }
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  onBranchFieldChange(branch: TrackedBranch): void {
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
  }

  // --- MÓDULO 2: ANÁLISIS DE CONTEXTO Y GENERACIÓN DE MR ESTRICTO ---

  private extractBulletPointsFromBranch(branch: TrackedBranch, visited = new Set<string>()): string[] {
    if (!branch || visited.has(branch.id)) return [];
    visited.add(branch.id);

    const bullets: string[] = [];
    const seen = new Set<string>();

    const pushUnique = (line: string) => {
      const cleaned = line
        .replace(/^[•\-\*]+\s*/, '')
        .replace(/^[0-9a-f]{7,40}\s+/i, '')
        .replace(/^(feat|fix|chore|refactor|docs|style|test)(\([^)]+\))?:\s*/i, '')
        .trim();
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        bullets.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    };

    if (branch.objectivesSummary?.trim()) {
      for (const line of branch.objectivesSummary.split(/\r?\n/)) {
        pushUnique(line);
      }
    }

    for (const sub of branch.subBranches || []) {
      if (sub.notesOrCommits?.trim()) {
        for (const line of sub.notesOrCommits.split(/\r?\n/)) {
          pushUnique(line);
        }
      }
      // Si la sub-rama es una rama existente jalada, incorporar también sus objetivos y commits
      const linked = this.getLinkedBranch(sub);
      if (linked && !visited.has(linked.id)) {
        for (const childBullet of this.extractBulletPointsFromBranch(linked, visited)) {
          pushUnique(childBullet);
        }
      }
    }

    if (branch.rawCommitsOrDiff?.trim()) {
      for (const line of branch.rawCommitsOrDiff.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Merge ') || trimmed.startsWith('Author:') || trimmed.startsWith('Date:')) {
          continue;
        }
        pushUnique(trimmed);
      }
    }

    return bullets;
  }

  private collectUniqueDevs(branches: TrackedBranch[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    const addDevName = (name: string) => {
      for (const part of name.split(',')) {
        const clean = part.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(clean);
        }
      }
    };

    for (const b of branches) {
      for (const d of b.devs || []) {
        addDevName(d);
      }
      for (const sub of b.subBranches || []) {
        if (sub.devName) addDevName(sub.devName);
        const linked = this.getLinkedBranch(sub);
        if (linked) {
          for (const ld of linked.devs || []) {
            addDevName(ld);
          }
        }
      }
    }

    return result;
  }

  generateSingleBranchMr(branch: TrackedBranch): void {
    if (branch.state !== 'Certificada') {
      this.showToast('Bloqueado: La rama debe estar en estado Certificada para generar el MR');
      return;
    }

    const moduleName = (branch.moduleFlow || 'General').trim();
    const titleDesc = (branch.featureTitle || branch.name).trim();
    const bullets = this.extractBulletPointsFromBranch(branch);
    const bodyText =
      bullets.length > 0
        ? bullets.map(b => `- ${b}`).join('\n')
        : `- Implementación y validación correspondiente a la rama ${branch.name}.`;

    const devs = this.collectUniqueDevs([branch]);
    const devsText = devs.length > 0 ? devs.join(', ') : 'Por definir';

    this.generatedSingleMr =
      `Título: feat(${moduleName}): ${titleDesc}\n\n` +
      `Descripción general del desarrollo u objetivos:\n` +
      `${bodyText}\n\n` +
      `Devs involucrados:\n` +
      `${devsText}`;

    this.showToast('MR generado con plantilla estricta');
    this.lucide.refresh();
  }

  // --- MÓDULO 3: CONSOLIDACIÓN DE RAMAS (RELEASE BLOCKS) ---

  toggleBranchInBlock(branchId: string): void {
    if (this.selectedBlockBranchIds.has(branchId)) {
      this.selectedBlockBranchIds.delete(branchId);
    } else {
      this.selectedBlockBranchIds.add(branchId);
    }
    this.generatedBlockMr = '';
    this.autoFillBlockMetadata();
    this.lucide.refresh();
  }

  private autoFillBlockMetadata(): void {
    const selected = this.selectedBlockBranches;
    if (selected.length === 0) return;
    const uniqueFlows = Array.from(new Set(selected.map(b => b.moduleFlow).filter(Boolean)));
    if (!this.blockModuleFlow && uniqueFlows.length > 0) {
      this.blockModuleFlow = uniqueFlows.join(' / ');
    }
  }

  get selectedBlockBranches(): TrackedBranch[] {
    return this.branches.filter(b => this.selectedBlockBranchIds.has(b.id));
  }

  get uncertifiedBlockBranches(): TrackedBranch[] {
    return this.selectedBlockBranches.filter(b => b.state !== 'Certificada');
  }

  get canGenerateBlockMr(): boolean {
    const selected = this.selectedBlockBranches;
    return selected.length > 0 && selected.every(b => b.state === 'Certificada');
  }

  generateReleaseBlockMr(): void {
    const selected = this.selectedBlockBranches;
    if (selected.length === 0) {
      this.showToast('Selecciona al menos una rama para el bloque');
      return;
    }

    if (this.uncertifiedBlockBranches.length > 0) {
      this.showToast('Bloqueado: Todas las ramas seleccionadas deben estar en estado Certificada');
      return;
    }

    const uniqueFlows = Array.from(new Set(selected.map(b => b.moduleFlow).filter(Boolean)));
    const moduleName = (this.blockModuleFlow || uniqueFlows.join('/') || 'General').trim();
    const titleDesc = (
      this.blockFeatureTitle ||
      selected.map(b => b.featureTitle || b.name).join(' + ')
    ).trim();

    const globalSeen = new Set<string>();
    const sections: string[] = [];

    for (const b of selected) {
      const branchBullets = this.extractBulletPointsFromBranch(b).filter(item => {
        const k = item.toLowerCase();
        if (globalSeen.has(k)) return false;
        globalSeen.add(k);
        return true;
      });

      const headerLabel = b.featureTitle ? `${b.featureTitle} (${b.name})` : b.name;
      if (branchBullets.length > 0) {
        sections.push(
          `• ${headerLabel}:\n` + branchBullets.map(point => `  - ${point}`).join('\n')
        );
      } else {
        sections.push(`• ${headerLabel}: Integración certificada lista para develop.`);
      }
    }

    const devs = this.collectUniqueDevs(selected);
    const devsText = devs.length > 0 ? devs.join(', ') : 'Por definir';

    this.generatedBlockMr =
      `Título: feat(${moduleName}): ${titleDesc}\n\n` +
      `Descripción general del desarrollo u objetivos:\n` +
      `${sections.join('\n\n')}\n\n` +
      `Devs involucrados:\n` +
      `${devsText}`;

    const record: ReleaseBlockRecord = {
      id: 'blk_' + Date.now(),
      name: titleDesc,
      moduleFlow: moduleName,
      branchIds: selected.map(b => b.id),
      generatedMrText: this.generatedBlockMr,
      createdAt: new Date().toISOString()
    };
    this.releaseBlocks.unshift(record);
    this.saveWorkspace();
    this.showToast('Release Block consolidado');
    this.lucide.refresh();
  }

  deleteReleaseBlock(blockId: string): void {
    this.releaseBlocks = this.releaseBlocks.filter(b => b.id !== blockId);
    this.saveWorkspace();
    this.lucide.refresh();
  }

  // --- EXPORTACIÓN PDF POR RAMA (PERSONALIZABLE) Y EXCEL GLOBAL ---

  exportBranchPdf(branch: TrackedBranch, event?: Event): void {
    if (event) event.stopPropagation();
    if (!branch) return;

    this.pdfTargetBranch = branch;
    this.pdfCustomHeaderTitle = (branch.featureTitle || branch.name || '').trim();
    const rawBullets = this.extractBulletPointsFromBranch(branch);
    this.pdfSelectableObjectives = rawBullets.map(text => ({ text, selected: true }));
    this.pdfSelectableSubBranches = (branch.subBranches || []).map(sub => ({
      sub,
      selected: true
    }));
    this.showPdfConfigModal = true;
    this.lucide.refresh();
  }

  selectAllPdfOptions(): void {
    this.pdfOptions = {
      includeHeader: true,
      includeTechSheet: true,
      fieldBranch: true,
      fieldCategory: true,
      fieldFeature: true,
      fieldState: true,
      fieldQaVersions: true,
      fieldDevs: true,
      fieldUpdatedAt: true,
      includeObjectives: true,
      includeSubBranches: true,
      includeMrPreview: true
    };
    this.pdfSelectableObjectives.forEach(o => (o.selected = true));
    this.pdfSelectableSubBranches.forEach(s => (s.selected = true));
  }

  selectMinimalPdfOptions(): void {
    this.pdfOptions = {
      includeHeader: true,
      includeTechSheet: true,
      fieldBranch: true,
      fieldCategory: true,
      fieldFeature: true,
      fieldState: true,
      fieldQaVersions: true,
      fieldDevs: true,
      fieldUpdatedAt: false,
      includeObjectives: true,
      includeSubBranches: false,
      includeMrPreview: false
    };
  }

  confirmExportBranchPdf(): void {
    const branch = this.pdfTargetBranch;
    if (!branch) return;

    try {
      const jsPDFCtor =
        typeof jspdf !== 'undefined' && jspdf.jsPDF ? jspdf.jsPDF : (window as any).jsPDF;
      if (!jsPDFCtor) {
        this.showToast('Librería PDF no disponible');
        return;
      }

      const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 14;

      // Encabezado con el título descriptivo (si está activado)
      if (this.pdfOptions.includeHeader) {
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, pageWidth, 22, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        const cleanTitle = (this.pdfCustomHeaderTitle || branch.featureTitle || branch.name || '').trim();
        const splitTitle = doc.splitTextToSize(cleanTitle, pageWidth - 28);
        doc.text(splitTitle[0] || cleanTitle, 14, 13.5);
        currentY = 28;
      }

      const devsList = this.collectUniqueDevs([branch]);
      const qaVersionsText = branch.qaVersions?.length
        ? branch.qaVersions.map(v => `v${v}`).join(', ')
        : 'Sin asignar';
      const formattedDate = new Date(branch.updatedAt || branch.createdAt).toLocaleString('es-ES');

      // 1. Tabla de Ficha Técnica (según los campos marcados)
      if (this.pdfOptions.includeTechSheet) {
        const parents = this.getParentBranches(branch);
        const techRows: [string, string][] = [];
        if (this.pdfOptions.fieldBranch) techRows.push(['Rama', branch.name]);
        if (parents.length > 0) {
          techRows.push(['Rama Padre (Unificada en)', parents.map(p => p.name).join(', ')]);
        }
        if (this.pdfOptions.fieldCategory) techRows.push(['Módulo / Flujo', branch.moduleFlow || 'General']);
        if (this.pdfOptions.fieldFeature) techRows.push(['Feature / Validación', branch.featureTitle || '-']);
        if (this.pdfOptions.fieldState) techRows.push(['Estado Actual', branch.state]);
        if (this.pdfOptions.fieldQaVersions) techRows.push(['Versiones Compilación QA', qaVersionsText]);
        if (this.pdfOptions.fieldDevs) {
          techRows.push(['Devs Involucrados', devsList.length ? devsList.join(', ') : 'Por definir']);
        }
        if (this.pdfOptions.fieldUpdatedAt) techRows.push(['Última Actualización', formattedDate]);

        if (techRows.length > 0) {
          (doc as any).autoTable({
            startY: currentY,
            head: [['Campo', 'Detalle de Trazabilidad']],
            body: techRows,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59], cellPadding: 3 },
            columnStyles: {
              0: { cellWidth: 48, fontStyle: 'bold', fillColor: [248, 250, 252] },
              1: { cellWidth: 'auto' }
            }
          });
          currentY = (doc as any).lastAutoTable.finalY + 8;
        }
      }

      // 2. Objetivos e Integraciones (solo los marcados por el usuario)
      const activeBullets = this.pdfSelectableObjectives
        .filter(o => o.selected)
        .map(o => o.text);

      if (this.pdfOptions.includeObjectives) {
        const objectivesRows = activeBullets.length
          ? activeBullets.map((b, i) => [`${i + 1}`, b])
          : [['-', 'Sin objetivos o commits detallados seleccionados.']];

        (doc as any).autoTable({
          startY: currentY,
          head: [['#', 'Objetivos Cumplidos, Integraciones y Control de Errores']],
          body: objectivesRows,
          theme: 'grid',
          headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59], cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 'auto' }
          }
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // 3. Sub-ramas seleccionadas
      const activeSubBranches = this.pdfSelectableSubBranches
        .filter(s => s.selected)
        .map(s => s.sub);

      if (this.pdfOptions.includeSubBranches && activeSubBranches.length > 0) {
        (doc as any).autoTable({
          startY: currentY,
          head: [['Sub-rama', 'Desarrollador', 'Aporte / Notas']],
          body: activeSubBranches.map(s => [
            s.branchName,
            s.devName || '-',
            s.notesOrCommits || '-'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 2.5 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // 4. Bloque de Plantilla Estricta de MR (si está activado)
      if (this.pdfOptions.includeMrPreview) {
        const moduleName = (branch.moduleFlow || 'General').trim();
        const titleDesc = (branch.featureTitle || branch.name).trim();
        const bodyText =
          activeBullets.length > 0
            ? activeBullets.map(b => `- ${b}`).join('\n')
            : `- Implementación y validación correspondiente a la rama ${branch.name}.`;
        const devsText = devsList.length > 0 ? devsList.join(', ') : 'Por definir';

        const mrPreview =
          `Título: feat(${moduleName}): ${titleDesc}\n\n` +
          `Descripción general del desarrollo u objetivos:\n${bodyText}\n\n` +
          `Devs involucrados:\n${devsText}`;

        (doc as any).autoTable({
          startY: currentY,
          head: [[
            branch.state === 'Certificada'
              ? 'MERGE REQUEST GENERADO (ESTADO: CERTIFICADA)'
              : `PREVISUALIZACIÓN DE MR (PENDIENTE CERTIFICAR — ESTADO ACTUAL: ${branch.state.toUpperCase()})`
          ]],
          body: [[mrPreview]],
          theme: 'grid',
          headStyles: {
            fillColor: branch.state === 'Certificada' ? [5, 150, 105] : [180, 83, 9],
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold'
          },
          bodyStyles: {
            font: 'courier',
            fontSize: 8,
            textColor: [15, 23, 42],
            fillColor: [248, 250, 252],
            cellPadding: 4
          }
        });
      }

      const safeFile = branch.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Reporte_Rama_${safeFile}.pdf`;
      const pdfArrayBuffer = doc.output('arraybuffer');

      this.showPdfConfigModal = false;
      this.saveFileAndShowNotification(
        fileName,
        new Uint8Array(pdfArrayBuffer),
        'application/pdf'
      );
    } catch (e: any) {
      this.showToast('Error al generar PDF: ' + (e.message || e));
    }
  }

  exportAllBranchesExcel(): void {
    try {
      const escXml = (val: any): string =>
        String(val ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');

      const colLetter = (colIdx: number): string => {
        let s = '';
        let n = colIdx + 1;
        while (n > 0) {
          const m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };

      const buildWorksheetXml = (
        rows: { value: string | number; styleIdx: number }[][],
        colWidths: number[],
        mergeLastColIdx: number
      ): string => {
        const colsXml = colWidths
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join('');

        const rowsXml = rows
          .map((cells, rIdx) => {
            const rowNum = rIdx + 1;
            const heightAttr = rIdx === 0 ? ' ht="28" customHeight="1"' : rIdx === 1 ? ' ht="24" customHeight="1"' : '';
            const cellsXml = cells
              .map((cell, cIdx) => {
                const ref = `${colLetter(cIdx)}${rowNum}`;
                if (typeof cell.value === 'number') {
                  return `<c r="${ref}" s="${cell.styleIdx}" t="n"><v>${cell.value}</v></c>`;
                }
                return `<c r="${ref}" s="${cell.styleIdx}" t="inlineStr"><is><t xml:space="preserve">${escXml(cell.value)}</t></is></c>`;
              })
              .join('');
            return `<row r="${rowNum}"${heightAttr}>${cellsXml}</row>`;
          })
          .join('');

        const endCol = colLetter(mergeLastColIdx);
        return (
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
          `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<cols>${colsXml}</cols>` +
          `<sheetData>${rowsXml}</sheetData>` +
          `<mergeCells count="1"><mergeCell ref="A1:${endCol}1"/></mergeCells>` +
          `</worksheet>`
        );
      };

      const getStateStyleIdx = (state: BranchLifecycleState): number => {
        if (state === 'Certificada') return 4;
        if (state === 'QA') return 5;
        return 6;
      };

      // =========================================================================
      // HOJA 1: CONTROL DE RAMAS
      // =========================================================================
      const headers1 = [
        '#',
        'Categoría (Módulo / Flujo)',
        'Nombre de Rama',
        'Título / Desarrollo',
        'Estado',
        'Versiones QA',
        'Devs Involucrados',
        'Objetivos y Descripción',
        'Sub-ramas Asociadas',
        'Última Actualización'
      ];

      const sheet1Rows: { value: string | number; styleIdx: number }[][] = [
        headers1.map((_, i) => ({
          value: i === 0 ? 'CONTROL DE RAMAS, CATEGORÍAS Y VERSIONES QA' : '',
          styleIdx: 1
        })),
        headers1.map(h => ({ value: h, styleIdx: 2 }))
      ];

      if (this.branches.length === 0) {
        sheet1Rows.push([
          { value: '-', styleIdx: 7 },
          { value: 'Sin ramas registradas', styleIdx: 0 },
          { value: '-', styleIdx: 0 },
          { value: '-', styleIdx: 0 },
          { value: '-', styleIdx: 7 },
          { value: '-', styleIdx: 7 },
          { value: '-', styleIdx: 0 },
          { value: '-', styleIdx: 0 },
          { value: '-', styleIdx: 0 },
          { value: '-', styleIdx: 7 }
        ]);
      } else {
        this.branches.forEach((b, idx) => {
          const bullets = this.extractBulletPointsFromBranch(b);
          const objectivesText = bullets.length
            ? bullets.map(item => `• ${item}`).join('\n')
            : b.objectivesSummary || '-';
          const subBranchesText = (b.subBranches || []).length
            ? b.subBranches
                .map(s => `• ${s.branchName} (${s.devName || 'Dev'}): ${s.notesOrCommits || ''}`)
                .join('\n')
            : '-';
          const devsText = this.collectUniqueDevs([b]).join(', ') || '-';
          const versionsText = (b.qaVersions || []).length
            ? b.qaVersions.map(v => `v${v}`).join(', ')
            : '-';
          const updatedText = new Date(b.updatedAt || b.createdAt).toLocaleDateString('es-ES');

          sheet1Rows.push([
            { value: idx + 1, styleIdx: 7 },
            { value: b.moduleFlow || 'General', styleIdx: 8 },
            { value: b.name, styleIdx: 3 },
            { value: b.featureTitle || '-', styleIdx: 0 },
            { value: b.state, styleIdx: getStateStyleIdx(b.state) },
            { value: versionsText, styleIdx: 7 },
            { value: devsText, styleIdx: 0 },
            { value: objectivesText, styleIdx: 0 },
            { value: subBranchesText, styleIdx: 0 },
            { value: updatedText, styleIdx: 7 }
          ]);
        });
      }

      const sheet1Xml = buildWorksheetXml(
        sheet1Rows,
        [6, 24, 48, 36, 18, 18, 26, 54, 42, 16],
        9
      );

      // =========================================================================
      // HOJA 2: DICCIONARIO VERSIONES QA
      // =========================================================================
      const headers2 = [
        'Versión QA',
        'Rama Asociada',
        'Categoría (Módulo / Flujo)',
        'Estado Actual',
        'Devs Involucrados'
      ];

      const sheet2Rows: { value: string | number; styleIdx: number }[][] = [
        headers2.map((_, i) => ({
          value: i === 0 ? 'DICCIONARIO DE VERSIONES QA (VERSION MAPPING)' : '',
          styleIdx: 1
        })),
        headers2.map(h => ({ value: h, styleIdx: 2 }))
      ];

      if (this.versionDictionary.length === 0) {
        sheet2Rows.push([
          { value: 'Sin versiones registradas', styleIdx: 0 },
          { value: '-', styleIdx: 0 },
          { value: '-', styleIdx: 0 },
          { value: '-', styleIdx: 7 },
          { value: '-', styleIdx: 0 }
        ]);
      } else {
        for (const item of this.versionDictionary) {
          sheet2Rows.push([
            { value: `v${item.version}`, styleIdx: 7 },
            { value: item.branch.name, styleIdx: 3 },
            { value: item.branch.moduleFlow || 'General', styleIdx: 8 },
            { value: item.branch.state, styleIdx: getStateStyleIdx(item.branch.state) },
            { value: this.collectUniqueDevs([item.branch]).join(', ') || '-', styleIdx: 0 }
          ]);
        }
      }

      const sheet2Xml = buildWorksheetXml(sheet2Rows, [18, 48, 24, 18, 30], 4);

      // =========================================================================
      // ESTILOS Y ARCHIVOS OPENXML (.XLSX NATIVO SIN DEPENDENCIAS EXTERNAS)
      // =========================================================================
      const stylesXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<fonts count="7">` +
        `<font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>` +
        `<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
        `<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
        `<font><b/><sz val="9.5"/><color rgb="FF1E1B4B"/><name val="Consolas"/></font>` +
        `<font><b/><sz val="10"/><color rgb="FF065F46"/><name val="Calibri"/></font>` +
        `<font><b/><sz val="10"/><color rgb="FF92400E"/><name val="Calibri"/></font>` +
        `<font><b/><sz val="10"/><color rgb="FF3730A3"/><name val="Calibri"/></font>` +
        `</fonts>` +
        `<fills count="8">` +
        `<fill><patternFill patternType="none"/></fill>` +
        `<fill><patternFill patternType="gray125"/></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/><bgColor indexed="64"/></patternFill></fill>` +
        `<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>` +
        `</fills>` +
        `<borders count="2">` +
        `<border><left/><right/><top/><bottom/><diagonal/></border>` +
        `<border>` +
        `<left style="thin"><color rgb="FFCBD5E1"/></left>` +
        `<right style="thin"><color rgb="FFCBD5E1"/></right>` +
        `<top style="thin"><color rgb="FFCBD5E1"/></top>` +
        `<bottom style="thin"><color rgb="FFCBD5E1"/></bottom>` +
        `<diagonal/>` +
        `</border>` +
        `</borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="9">` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
        `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
        `<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
        `<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
        `<xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
        `<xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
        `<xf numFmtId="0" fontId="6" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>` +
        `<xf numFmtId="0" fontId="6" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>` +
        `</cellXfs>` +
        `</styleSheet>`;

      const workbookXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>` +
        `<sheet name="Control de Ramas" sheetId="1" r:id="rId1"/>` +
        `<sheet name="Versiones QA" sheetId="2" r:id="rId2"/>` +
        `</sheets>` +
        `</workbook>`;

      const workbookRelsXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` +
        `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`;

      const rootRelsXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`;

      const contentTypesXml =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`;

      const zipBytes = this.buildZipArchiveBytes([
        { path: '[Content_Types].xml', content: contentTypesXml },
        { path: '_rels/.rels', content: rootRelsXml },
        { path: 'xl/workbook.xml', content: workbookXml },
        { path: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
        { path: 'xl/styles.xml', content: stylesXml },
        { path: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
        { path: 'xl/worksheets/sheet2.xml', content: sheet2Xml }
      ]);

      const dateSlug = new Date().toISOString().slice(0, 10);
      const fileName = `Control_de_Ramas_${dateSlug}.xlsx`;
      this.saveFileAndShowNotification(
        fileName,
        zipBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    } catch (e: any) {
      this.showToast('Error al exportar Excel: ' + (e.message || e));
    }
  }

  private buildZipArchiveBytes(files: { path: string; content: string }[]): Uint8Array {
    const encoder = new TextEncoder();
    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }

    const crc32 = (bytes: Uint8Array): number => {
      let crc = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) {
        crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };

    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.path);
      const dataBytes = encoder.encode(file.content);
      const crc = crc32(dataBytes);
      const size = dataBytes.length;

      // Local file header (30 bytes + name)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(localHeader.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true); // UTF-8 flag
      lv.setUint16(8, 0, true); // STORE (0)
      lv.setUint16(10, 0, true);
      lv.setUint16(12, 0, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, size, true);
      lv.setUint32(22, size, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader, dataBytes);

      // Central directory header (46 bytes + name)
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(centralHeader.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true); // UTF-8 flag
      cv.setUint16(10, 0, true); // STORE (0)
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, size, true);
      cv.setUint32(24, size, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    }

    const centralSize = centralParts.reduce((acc, p) => acc + p.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    const allParts = [...localParts, ...centralParts, eocd];
    const totalLength = allParts.reduce((acc, p) => acc + p.length, 0);
    const merged = new Uint8Array(totalLength);
    let pos = 0;
    for (const part of allParts) {
      merged.set(part, pos);
      pos += part.length;
    }
    return merged;
  }

  private saveFileAndShowNotification(
    fileName: string,
    bytes: Uint8Array,
    mimeType: string
  ): void {
    let savedFullPath = '';
    try {
      const win = window as any;
      if (win.require) {
        const fs = win.require('fs');
        const path = win.require('path');
        const os = win.require('os');
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        if (fs.existsSync(downloadsDir)) {
          savedFullPath = path.join(downloadsDir, fileName);
          fs.writeFileSync(savedFullPath, win.Buffer ? win.Buffer.from(bytes) : bytes);
        }
      }
    } catch {
      savedFullPath = '';
    }

    if (!savedFullPath) {
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    this.showDownloadNotification(fileName, savedFullPath);
  }

  showDownloadNotification(fileName: string, fullPath = ''): void {
    this.downloadFileName = fileName;
    this.downloadFilePath = fullPath;
    this.downloadNotificationVisible = true;
    if (this.downloadTimer) clearTimeout(this.downloadTimer);
    this.downloadTimer = setTimeout(() => {
      this.downloadNotificationVisible = false;
    }, 9000);
    this.lucide.refresh();
  }

  closeDownloadNotification(event?: Event): void {
    if (event) event.stopPropagation();
    this.downloadNotificationVisible = false;
    if (this.downloadTimer) clearTimeout(this.downloadTimer);
  }

  openDownloadedFileFolder(): void {
    try {
      const win = window as any;
      if (win.require) {
        const electron = win.require('electron');
        const path = win.require('path');
        const os = win.require('os');
        const fs = win.require('fs');
        const targetPath =
          this.downloadFilePath ||
          path.join(os.homedir(), 'Downloads', this.downloadFileName || '');

        if (electron?.shell) {
          if (targetPath && fs.existsSync(targetPath)) {
            electron.shell.showItemInFolder(targetPath);
          } else {
            electron.shell.openPath(path.join(os.homedir(), 'Downloads'));
          }
          this.downloadNotificationVisible = false;
          return;
        }
      }
    } catch {
      // Fallback al endpoint del servidor local
    }

    fetch('/api/system/open-downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: this.downloadFileName })
    }).catch(() => {});
    this.downloadNotificationVisible = false;
  }

  // --- UTILIDADES ---

  async copyBranchName(branchName: string, key = '', event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const clean = (branchName || '').trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
      if (key) {
        this.copiedKey = key;
        if (this.copiedTimer) clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => {
          this.copiedKey = null;
        }, 1600);
      }
      this.showToast(`Rama copiada: ${clean}`);
    } catch {
      this.showToast('No se pudo copiar automáticamente');
    }
  }

  async copySelectedBlockBranchNames(): Promise<void> {
    const names = this.selectedBlockBranches.map(b => b.name).join('\n');
    if (!names) return;
    await this.copyText(names);
  }

  async copyText(text: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copiado al portapapeles');
    } catch {
      this.showToast('No se pudo copiar automáticamente');
    }
  }

  getStateBadgeClass(state: BranchLifecycleState): string {
    switch (state) {
      case 'Certificada':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'QA':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    }
  }

  getStateDotClass(state: BranchLifecycleState): string {
    switch (state) {
      case 'Certificada':
        return 'bg-emerald-400';
      case 'QA':
        return 'bg-amber-400';
      default:
        return 'bg-indigo-400';
    }
  }

  showToast(msg: string): void {
    this.toastMsg = msg;
    this.toastVisible = true;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 2800);
  }
}
