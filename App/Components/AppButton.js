// App/Components/AppButton.js
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const DISABLED_BG = '#E5E7EB';
const DISABLED_TEXT = '#9CA3AF';

const AppButton = ({
  title = 'Button',
  color = '#fe4c74',
  onPress,
  onPressIn,
  onPressOut,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  testID,
  ...rest
}) => {
  const isInactive = disabled || loading;
  const contentColor = disabled ? DISABLED_TEXT : '#FFFFFF';

  const renderIcon = icon => {
    if (!icon) return null;
    return typeof icon === 'string' ? (
      <Ionicons name={icon} size={18} color={contentColor} />
    ) : (
      icon
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: disabled ? DISABLED_BG : color },
        style,
      ]}
      onPress={isInactive ? undefined : onPress}
      onPressIn={isInactive ? undefined : onPressIn}
      onPressOut={isInactive ? undefined : onPressOut}
      activeOpacity={0.85}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      accessibilityLabel={
        accessibilityLabel || (typeof title === 'string' ? title : 'button')
      }
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID={testID}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} />
      ) : (
        <View style={styles.content}>
          {renderIcon(leftIcon)}
          {typeof title === 'string' ? (
            <Text style={[styles.text, { color: contentColor }, textStyle]}>
              {title}
            </Text>
          ) : (
            title
          )}
          {renderIcon(rightIcon)}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.5,
    elevation: 5,
  },
  content: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

export default AppButton;
