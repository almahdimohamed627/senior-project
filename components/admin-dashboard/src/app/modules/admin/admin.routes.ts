import { Routes } from "@angular/router";
import { AdminPageComponent } from "./feature/admin-page/admin-page.component";

export const AdminRoutes: Routes = [
    {
        path: '',
        component: AdminPageComponent,
        children: [
            { path: '', redirectTo: 'users', pathMatch: 'full' },
            {
                path: 'users',
                loadComponent: () => import('@modules/admin/feature/users-page/users-page.component').then(
                    c => c.UsersPageComponent
                ),
            },
            {
                path: 'posts',
                loadComponent: () => import('@modules/admin/feature/doctors-posts-page/doctors-posts-page.component').then(
                    c => c.DoctorsPostsPageComponent
                )
            },
            {
                path: 'diagnosis',
                loadComponent: () => import('@modules/admin/feature/diagnosis-cases-page/diagnosis-cases-page.component').then(
                    c => c.DiagnosisCasesPageComponent 
                )
            }
        ]
    }
]