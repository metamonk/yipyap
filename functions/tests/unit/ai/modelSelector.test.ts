/**
 * Unit tests for model selection logic
 * @module functions/tests/unit/ai/modelSelector.test
 */

import { selectModel } from '../../../src/ai/modelSelector';
import type { ModelSelectionCriteria } from '../../../src/types/ai';

describe('ModelSelector', () => {
  describe('selectModel', () => {
    describe('speed priority', () => {
      it('should select GPT-4o-mini for speed priority', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'speed',
        };

        const result = selectModel(criteria);

        expect(result).toEqual({
          provider: 'openai',
          model: 'gpt-4o-mini',
          config: {
            maxTokens: 1000,
            temperature: 0.7,
          },
        });
      });

      it('should use custom maxTokens if provided', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'speed',
          maxTokens: 1500,
        };

        const result = selectModel(criteria);

        expect(result.config.maxTokens).toBe(1500);
        expect(result.provider).toBe('openai');
      });

      it('should use custom temperature if provided', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'speed',
          temperature: 0.5,
        };

        const result = selectModel(criteria);

        expect(result.config.temperature).toBe(0.5);
        expect(result.provider).toBe('openai');
      });

      it('should use both custom maxTokens and temperature', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'speed',
          maxTokens: 800,
          temperature: 0.9,
        };

        const result = selectModel(criteria);

        expect(result.config.maxTokens).toBe(800);
        expect(result.config.temperature).toBe(0.9);
      });
    });

    describe('quality priority', () => {
      it('should select GPT-4 Turbo for quality priority', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'quality',
        };

        const result = selectModel(criteria);

        expect(result).toEqual({
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          config: {
            maxTokens: 2000,
            temperature: 0.8,
          },
        });
      });

      it('should use custom maxTokens if provided', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'quality',
          maxTokens: 3000,
        };

        const result = selectModel(criteria);

        expect(result.config.maxTokens).toBe(3000);
        expect(result.provider).toBe('openai');
      });

      it('should use custom temperature if provided', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'quality',
          temperature: 0.3,
        };

        const result = selectModel(criteria);

        expect(result.config.temperature).toBe(0.3);
        expect(result.provider).toBe('openai');
      });

      it('should use both custom maxTokens and temperature', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'quality',
          maxTokens: 2500,
          temperature: 0.6,
        };

        const result = selectModel(criteria);

        expect(result.config.maxTokens).toBe(2500);
        expect(result.config.temperature).toBe(0.6);
      });
    });

    describe('cost priority', () => {
      it('should select GPT-4o-mini with reduced tokens for cost priority', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'cost',
        };

        const result = selectModel(criteria);

        expect(result).toEqual({
          provider: 'openai',
          model: 'gpt-4o-mini',
          config: {
            maxTokens: 500,
            temperature: 0.5,
          },
        });
      });

      it('should use custom maxTokens if provided', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'cost',
          maxTokens: 300,
        };

        const result = selectModel(criteria);

        expect(result.config.maxTokens).toBe(300);
        expect(result.provider).toBe('openai');
      });

      it('should use custom temperature if provided', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'cost',
          temperature: 0.2,
        };

        const result = selectModel(criteria);

        expect(result.config.temperature).toBe(0.2);
        expect(result.provider).toBe('openai');
      });

      it('should use both custom maxTokens and temperature', () => {
        const criteria: ModelSelectionCriteria = {
          priority: 'cost',
          maxTokens: 400,
          temperature: 0.4,
        };

        const result = selectModel(criteria);

        expect(result.config.maxTokens).toBe(400);
        expect(result.config.temperature).toBe(0.4);
      });
    });

    describe('model characteristics', () => {
      it('should return same provider for all priorities', () => {
        const speedResult = selectModel({ priority: 'speed' });
        const qualityResult = selectModel({ priority: 'quality' });

        expect(speedResult.provider).toBe(qualityResult.provider);
        expect(speedResult.provider).toBe('openai');
      });

      it('should return same model and provider for speed and cost priorities', () => {
        const speedResult = selectModel({ priority: 'speed' });
        const costResult = selectModel({ priority: 'cost' });

        expect(speedResult.model).toBe(costResult.model);
        expect(speedResult.model).toBe('gpt-4o-mini');
        expect(speedResult.provider).toBe(costResult.provider);
        expect(speedResult.provider).toBe('openai');
      });

      it('should return different token counts for speed vs cost', () => {
        const speedResult = selectModel({ priority: 'speed' });
        const costResult = selectModel({ priority: 'cost' });

        expect(speedResult.config.maxTokens).toBeGreaterThan(costResult.config.maxTokens);
      });

      it('should return highest token count for quality priority', () => {
        const speedResult = selectModel({ priority: 'speed' });
        const qualityResult = selectModel({ priority: 'quality' });
        const costResult = selectModel({ priority: 'cost' });

        expect(qualityResult.config.maxTokens).toBeGreaterThan(speedResult.config.maxTokens);
        expect(qualityResult.config.maxTokens).toBeGreaterThan(costResult.config.maxTokens);
      });
    });
  });
});
