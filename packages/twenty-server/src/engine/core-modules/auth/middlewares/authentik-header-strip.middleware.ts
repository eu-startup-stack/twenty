import { Injectable, type NestMiddleware } from '@nestjs/common';

import { type NextFunction, type Request, type Response } from 'express';

// This middleware runs unconditionally (regardless of AUTHENTIK_HEADER_AUTH_ENABLED)
// to prevent header spoofing from untrusted sources. It strips every inbound
// X-authentik-* header when the socket's remote IP is not trusted by Express's
// trust-proxy configuration.
//
// The trust-proxy fn is looked up lazily per request (not in the constructor)
// because main.ts calls app.set('trust proxy', …) after module bootstrap.
@Injectable()
export class AuthentikHeaderStripMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const trustProxyFn = req.app.get('trust proxy fn');
    const socketIp = req.socket?.remoteAddress;

    const isTrusted =
      typeof trustProxyFn === 'function' &&
      typeof socketIp === 'string' &&
      // Express trust-proxy fn signature: (addr: string, hop: number) => boolean
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (trustProxyFn(socketIp, 0) as boolean);

    if (!isTrusted) {
      for (const key of Object.keys(req.headers)) {
        if (key.toLowerCase().startsWith('x-authentik-')) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete req.headers[key];
        }
      }
    }

    next();
  }
}
