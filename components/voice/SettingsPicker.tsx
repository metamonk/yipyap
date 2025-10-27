/**
 * Settings Picker Component
 * @remarks
 * iOS-friendly picker that displays the selected value and opens native picker on tap
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

/**
 * Picker item configuration
 */
export interface PickerItem<T = any> {
  /** Display label for the item */
  label: string;
  /** Value for the item */
  value: T;
}

/**
 * Settings Picker Props
 */
export interface SettingsPickerProps<T = any> {
  /** Currently selected value */
  value: T;
  /** Array of picker items */
  items: PickerItem<T>[];
  /** Callback when value changes */
  onValueChange: (value: T) => void;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Test ID for testing */
  testID?: string;
  /** Placeholder text when no value selected */
  placeholder?: string;
}

/**
 * Settings Picker Component
 * @component
 * @example
 * ```tsx
 * <SettingsPicker
 *   value={selectedValue}
 *   items={[
 *     { label: 'Option 1', value: 1 },
 *     { label: 'Option 2', value: 2 },
 *   ]}
 *   onValueChange={setValue}
 * />
 * ```
 */
export function SettingsPicker<T = any>({
  value,
  items,
  onValueChange,
  disabled = false,
  testID,
  placeholder = 'Select...',
}: SettingsPickerProps<T>) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  // Find the label for the current value
  const selectedItem = items.find((item) => item.value === value);
  const displayLabel = selectedItem ? selectedItem.label : placeholder;

  const handleDone = () => {
    onValueChange(tempValue);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setShowPicker(false);
  };

  // Use ActionSheet for small option sets (≤ 4 items)
  const useActionSheet = Platform.OS === 'ios' && items.length <= 4;

  const handlePress = () => {
    if (disabled) return;

    if (useActionSheet) {
      // Show native iOS ActionSheet for small option sets
      const options = [...items.map(item => item.label), 'Cancel'];
      const cancelButtonIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex) {
            onValueChange(items[buttonIndex].value);
          }
        }
      );
    } else {
      // Show picker wheel for larger option sets
      setShowPicker(true);
    }
  };

  if (Platform.OS === 'ios') {
    return (
      <>
        <TouchableOpacity
          style={[styles.iosPickerButton, disabled && styles.disabledButton]}
          onPress={handlePress}
          disabled={disabled}
          testID={testID}
        >
          <Text style={[styles.iosPickerText, disabled && styles.disabledText]}>
            {displayLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={20}
            color={disabled ? '#C7C7CC' : '#8E8E93'}
          />
        </TouchableOpacity>

        {/* Only show picker modal for larger option sets */}
        {!useActionSheet && (
          <Modal
            visible={showPicker}
            animationType="slide"
            presentationStyle="formSheet"
            onRequestClose={handleCancel}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={handleCancel} style={styles.modalButton}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDone} style={styles.modalButton}>
                  <Text style={styles.modalDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <Picker
                selectedValue={tempValue}
                onValueChange={(itemValue) => setTempValue(itemValue as T)}
                style={styles.iosPicker}
                itemStyle={styles.iosPickerItem}
              >
                {items.map((item, index) => (
                  <Picker.Item
                    key={index}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </Picker>
            </View>
          </Modal>
        )}
      </>
    );
  }

  // Android: Use standard picker
  return (
    <View style={styles.androidPickerContainer}>
      <Picker
        selectedValue={value}
        onValueChange={onValueChange}
        enabled={!disabled}
        style={styles.androidPicker}
        testID={testID}
      >
        {items.map((item, index) => (
          <Picker.Item
            key={index}
            label={item.label}
            value={item.value}
          />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  // iOS Styles
  iosPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  iosPickerText: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#8E8E93',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  modalCancelText: {
    fontSize: 17,
    color: '#007AFF',
  },
  modalDoneText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  iosPicker: {
    height: 216,
  },
  iosPickerItem: {
    color: '#000000',
    fontSize: 20,
  },
  // Android Styles
  androidPickerContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    overflow: 'hidden',
  },
  androidPicker: {
    height: 50,
  },
});
