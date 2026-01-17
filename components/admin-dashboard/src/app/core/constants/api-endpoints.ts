import { environment } from "environments/environment.development";

export const API_ENDPOINTS = {
    auth:{
        login: `${environment.baseUrl}auth/login`,
    },
    admin: {
        users: `${environment.baseUrl}profile/profiles`,
        userChangeStatus: `${environment.baseUrl}users/changeStatus/:id`,
        posts: `${environment.baseUrl}post`,
        postStatus: `${environment.baseUrl}admindashboard/accept-or-reject-post/:id/:accept`,
        diagnosis: `${environment.baseUrl}admindashboard/diagnoses`,
        userAccountStatus: `${environment.baseUrl}admindashboard/block-user/:id`,
    }
}