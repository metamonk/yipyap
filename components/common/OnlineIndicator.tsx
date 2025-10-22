/**
 * Online status indicator component
 * @module components/common/OnlineIndicator
 */

import React, { FC } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

/**
 * Props for OnlineIndicator component
 */
export interface OnlineIndicatorProps {
  /** Whether the user is online */
  isOnline: boolean;
  /** Size of the indicator dot (default: 8) */
  size?: number;
  /** Position style for absolute positioning */
  style?: ViewStyle;
}

/**
 * Displays a colored dot indicating online/offline status
 * @component
 * @example
 * ```tsx
 * <OnlineIndicator isOnline={true} size={10} />
 * ```
 */
export const OnlineIndicator: FC<OnlineIndicatorProps> = ({ isOnline, size = 8, style }) => {
  return (
    <View
      style={[
        styles.indicator,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isOnline ? '#4CAF50' : '#9E9E9E',
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  indicator: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
