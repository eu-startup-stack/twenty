import {
  Controller,
  Get,
  Logger,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { Request, Response } from 'express';

import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { AuthentikAuthService } from 'src/engine/core-modules/auth/services/authentik-auth.service';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

@Controller('auth')
@UseFilters(AuthRestApiExceptionFilter)
export class AuthentikHeaderAuthController {
  private readonly logger = new Logger(AuthentikHeaderAuthController.name);

  constructor(
    private readonly authentikAuthService: AuthentikAuthService,
    private readonly authService: AuthService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  @Get('authentik')
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async authentikAuth(@Req() req: Request, @Res() res: Response) {
    // Express lower-cases all incoming header names, so these lookups are
    // already case-insensitive in practice.
    const emailHeader = req.headers['x-authentik-email'];
    const nameHeader = req.headers['x-authentik-name'];
    const groupsHeader = req.headers['x-authentik-groups'];
    const usernameHeader = req.headers['x-authentik-username'];

    // Coerce to string or undefined — headers can technically be string[].
    const email = Array.isArray(emailHeader) ? emailHeader[0] : emailHeader;
    const name = Array.isArray(nameHeader) ? nameHeader[0] : nameHeader;
    const groupsRaw = Array.isArray(groupsHeader)
      ? groupsHeader[0]
      : groupsHeader;
    const username = Array.isArray(usernameHeader)
      ? usernameHeader[0]
      : usernameHeader;

    // Log the incoming request for observability (username is optional and
    // used only here — it is never stored in the DB).
    this.logger.log(
      `Authentik header auth request — username: ${username ?? '(none)'}`,
    );

    // Validate required headers — trim to catch whitespace-only values.
    const trimmedEmail = email?.trim();

    if (!trimmedEmail || !groupsRaw) {
      return res
        .status(403)
        .json({ error: 'Authentik auth headers missing' });
    }

    // Parse groups: pipe-separated, trim whitespace, drop empty strings.
    const allGroups = groupsRaw
      .split('|')
      .map((g) => g.trim())
      .filter(Boolean);

    // Filter to groups that start with the configured prefix, strip the
    // prefix, and lower-case the remainder.
    const groupPrefix = this.twentyConfigService.get(
      'AUTHENTIK_HEADER_GROUP_PREFIX',
    );
    const prefixedGroups = allGroups
      .filter((g) => g.startsWith(groupPrefix))
      .map((g) => g.slice(groupPrefix.length).toLowerCase());

    if (prefixedGroups.length === 0) {
      return res
        .status(403)
        .json({ error: 'Authentik auth headers missing' });
    }

    // Delegate to the service — AuthExceptions bubble to AuthRestApiExceptionFilter.
    const result = await this.authentikAuthService.signInOrProvision({
      email: trimmedEmail,
      displayName: name ?? null,
      prefixedGroups,
    });

    // Prevent intermediary caching of the short-lived login token.
    res.setHeader('Cache-Control', 'no-store');

    return res.redirect(
      this.authService.computeRedirectURI({
        loginToken: result.loginToken.token,
        workspace: result.workspace,
      }),
    );
  }
}
