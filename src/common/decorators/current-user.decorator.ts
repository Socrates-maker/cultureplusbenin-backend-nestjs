import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../../casl/casl-ability.factory';

/**
 * Injects the authenticated user (as attached by the JWT strategy) into a
 * route handler parameter.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
