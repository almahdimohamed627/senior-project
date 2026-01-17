import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
    {
        path: 'auth',
        loadChildren: () => import('./core/auth/feature/auth-shell/auth.routes').then(m => m.authRoutes)
    },
    {
        path: '',
        canMatch: [authGuard],
        loadChildren: () => import('./core/layout/feature/layout-shell/layout.routes').then(m => m.layoutRoutes)
    },
    {
        path: '**',
        redirectTo: ''
    }
];
