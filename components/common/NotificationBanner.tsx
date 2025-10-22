/**
 * In-app notification banner component
 * @module components/common/NotificationBanner
 */

import React, { FC, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

/**
 * Props for NotificationBanner component
 */
export interface NotificationBannerProps {
  /** The notification to display */
  notification: Notifications.Notification | null;
  /** Callback when banner is tapped */
  onPress?: () => void;
  /** Callback when close button is tapped */
  onClose?: () => void;
  /** Duration to show banner in milliseconds (default: 5000) */
  duration?: number;
}

/**
 * Displays an in-app notification banner
 * @component
 * @example
 * ```tsx
 * <NotificationBanner
 *   notification={lastNotification}
 *   onPress={() => navigateToChat()}
 *   onClose={() => clearNotification()}
 * />
 * ```
 */
export const NotificationBanner: FC<NotificationBannerProps> = ({
  notification,
  onPress,
  onClose,
  duration = 5000,
}) => {
  const [visible, setVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));
  const [currentNotification, setCurrentNotification] = useState<Notifications.Notification | null>(
    null
  );

  useEffect(() => {
    if (notification) {
      // Show banner
      setCurrentNotification(notification);
      setVisible(true);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();

      // Auto-hide after duration
      const timeout = setTimeout(() => {
        hideBanner();
      }, duration);

      return () => clearTimeout(timeout);
    }
  }, [notification]);

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setCurrentNotification(null);
      onClose?.();
    });
  };

  const handlePress = () => {
    hideBanner();
    onPress?.();
  };

  if (!visible || !currentNotification) {
    return null;
  }

  const { title, body } = currentNotification.request.content;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity style={styles.banner} onPress={handlePress} activeOpacity={0.9}>
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'New Message'}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {body || 'You have a new message'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={hideBanner}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 50, // Account for status bar
    paddingHorizontal: 12,
  },
  banner: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  closeButton: {
    padding: 8,
  },
});
