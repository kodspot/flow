import type { MiddlewareHandler } from 'hono';
import { verifyJwt } from '../lib/auth.js';
import type { Env, AppVariables } from '../env.js';

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> =
  async (c, next) => {
    const authz = c.req.header('Authorization');
    const cookie = c.req.header('Cookie') ?? '';
    const cookieToken = /(?:^|;\s*)kf_session=([^;]+)/.exec(cookie)?.[1];
    const token = authz?.startsWith('Bearer ') ? authz.slice(7) : cookieToken;
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verifyJwt(c.env.JWT_SECRET, token);
    if (!payload) return c.json({ error: 'Invalid token' }, 401);

    c.set('auth', {
      userId: payload.sub,
      workspaceId: payload.wsId,
      role: payload.role,
      email: payload.email,
    });
    await next();
  };
