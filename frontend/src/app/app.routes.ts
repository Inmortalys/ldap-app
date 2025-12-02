import { Routes } from '@angular/router';
import { UsersComponent } from './pages/users/users.component';
import { SettingsComponent } from './pages/settings/settings.component';

export const routes: Routes = [
    { path: '', redirectTo: '/users', pathMatch: 'full' },
    { path: 'users', component: UsersComponent },
    { path: 'settings', component: SettingsComponent },
    { path: '**', redirectTo: '/users' }
];
