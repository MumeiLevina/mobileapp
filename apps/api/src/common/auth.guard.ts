import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Request } from "express";
import { DatabaseService } from "../database/database.service";
type AuthRequest = Request & { userId: string };
const PUBLIC_ROUTE = "mori:public-route";
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const handler = context.getHandler?.();
    const controller = context.getClass?.();
    if (
      (handler && Reflect.getMetadata(PUBLIC_ROUTE, handler)) ||
      (controller && Reflect.getMetadata(PUBLIC_ROUTE, controller))
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException();
    const { data, error } = await this.db.admin.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException();
    request.userId = data.user.id;
    return true;
  }
}
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthRequest>().userId,
);
