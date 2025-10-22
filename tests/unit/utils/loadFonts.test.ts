import { loadFonts, useFontsLoaded } from '@/utils/loadFonts';
import * as Font from 'expo-font';
import { renderHook, waitFor } from '@testing-library/react-native';

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: {
    font: {
      Ionicons: 'mock-ionicons-font-path',
    },
  },
  MaterialIcons: {
    font: {
      'Material Icons': 'mock-material-icons-font-path',
    },
  },
}));

describe('Font Loading Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadFonts', () => {
    it('should load Ionicons and MaterialIcons fonts', async () => {
      (Font.loadAsync as jest.Mock).mockResolvedValue(undefined);

      await loadFonts();

      expect(Font.loadAsync).toHaveBeenCalledWith({
        Ionicons: 'mock-ionicons-font-path',
        'Material Icons': 'mock-material-icons-font-path',
      });
      expect(Font.loadAsync).toHaveBeenCalledTimes(1);
    });

    it('should handle font loading errors gracefully', async () => {
      const error = new Error('Font loading failed');
      (Font.loadAsync as jest.Mock).mockRejectedValue(error);

      // Should not throw
      await loadFonts();

      expect(console.warn).toHaveBeenCalledWith('Failed to preload icon fonts:', error);
    });
  });

  describe('useFontsLoaded', () => {
    it('should initially return fontsLoaded as false', () => {
      (Font.loadAsync as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useFontsLoaded());

      expect(result.current.fontsLoaded).toBe(false);
    });

    it('should set fontsLoaded to true after fonts are loaded', async () => {
      (Font.loadAsync as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useFontsLoaded());

      expect(result.current.fontsLoaded).toBe(false);

      await waitFor(() => {
        expect(result.current.fontsLoaded).toBe(true);
      });

      expect(Font.loadAsync).toHaveBeenCalled();
    });

    it('should set fontsLoaded to true even if loading fails', async () => {
      const error = new Error('Font loading failed');
      (Font.loadAsync as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useFontsLoaded());

      expect(result.current.fontsLoaded).toBe(false);

      await waitFor(() => {
        expect(result.current.fontsLoaded).toBe(true);
      });

      // loadFonts catches errors internally, so the error is logged there
      expect(console.warn).toHaveBeenCalledWith('Failed to preload icon fonts:', error);
    });

    it('should only attempt to load fonts once', async () => {
      (Font.loadAsync as jest.Mock).mockResolvedValue(undefined);

      const { result, rerender } = renderHook(() => useFontsLoaded());

      await waitFor(() => {
        expect(result.current.fontsLoaded).toBe(true);
      });

      expect(Font.loadAsync).toHaveBeenCalledTimes(1);

      // Re-render should not trigger another font load
      rerender();

      // Wait a bit and verify fonts are not loaded again
      await waitFor(() => {
        expect(result.current.fontsLoaded).toBe(true);
      });

      expect(Font.loadAsync).toHaveBeenCalledTimes(1);
    });
  });
});
