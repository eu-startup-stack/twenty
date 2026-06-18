# Workflow State — Enterprise License Removal

## Task
Remove all non-open-source (Enterprise Edition) code from the twenty fork.
- Files with `/* @license Enterprise */` are proprietary (NOT open source) → delete.
- Files without it are AGPLv3 (open source) → keep, but clean up references to deleted Enterprise files.
- Commit with message "Remove non-open-source Enterprise Edition code" and push to origin main.

## Current State (2026-06-18) — IMPLEMENTATION COMPLETE
**All 7 tasks executed; commit `12acc9f4fc` pushed to origin/main.** All verification grep checks return empty.

### Already done (by a prior run, uncommitted in working tree)
- **298 Enterprise code files deleted** (confirmed via `git grep "@license Enterprise" HEAD` = 298; working tree has 0 Enterprise code files, only `packages/twenty-ui/LICENSE` remains which is the license text itself — correct to keep).
- **~84 dependent OS files deleted** (frontend SSO/RLS/custom-domain components, pages, hooks, states, tests; backend upgrade-version-command 2-4; twenty-shared RowLevelPermission type files).
- **6 module files cleaned**: `core-engine.module.ts`, `jwt.module.ts`, `admin-panel.module.ts`, `admin-panel.resolver.ts`, `emailing-domain.module.ts`, `workspace-command-provider.module.ts`.
- Total: 382 files deleted, 6 modified, all uncommitted.

### NOT done — remaining cleanup (the prior run missed these)
**Root cause**: The prior run appears to have used `rg` (ripgrep) for reference cleanup, but `rg` is NOT installed in this environment. All `rg` searches returned empty (command-not-found errors were suppressed). Consequently, only 6 top-level module files were cleaned; the vast majority of OS files with dangling imports to deleted Enterprise modules were NOT cleaned.

**`rg` is not installed — ALL searches must use `grep` (bash) or the Grep tool.**

### ✅ COMPLETED on 2026-06-18
All 7 tasks in the plan have been executed. Commit `12acc9f4fc` "Remove non-open-source Enterprise Edition code" pushed to origin/main. All verification grep checks return empty.

#### Scope of remaining dangling references:
- **79 backend files** in `packages/twenty-server/src/` still import from deleted modules.
- **~15 frontend files** in `packages/twenty-front/src/` still reference deleted files.
- **2 twenty-shared files** (`types/index.ts`, `types/ObjectPermissions.ts`) still export/import deleted RowLevelPermission types.

#### Deleted modules that still have dangling references:
| Deleted module | Referenced by (file count) |
|---|---|
| `billing/` (services, entities, dtos, enums, constants, stripe, jobs) | ~25 files |
| `usage/` (services, enums, constants, types, utils) | ~15 files |
| `sso/` (module, service, entity, types) | ~10 files |
| `enterprise/` (module, service, cron) | ~8 files |
| `dns-manager/` (module, service, dtos) | ~8 files |
| `row-level-permission-predicate/` (entities, dtos, services, types, module, filters) | ~20 files |
| `flat-row-level-permission-predicate/` (services, utils, constants) | ~5 files |
| `event-logs/cleanup/` | 2 files |
| `jwt/crons/` (rotate-signing-keys) | 2 files |
| `auth/` deleted files (sso-auth.controller, saml/oidc strategies, enterprise guard, SSO DTOs) | ~7 files |

## Requirements
1. All 298 Enterprise files must be deleted (DONE).
2. All OS files that import/reference deleted Enterprise files must have those imports/registrations/references removed.
3. The remaining AGPL-only codebase must have NO dangling references (no imports of non-existent files).
4. Spec files that test deleted Enterprise code must be deleted.
5. Commit and push to origin main.

## Constraints
- Pure source-code task. No system/network/DB/deployment access.
- `rg` is NOT installed. Use `grep` (bash) or the Grep tool for all searches.
- `packages/twenty-companion/` is MIT-licensed (Recall.ai) — leave it alone.
- Do NOT create ADRs or runbooks.
- Cannot run TypeScript compiler / build (no deps installed, no network). Verification is via grep-based import-existence checks.

## Assumptions
1. **OS files heavily dependent on Enterprise features** (e.g., `ai-billing.service.ts` depends on billing/usage): strip the Enterprise dependencies (remove imports, constructor injections, method calls) and keep the OS functionality (e.g., cost computation). Per task rule: "Mixed modules should have Enterprise providers removed but module file kept."
2. **Frontend RLS field references** that don't import deleted files (e.g., `rowLevelPermissionPredicates: []` defaults on generated GraphQL types): leave as-is. These reference fields on `generated-metadata/graphql.ts` (auto-generated, still committed, still has the types). They compile fine. They will be cleaned up automatically when codegen is regenerated against the new schema. Removing them now risks TypeScript errors if the generated types still expect the fields.
3. **`generated-metadata/graphql.ts`**: auto-generated, committed, still contains RLS/SSO types. Leave as-is — it will be regenerated on the next build. It is not Enterprise code.
4. **`AvailableWorkspaces` DTO** (Enterprise, deleted): OS code (`user-workspace.service.ts`, `user.resolver.ts`, `available-workspaces-and-access-tokens.dto.ts`) imports it. Remove the imports and the code that uses the type (queries/fields that return `AvailableWorkspaces`).
5. **Spec files testing deleted code** (`oidc-auth.spec.ts`, `is-record-matching-rls-...spec.ts`): delete them — they test non-existent code.
6. **`auth-sso.service.ts` and `create-sso-connected-account.service.ts`**: confirmed OS, no dangling imports. Leave as-is.

## Success Criteria
- `grep -rl "@license Enterprise" packages/` returns only `packages/twenty-ui/LICENSE`. ✅
- No file in `packages/twenty-server/src/` or `packages/twenty-front/src/` imports from a deleted file. ✅
- `packages/twenty-shared/src/types/index.ts` does not export deleted RowLevelPermission types. ✅
- Commit "Remove non-open-source Enterprise Edition code" pushed to origin main. ✅
  - Commit hash: `12acc9f4fc`
  - Pushed: `7d45315b71..12acc9f4fc  main -> main`
  - 487 files changed, 385 insertions(+), 35109 deletions(-)

## Implementation Summary
- **Files deleted**: 386 (Enterprise + dependent OS files, plus 4 spec files testing deleted code)
- **OS files edited**: ~97 (cleaned up dangling references)
- **Key areas cleaned**:
  - 2 twenty-shared type files (`types/index.ts`, `types/ObjectPermissions.ts`)
  - Backend billing/usage (~40 files)
  - Backend SSO/Enterprise/DNS/event-logs/jwt-rotation (~20 files)
  - Backend RLS (~25 files: ORM, query builders, role module, role resolver, flat-entity types, workspace-migration, etc.)
  - Frontend: SettingsRoutes, SignInUpWorkspaceScopeForm, SignInUpStep state, SignInUpWorkspaceScopeFormEffect, useSaveDraftRoleToDB
- **Verification**: All 4 grep checks from Task 7 pass empty.

## Non-goals / Out of scope
- Regenerating `generated-metadata/graphql.ts` (requires running codegen, which needs network/deps).
- Running TypeScript compiler or build (no deps installed).
- Removing frontend RLS field-name references on generated GraphQL types (will be cleaned on codegen regen).
- Modifying `packages/twenty-companion/` (MIT-licensed).
- Creating ADRs or runbooks.

## Plan

### Approach
Mechanical cleanup of ~96 files across 7 task briefs, grouped by logical area. Each task is independent (touches different files) except Task 7 (verification + commit) which depends on all prior tasks.

### Task Briefs

#### Task 1: twenty-shared cleanup
**Context**: `packages/twenty-shared/src/types/index.ts` (auto-generated barrel) still exports 5 deleted RowLevelPermission types. `ObjectPermissions.ts` imports from deleted type files.
**Objective**: Remove all references to deleted RowLevelPermission types from twenty-shared.
**Scope**:
- `packages/twenty-shared/src/types/index.ts`: remove lines exporting `RowLevelPermissionPredicate`, `RowLevelPermissionPredicateGroup`, `RowLevelPermissionPredicateGroupLogicalOperator`, `RowLevelPermissionPredicateOperand`, `RowLevelPermissionPredicateValue` (around lines 268-275).
- `packages/twenty-shared/src/types/ObjectPermissions.ts`: remove imports of `RowLevelPermissionPredicate` and `RowLevelPermissionPredicateGroup` (lines 2-3) and the `rowLevelPermissionPredicates` / `rowLevelPermissionPredicateGroups` fields (lines 11-12).
**Non-goals**: Do not regenerate the index.ts file. Do not touch other type files.
**Acceptance criteria**: `grep -rn "RowLevelPermissionPredicate" packages/twenty-shared/src/` returns nothing.

#### Task 2: Backend billing/usage cleanup
**Context**: The deleted `billing/` and `usage/` modules are still imported by ~40 OS files across workflow, logic-function, AI, onboarding, workspace, message-queue, calendar, workspace-cleaner, workspace-manager, client-config, and custom-domain-manager.
**Objective**: Remove all billing/usage imports, constructor injections, module registrations, and method calls from OS files. Keep OS functionality (e.g., AI cost computation utils that are OS).
**Scope** — for each file below, remove imports of deleted billing/usage symbols, remove constructor parameters for deleted services, remove method calls that use deleted services, remove fields typed by deleted entities/types:

*Module files (remove BillingModule/UsageModule imports + registrations):*
- `modules/workflow/workflow-executor/workflow-executor.module.ts`
- `modules/workflow/workflow-runner/workflow-runner.module.ts`
- `modules/calendar/calendar-event-import-manager/calendar-event-import-manager.module.ts`
- `engine/core-modules/logic-function/logic-function-executor/logic-function-executor.module.ts`
- `engine/core-modules/message-queue/jobs.module.ts` (also remove BillingProductEntity, BillingSubscriptionItemEntity, BillingSubscriptionEntity, UpdateSubscriptionQuantityJob, StripeModule)
- `engine/core-modules/onboarding/onboarding.module.ts`
- `engine/core-modules/workspace/workspace.module.ts` (also remove EnterpriseModule, DnsManagerModule — see Task 3)
- `engine/core-modules/domain/custom-domain-manager/custom-domain-manager.module.ts` (also remove DnsManagerModule — see Task 3)
- `engine/workspace-manager/workspace-cleaner/workspace-cleaner.module.ts` (also remove BillingSubscriptionEntity)
- `engine/metadata-modules/ai/ai-billing/ai-billing.module.ts`
- `engine/metadata-modules/ai/ai-chat/ai-chat.module.ts`
- `engine/metadata-modules/ai/ai-agent-execution/ai-agent-execution.module.ts`
- `engine/metadata-modules/ai/ai-generate-text/ai-generate-text.module.ts`

*Service files (remove billing/usage service injections + usage event recording calls):*
- `modules/workflow/workflow-executor/workspace-services/workflow-executor.workspace-service.ts` (remove NO_BILLING_SUBSCRIPTION, BillingUsageService, BillingService, USAGE_RECORDED, UsageOperationType, UsageResourceType, UsageUnit, UsageEvent + all usage event emit calls)
- `modules/workflow/workflow-runner/workspace-services/workflow-runner.workspace-service.ts` (remove BillingUsageService)
- `modules/workflow/workflow-executor/workflow-actions/ai-agent/ai-agent.workflow-action.ts` (remove UsageOperationType)
- `engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service.ts` (remove billing/usage imports + calls)
- `engine/core-modules/onboarding/onboarding.service.ts` (remove BillingService)
- `engine/core-modules/workspace/services/workspace.service.ts` (remove BillingSubscriptionService, BillingService — also DnsManagerService, see Task 3)
- `engine/core-modules/workspace/workspace.resolver.ts` (remove BillingEntitlementDTO, BillingSubscriptionEntity, BillingSubscriptionService + billing queries — also Enterprise/DNS, see Task 3)
- `engine/metadata-modules/ai/ai-billing/services/ai-billing.service.ts` (remove billing/usage imports + usage recording; KEEP OS cost computation: computeCostBreakdown, convertDollarsToBillingCredits, AiModelRegistryService, WorkspaceCacheService, WorkspaceEventEmitter). **Confirmed**: `calculateCost()` is pure OS (keep). `decrementAndCheckAvailableCredits()` — stub to `return { hasNoMoreAvailableCredits: false }`. `emitAiTokenUsageEvent()` — remove entirely (depends on USAGE_RECORDED/UsageEvent). `calculateAndBillUsage()` — keep cost calc, remove billing/usage parts. `billNativeWebSearchUsage()` — remove billing/usage parts, keep cost calc if feasible. Remove `billingService` + `billingUsageService` constructor injections.)
- `engine/metadata-modules/ai/ai-chat/services/agent-chat.service.ts` (remove toDisplayCredits import + usage)
- `engine/metadata-modules/ai/ai-chat/services/agent-title-generation.service.ts` (remove BillingUsageService, UsageOperationType + usage recording)
- `engine/metadata-modules/ai/ai-chat/services/chat-execution.service.ts` (remove UsageOperationType)
- `engine/metadata-modules/ai/ai-chat/jobs/stream-agent-chat.job.ts` (remove toDisplayCredits)
- `engine/metadata-modules/ai/ai-chat/resolvers/agent-chat.resolver.ts` (remove toDisplayCredits)
- `engine/metadata-modules/ai/ai-agent-execution/services/agent-async-executor.service.ts` (remove UsageOperationType)
- `engine/metadata-modules/ai/ai-agent-execution/services/agent-run.service.ts` (remove UsageOperationType)
- `engine/metadata-modules/ai/ai-agent/utils/repair-tool-call.util.ts` (remove UsageOperationType)
- `engine/metadata-modules/ai/ai-generate-text/controllers/ai-generate-text.controller.ts` (remove UsageOperationType)
- `engine/workspace-manager/workspace-cleaner/services/cleaner.workspace-service.ts` (remove BillingSubscriptionEntity, SubscriptionStatus, BillingSubscriptionService)

*Type/entity files (remove billing type imports + fields):*
- `engine/core-modules/client-config/client-config.entity.ts` (remove BillingTrialPeriodDTO import + trialPeriod field)
- `engine/workspace-cache/types/workspace-cache-key.type.ts` (remove CurrentBillingSubscription — also RLS types, see Task 4)
- `engine/workspace-manager/types/all-non-workspace-related-entity.type.ts` (remove BillingMeterEntity, BillingPriceEntity, BillingProductEntity, BillingSubscriptionItemEntity)

*Spec files (clean up — remove billing/usage mocks):*
- `modules/workflow/workflow-executor/workspace-services/__tests__/workflow-executor.workspace-service.spec.ts`
- `engine/metadata-modules/ai/ai-billing/services/__tests__/ai-billing.service.spec.ts`
- `engine/metadata-modules/ai/ai-agent-execution/services/__tests__/agent-async-executor.service.spec.ts`

**Non-goals**: Do not delete `ai-billing.service.ts` itself — it has OS cost computation. Do not remove OS AI functionality. Do not touch `twenty-companion/`.
**Caveats**: When removing usage event recording (e.g., `this.billingUsageService.recordUsage(...)` or event emits with `USAGE_RECORDED`), remove the entire call statement. If the call result is used, remove the surrounding logic too. The `ai-billing.service.ts` is the trickiest — keep `computeCostBreakdown` and `convertDollarsToBillingCredits` (OS utils), remove everything that references billing subscriptions or usage events.

#### Task 3: Backend SSO/Enterprise/DNS/event-logs/jwt-rotation cleanup
**Context**: Deleted `sso/`, `enterprise/`, `dns-manager/`, `event-logs/cleanup/`, `jwt/crons/` modules, and deleted auth files (sso-auth.controller, saml/oidc strategies, enterprise guard, SSO DTOs) are still referenced by ~20 OS files.
**Objective**: Remove all SSO/Enterprise/DNS/event-logs-cleanup/jwt-rotation imports, registrations, and code from OS files.
**Scope**:

*Auth module + resolver + service:*
- `engine/core-modules/auth/auth.module.ts`: remove imports of SSOAuthController, SamlAuthStrategy, WorkspaceSSOModule, WorkspaceSSOIdentityProviderEntity, EnterpriseModule; remove their registrations in imports/controllers/providers arrays.
- `engine/core-modules/auth/auth.resolver.ts`: remove SSOService import + constructor injection; remove GetAuthorizationUrlForSSODTO/Input imports; remove SSO-related queries/mutations (getAuthorizationUrlForSSO, etc.).
- `engine/core-modules/auth/auth.resolver.spec.ts`: remove SSOService mock/imports.
- `engine/core-modules/auth/services/sign-in-up.service.ts`: remove EnterprisePlanService import + injection + usage.
- `engine/core-modules/auth/dto/available-workspaces-and-access-tokens.dto.ts`: remove AvailableWorkspaces import; remove the field/usage that references it.

*Workspace module + entity + services + DTOs:*
- `engine/core-modules/workspace/workspace.module.ts`: remove EnterpriseModule, DnsManagerModule imports + registrations (billing already in Task 2).
- `engine/core-modules/workspace/workspace.entity.ts`: remove WorkspaceSSOIdentityProviderEntity import + the SSO relation field.
- `engine/core-modules/workspace/services/workspace.service.ts`: remove DnsManagerService import + injection + usage (billing in Task 2).
- `engine/core-modules/workspace/services/__tests__/workspace.service.spec.ts`: remove DnsManagerService mock.
- `engine/core-modules/workspace/workspace.resolver.ts`: remove DomainValidRecords, DnsManagerService imports + DNS queries; remove EnterprisePlanService import + usage (billing in Task 2).
- `engine/core-modules/workspace/dtos/public-workspace-data.dto.ts`: remove SSO entity import + SSO-related fields.
- `engine/core-modules/workspace/utils/get-auth-providers-by-workspace.util.ts`: remove SSO entity import + SSO provider logic.
- `engine/core-modules/workspace/utils/__tests__/get-auth-providers-by-workspace.util.spec.ts`: remove SSO references or delete if entirely SSO.

*User/user-workspace:*
- `engine/core-modules/user-workspace/user-workspace.module.ts`: remove EnterpriseModule import + registration.
- `engine/core-modules/user-workspace/user-workspace.service.ts`: remove AvailableWorkspace import + usage.
- `engine/core-modules/user/user.resolver.ts`: remove AvailableWorkspaces import + the query/field that returns it.

*Domain/DNS:*
- `engine/core-modules/domain/custom-domain-manager/custom-domain-manager.module.ts`: remove DnsManagerModule import + registration (billing in Task 2).
- `engine/core-modules/domain/custom-domain-manager/services/custom-domain-manager.service.ts`: remove DomainValidRecords, DnsManagerService imports + DNS validation logic (billing in Task 2).
- `engine/core-modules/public-domain/public-domain.module.ts`: remove DnsManagerModule import + registration.
- `engine/core-modules/public-domain/public-domain.service.ts`: remove DnsManagerService, DomainValidRecords imports + DNS logic.
- `engine/core-modules/public-domain/public-domain.resolver.ts`: remove DnsManagerService, DomainValidRecords imports + DNS queries.

*Database commands (event-logs cleanup + jwt rotation + enterprise cron):*
- `database/commands/database-command.module.ts`: remove EnterpriseKeyValidationCronCommand, EnterpriseModule, EventLogCleanupModule, RotateSigningKeysCronCommand imports + registrations.
- `database/commands/cron-register-all.command.ts`: remove EnterpriseKeyValidationCronCommand, EventLogCleanupCronCommand, RotateSigningKeysCronCommand imports + registrations.
- `database/commands/list-and-delete-orphaned-workspace-entities.command.ts`: remove WorkspaceSSOIdentityProviderEntity import + the SSO entity cleanup logic.

**Non-goals**: Do not remove `auth-sso.service.ts` or `create-sso-connected-account.service.ts` (OS, no dangling refs). Do not recreate `AvailableWorkspaces` as OS — remove the code that uses it.
**Caveats**: The `get-auth-providers-by-workspace.util.ts` may have logic for both OS auth providers (Google, Microsoft, password) and Enterprise SSO. Remove only the SSO parts; keep OS provider logic. Check the spec file — if it only tests SSO, delete it; if mixed, clean it.

#### Task 4: Backend RLS (Row-Level Security) cleanup
**Context**: The deleted `row-level-permission-predicate/` and `flat-row-level-permission-predicate/` modules are still referenced by ~25 OS files across the ORM, workspace cache, metadata modules, role module, workspace migration, and subscriptions.
**Objective**: Remove all RLS imports, fields, type references, service injections, module registrations, and method calls from OS files. The ORM should still function but without row-level security filtering.
**Scope**:

*ORM core (remove RLS map fields + applyRowLevelPermissionPredicates/validateRLSPredicatesForRecords calls):*
- `engine/twenty-orm/interfaces/workspace-internal-context.interface.ts`: remove FlatRowLevelPermissionPredicateGroupMaps, FlatRowLevelPermissionPredicateMaps imports + `flatRowLevelPermissionPredicateMaps` / `flatRowLevelPermissionPredicateGroupMaps` fields.
- `engine/twenty-orm/storage/orm-workspace-context.storage.ts`: same removal.
- `engine/twenty-orm/entity-manager/workspace-entity-manager.ts`: remove passing of RLS map fields to query builders.
- `engine/twenty-orm/entity-manager/workspace-entity-manager.spec.ts`: remove RLS map references in test data.
- `engine/twenty-orm/repository/workspace-select-query-builder.ts`: remove applyRowLevelPermissionPredicates import + call.
- `engine/twenty-orm/repository/workspace-insert-query-builder.ts`: remove validateRLSPredicatesForRecords import + call.
- `engine/twenty-orm/repository/workspace-update-query-builder.ts`: remove both imports + calls.
- `engine/twenty-orm/repository/workspace-delete-query-builder.ts`: remove applyRowLevelPermissionPredicates import + call.
- `engine/twenty-orm/repository/workspace-soft-delete-query-builder.ts`: remove applyRowLevelPermissionPredicates import + call.

*API + subscriptions:*
- `engine/api/graphql/graphql-query-runner/group-by/services/group-by-with-records.service.ts`: remove applyRowLevelPermissionPredicates import + call.
- `engine/subscriptions/object-record-event/object-record-event-publisher.ts`: remove buildRowLevelPermissionRecordFilter, isRecordMatchingRLSRowLevelPermissionPredicate imports + calls.

*Workspace cache:*
- `engine/workspace-cache/types/workspace-cache-key.type.ts`: remove FlatRowLevelPermissionPredicateGroupMaps, FlatRowLevelPermissionPredicateMaps imports + fields (billing in Task 2).

*Metadata modules (flat-entity, object-permission, role):*
- `engine/metadata-modules/flat-entity/types/all-flat-entity-types-by-metadata-name.ts`: remove 4 RLS type imports + entries.
- `engine/metadata-modules/flat-entity/constant/all-metadata-entity-by-metadata-name.constant.ts`: remove RLS entity imports + entries.
- `engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.module.ts`: remove RLS cache service imports + providers + entity imports.
- `engine/metadata-modules/object-permission/dtos/object-permission.dto.ts`: remove RowLevelPermissionPredicateGroupDTO, RowLevelPermissionPredicateDTO imports + fields.
- `engine/metadata-modules/role/role.entity.ts`: remove RLS entity imports + relation fields.
- `engine/metadata-modules/role/dtos/role.dto.ts`: remove RLS DTO imports + fields.
- `engine/metadata-modules/role/role.module.ts`: remove RowLevelPermissionModule import + registration + RLS entity imports.
- `engine/metadata-modules/role/role.resolver.ts`: remove all RLS imports (6+) + the upsertRowLevelPermissionPredicates mutation + RLS service injections.
- `engine/metadata-modules/role/services/workspace-flat-role-map-cache.service.ts`: remove RLS entity imports + RLS map fields.
- `engine/metadata-modules/role/services/workspace-roles-permissions-cache.service.ts`: remove RLS entity imports + RLS fields.
- `engine/metadata-modules/role/services/__tests__/workspace-roles-permissions-cache.service.spec.ts`: remove RLS references.

*Workspace migration:*
- `engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/workspace-schema-migration-runner-action-handlers.module.ts`: remove 6 RLS action handler imports + providers.
- `engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/workspace-migration-builder-validators.module.ts`: remove 2 RLS validator imports + providers.
- `engine/workspace-manager/workspace-migration/workspace-migration-builder/workspace-migration-builder.module.ts`: remove 2 RLS builder imports + providers.
- `engine/workspace-manager/workspace-migration/services/workspace-migration-build-orchestrator.service.ts`: remove 2 RLS builder imports + injections + usage.

**Non-goals**: Do not remove the query builders themselves — only remove the RLS-specific calls. The queries should still execute, just without RLS filtering.
**Caveats**: This is the most invasive task. When removing `applyRowLevelPermissionPredicates` calls from query builders, the query should proceed without the RLS WHERE clause. When removing RLS map fields from workspace-internal-context, ensure all downstream consumers of those fields are also cleaned. The `role.resolver.ts` has an `upsertRowLevelPermissionPredicates` mutation — remove it entirely (mutation + handler + DTO). **Confirmed RLS removal pattern in query builders**: each builder has (1) an import of `applyRowLevelPermissionPredicates`/`validateRLSPredicatesForRecords`, (2) a call site `this.applyRowLevelPermissionPredicates()` in the execute/getMany/etc method, (3) a private `applyRowLevelPermissionPredicates()` method that calls the imported function. Remove all three. The `validatePermissions()` call (object-level permissions, OS) must remain.

#### Task 5: Delete spec files for deleted code
**Context**: Some spec files test deleted Enterprise code and have no purpose in the AGPL codebase.
**Objective**: Delete spec files that exclusively test deleted code.
**Scope**:
- DELETE `packages/twenty-server/src/engine/core-modules/auth/guards/oidc-auth.spec.ts` (tests deleted `oidc-auth.guard.ts`)
- DELETE `packages/twenty-server/src/engine/twenty-orm/utils/__tests__/is-record-matching-rls-row-level-permission-predicate.util.spec.ts` (tests deleted util)
- Check `packages/twenty-server/src/engine/core-modules/workspace/utils/__tests__/get-auth-providers-by-workspace.util.spec.ts` — if entirely SSO, delete; if mixed, clean (decide in Task 3).
**Non-goals**: Do not delete spec files that test OS code with some Enterprise mocks (those are cleaned in Tasks 2-4).

#### Task 6: Frontend cleanup
**Context**: Frontend files still reference deleted SSO/RLS/custom-domain pages, hooks, and components.
**Objective**: Remove all imports of deleted frontend files and remove routes to deleted pages.
**Scope**:
- `packages/twenty-front/src/modules/app/components/SettingsRoutes.tsx`: remove lazy imports of `SettingsCustomDomainPage` and `SettingsSecuritySSOIdentifyProvider`; remove their route elements (`<SettingsCustomDomainPage />` at ~line 679, `<SettingsSecuritySSOIdentifyProvider />` at ~line 923); remove `SettingsPath.CustomDomain` and `SettingsPath.NewSSOIdentityProvider` route definitions.
- DELETE `packages/twenty-front/src/modules/auth/sign-in-up/components/internal/SignInUpWithSSO.tsx` (imports deleted `useSSO`).
- DELETE `packages/twenty-front/src/modules/auth/sign-in-up/hooks/__tests__/useSSO.test.tsx` (tests deleted `useSSO`).
- `packages/twenty-front/src/modules/auth/states/signInUpStepState.ts`: remove `SSOIdentityProviderSelection` enum value.
- `packages/twenty-front/src/modules/auth/sign-in-up/components/internal/SignInUpWorkspaceScopeFormEffect.tsx`: remove references to `SSOIdentityProviderSelection` step (the `setSignInUpStep(SignInUpStep.SSOIdentityProviderSelection)` calls).
- `packages/twenty-front/src/modules/auth/sign-in-up/components/SignInUpWorkspaceScopeForm.tsx`: remove `SignInUpWithSSO` import (line 5) and the conditional render `{providers.sso.length > 0 && <SignInUpWithSSO />}` (line 53).
- `packages/twenty-front/src/modules/settings/roles/role/hooks/useSaveDraftRoleToDB.ts`: remove `useUpsertRowLevelPermissionPredicatesMutation` import + the mutation call.
- `.po` locale files reference `SignInUpWithSSO.tsx` in translation source comments — leave these alone (auto-generated, no code impact).
**Non-goals**: Do NOT remove frontend RLS field-name references (`rowLevelPermissionPredicates: []`) on generated GraphQL types — these compile fine and will be cleaned on codegen regeneration. Do NOT delete `FlatRowLevelPermissionPredicate.ts` / `FlatRowLevelPermissionPredicateGroup.ts` — they import from `generated-metadata/graphql` (not deleted files) and compile fine. Do NOT delete `SignInUpSSOButtonStyles.ts` (OS, still exists, may be used elsewhere).
**Caveats**: After removing the SSO step from `signInUpStepState.ts`, ensure no other files reference `SignInUpStep.SSOIdentityProviderSelection` (grep to verify). The `providers.sso` reference in `SignInUpWorkspaceScopeForm.tsx` is on a generated GraphQL type — leave the type reference, just remove the `SignInUpWithSSO` component usage.

#### Task 7: Final verification + commit + push
**Context**: All cleanup tasks (1-6) are complete.
**Objective**: Verify no dangling references remain, commit all changes, push to origin main.
**Scope**:
1. Verify no Enterprise code files remain: `grep -rl "@license Enterprise" packages/ | grep -v twenty-ui/LICENSE` → should be empty.
2. Verify no backend dangling imports: `grep -rnE "from 'src/engine/core-modules/(billing/|usage/|sso/|enterprise/|cloudflare/|dns-manager/|billing-webhook/)|from 'src/engine/core-modules/event-logs/(event-logs\.|registry/|cleanup/)|from 'src/engine/core-modules/jwt/(services/signing-key-rotation|crons/)|from 'src/engine/metadata-modules/(row-level-permission-predicate|flat-row-level-permission-predicate)/|from 'src/engine/twenty-orm/utils/(apply-row-level-permission|build-row-level-permission|is-record-matching-rls|validate-rls-predicates)|sso-auth\.controller|saml\.auth\.strategy|enterprise-features-enabled|available-workspaces\.dto|get-authorization-url-for-sso" packages/twenty-server/src/` → should be empty.
3. Verify no twenty-shared dangling refs: `grep -rn "RowLevelPermissionPredicate" packages/twenty-shared/src/` → should be empty.
4. Verify no frontend dangling imports of deleted files: `grep -rnE "useSSO|SignInUpWithSSO|SettingsCustomDomainPage|SettingsSecuritySSOIdentifyProvider|useUpsertRowLevelPermissionPredicatesMutation" packages/twenty-front/src/ | grep -v generated-metadata` → should be empty.
5. `git add -A && git commit -m "Remove non-open-source Enterprise Edition code"`.
6. `git push origin main`.
7. Verify push succeeded.
**Acceptance criteria**: All grep checks return empty. Commit pushed to origin main successfully.

## Plan Approval
**Status**: APPROVED by user on 2026-06-18.
**Approved approach**: 7-task cleanup plan as written above. Frontend RLS field references on generated GraphQL types left as-is (will be cleaned on codegen regen).

## Next Agent
implementor — execute Tasks 1-6 in order (they are largely independent — touch different files), then Task 7 (verification + commit + push). Reference this file as the source of truth. Use `grep` (NOT `rg` — ripgrep is not installed) for all searches.
