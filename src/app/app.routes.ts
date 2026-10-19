import { Routes } from '@angular/router';
import { HubComponent } from './features/hub/hub.component';
import { DashboardCmdComponent } from './features/dashboard-cmd/dashboard-cmd.component';
import { DocGeneratorComponent } from './features/doc-generator/doc-generator.component';
import { RedesComponent } from './features/redes/redes.component';
import { ApiDocComponent } from './features/api-doc/api-doc.component';
import { RepoDocComponent } from './features/repo-doc/repo-doc.component';
import { EmuladorComponent } from './features/emulador/emulador.component';
import { ConfiguracionesComponent } from './features/configuraciones/configuraciones.component';

export const routes: Routes = [
  { path: '', redirectTo: 'hub', pathMatch: 'full' },
  { path: 'index', redirectTo: 'hub', pathMatch: 'full' },
  { path: 'hub', component: HubComponent },
  { path: 'dashboard-cmd', component: DashboardCmdComponent },
  { path: 'dashboard-CMD', redirectTo: 'dashboard-cmd', pathMatch: 'full' },
  { path: 'doc-generator', component: DocGeneratorComponent },
  { path: 'redes', component: RedesComponent },
  { path: 'api-doc', component: ApiDocComponent },
  { path: 'doc-api', redirectTo: 'api-doc', pathMatch: 'full' },
  { path: 'repo-doc', component: RepoDocComponent },
  { path: 'emulador', component: EmuladorComponent },
  { path: 'configuraciones', component: ConfiguracionesComponent },
  { path: '**', redirectTo: 'hub' }
];

