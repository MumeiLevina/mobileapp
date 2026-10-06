import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Request } from "express";
import { DatabaseService } from "../database/database.service";
type AuthRequest = Request & { userId: string };
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
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
