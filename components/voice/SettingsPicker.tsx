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

  if (Platform.OS === 'ios') {
    return (
      <>
        <TouchableOpacity
          style={[styles.iosPickerButton, disabled && styles.disabledButton]}
          onPress={() => !disabled && setShowPicker(true)}
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

        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={handleCancel}
            />
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
          </View>
        </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
