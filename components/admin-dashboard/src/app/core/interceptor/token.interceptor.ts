import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TokenService } from '../services/token.service';
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  if(req.url.includes(environment.baseUrl)){
    const tokenService:TokenService = inject(TokenService);
    const token = tokenService.token();
      if(!!token){
        return next(req.clone({headers:req.headers.append('Authorization','Bearer ' + token)}));
      }
    }
    return next(req);
};
