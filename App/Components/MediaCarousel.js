// App/Components/MediaCarousel.js
import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Image,
  FlatList,
  Dimensions,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
  Text,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
// Tracks whether the screen this carousel is rendered on currently has
// navigation focus. `isViewable` (passed in by the caller) only tracks
// scroll position within the current screen — it has no way to know the
// whole screen was navigated away from (e.g. Feed -> Post detail, or
// switching tabs), since React Navigation keeps the previous screen
// mounted in the background rather than unmounting it. Without this, a
// playing video keeps playing (and making sound) after you leave the
// screen entirely.
import { useIsFocused } from '@react-navigation/native';
import { toUrlString } from '../utils/media';
import { normalizeFirebaseDownloadUrl } from '../utils/fbUrl';

const { width: SCREEN_W } = Dimensions.get('window');
const FEED_HARD_HEIGHT = Math.round(SCREEN_W);

const looksLikeVideo = (url, type) => {
  if (type && String(type).toLowerCase().includes('video')) return true;
  const u = toUrlString(url);
  return /\.(mp4|mov|m4v|webm|avi)$/i.test(u || '');
};

const guessMime = (url, fallbackType) => {
  if (fallbackType) return fallbackType;
  const u = String(url || '').toLowerCase();
  if (u.endsWith('.mp4') || u.endsWith('.m4v')) return 'video/mp4';
  if (u.endsWith('.mov')) return 'video/quicktime';
  if (u.endsWith('.webm')) return 'video/webm';
  if (u.endsWith('.avi')) return 'video/avi';
  return 'video/mp4';
};

const fixFirebaseUrl = url => {
  if (!url) return url;
  return normalizeFirebaseDownloadUrl(url);
};

const Slide = React.memo(function Slide({
  item,
  type,
  containerW,
  mediaH,
  muted,
  paused,
  onSlidePress,
  onToggleMute,
  mode,
}) {
  const srcUri = useMemo(() => fixFirebaseUrl(toUrlString(item)) || '', [item]);
  const isVideo = looksLikeVideo(srcUri, type);
  const mime = guessMime(srcUri, type);

  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);

  const onBuffer = useCallback(({ isBuffering }) => {
    setBuffering(isBuffering);
  }, []);

  const onError = useCallback(error => {
    console.warn('Video error:', error);
    setError(true);
  }, []);

  const onLoad = useCallback(() => {
    setBuffering(false);
    setError(false);
  }, []);

  return (
    <TouchableWithoutFeedback onPress={onSlidePress}>
      <View style={{ width: containerW, height: mediaH }}>
        {isVideo && srcUri ? (
          <>
            {paused ? (
              <View
                style={{
                  width: containerW,
                  height: mediaH,
                  backgroundColor: '#000',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="play-circle"
                  size={48}
                  color="rgba(255,255,255,0.85)"
                />
              </View>
            ) : (
              <Video
                source={{ uri: srcUri, type: mime }}
                style={{
                  width: containerW,
                  height: mediaH,
                  backgroundColor: '#000',
                }}
                resizeMode={mode === 'detail' ? 'contain' : 'cover'}
                paused={paused}
                muted={muted}
                repeat
                onBuffer={onBuffer}
                onError={onError}
                onLoad={onLoad}
                ignoreSilentSwitch="ignore"
                playInBackground={false}
                playWhenInactive={false}
              />
            )}

            {!paused && (
              <TouchableOpacity onPress={onToggleMute} style={styles.controls}>
                <Ionicons
                  name={muted ? 'volume-mute' : 'volume-high'}
                  size={18}
                  color="#fff"
                />
              </TouchableOpacity>
            )}

            {buffering && (
              <View style={styles.spinner}>
                <ActivityIndicator color="#fff" />
              </View>
            )}

            {error && (
              <View
                style={[styles.spinner, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
              >
                <Ionicons name="alert-circle-outline" size={24} color="#fff" />
                <Text style={{ color: '#fff', marginTop: 6 }}>
                  Can't play video
                </Text>
              </View>
            )}
          </>
        ) : (
          <Image
            source={{ uri: srcUri }}
            style={{
              width: containerW,
              height: mediaH,
              backgroundColor: '#eee',
            }}
            resizeMode={mode === 'detail' ? 'contain' : 'cover'}
            fadeDuration={0}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
});

export default function MediaCarousel({
  media = [],
  mediaMeta = [],
  isViewable = false,
  onSlidePress,
  mode = 'feed',
}) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(mode !== 'detail');
  const [containerW, setContainerW] = useState(0);

  // false whenever this screen isn't the currently-focused one, regardless
  // of what isViewable says.
  const isScreenFocused = useIsFocused();

  const onLayout = useCallback(e => {
    const w = Math.max(1, Math.round(e.nativeEvent.layout.width || SCREEN_W));
    setContainerW(w);
  }, []);

  // FIX: was `useEffect(() => setIndex(0), [media])` — reset on array
  // REFERENCE change, not content change. `media` gets a brand-new array
  // object every time the parent's live Firestore listener fires for ANY
  // field on the post (e.g. someone else's like incrementing `likes`),
  // even though the actual media URLs haven't changed at all. That was
  // silently snapping the carousel back to slide 1 mid-browse whenever an
  // unrelated field on the post updated. Comparing a joined string of the
  // actual URLs means this only resets when the media genuinely changes.
  const mediaKey = useMemo(
    () => media.map(m => toUrlString(m)).join('|'),
    [media],
  );
  const prevMediaKeyRef = useRef(mediaKey);
  useEffect(() => {
    if (mediaKey !== prevMediaKeyRef.current) {
      prevMediaKeyRef.current = mediaKey;
      setIndex(0);
    }
  }, [mediaKey]);

  const FEED_HEIGHT = FEED_HARD_HEIGHT;

  const aspect = useMemo(() => {
    if (mode !== 'detail') return 1;
    const meta = mediaMeta?.[index];
    if (meta?.width && meta?.height) return meta.width / meta.height;
    return 1;
  }, [mediaMeta, index, mode]);

  const mediaH = useMemo(() => {
    if (mode === 'feed') return FEED_HEIGHT;
    return Math.max(
      260,
      Math.min((containerW || SCREEN_W) / (aspect || 1), 600),
    );
  }, [FEED_HEIGHT, aspect, containerW, mode]);

  const onMomentumScrollEnd = useCallback(
    e => {
      const x = e.nativeEvent.contentOffset?.x ?? 0;
      const i = Math.max(
        0,
        Math.min(media.length - 1, Math.round(x / (containerW || 1))),
      );
      if (i !== index) setIndex(i);
    },
    [containerW, index, media.length],
  );

  const renderItem = useCallback(
    ({ item, index: i }) => {
      const type = mediaMeta?.[i]?.type || '';
      const active = i === index;
      // Also requires the screen itself to be focused — previously a
      // video kept its shouldPlay=true state (and kept playing/making
      // sound) after navigating away, since neither `active` nor
      // `isViewable` had any way to reflect that the screen was no
      // longer visible at all.
      const shouldPlay =
        (mode === 'detail' ? active : isViewable && active) && isScreenFocused;

      return (
        <Slide
          item={item}
          type={type}
          containerW={containerW}
          mediaH={mediaH}
          muted={muted}
          paused={!shouldPlay}
          mode={mode}
          onSlidePress={onSlidePress}
          onToggleMute={() => setMuted(m => !m)}
        />
      );
    },
    [
      index,
      isViewable,
      isScreenFocused,
      mediaMeta,
      mediaH,
      mode,
      onSlidePress,
      containerW,
      muted,
    ],
  );

  const getItemLayout = useCallback(
    (_d, i) => ({ length: containerW, offset: containerW * i, index: i }),
    [containerW],
  );

  const measured = containerW > 0;

  return (
    <View onLayout={onLayout} collapsable={false}>
      {measured ? (
        <FlatList
          key={`w-${containerW}`}
          data={media}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_u, i) => `mc-${i}`}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          onMomentumScrollEnd={onMomentumScrollEnd}
          scrollEnabled={media.length > 1}
          removeClippedSubviews={true}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          updateCellsBatchingPeriod={40}
          scrollEventThrottle={16}
        />
      ) : (
        <View style={{ height: FEED_HARD_HEIGHT, width: '100%' }} />
      )}

      {media.length > 1 && measured && (
        <View style={styles.dotsRow}>
          {media.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: i === index ? 1 : 0.35,
                  width: i === index ? 14 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { height: 6, borderRadius: 3, backgroundColor: '#ffffff' },
});
