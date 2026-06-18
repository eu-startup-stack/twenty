import { Injectable, Logger } from '@nestjs/common';

import { type LanguageModelUsage } from 'ai';

import { NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS } from 'src/engine/metadata-modules/ai/ai-billing/constants/native-web-search-cost-per-call-dollars';
import { computeCostBreakdown } from 'src/engine/metadata-modules/ai/ai-billing/utils/compute-cost-breakdown.util';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { type ModelId } from 'src/engine/metadata-modules/ai/ai-models/types/model-id.type';

export type BillingUsageInput = {
  usage: LanguageModelUsage;
  cacheCreationTokens?: number;
};

@Injectable()
export class AiBillingService {
  private readonly logger = new Logger(AiBillingService.name);

  constructor(
    private readonly aiModelRegistryService: AiModelRegistryService,
  ) {}

  calculateCost(modelId: ModelId, billingInput: BillingUsageInput): number {
    const model = this.aiModelRegistryService.getEffectiveModelConfig(modelId);
    const { usage, cacheCreationTokens = 0 } = billingInput;

    const breakdown = computeCostBreakdown(model, {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
      cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
      cacheCreationTokens,
    });

    this.logger.log(
      `Cost for ${model.modelId}: $${breakdown.totalCostInDollars.toFixed(6)} ` +
        `(input: ${breakdown.tokenCounts.adjustedInputTokens}, ` +
        `cached: ${breakdown.tokenCounts.cachedInputTokens}, ` +
        `cacheCreation: ${breakdown.tokenCounts.cacheCreationTokens}, ` +
        `output: ${breakdown.tokenCounts.adjustedOutputTokens}, ` +
        `reasoning: ${breakdown.tokenCounts.reasoningTokens})`,
    );

    return breakdown.totalCostInDollars;
  }

  async calculateAndBillUsage(
    modelId: ModelId,
    billingInput: BillingUsageInput,
    _workspaceId: string,
    _operationType: string,
    _agentId?: string | null,
    _userWorkspaceId?: string | null,
  ): Promise<void> {
    // Cost is logged via calculateCost; recording usage events tied to
    // the Enterprise usage pipeline is intentionally a no-op in the
    // AGPL build.
    this.calculateCost(modelId, billingInput);
  }

  async decrementAndCheckAvailableCredits(
    _modelId: ModelId,
    _billingInput: BillingUsageInput,
    _workspaceId: string,
  ): Promise<{ hasNoMoreAvailableCredits: boolean }> {
    return { hasNoMoreAvailableCredits: false };
  }

  async billNativeWebSearchUsage(
    nativeWebSearchCallCount: number,
    _workspaceId: string,
    _userWorkspaceId?: string | null,
  ): Promise<void> {
    if (nativeWebSearchCallCount <= 0) {
      return;
    }

    const costInDollars =
      nativeWebSearchCallCount * NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS;

    this.logger.log(
      `Native web search billing: ${nativeWebSearchCallCount} calls, $${costInDollars.toFixed(4)}`,
    );
  }

  async emitAiTokenUsageEvent(
    _workspaceId: string,
    _creditsUsedMicro: number,
    _totalTokens: number,
    _modelId: ModelId,
    _operationType: string,
    _agentId?: string | null,
    _userWorkspaceId?: string | null,
  ): Promise<void> {
    // Usage event emission is tied to the Enterprise usage pipeline.
    // Intentionally a no-op in the AGPL build.
    return;
  }
}
