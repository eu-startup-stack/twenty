import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';

import { AuthentikAuthService } from '../authentik-auth.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeWorkspace = (overrides: Record<string, unknown> = {}) => ({
  id: 'ws-id',
  subdomain: 'acme',
  activationStatus: 'ACTIVE',
  defaultRoleId: 'default-role-id',
  ...overrides,
});

const makeRole = (label: string, id = `role-${label}`) => ({ id, label });

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-id',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  ...overrides,
});

const makeUserWorkspace = (overrides: Record<string, unknown> = {}) => ({
  id: 'uw-id',
  userId: 'user-id',
  workspaceId: 'ws-id',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Factory: builds a fully-mocked AuthentikAuthService with injectable stubs
// ---------------------------------------------------------------------------

const buildService = (overrides: {
  workspaceCount?: number;
  workspaceBySubdomain?: object | null;
  workspaceFirst?: object | null;
  existingUser?: object | null;
  workspaceRoles?: object[];
  signInUpResult?: object;
  userWorkspace?: object;
  targetSubdomain?: string;
}) => {
  const {
    workspaceCount = 1,
    workspaceBySubdomain = null,
    workspaceFirst = makeWorkspace(),
    existingUser = null,
    workspaceRoles = [makeRole('Admin'), makeRole('Member'), makeRole('Guest')],
    signInUpResult = makeUser(),
    userWorkspace = makeUserWorkspace(),
    targetSubdomain = '',
  } = overrides;

  const workspaceRepository = {
    findOne: jest.fn(({ where }: { where: Record<string, unknown> }) => {
      if (where.subdomain) {
        return Promise.resolve(workspaceBySubdomain);
      }

      return Promise.resolve(workspaceFirst);
    }),
    count: jest.fn().mockResolvedValue(workspaceCount),
  };

  const userService = {
    findUserByEmail: jest.fn().mockResolvedValue(existingUser),
    markEmailAsVerified: jest.fn().mockResolvedValue(undefined),
  };

  const computePartialUserFromUserPayloadResult = {
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    isEmailVerified: true,
  };

  const signInUpService = {
    computePartialUserFromUserPayload: jest
      .fn()
      .mockResolvedValue(computePartialUserFromUserPayloadResult),
    signInUpOnExistingWorkspace: jest.fn().mockResolvedValue(signInUpResult),
  };

  const loginTokenService = {
    generateLoginToken: jest.fn().mockResolvedValue({
      token: 'login-token',
      expiresAt: new Date(),
    }),
  };

  const userWorkspaceService = {
    getUserWorkspaceForUserOrThrow: jest.fn().mockResolvedValue(userWorkspace),
  };

  const roleService = {
    getWorkspaceRoles: jest.fn().mockResolvedValue(workspaceRoles),
  };

  const userRoleService = {
    assignRoleToManyUserWorkspace: jest.fn().mockResolvedValue(undefined),
  };

  const twentyConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'AUTHENTIK_TARGET_WORKSPACE_SUBDOMAIN') return targetSubdomain;

      return undefined;
    }),
  };

  const service = new AuthentikAuthService(
    workspaceRepository as never,
    userService as never,
    signInUpService as never,
    loginTokenService as never,
    userWorkspaceService as never,
    roleService as never,
    userRoleService as never,
    twentyConfigService as never,
  );

  return {
    service,
    workspaceRepository,
    userService,
    signInUpService,
    loginTokenService,
    userWorkspaceService,
    roleService,
    userRoleService,
    twentyConfigService,
  };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthentikAuthService', () => {
  // 1. Rejects when prefixedGroups is empty
  it('should reject when prefixedGroups is empty', async () => {
    const { service } = buildService({});

    await expect(
      service.signInOrProvision({
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        prefixedGroups: [],
      }),
    ).rejects.toThrow(AuthException);

    await expect(
      service.signInOrProvision({
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        prefixedGroups: [],
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  // 2. Rejects when groups present but none match any workspace role
  it('should reject when groups present but none match any workspace role', async () => {
    const { service } = buildService({
      workspaceRoles: [makeRole('Admin'), makeRole('Member')],
    });

    await expect(
      service.signInOrProvision({
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        // 'editor' does not match 'Admin' or 'Member'
        prefixedGroups: ['editor'],
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  // 3. Rejects when 0 workspaces and no subdomain env var set
  it('should reject when 0 workspaces and no subdomain env var set', async () => {
    const { service } = buildService({
      workspaceCount: 0,
      targetSubdomain: '',
    });

    await expect(
      service.signInOrProvision({
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        prefixedGroups: ['admin'],
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  // 4. Rejects when 2+ workspaces and no subdomain env var set
  it('should reject when 2+ workspaces and no subdomain env var set', async () => {
    const { service } = buildService({
      workspaceCount: 2,
      targetSubdomain: '',
    });

    await expect(
      service.signInOrProvision({
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        prefixedGroups: ['admin'],
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.FORBIDDEN_EXCEPTION });
  });

  // 5. Resolves workspace by AUTHENTIK_TARGET_WORKSPACE_SUBDOMAIN when set
  it('should resolve workspace by AUTHENTIK_TARGET_WORKSPACE_SUBDOMAIN when set', async () => {
    const targetWorkspace = makeWorkspace({ subdomain: 'target' });
    const { service, workspaceRepository } = buildService({
      targetSubdomain: 'target',
      workspaceBySubdomain: targetWorkspace,
    });

    const result = await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    expect(result.workspace).toEqual(targetWorkspace);
    // Should look up by subdomain, not by count
    expect(workspaceRepository.count).not.toHaveBeenCalled();
    expect(workspaceRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subdomain: 'target' } }),
    );
  });

  // 5b. Rejects when subdomain is set but workspace not found
  it('should reject with WORKSPACE_NOT_FOUND when subdomain is set but workspace not found', async () => {
    const { service } = buildService({
      targetSubdomain: 'missing',
      workspaceBySubdomain: null,
    });

    await expect(
      service.signInOrProvision({
        email: 'jane@example.com',
        displayName: 'Jane Doe',
        prefixedGroups: ['admin'],
      }),
    ).rejects.toMatchObject({ code: AuthExceptionCode.WORKSPACE_NOT_FOUND });
  });

  // 6. Precedence: admin wins when both admin and member are present
  it('should pick admin role when both admin and member groups are present', async () => {
    const adminRole = makeRole('Admin', 'role-admin');
    const memberRole = makeRole('Member', 'role-member');
    const { service, userRoleService } = buildService({
      workspaceRoles: [adminRole, memberRole],
    });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin', 'member'],
    });

    expect(userRoleService.assignRoleToManyUserWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'role-admin' }),
    );
  });

  // 7. Precedence: guest wins over member
  it('should pick guest role over member when both are present', async () => {
    const guestRole = makeRole('Guest', 'role-guest');
    const memberRole = makeRole('Member', 'role-member');
    const { service, userRoleService } = buildService({
      workspaceRoles: [guestRole, memberRole],
    });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['guest', 'member'],
    });

    expect(userRoleService.assignRoleToManyUserWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'role-guest' }),
    );
  });

  // 8. Label-match fallback works for a custom group like 'editor' matching a role labelled 'Editor'
  it('should use label-match fallback for a custom group', async () => {
    const editorRole = makeRole('Editor', 'role-editor');
    const { service, userRoleService } = buildService({
      workspaceRoles: [editorRole],
    });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['editor'],
    });

    expect(userRoleService.assignRoleToManyUserWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'role-editor' }),
    );
  });

  // 9. JIT-creates user when findUserByEmail returns null
  it('should JIT-create user when findUserByEmail returns null', async () => {
    const { service, signInUpService } = buildService({
      existingUser: null,
    });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    expect(signInUpService.signInUpOnExistingWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        userData: expect.objectContaining({ type: 'newUserWithPicture' }),
      }),
    );
  });

  // 10. Reuses existing user when findUserByEmail returns a user
  it('should reuse existing user when findUserByEmail returns a user', async () => {
    const existingUser = makeUser();
    const { service, signInUpService } = buildService({ existingUser });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    expect(signInUpService.signInUpOnExistingWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        userData: expect.objectContaining({
          type: 'existingUser',
          existingUser,
        }),
      }),
    );
  });

  // 11. Calls assignRoleToManyUserWorkspace with the resolved roleId
  it('should call assignRoleToManyUserWorkspace with the resolved roleId', async () => {
    const adminRole = makeRole('Admin', 'role-admin-id');
    const { service, userRoleService, userWorkspaceService } = buildService({
      workspaceRoles: [adminRole],
    });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    expect(
      userWorkspaceService.getUserWorkspaceForUserOrThrow,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        workspaceId: 'ws-id',
      }),
    );

    expect(userRoleService.assignRoleToManyUserWorkspace).toHaveBeenCalledWith({
      workspaceId: 'ws-id',
      userWorkspaceIds: ['uw-id'],
      roleId: 'role-admin-id',
    });
  });

  // 12a. Marks email verified for JIT-created users
  it('should mark email as verified for JIT-created users', async () => {
    const { service, userService } = buildService({
      existingUser: null,
      signInUpResult: makeUser({ id: 'new-user-id' }),
    });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    expect(userService.markEmailAsVerified).toHaveBeenCalledWith('new-user-id');
  });

  // 12b. Does NOT mark email verified for existing users
  it('should NOT mark email as verified for existing users', async () => {
    const existingUser = makeUser({ id: 'existing-user-id' });
    const { service, userService } = buildService({
      existingUser,
      signInUpResult: existingUser,
    });

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    expect(userService.markEmailAsVerified).not.toHaveBeenCalled();
  });

  // Bonus: mints loginToken with AuthentikProxy provider
  it('should mint loginToken with AuthProviderEnum.AuthentikProxy', async () => {
    const { service, loginTokenService } = buildService({});

    await service.signInOrProvision({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    expect(loginTokenService.generateLoginToken).toHaveBeenCalledWith(
      'jane@example.com',
      'ws-id',
      AuthProviderEnum.AuthentikProxy,
    );
  });

  // Email normalization: mixed-case input is lower-cased before lookup and JIT creation
  it('should normalize mixed-case email to lowercase before user lookup and JIT creation', async () => {
    const { service, userService, signInUpService } = buildService({
      existingUser: null,
    });

    await service.signInOrProvision({
      email: 'Jane@Example.COM',
      displayName: 'Jane Doe',
      prefixedGroups: ['admin'],
    });

    // findUserByEmail must receive the lower-cased email
    expect(userService.findUserByEmail).toHaveBeenCalledWith('jane@example.com');

    // JIT payload must also use the lower-cased email
    expect(signInUpService.computePartialUserFromUserPayload).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com' }),
      expect.anything(),
    );
  });
});
