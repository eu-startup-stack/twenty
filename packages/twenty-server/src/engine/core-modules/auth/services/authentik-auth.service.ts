import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { LoginTokenService } from 'src/engine/core-modules/auth/token/services/login-token.service';
import { type AuthToken } from 'src/engine/core-modules/auth/dto/auth-token.dto';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { RoleService } from 'src/engine/metadata-modules/role/role.service';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';

// Parses "Jane Doe" → { firstName: "Jane", lastName: "Doe" }.
// Single token → firstName only; missing/empty → both empty strings.
const parseDisplayName = (
  name: string | null | undefined,
): { firstName: string; lastName: string } => {
  if (!name || name.trim() === '') {
    return { firstName: '', lastName: '' };
  }

  const tokens = name.trim().split(/\s+/);
  const firstName = tokens[0] ?? '';
  const lastName = tokens.slice(1).join(' ');

  return { firstName, lastName };
};

// Resolves the single desired role from the workspace's role list using the
// precedence defined in the plan:
//   1. admin  → role labelled "Admin"
//   2. guest  → role labelled "Guest"
//   3. member | user → role labelled "Member"
//   4. any other group → role whose label (lower-cased) matches the group name
// Returns undefined when no group resolves to an existing role.
const resolveDesiredRole = (
  prefixedGroups: string[],
  workspaceRoles: RoleEntity[],
): RoleEntity | undefined => {
  const roleByLowerLabel = new Map<string, RoleEntity>(
    workspaceRoles.map((role) => [role.label.toLowerCase(), role]),
  );

  const groupSet = new Set(prefixedGroups);

  // Precedence 1: admin
  if (groupSet.has('admin')) {
    const role = roleByLowerLabel.get('admin');

    if (role) return role;
  }

  // Precedence 2: guest
  if (groupSet.has('guest')) {
    const role = roleByLowerLabel.get('guest');

    if (role) return role;
  }

  // Precedence 3: member or user
  if (groupSet.has('member') || groupSet.has('user')) {
    const role = roleByLowerLabel.get('member');

    if (role) return role;
  }

  // Precedence 4: label-match fallback — first group that matches any role label
  for (const group of prefixedGroups) {
    const role = roleByLowerLabel.get(group);

    if (role) return role;
  }

  return undefined;
};

@Injectable()
// oxlint-disable-next-line twenty/inject-workspace-repository
export class AuthentikAuthService {
  private readonly logger = new Logger(AuthentikAuthService.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    private readonly userService: UserService,
    private readonly signInUpService: SignInUpService,
    private readonly loginTokenService: LoginTokenService,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly roleService: RoleService,
    private readonly userRoleService: UserRoleService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  // Main entry point: given parsed Authentik headers, returns a loginToken +
  // workspace or throws an AuthException.
  async signInOrProvision(input: {
    email: string;
    displayName: string | null;
    prefixedGroups: string[];
  }): Promise<{ loginToken: AuthToken; workspace: WorkspaceEntity }> {
    const { displayName, prefixedGroups } = input;
    // Normalize email defensively — findUserByEmail does an exact-match query
    // so mixed-case input would create duplicate users on re-login.
    const email = input.email.trim().toLowerCase();

    // Guard: at least one prefixed group must be present before we do any DB
    // work — this is the "no twenty-* group = no access" policy.
    if (prefixedGroups.length === 0) {
      throw new AuthException(
        'No twenty-* group present in Authentik headers',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    // Step 1: Resolve workspace (assumption 1 from the plan).
    const workspace = await this.resolveWorkspace();

    // Step 2: Resolve existing user by lower-cased email.
    const existingUser = await this.userService.findUserByEmail(email);

    // Step 3: Compute desired role from the prefixed groups.
    const workspaceRoles = await this.roleService.getWorkspaceRoles(
      workspace.id,
    );
    const desiredRole = resolveDesiredRole(prefixedGroups, workspaceRoles);

    if (!desiredRole) {
      throw new AuthException(
        'No twenty-* group matches a workspace role',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      );
    }

    // Step 4: JIT user create or reuse existing user via signInUpOnExistingWorkspace.
    const isNewUser = !existingUser;
    const { firstName, lastName } = parseDisplayName(displayName);

    let user: UserEntity;

    if (isNewUser) {
      // Build PartialUserWithPicture for a brand-new user.
      // isEmailVerified is set to true because Authentik has already verified
      // the email address before forwarding the request.
      const newUserWithPicture =
        await this.signInUpService.computePartialUserFromUserPayload(
          {
            email,
            firstName,
            lastName,
            isEmailAlreadyVerified: true,
          },
          { provider: AuthProviderEnum.AuthentikProxy },
        );

      user = await this.signInUpService.signInUpOnExistingWorkspace({
        workspace,
        userData: { type: 'newUserWithPicture', newUserWithPicture },
      });
    } else {
      user = await this.signInUpService.signInUpOnExistingWorkspace({
        workspace,
        userData: { type: 'existingUser', existingUser },
      });
    }

    // Step 5: Assign the desired role (replaces any prior role-target for this
    // userWorkspace — UserRoleService.assignRoleToManyUserWorkspace handles
    // the delete-then-insert atomically via RoleTargetService.createMany).
    const userWorkspace =
      await this.userWorkspaceService.getUserWorkspaceForUserOrThrow({
        userId: user.id,
        workspaceId: workspace.id,
        // We only need the id; skip heavy relations.
        relations: [],
      });

    await this.userRoleService.assignRoleToManyUserWorkspace({
      workspaceId: workspace.id,
      userWorkspaceIds: [userWorkspace.id],
      roleId: desiredRole.id,
    });

    // Step 6 (JIT only): mark email as verified — Authentik has already done
    // this; mirrors what signInUpWithPersonalInvitation does for SSO users.
    if (isNewUser) {
      await this.userService.markEmailAsVerified(user.id);
    }

    // Step 7: Mint a short-lived login token.
    const loginToken = await this.loginTokenService.generateLoginToken(
      user.email,
      workspace.id,
      AuthProviderEnum.AuthentikProxy,
    );

    return { loginToken, workspace };
  }

  // Resolves the target workspace using the strategy from assumption 1:
  //   - AUTHENTIK_TARGET_WORKSPACE_SUBDOMAIN env var → look up by subdomain
  //   - Else exactly one workspace in DB → use it
  //   - Else → throw FORBIDDEN + log error
  private async resolveWorkspace(): Promise<WorkspaceEntity> {
    const targetSubdomain = this.twentyConfigService.get(
      'AUTHENTIK_TARGET_WORKSPACE_SUBDOMAIN',
    );

    if (targetSubdomain) {
      const workspace = await this.workspaceRepository.findOne({
        where: { subdomain: targetSubdomain },
      });

      if (!workspace) {
        throw new AuthException(
          `Authentik auth: workspace with subdomain "${targetSubdomain}" not found`,
          AuthExceptionCode.WORKSPACE_NOT_FOUND,
        );
      }

      return workspace;
    }

    // No subdomain configured — fall back to the single-workspace heuristic.
    const count = await this.workspaceRepository.count();

    if (count === 1) {
      // Safe: exactly one workspace exists.
      const workspace = await this.workspaceRepository.findOne({
        where: {},
      });

      if (!workspace) {
        // Should not happen given count === 1, but guard defensively.
        throw new AuthException(
          'Authentik auth: workspace not found',
          AuthExceptionCode.WORKSPACE_NOT_FOUND,
        );
      }

      return workspace;
    }

    // Zero or multiple workspaces with no subdomain configured — ambiguous.
    this.logger.error(
      `Authentik auth: ambiguous workspace resolution — found ${count} workspaces and AUTHENTIK_TARGET_WORKSPACE_SUBDOMAIN is not set`,
    );

    throw new AuthException(
      'Authentik auth: ambiguous workspace — set AUTHENTIK_TARGET_WORKSPACE_SUBDOMAIN',
      AuthExceptionCode.FORBIDDEN_EXCEPTION,
    );
  }
}
