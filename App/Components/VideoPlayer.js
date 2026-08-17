// components/VideoPlayer.js
import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { normalizeFirebaseDownloadUrl } from '../utils/fbUrl'; // Import the correct function

// Helper function to fix Firebase URLs (same as in MediaCarousel)
const fixFirebaseUrl = (url) => {
  if (!url) return url;
  return normalizeFirebaseDownloadUrl(url);
};

export const VideoPlayer = ({ uri, paused, style, onPress, muted = false }) => {
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const videoRef = useRef(null);

  return (
    <View style={style}>
      <Video
        ref={videoRef}
        source={{ uri: fixFirebaseUrl(uri) }}
        style={{ flex: 1, backgroundColor: '#000' }}
        resizeMode="cover"
        paused={paused}
        muted={muted}
        repeat={true}
        onBuffer={({ isBuffering }) => setBuffering(isBuffering)}
        onError={() => setError(true)}
        onLoad={() => {
          setError(false);
          setBuffering(false);
        }}
        ignoreSilentSwitch="ignore"
        playInBackground={false}
        playWhenInactive={false}
      />
      
      {buffering && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      
      {error && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle" size={32} color="#fff" />
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.videoOverlay} 
        onPress={onPress}
        activeOpacity={0.9}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});