// App/Screens/EditPostScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Video from 'react-native-video';
import KeyboardScreenWrapper from '../Components/KeyboardScreenWrapper';

const GRADIENT = ['#7c3aed', '#db2777'];

export default function EditPostScreen({ route, navigation }) {
  // Expect payload: { postId, caption, media, mediaMeta, type, uid }
  const params = route?.params || {};
  const postId = params.postId;
  const insets = useSafeAreaInsets();

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caption, setCaption] = useState(params.caption || '');
  const [media, setMedia] = useState(
    Array.isArray(params.media) ? params.media : [],
  );

  const [mediaMeta, setMediaMeta] = useState(
    Array.isArray(params.mediaMeta) ? params.mediaMeta : [],
  );

  // Keep UI in sync with Firestore (in case payload is stale)
  useEffect(() => {
    if (!postId) return;
    const unsub = firestore()
      .collection('Posts')
      .doc(postId)
      .onSnapshot(
        snap => {
          const d = snap.data();
          if (!d) {
            Alert.alert(
              'Post not found',
              'This post was deleted or does not exist.',
              [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
            return;
          }
          // only adopt server values if our local fields are empty
          setCaption(prev => (prev?.length ? prev : d.caption || ''));
          setMedia(Array.isArray(d.media) ? d.media : []);
          setMediaMeta(Array.isArray(d.mediaMeta) ? d.mediaMeta : []);
          setInitialLoaded(true);
        },
        () => setInitialLoaded(true),
      );
    return () => unsub();
  }, [navigation, postId]);

  const canSave = useMemo(
    () => !!postId && caption.trim().length >= 0,
    [postId, caption],
  );

  const onSave = async () => {
    if (!postId) return;
    try {
      setSaving(true);
      await firestore().collection('Posts').doc(postId).set(
        {
          caption: caption.trim(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const looksLikeVideo = (url, type) =>
    (type && String(type).toLowerCase().includes('video')) ||
    /\.(mp4|mov|m4v|webm|avi)$/i.test(String(url || ''));

  // (optional) make Firebase download URLs robust
  const normalizeFirebaseDownloadUrl = url => {
    if (!url) return '';
    const s = String(url);
    if (!/https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i.test(s))
      return s;
    const m = s.match(/^(.*\/o\/)([^?]+)(\?.*)?$/);
    if (!m) return s;
    const [, prefix, rawName, suffix = ''] = m;
    let decoded = rawName;
    try {
      decoded = decodeURIComponent(rawName);
    } catch {}
    return `${prefix}${encodeURIComponent(decoded)}${suffix}`.replace(
      /\\u0026/gi,
      '&',
    );
  };

  const guessMime = (url, fallbackType) => {
    if (fallbackType) return fallbackType;
    const u = String(url || '').toLowerCase();
    if (u.endsWith('.mp4') || u.endsWith('.m4v')) return 'video/mp4';
    if (u.endsWith('.mov')) return 'video/quicktime';
    if (u.endsWith('.webm')) return 'video/webm';
    if (u.endsWith('.avi')) return 'video/avi';
    return undefined;
  };

  if (!postId) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#666' }}>Missing postId in route params.</Text>
      </View>
    );
  }

  if (!initialLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading post…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* paddingTop uses the real device inset (not a hardcoded 50/16
          guess), so this never sits behind a status bar / punch-hole
          camera on Android. Kept as inline JSX rather than a nested
          component function — a component defined inside another
          component's body gets recreated on every render (e.g. every
          keystroke in the caption box below), which makes React remount
          it instead of just re-rendering it. */}
      <LinearGradient
        colors={GRADIENT}
        style={[styles.headerGrad, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Post</Text>
          <TouchableOpacity
            onPress={onSave}
            disabled={!canSave || saving}
            style={[styles.saveBtn, (!canSave || saving) && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveTxt}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Main scrollable content — KeyboardScreenWrapper handles both the
          camera-cutout bottom inset and proper Android keyboard avoidance
          (the old KeyboardAvoidingView had behavior=undefined on Android,
          which meant the caption field was hidden behind the keyboard). */}
      <KeyboardScreenWrapper
        backgroundColor="#f6f7fb"
        topInset={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Media preview (read-only) */}
        <View style={styles.card}>
          <Text style={styles.label}>Media</Text>
          {media?.length ? (
            <FlatList
              data={media}
              keyExtractor={(u, i) => `${u}-${i}`}
              numColumns={3}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item, index }) => {
                const uri = normalizeFirebaseDownloadUrl(String(item));
                const metaType = mediaMeta?.[index]?.type || '';
                const isVideo = looksLikeVideo(uri, metaType);

                return (
                  <View style={styles.thumb}>
                    {isVideo ? (
                      <View style={styles.thumbVideoWrap}>
                        <Video
                          source={{ uri, type: guessMime(uri, metaType) }}
                          style={styles.thumbImg}
                          resizeMode="cover"
                          paused // keep thumbnails lightweight
                          muted
                          repeat={false}
                        />
                        <View style={styles.playBadge}>
                          <Ionicons name="play" size={14} color="#fff" />
                        </View>
                      </View>
                    ) : (
                      <Image source={{ uri }} style={styles.thumbImg} />
                    )}
                  </View>
                );
              }}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyBox}>
              <Ionicons name="image-outline" size={22} color="#9ca3af" />
              <Text style={styles.emptyText}>No media</Text>
            </View>
          )}
        </View>

        {/* Caption editor */}
        <View style={styles.card}>
          <Text style={styles.label}>Caption</Text>
          <TextInput
            style={styles.input}
            placeholder="Write something…"
            placeholderTextColor="#9ca3af"
            value={caption}
            onChangeText={setCaption}
            multiline
            textAlignVertical="top"
            maxLength={2200}
          />
          <Text style={styles.counter}>{caption.length}/2200</Text>
        </View>
      </KeyboardScreenWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  scrollContent: { paddingHorizontal: 0, paddingBottom: 24 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  headerGrad: {
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  saveBtn: {
    minWidth: 64,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  saveTxt: { color: '#fff', fontWeight: '800' },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  label: { fontWeight: '800', color: '#111827', marginBottom: 8 },

  input: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fafafa',
    color: '#111',
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },

  thumb: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  thumbImg: { width: '100%', height: '100%' },

  emptyBox: {
    height: 90,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#9ca3af', marginTop: 6 },
  thumbVideoWrap: { width: '100%', height: '100%', backgroundColor: '#000' },
  playBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
