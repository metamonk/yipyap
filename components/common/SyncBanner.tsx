import React, { FC } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';

interface SyncBannerProps {
  /** Whether sync is currently in progress */
  isSyncing: boolean;
}

/**
 * Displays a banner at the top of the screen when messages are syncing
 * after app returns to foreground
 *
 * @component
 * @example
 * ```tsx
 * const { isSyncing } = useOfflineSync();
 * <SyncBanner isSyncing={isSyncing} />
 * ```
 */
export const SyncBanner: FC<SyncBannerProps> = ({ isSyncing }) => {
  if (!isSyncing) return null;

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(300)}
      style={styles.banner}
    >
      <ActivityIndicator size="small" color="#fff" />
      <View style={styles.textContainer}>
        <Text style={styles.text}>Syncing messages...</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#007AFF', // iOS blue color for info
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 999, // Slightly below OfflineBanner
    elevation: 4, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
