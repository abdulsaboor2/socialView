// App/Components/AppInput.js
import React, { forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const AppInput = forwardRef(
  (
    {
      placeholder,
      keyboardType = 'default',
      value,
      onChangeText,
      secureTextEntry = false,
      autoCapitalize = 'none',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      onLeftIconPress,
      onRightIconPress,
      containerStyle,
      inputStyle,
      disabled = false,
      returnKeyType = 'done',
      onSubmitEditing,
      blurOnSubmit = true,
      autoCorrect = false,
      textContentType,
      autoComplete,
      inputMode,
      maxLength,
      testID,
      accessibilityLabel,
      ...rest
    },
    ref,
  ) => {
    const iconColor = error ? '#E5484D' : disabled ? '#9CA3AF' : '#4B5563';
    const atLimit =
      typeof maxLength === 'number' && typeof value === 'string'
        ? value.length >= maxLength
        : false;

    const renderIcon = (icon, side, onPress) => {
      if (!icon) return null;
      const node =
        typeof icon === 'string' ? (
          <Ionicons name={icon} size={20} color={iconColor} />
        ) : (
          icon
        );

      const positionStyle =
        side === 'left' ? styles.iconLeft : styles.iconRight;

      // Only make it interactive (and touch-absorbing) if there's actually a handler.
      if (!onPress) {
        return <View style={positionStyle}>{node}</View>;
      }

      return (
        <Pressable
          onPress={onPress}
          hitSlop={10}
          style={positionStyle}
          accessibilityRole="button"
          accessibilityLabel={`${
            side === 'left' ? 'Left' : 'Right'
          } input action`}
        >
          {node}
        </Pressable>
      );
    };

    return (
      <View
        style={[styles.wrapper, containerStyle]}
        pointerEvents={disabled ? 'none' : 'auto'} // also blocks icon presses while disabled — intentional
      >
        {label ? (
          <Text
            style={styles.label}
            nativeID={testID ? `${testID}-label` : undefined}
          >
            {label}
          </Text>
        ) : null}

        <View
          style={[
            styles.inputContainer,
            {
              borderColor: error ? '#E5484D' : '#E6E6E6',
              backgroundColor: disabled ? '#F5F5F5' : '#F1F1F1',
            },
          ]}
        >
          {renderIcon(leftIcon, 'left', onLeftIconPress)}

          <TextInput
            ref={ref}
            style={[styles.input, inputStyle]}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            autoCapitalize={autoCapitalize}
            autoCorrect={autoCorrect}
            editable={!disabled}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            blurOnSubmit={blurOnSubmit}
            textContentType={textContentType}
            autoComplete={autoComplete}
            inputMode={inputMode}
            maxLength={maxLength}
            clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
            selectionColor="#da1e72"
            testID={testID}
            accessibilityLabel={accessibilityLabel || label || placeholder}
            accessibilityState={{ disabled, invalid: !!error }}
            {...rest}
          />

          {renderIcon(rightIcon, 'right', onRightIconPress)}
        </View>

        {!!helperText && !error && (
          <Text style={styles.helperText}>{helperText}</Text>
        )}
        {!!error && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}
        {typeof maxLength === 'number' && typeof value === 'string' ? (
          <Text
            style={[styles.counterText, atLimit && styles.counterTextLimit]}
          >
            {`${value.length}/${maxLength}`}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrapper: { width: '100%', alignItems: 'center', marginTop: 10 },
  label: {
    width: '90%',
    marginBottom: 6,
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    width: '90%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, color: '#111827', fontSize: 16, paddingVertical: 12 },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  helperText: { width: '90%', marginTop: 6, color: '#6B7280', fontSize: 12 },
  errorText: {
    width: '90%',
    marginTop: 6,
    color: '#E5484D',
    fontSize: 12,
    fontWeight: '600',
  },
  counterText: {
    width: '90%',
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'right',
  },
  counterTextLimit: { color: '#E5484D', fontWeight: '600' },
});

export default AppInput;
