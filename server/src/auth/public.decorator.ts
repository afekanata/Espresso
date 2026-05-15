import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route/controller as accessible without authentication.
 * Used in combination with the globally-applied AuthGuard so the default
 * posture is "auth required" and only explicitly-public endpoints (login,
 * health) are exempted.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
