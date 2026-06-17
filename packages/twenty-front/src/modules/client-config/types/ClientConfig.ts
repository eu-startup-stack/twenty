import {
  type ApiConfig,
  type AuthProviders,
  type Billing,
  type Captcha,
  type ClientAiModelConfig,
  type ClientConfigMaintenanceMode,
  type PublicFeatureFlag,
  type Sentry,
  type Support,
} from '~/generated-metadata/graphql';

// TODO: regenerate via npx nx run twenty-front:graphql:generate after server schema change
type AuthentikClientConfig = {
  enabled: boolean;
};

export type ClientConfig = {
  appVersion?: string;
  aiModels: Array<ClientAiModelConfig>;
  analyticsEnabled: boolean;
  api: ApiConfig;
  authProviders: AuthProviders;
  billing: Billing;
  calendarBookingPageId?: string;
  canManageFeatureFlags: boolean;
  captcha: Captcha;
  defaultSubdomain?: string;
  frontDomain: string;
  isAttachmentPreviewEnabled: boolean;
  isConfigVariablesInDbEnabled: boolean;
  isEmailVerificationRequired: boolean;
  isGoogleCalendarEnabled: boolean;
  isGoogleMessagingEnabled: boolean;
  isMicrosoftCalendarEnabled: boolean;
  isMicrosoftMessagingEnabled: boolean;
  isMultiWorkspaceEnabled: boolean;
  isImapSmtpCaldavEnabled: boolean;
  isEmailingDomainInDemoMode: boolean;
  isCloudflareIntegrationEnabled: boolean;
  isClickHouseConfigured: boolean;
  isWorkspaceSchemaDDLLocked: boolean;
  publicFeatureFlags: Array<PublicFeatureFlag>;
  sentry: Sentry;
  signInPrefilled: boolean;
  support: Support;
  isTwoFactorAuthenticationEnabled: boolean;
  allowRequestsToTwentyIcons: boolean;
  maintenance?: ClientConfigMaintenanceMode;
  authentik: AuthentikClientConfig;
};
