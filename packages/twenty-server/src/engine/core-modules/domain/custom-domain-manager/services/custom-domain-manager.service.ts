import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { msg } from '@lingui/core/macro';
import { assertIsDefinedOrThrow, isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { CUSTOM_DOMAIN_ACTIVATED_EVENT } from 'src/engine/core-modules/event-logs/emit/events/workspace-event/custom-domain/custom-domain-activated';
import { CUSTOM_DOMAIN_DEACTIVATED_EVENT } from 'src/engine/core-modules/event-logs/emit/events/workspace-event/custom-domain/custom-domain-deactivated';
import { PublicDomainEntity } from 'src/engine/core-modules/public-domain/public-domain.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import {
  WorkspaceException,
  WorkspaceExceptionCode,
} from 'src/engine/core-modules/workspace/workspace.exception';

@Injectable()
export class CustomDomainManagerService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    // Enforces global uniqueness of a custom domain across all workspaces.
    // eslint-disable-next-line twenty/prefer-workspace-scoped-repository
    @InjectRepository(PublicDomainEntity)
    private readonly publicDomainRepository: Repository<PublicDomainEntity>,
    private readonly eventLogEmitterService: EventLogEmitterService,
  ) {}

  async setCustomDomain(workspace: WorkspaceEntity, customDomain: string) {
    const existingWorkspace = await this.workspaceRepository.findOne({
      where: { customDomain },
    });

    if (existingWorkspace && existingWorkspace.id !== workspace.id) {
      throw new WorkspaceException(
        'Domain already taken',
        WorkspaceExceptionCode.DOMAIN_ALREADY_TAKEN,
      );
    }

    if (
      await this.publicDomainRepository.findOneBy({
        domain: customDomain,
      })
    ) {
      throw new WorkspaceException(
        'Domain is already registered as public domain',
        WorkspaceExceptionCode.DOMAIN_ALREADY_TAKEN,
        {
          userFriendlyMessage: msg`Domain is already registered as public domain`,
        },
      );
    }

    if (!isDefined(customDomain) || workspace.customDomain === customDomain) {
      return;
    }
  }

  async checkCustomDomainValidRecords(workspace: WorkspaceEntity) {
    assertIsDefinedOrThrow(workspace.customDomain);

    if (workspace.isCustomDomainEnabled !== true) {
      workspace.isCustomDomainEnabled = true;

      await this.workspaceRepository.save(workspace);

      const eventLogContext = this.eventLogEmitterService.createContext({
        workspaceId: workspace.id,
      });

      void eventLogContext.insertWorkspaceEvent(
        workspace.isCustomDomainEnabled
          ? CUSTOM_DOMAIN_ACTIVATED_EVENT
          : CUSTOM_DOMAIN_DEACTIVATED_EVENT,
        {},
      );
    }

    return workspace.customDomain;
  }
}
