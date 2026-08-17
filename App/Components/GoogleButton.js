// App/Components/GoogleButton.js
import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  Text,
  StyleSheet,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function GoogleButton({ onPress, loading }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={styles.btn}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Ionicons
            name="logo-google"
            size={20}
            color="#fff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.text}>Sign in with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    backgroundColor: '#4285F4', // Google Blue
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
