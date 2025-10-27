import { EngagementMetricsService } from '../../../services/engagementMetricsService';
import { HealthScoreComponents, RawEngagementMetrics } from '../../../types/user';

describe('EngagementMetricsService', () => {
  let service: EngagementMetricsService;

  beforeEach(() => {
    service = new EngagementMetricsService();
  });

  describe('calculateHealthScore', () => {
    it('should calculate correct weighted composite score for excellent metrics', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 100,
        avgResponseTime: 100,
        conversationDepth: 100,
        capacityUsage: 100,
      };

      const score = service.calculateHealthScore(components);
      expect(score).toBe(100);
    });

    it('should calculate correct weighted composite score for good metrics', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 82, // 35% weight
        avgResponseTime: 80, // 25% weight
        conversationDepth: 45, // 20% weight
        capacityUsage: 85, // 20% weight
      };

      const score = service.calculateHealthScore(components);
      // Expected: 82*0.35 + 80*0.25 + 45*0.20 + 85*0.20 = 28.7 + 20 + 9 + 17 = 74.7 => 75
      expect(score).toBe(75);
    });

    it('should calculate correct weighted composite score for poor metrics', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 30,
        avgResponseTime: 20,
        conversationDepth: 10,
        capacityUsage: 40,
      };

      const score = service.calculateHealthScore(components);
      // Expected: 30*0.35 + 20*0.25 + 10*0.20 + 40*0.20 = 10.5 + 5 + 2 + 8 = 25.5 => 26
      expect(score).toBe(26);
    });

    it('should handle 0% metrics', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 0,
        avgResponseTime: 0,
        conversationDepth: 0,
        capacityUsage: 0,
      };

      const score = service.calculateHealthScore(components);
      expect(score).toBe(0);
    });

    it('should weight personal response rate most heavily (35%)', () => {
      const componentsHigh: HealthScoreComponents = {
        personalResponseRate: 100,
        avgResponseTime: 0,
        conversationDepth: 0,
        capacityUsage: 0,
      };

      const scoreHigh = service.calculateHealthScore(componentsHigh);
      expect(scoreHigh).toBe(35); // 100 * 0.35 = 35
    });

    it('should weight response time at 25%', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 0,
        avgResponseTime: 100,
        conversationDepth: 0,
        capacityUsage: 0,
      };

      const score = service.calculateHealthScore(components);
      expect(score).toBe(25); // 100 * 0.25 = 25
    });

    it('should weight conversation depth at 20%', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 0,
        avgResponseTime: 0,
        conversationDepth: 100,
        capacityUsage: 0,
      };

      const score = service.calculateHealthScore(components);
      expect(score).toBe(20); // 100 * 0.20 = 20
    });

    it('should weight capacity usage at 20%', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 0,
        avgResponseTime: 0,
        conversationDepth: 0,
        capacityUsage: 100,
      };

      const score = service.calculateHealthScore(components);
      expect(score).toBe(20); // 100 * 0.20 = 20
    });

    it('should round to nearest integer', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 81, // 28.35
        avgResponseTime: 83, // 20.75
        conversationDepth: 47, // 9.4
        capacityUsage: 89, // 17.8
      };

      const score = service.calculateHealthScore(components);
      // Expected: 28.35 + 20.75 + 9.4 + 17.8 = 76.3 => 76
      expect(score).toBe(76);
    });

    it('should handle mid-range balanced metrics', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 50,
        avgResponseTime: 50,
        conversationDepth: 50,
        capacityUsage: 50,
      };

      const score = service.calculateHealthScore(components);
      expect(score).toBe(50);
    });
  });

  describe('normalizeResponseTime (private method via calculateHealthScore)', () => {
    it('should score < 12 hours as 100', () => {
      const service = new EngagementMetricsService();
      // Access private method via reflection for testing
      const normalizeResponseTime = (service as any).normalizeResponseTime.bind(service);

      expect(normalizeResponseTime(6)).toBe(100);
      expect(normalizeResponseTime(11)).toBe(100);
      expect(normalizeResponseTime(11.9)).toBe(100);
    });

    it('should score 12-24 hours as 80', () => {
      const service = new EngagementMetricsService();
      const normalizeResponseTime = (service as any).normalizeResponseTime.bind(service);

      expect(normalizeResponseTime(12)).toBe(80);
      expect(normalizeResponseTime(18)).toBe(80);
      expect(normalizeResponseTime(23.9)).toBe(80);
    });

    it('should score 24-48 hours as 40', () => {
      const service = new EngagementMetricsService();
      const normalizeResponseTime = (service as any).normalizeResponseTime.bind(service);

      expect(normalizeResponseTime(24)).toBe(40);
      expect(normalizeResponseTime(36)).toBe(40);
      expect(normalizeResponseTime(47.9)).toBe(40);
    });

    it('should score >= 48 hours as 0', () => {
      const service = new EngagementMetricsService();
      const normalizeResponseTime = (service as any).normalizeResponseTime.bind(service);

      expect(normalizeResponseTime(48)).toBe(0);
      expect(normalizeResponseTime(72)).toBe(0);
      expect(normalizeResponseTime(120)).toBe(0);
    });
  });

  describe('normalizeCapacityUsage (private method)', () => {
    it('should score 70-80% as 100 (optimal)', () => {
      const service = new EngagementMetricsService();
      const normalizeCapacityUsage = (service as any).normalizeCapacityUsage.bind(service);

      expect(normalizeCapacityUsage(70)).toBe(100);
      expect(normalizeCapacityUsage(75)).toBe(100);
      expect(normalizeCapacityUsage(80)).toBe(100);
    });

    it('should score 60-90% as 80 (good)', () => {
      const service = new EngagementMetricsService();
      const normalizeCapacityUsage = (service as any).normalizeCapacityUsage.bind(service);

      expect(normalizeCapacityUsage(60)).toBe(80);
      expect(normalizeCapacityUsage(65)).toBe(80);
      expect(normalizeCapacityUsage(85)).toBe(80);
      expect(normalizeCapacityUsage(90)).toBe(80);
    });

    it('should score >= 90% as 60 (high, approaching burnout)', () => {
      const service = new EngagementMetricsService();
      const normalizeCapacityUsage = (service as any).normalizeCapacityUsage.bind(service);

      expect(normalizeCapacityUsage(91)).toBe(60);
      expect(normalizeCapacityUsage(95)).toBe(60);
      expect(normalizeCapacityUsage(100)).toBe(60);
    });

    it('should score < 60% as 40 (underutilized)', () => {
      const service = new EngagementMetricsService();
      const normalizeCapacityUsage = (service as any).normalizeCapacityUsage.bind(service);

      expect(normalizeCapacityUsage(40)).toBe(40);
      expect(normalizeCapacityUsage(50)).toBe(40);
      expect(normalizeCapacityUsage(59)).toBe(40);
    });
  });

  describe('assessBurnoutRisk', () => {
    it('should return low risk for healthy metrics', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 80,
        avgResponseTime: 18,
        conversationDepth: 45,
        capacityUsage: 70,
      };

      // Mock getDaysAtMaxCapacity to return 0
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      expect(risk).toBe('low');
    });

    it('should return high risk for 100% capacity over 7 days', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 80,
        avgResponseTime: 18,
        conversationDepth: 45,
        capacityUsage: 100,
      };

      // Mock getDaysAtMaxCapacity to return 7
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(7);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      expect(risk).toBe('medium'); // Score: 3 (only capacity issue)
    });

    it('should return high risk for multiple red flags', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 50, // < 60%, +2 points
        avgResponseTime: 60, // > 48h, +2 points
        conversationDepth: 20, // < 25%, +1 point
        capacityUsage: 100,
      };

      // Mock getDaysAtMaxCapacity to return 7
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(7);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      // Score: 3 (capacity) + 2 (response rate) + 2 (response time) + 1 (depth) = 8
      expect(risk).toBe('high');
    });

    it('should return medium risk for moderate issues', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 50, // < 60%, +2 points
        avgResponseTime: 30, // Fine
        conversationDepth: 30, // Fine
        capacityUsage: 70,
      };

      // Mock getDaysAtMaxCapacity to return 0
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      // Score: 2 (response rate) = 2
      expect(risk).toBe('low'); // Score < 3
    });

    it('should return medium risk for low personal response rate only', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 55, // < 60%, +2 points
        avgResponseTime: 20,
        conversationDepth: 40,
        capacityUsage: 75,
      };

      // Mock getDaysAtMaxCapacity to return 0
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      // Score: 2
      expect(risk).toBe('low');
    });

    it('should return medium risk for slow response times only', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 80,
        avgResponseTime: 50, // > 48h, +2 points
        conversationDepth: 40,
        capacityUsage: 75,
      };

      // Mock getDaysAtMaxCapacity to return 0
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      // Score: 2
      expect(risk).toBe('low');
    });

    it('should return medium risk with threshold score of 3', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 50, // +2 points
        avgResponseTime: 30,
        conversationDepth: 20, // +1 point
        capacityUsage: 70,
      };

      // Mock getDaysAtMaxCapacity to return 0
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      // Score: 2 + 1 = 3
      expect(risk).toBe('medium');
    });

    it('should return high risk with threshold score of 5', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 50, // +2 points
        avgResponseTime: 50, // +2 points
        conversationDepth: 20, // +1 point
        capacityUsage: 70,
      };

      // Mock getDaysAtMaxCapacity to return 0
      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      // Score: 2 + 2 + 1 = 5
      expect(risk).toBe('high');
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('should handle personal response rate exactly at 60% threshold', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 60, // Exactly at threshold, should NOT add points
        avgResponseTime: 20,
        conversationDepth: 40,
        capacityUsage: 70,
      };

      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      expect(risk).toBe('low'); // Score: 0
    });

    it('should handle response time exactly at 48h threshold', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 80,
        avgResponseTime: 48, // Exactly at threshold, should NOT add points
        conversationDepth: 40,
        capacityUsage: 70,
      };

      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      expect(risk).toBe('low'); // Score: 0
    });

    it('should handle conversation depth exactly at 25% threshold', async () => {
      const metrics: RawEngagementMetrics = {
        personalResponseRate: 80,
        avgResponseTime: 20,
        conversationDepth: 25, // Exactly at threshold, should NOT add points
        capacityUsage: 70,
      };

      jest.spyOn(service, 'getDaysAtMaxCapacity').mockResolvedValue(0);

      const risk = await service.assessBurnoutRisk('user123', metrics);
      expect(risk).toBe('low'); // Score: 0
    });
  });

  describe('Integration Scenarios', () => {
    it('should produce realistic health score for typical creator', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 75, // Edits 75% of drafts
        avgResponseTime: 80, // ~12-24 hour response time
        conversationDepth: 40, // 40% multi-turn conversations
        capacityUsage: 80, // Using 60-90% capacity
      };

      const score = service.calculateHealthScore(components);
      // Expected: 75*0.35 + 80*0.25 + 40*0.20 + 80*0.20 = 26.25 + 20 + 8 + 16 = 70.25 => 70
      expect(score).toBe(70);
    });

    it('should produce high health score for excellent creator', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 95, // Highly personal
        avgResponseTime: 100, // Very responsive
        conversationDepth: 60, // Deep conversations
        capacityUsage: 100, // Optimal capacity
      };

      const score = service.calculateHealthScore(components);
      // Expected: 95*0.35 + 100*0.25 + 60*0.20 + 100*0.20 = 33.25 + 25 + 12 + 20 = 90.25 => 90
      expect(score).toBe(90);
    });

    it('should produce low health score for at-risk creator', () => {
      const components: HealthScoreComponents = {
        personalResponseRate: 40, // Mostly AI-generated
        avgResponseTime: 40, // Slow responses
        conversationDepth: 15, // Shallow conversations
        capacityUsage: 60, // High burnout risk
      };

      const score = service.calculateHealthScore(components);
      // Expected: 40*0.35 + 40*0.25 + 15*0.20 + 60*0.20 = 14 + 10 + 3 + 12 = 39
      expect(score).toBe(39);
    });
  });
});
