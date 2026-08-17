// App/Components/AppLoading.js
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

const AppLoading = ({
  title = 'Loading...',
  size = 'large',
  color = '#3498db',
  isLoading = true,
  fullScreen = true,
  style,
  testID,
}) => {
  if (!isLoading) return null;

  return (
    <View
      style={[styles.container, fullScreen && styles.fullScreen, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <ActivityIndicator size={size} color={color} />
      {!!title && <Text style={styles.text}>{title}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
  },
  text: {
    marginTop: 12,
    fontSize: 18,
    color: '#7f8c8d',
  },
});

export default AppLoading;
