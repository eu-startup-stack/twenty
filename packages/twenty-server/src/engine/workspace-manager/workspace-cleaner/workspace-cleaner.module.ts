import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { MetricsModule } from 'src/engine/core-modules/metrics/metrics.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserVarsModule } from 'src/engine/core-modules/user/user-vars/user-vars.module';
import { UserModule } from 'src/engine/core-modules/user/user.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';
import { CleanOnboardingWorkspacesCommand } from 'src/engine/workspace-manager/workspace-cleaner/commands/clean-onboarding-workspaces.command';
import { CleanOnboardingWorkspacesCronCommand } from 'src/engine/workspace-manager/workspace-cleaner/commands/clean-onboarding-workspaces.cron.command';
import { CleanSuspendedWorkspacesCommand } from 'src/engine/workspace-manager/workspace-cleaner/commands/clean-suspended-workspaces.command';
import { CleanSuspendedWorkspacesCronCommand } from 'src/engine/workspace-manager/workspace-cleaner/commands/clean-suspended-workspaces.cron.command';
import { DestroyWorkspaceCommand } from 'src/engine/workspace-manager/workspace-cleaner/commands/destroy-workspace.command';
import { CleanerWorkspaceService } from 'src/engine/workspace-manager/workspace-cleaner/services/cleaner.workspace-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceEntity,
      UserWorkspaceEntity,
    ]),
    WorkspaceModule,
    UserVarsModule,
    UserModule,
    EmailModule,
    MetricsModule,
  ],
  providers: [
    DestroyWorkspaceCommand,
    CleanSuspendedWorkspacesCronCommand,
    CleanSuspendedWorkspacesCommand,
    CleanOnboardingWorkspacesCommand,
    CleanOnboardingWorkspacesCronCommand,
    CleanerWorkspaceService,
  ],
  exports: [
    CleanerWorkspaceService,
    CleanSuspendedWorkspacesCronCommand,
    CleanOnboardingWorkspacesCronCommand,
  ],
})
export class WorkspaceCleanerModule {}
