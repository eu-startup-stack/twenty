import { AuthentikHeaderAuthController } from '../authentik-header-auth.controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeWorkspace = (overrides: Record<string, unknown> = {}) => ({
  id: 'ws-id',
  subdomain: 'acme',
  ...overrides,
});

const makeLoginToken = (token = 'login-token-abc') => ({
  token,
  expiresAt: new Date(),
});

// Builds a minimal fake Express Request with the given headers.
const buildRequest = (headers: Record<string, string | undefined>) => ({
  headers,
});

// Builds a fake Express Response that records calls to status/json/redirect/setHeader.
const buildResponse = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    redirect: jest.fn(),
    setHeader: jest.fn(),
  };

  // status() returns the same res so callers can chain .json()
  res.status.mockReturnValue(res);

  return res;
};

// ---------------------------------------------------------------------------
// Factory: builds a fully-mocked AuthentikHeaderAuthController
// ---------------------------------------------------------------------------

const buildController = (overrides: {
  groupPrefix?: string;
  signInOrProvisionResult?: object;
  computeRedirectURIResult?: string;
}) => {
  const {
    groupPrefix = 'twenty-',
    signInOrProvisionResult = {
      loginToken: makeLoginToken(),
      workspace: makeWorkspace(),
    },
    computeRedirectURIResult = 'https://acme.example.com/verify?loginToken=login-token-abc',
  } = overrides;

  const authentikAuthService = {
    signInOrProvision: jest.fn().mockResolvedValue(signInOrProvisionResult),
  };

  const authService = {
    computeRedirectURI: jest.fn().mockReturnValue(computeRedirectURIResult),
  };

  const twentyConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'AUTHENTIK_HEADER_GROUP_PREFIX') return groupPrefix;

      return undefined;
    }),
  };

  const controller = new AuthentikHeaderAuthController(
    authentikAuthService as never,
    authService as never,
    twentyConfigService as never,
  );

  return {
    controller,
    authentikAuthService,
    authService,
    twentyConfigService,
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthentikHeaderAuthController', () => {
  // 1. Returns 403 when x-authentik-email is missing
  it('should return 403 when x-authentik-email header is missing', async () => {
    const { controller, authentikAuthService } = buildController({});
    const req = buildRequest({
      'x-authentik-groups': 'twenty-admin',
    });
    const res = buildResponse();

    await controller.authentikAuth(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentik auth headers missing',
    });
    // Service must NOT be called when validation fails
    expect(authentikAuthService.signInOrProvision).not.toHaveBeenCalled();
  });

  // 1b. Returns 403 when x-authentik-email is whitespace-only
  it('should return 403 when x-authentik-email header is whitespace-only', async () => {
    const { controller, authentikAuthService } = buildController({});
    const req = buildRequest({
      'x-authentik-email': '   ',
      'x-authentik-groups': 'twenty-admin',
    });
    const res = buildResponse();

    await controller.authentikAuth(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentik auth headers missing',
    });
    expect(authentikAuthService.signInOrProvision).not.toHaveBeenCalled();
  });

  // 2. Returns 403 when x-authentik-groups is missing
  it('should return 403 when x-authentik-groups header is missing', async () => {
    const { controller, authentikAuthService } = buildController({});
    const req = buildRequest({
      'x-authentik-email': 'jane@example.com',
    });
    const res = buildResponse();

    await controller.authentikAuth(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentik auth headers missing',
    });
    // Service must NOT be called when validation fails
    expect(authentikAuthService.signInOrProvision).not.toHaveBeenCalled();
  });

  // 3. Returns 403 when groups header present but no group starts with 'twenty-'
  it('should return 403 when no group starts with the configured prefix', async () => {
    const { controller, authentikAuthService } = buildController({
      groupPrefix: 'twenty-',
    });
    const req = buildRequest({
      'x-authentik-email': 'jane@example.com',
      'x-authentik-groups': 'other-admin|other-member',
    });
    const res = buildResponse();

    await controller.authentikAuth(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Authentik auth headers missing',
    });
    // Service must NOT be called when no prefixed group is found
    expect(authentikAuthService.signInOrProvision).not.toHaveBeenCalled();
  });

  // 4. Calls signInOrProvision with parsed prefixed groups and redirects
  it('should call signInOrProvision with stripped+lower-cased groups and redirect', async () => {
    const redirectUrl =
      'https://acme.example.com/verify?loginToken=login-token-abc';
    const loginToken = makeLoginToken('login-token-abc');
    const workspace = makeWorkspace();
    const { controller, authentikAuthService, authService } = buildController({
      signInOrProvisionResult: { loginToken, workspace },
      computeRedirectURIResult: redirectUrl,
    });

    const req = buildRequest({
      'x-authentik-email': 'jane@example.com',
      'x-authentik-name': 'Jane Doe',
      'x-authentik-groups': 'twenty-Admin|twenty-Member|other-group',
    });
    const res = buildResponse();

    await controller.authentikAuth(req as never, res as never);

    // Prefix stripped and lower-cased; 'other-group' filtered out
    expect(authentikAuthService.signInOrProvision).toHaveBeenCalledWith({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin', 'member'],
    });

    // computeRedirectURI must receive the token and workspace from the service result
    expect(authService.computeRedirectURI).toHaveBeenCalledWith({
      loginToken: loginToken.token,
      workspace,
    });

    expect(res.redirect).toHaveBeenCalledWith(redirectUrl);
  });

  // 5. Sets Cache-Control: no-store before the redirect
  it('should set Cache-Control: no-store before redirecting', async () => {
    const redirectUrl =
      'https://acme.example.com/verify?loginToken=login-token-abc';
    const { controller } = buildController({
      computeRedirectURIResult: redirectUrl,
    });

    const req = buildRequest({
      'x-authentik-email': 'jane@example.com',
      'x-authentik-groups': 'twenty-admin',
    });
    const res = buildResponse();

    await controller.authentikAuth(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    // setHeader must be called before redirect
    const setHeaderOrder = res.setHeader.mock.invocationCallOrder[0];
    const redirectOrder = res.redirect.mock.invocationCallOrder[0];

    expect(setHeaderOrder).toBeLessThan(redirectOrder);
  });
});
