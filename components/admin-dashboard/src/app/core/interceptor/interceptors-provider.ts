import { withInterceptors } from "@angular/common/http";
import { tokenInterceptor } from "./token.interceptor";

export const interceptorsProviders = [
    tokenInterceptor,
]