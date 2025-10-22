import React, { FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

interface OfflineBannerProps {
  /** Whether the app is currently offline */
  isOffline: boolean;
}

/**
 * Displays a banner at the top of the screen when the app is offline
 *
 * @component
 * @example
 * ```tsx
 * const { connectionStatus } = useNetworkStatus();
 * <OfflineBanner isOffline={connectionStatus === 'offline'} />
 * ```
 */
export const OfflineBanner: FC<OfflineBannerProps> = ({ isOffline }) => {
  if (!isOffline) return null;

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(300)}
      style={styles.banner}
    >
      <MaterialIcons name="wifi-off" size={20} color="#fff" />
      <View style={styles.textContainer}>
        <Text style={styles.text}>You&apos;re offline</Text>
        <Text style={styles.subtext}>Messages will send when reconnected</Text>
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
    backgroundColor: '#FF9500', // Orange warning color
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5, // Android shadow
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
  subtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
});
