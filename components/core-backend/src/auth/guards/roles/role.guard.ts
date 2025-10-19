import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/auth/decorators/role.decorator';
import { Role } from '../../../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflect:Reflector){}
  canActivate(
    context: ExecutionContext,
  ): boolean  {
    const requredRoles=this.reflect.getAllAndOverride<Role[]>(ROLES_KEY,[
      context.getHandler(),
      context.getClass()
    ]);
   if(!requredRoles) return true
    const user=context.switchToHttp().getRequest().user
    console.log(user)
    const hasRequiredRole=requredRoles.some(role=>user.role==role)

    return hasRequiredRole
  }//if this function return true then we allow to user to access to this protected resource atherweise(return false) return forbidden exeption
   

}
