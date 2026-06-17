import { type NextFunction, type Response } from 'express';

import { AuthentikHeaderStripMiddleware } from '../authentik-header-strip.middleware';

// Hand-rolled mock request — no NestJS testing module required.
const buildMockRequest = ({
  remoteAddress,
  headers,
  trustProxyFn,
}: {
  remoteAddress: string | undefined;
  headers: Record<string, string>;
  trustProxyFn: ((addr: string, hop: number) => boolean) | undefined;
}) => ({
  socket: { remoteAddress },
  headers,
  app: {
    get: jest.fn().mockReturnValue(trustProxyFn),
  },
});

describe('AuthentikHeaderStripMiddleware', () => {
  let middleware: AuthentikHeaderStripMiddleware;
  let mockResponse: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new AuthentikHeaderStripMiddleware();
    mockResponse = {} as Response;
    mockNext = jest.fn();
  });

  it('should strip all x-authentik-* headers when trust proxy fn returns false for the socket IP', () => {
    const headers: Record<string, string> = {
      'x-authentik-email': 'user@example.com',
      'x-authentik-name': 'Jane Doe',
      'x-authentik-groups': 'twenty-admin',
      'content-type': 'application/json',
    };

    const req = buildMockRequest({
      remoteAddress: '203.0.113.1',
      headers,
      trustProxyFn: (_addr: string, _hop: number) => false,
    });

    middleware.use(req as never, mockResponse, mockNext);

    expect(req.headers['x-authentik-email']).toBeUndefined();
    expect(req.headers['x-authentik-name']).toBeUndefined();
    expect(req.headers['x-authentik-groups']).toBeUndefined();
    // Non-authentik headers must be preserved
    expect(req.headers['content-type']).toBe('application/json');
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should leave x-authentik-* headers intact when trust proxy fn returns true', () => {
    const headers: Record<string, string> = {
      'x-authentik-email': 'user@example.com',
      'x-authentik-name': 'Jane Doe',
      'x-authentik-groups': 'twenty-admin',
      'content-type': 'application/json',
    };

    const req = buildMockRequest({
      remoteAddress: '127.0.0.1',
      headers,
      trustProxyFn: (_addr: string, _hop: number) => true,
    });

    middleware.use(req as never, mockResponse, mockNext);

    expect(req.headers['x-authentik-email']).toBe('user@example.com');
    expect(req.headers['x-authentik-name']).toBe('Jane Doe');
    expect(req.headers['x-authentik-groups']).toBe('twenty-admin');
    expect(req.headers['content-type']).toBe('application/json');
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should strip x-authentik-* headers when trust proxy fn is undefined (defensive)', () => {
    const headers: Record<string, string> = {
      'x-authentik-email': 'user@example.com',
      'x-authentik-uid': 'abc123',
      'authorization': 'Bearer token',
    };

    const req = buildMockRequest({
      remoteAddress: '10.0.0.1',
      headers,
      trustProxyFn: undefined,
    });

    middleware.use(req as never, mockResponse, mockNext);

    expect(req.headers['x-authentik-email']).toBeUndefined();
    expect(req.headers['x-authentik-uid']).toBeUndefined();
    // Non-authentik headers must be preserved
    expect(req.headers['authorization']).toBe('Bearer token');
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
