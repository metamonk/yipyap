/**
 * Unit tests for aiAvailabilityService (Story 5.7 - Task 11)
 * Tests graceful degradation when AI services are unavailable
 */

import { checkAIAvailability, AIAvailabilityMonitor } from '@/services/aiAvailabilityService';

// Mock fetch
global.fetch = jest.fn();

// Mock Config
jest.mock('@/constants/Config', () => ({
  default: {
    API_BASE_URL: 'http://test-api.com',
  },
}));

describe('aiAvailabilityService', () => {
  let originalSetTimeout: typeof setTimeout;
  let originalClearTimeout: typeof clearTimeout;

  beforeEach(() => {
    jest.clearAllMocks();

    // Store original timers
    originalSetTimeout = global.setTimeout;
    originalClearTimeout = global.clearTimeout;

    // Mock setTimeout to call callback immediately (simulates fast response)
    global.setTimeout = ((callback: () => void) => {
      // Return a fake timer ID but don't actually call the abort
      return 12345 as any;
    }) as any;

    global.clearTimeout = jest.fn();
  });

  afterEach(() => {
    // Restore original timers
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  describe('checkAIAvailability', () => {
    it('should return true when AI service responds with 2xx', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true,
      });

      const result = await checkAIAvailability();

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/categorize-message'),
        expect.objectContaining({
          method: 'HEAD',
        })
      );
    });

    it('should return true for 4xx errors (service available but auth issue)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 404,
        ok: false,
      });

      const result = await checkAIAvailability();

      // 404 means service is reachable (not a server error)
      expect(result).toBe(true);
    });

    it('should return false for 5xx server errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 503,
        ok: false,
      });

      const result = await checkAIAvailability();

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await checkAIAvailability();

      expect(result).toBe(false);
    });

    it('should handle fetch abort', async () => {
      // Mock fetch to simulate abort
      (global.fetch as jest.Mock).mockRejectedValue(new Error('AbortError'));

      const result = await checkAIAvailability();

      expect(result).toBe(false);
    });

    it('should use configured API base URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true,
      });

      await checkAIAvailability();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/categorize-message$/),
        expect.any(Object)
      );
    });
  });

  describe('AIAvailabilityMonitor', () => {
    afterEach(() => {
      // Ensure all monitors are stopped to prevent timer leaks
      jest.clearAllTimers();
    });

    it('should start monitoring and call callback with availability status', async () => {
      const monitor = new AIAvailabilityMonitor();
      const callback = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true,
      });

      monitor.startMonitoring(callback);

      // Trigger immediate check
      await monitor.checkNow();

      expect(callback).toHaveBeenCalledWith(true);

      // Cleanup
      monitor.stopMonitoring();
    });

    it('should create monitor and check availability', async () => {
      const monitor = new AIAvailabilityMonitor();

      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        ok: true,
      });

      // Direct check without monitoring
      const result = await monitor.checkNow();

      expect(result).toBe(true);

      // Cleanup
      monitor.stopMonitoring();
    });

    it('should detect unavailable service', async () => {
      const monitor = new AIAvailabilityMonitor();

      (global.fetch as jest.Mock).mockResolvedValue({
        status: 503,
        ok: false,
      });

      const result = await monitor.checkNow();

      expect(result).toBe(false);

      // Cleanup
      monitor.stopMonitoring();
    });

    it('should cleanup monitor on stop', () => {
      const monitor = new AIAvailabilityMonitor();

      // Should not throw
      expect(() => {
        monitor.stopMonitoring();
      }).not.toThrow();
    });
  });
});
