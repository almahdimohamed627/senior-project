import { Routes } from "@angular/router";

export const authRoutes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('../login-page/login-page.component').then((c) => c.LoginPageComponent),
    },
];
