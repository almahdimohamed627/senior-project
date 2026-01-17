import { Routes } from "@angular/router";
import { LayoutPageComponent } from "../layout-page/layout-page.component";

export const layoutRoutes: Routes = [
    {
        path: '',
        component: LayoutPageComponent,
        children: [
            { path: '', redirectTo: 'admin/users', pathMatch: 'full' },
            {
                path: 'admin',
                loadChildren: () => import('@modules/admin/admin.routes').then(m => m.AdminRoutes)
            },
        ]
    },
    
]