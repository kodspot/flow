import type { MiddlewareHandler } from 'hono';
import { issuedBeforePasswordChange, verifyJwt } from '../lib/auth.js';
import type { Env, AppVariables } from '../env.js';

/** `code` lets the web app tell an ended session (sign in again) from other 401s. */
const sessionEnded = (error: string) => ({ error, code: 'session_expired' as const });

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> =
  async (c, next) => {
    const authz = c.req.header('Authorization');
    const cookie = c.req.header('Cookie') ?? '';
    const cookieToken = /(?:^|;\s*)kf_session=([^;]+)/.exec(cookie)?.[1];
    const token = authz?.startsWith('Bearer ') ? authz.slice(7) : cookieToken;
    if (!token) return c.json(sessionEnded('Unauthorized'), 401);

    const payload = await verifyJwt(c.env.JWT_SECRET, token);
    if (!payload) return c.json(sessionEnded('Invalid token'), 401);
    if (await issuedBeforePasswordChange(c.env.KV, payload)) {
      return c.json(sessionEnded('Your password was changed. Please sign in again.'), 401);
    }

    c.set('auth', {
      userId: payload.sub,
      workspaceId: payload.wsId,
      role: payload.role,
      email: payload.email,
    });
    await next();
  };
