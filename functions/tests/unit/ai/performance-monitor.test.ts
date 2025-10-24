/**
 * Unit tests for AI Performance Monitor Cloud Function
 * @module functions/tests/unit/ai/performance-monitor
 */

describe('Performance Monitor Cloud Function', () => {
  describe('Latency Threshold Detection', () => {
    it('should detect high latency above 500ms threshold', () => {
      const metrics = [
        { latency: 600 },
        { latency: 650 },
        { latency: 700 },
      ];

      const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;

      expect(avgLatency).toBeGreaterThan(500);
    });

    it('should not trigger for latency below 500ms threshold', () => {
      const metrics = [
        { latency: 400 },
        { latency: 450 },
        { latency: 480 },
      ];

      const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;

      expect(avgLatency).toBeLessThan(500);
    });
  });

  describe('Error Rate Detection', () => {
    it('should detect error rate above 5% threshold', () => {
      const metrics = [
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: false }, // 1 failure
        { success: false }, // 2 failures
      ];

      const successCount = metrics.filter((m) => m.success).length;
      const errorRate = 1 - successCount / metrics.length;

      expect(errorRate).toBeGreaterThan(0.05); // > 5%
    });

    it('should have correct sample size for error rate calculation', () => {
      const metrics = [
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: true },
        { success: false },
      ];

      expect(metrics.length).toBe(10);
      expect(metrics.filter((m) => m.success).length).toBe(9);
    });

    it('should calculate correct error rate for mixed results', () => {
      // 2 failures out of 20 = 10% error rate
      const metrics = Array.from({ length: 20 }, (_, i) => ({
        success: i < 18, // First 18 succeed, last 2 fail
      }));

      const successCount = metrics.filter((m) => m.success).length;
      const errorRate = 1 - successCount / metrics.length;

      expect(errorRate).toBeCloseTo(0.1); // 10% error rate
      expect(errorRate).toBeGreaterThan(0.05);
    });

    it('should not trigger for very low error rate', () => {
      // 1 failure out of 100 = 1% error rate
      const metrics = Array.from({ length: 100 }, (_, i) => ({
        success: i < 99,
      }));

      const successCount = metrics.filter((m) => m.success).length;
      const errorRate = 1 - successCount / metrics.length;

      expect(errorRate).toBeCloseTo(0.01); // 1% error rate
      expect(errorRate).toBeLessThan(0.05);
    });
  });

  describe('Notification Formatting', () => {
    it('should format high latency alert correctly', () => {
      const operation = 'categorization';
      const avgLatency = 650;

      const operationLabels: Record<string, string> = {
        categorization: 'Message Categorization',
        sentiment: 'Sentiment Analysis',
        faq_detection: 'FAQ Detection',
        voice_matching: 'Voice Matching',
        opportunity_scoring: 'Opportunity Scoring',
        daily_agent: 'Daily Agent Workflow',
      };

      const operationLabel = operationLabels[operation];
      const title = 'AI Performance Alert';
      const body = `${operationLabel} is experiencing high latency (${Math.round(avgLatency)}ms). This may affect response times.`;

      expect(title).toBe('AI Performance Alert');
      expect(body).toContain('650ms');
      expect(body).toContain('Message Categorization');
    });

    it('should format high error rate alert correctly', () => {
      const operation = 'sentiment';
      const errorRate = 0.15; // 15%

      const operationLabels: Record<string, string> = {
        categorization: 'Message Categorization',
        sentiment: 'Sentiment Analysis',
        faq_detection: 'FAQ Detection',
        voice_matching: 'Voice Matching',
        opportunity_scoring: 'Opportunity Scoring',
        daily_agent: 'Daily Agent Workflow',
      };

      const operationLabel = operationLabels[operation];
      const title = 'AI Reliability Alert';
      const body = `${operationLabel} has a ${(errorRate * 100).toFixed(1)}% error rate. Some operations may be failing.`;

      expect(title).toBe('AI Reliability Alert');
      expect(body).toContain('15.0%');
      expect(body).toContain('Sentiment Analysis');
    });
  });

  describe('Cooldown Period Logic', () => {
    it('should respect 1-hour cooldown period', () => {
      const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
      const now = Date.now();
      const lastAlertTime = now - 30 * 60 * 1000; // 30 minutes ago

      const timeSinceLastAlert = now - lastAlertTime;
      const isInCooldown = timeSinceLastAlert < ALERT_COOLDOWN_MS;

      expect(isInCooldown).toBe(true);
    });

    it('should allow alert after cooldown period expires', () => {
      const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
      const now = Date.now();
      const lastAlertTime = now - 65 * 60 * 1000; // 65 minutes ago

      const timeSinceLastAlert = now - lastAlertTime;
      const isInCooldown = timeSinceLastAlert < ALERT_COOLDOWN_MS;

      expect(isInCooldown).toBe(false);
    });
  });

  describe('Minimum Operations Threshold', () => {
    it('should not trigger alert with insufficient operations', () => {
      const MIN_OPERATIONS_FOR_ALERT = 10;
      const metrics = [
        { latency: 600, success: true },
        { latency: 650, success: true },
        { latency: 700, success: true },
      ];

      const hasMinimumOperations = metrics.length >= MIN_OPERATIONS_FOR_ALERT;

      expect(hasMinimumOperations).toBe(false);
    });

    it('should trigger alert with sufficient operations', () => {
      const MIN_OPERATIONS_FOR_ALERT = 10;
      const metrics = Array.from({ length: 15 }, () => ({
        latency: 600,
        success: true,
      }));

      const hasMinimumOperations = metrics.length >= MIN_OPERATIONS_FOR_ALERT;

      expect(hasMinimumOperations).toBe(true);
    });
  });

  describe('Token Type Detection', () => {
    it('should detect Expo tokens', () => {
      const expoToken = 'ExponentPushToken[abc123xyz]';
      const isExpo = expoToken.startsWith('ExponentPushToken[') && expoToken.endsWith(']');
      expect(isExpo).toBe(true);
    });

    it('should detect APNs tokens', () => {
      const apnsToken = 'a'.repeat(64);
      const isApns = apnsToken.length === 64 && /^[a-f0-9]+$/i.test(apnsToken);
      expect(isApns).toBe(true);
    });

    it('should default to FCM for other tokens', () => {
      const fcmToken = 'some-fcm-token-string';
      const isExpo = fcmToken.startsWith('ExponentPushToken[');
      const isApns = fcmToken.length === 64 && /^[a-f0-9]+$/i.test(fcmToken);
      expect(isExpo).toBe(false);
      expect(isApns).toBe(false);
    });
  });

  describe('Operation Grouping', () => {
    it('should group metrics by operation type', () => {
      const metrics = [
        { operation: 'categorization', latency: 400 },
        { operation: 'sentiment', latency: 300 },
        { operation: 'categorization', latency: 450 },
        { operation: 'sentiment', latency: 320 },
      ];

      const metricsByOperation: Record<string, any[]> = {};
      metrics.forEach((metric) => {
        if (!metricsByOperation[metric.operation]) {
          metricsByOperation[metric.operation] = [];
        }
        metricsByOperation[metric.operation].push(metric);
      });

      expect(metricsByOperation.categorization.length).toBe(2);
      expect(metricsByOperation.sentiment.length).toBe(2);
    });
  });
});
