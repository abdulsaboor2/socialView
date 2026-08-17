// App/Screens/AddStoryScreen.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import ProgressBar from 'react-native-progress/Bar';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import AppButton from '../Components/AppButton';

const GRADIENT = ['#7c3aed', '#db2777'];
const COLORS = {
  bg: '#f6f7fb',
  card: '#ffffff',
  text: '#111827',
  sub: '#6b7280',
  line: '#e5e7eb',
  primary: '#7c3aed',
  primary2: '#db2777',
  chip: '#f3e8ff',
};

export default function AddStoryScreen({ navigation }) {
  const me = auth().currentUser;
  const insets = useSafeAreaInsets();

  // Picker state
  const [asset, setAsset] = useState(null); // { uri, type, fileName, base64?, duration? }
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // "Your Story" state (last 24h)
  const [hasRecentStory, setHasRecentStory] = useState(false);
  const [latestStoryId, setLatestStoryId] = useState(null);
  const [myRecentStories, setMyRecentStories] = useState([]); // to open viewer stack
  const [myLatestThumb, setMyLatestThumb] = useState(null);

  // My current privacy setting — stamped onto every story the same way
  // it's stamped onto every post, so the Stories security rule
  // (authorPrivacy == 'public' OR userId == request.auth.uid) can
  // actually evaluate it. Without this, posting a story with no
  // authorPrivacy field gets denied outright by that rule.
  const [myPrivacy, setMyPrivacy] = useState('public');

  const cutoff = useMemo(() => Date.now() - 24 * 60 * 60 * 1000, []);

  useEffect(() => {
    if (!me) return;

    const load = async () => {
      try {
        const [storiesSnap, userDoc] = await Promise.all([
          firestore().collection('Stories').where('userId', '==', me.uid).get(),
          firestore().collection('Users').doc(me.uid).get(),
        ]);

        const all = [];
        storiesSnap.forEach(doc => all.push({ id: doc.id, ...doc.data() }));

        // client-side filter & sort (avoids composite index)
        const recent = all
          .filter(s => (s?.createdAt?.toMillis?.() ?? 0) >= cutoff)
          .sort(
            (a, b) =>
              (b?.createdAt?.toMillis?.() ?? 0) -
              (a?.createdAt?.toMillis?.() ?? 0),
          );

        setMyRecentStories(recent);
        const latest = recent[0] || null;
        setHasRecentStory(!!latest);
        setLatestStoryId(latest?.id || null);
        setMyLatestThumb(
          latest?.image || latest?.videoThumb || (me?.photoURL ?? null),
        );

        const userData = userDoc.data() || {};
        setMyPrivacy(
          userData.profilePrivacy === 'private' ? 'private' : 'public',
        );
      } catch (e) {
        console.warn('recent-story check failed:', e?.message || e);
        setHasRecentStory(false);
        setLatestStoryId(null);
        setMyRecentStories([]);
        setMyLatestThumb(null);
      }
    };

    load();
  }, [me?.uid, cutoff]);

  const openMyStory = () => {
    if (!myRecentStories.length) {
      chooseMedia();
      return;
    }
    navigation.navigate('StoryScreen', {
      stories: myRecentStories,
      isCurrentUser: true,
      startIndex: 0,
    });
  };

  const chooseMedia = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: 1,
        includeBase64: true,
        quality: 0.92,
        videoQuality: 'high',
        durationLimit: 60,
      });

      if (res.didCancel) return;
      if (res.errorCode) {
        Alert.alert('Picker Error', res.errorMessage || res.errorCode);
        return;
      }

      const a = res.assets?.[0];
      if (!a?.uri) {
        Alert.alert('Error', 'No media returned from picker.');
        return;
      }

      setAsset({
        uri: a.uri,
        type: a.type,
        fileName: a.fileName || `story_${Date.now()}`,
        base64: a.base64 || null,
        duration: a.duration ? Math.round(a.duration) : null,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to open gallery.');
    }
  };

  const getMyAvatar = async (uid, fallbackUrl) => {
    try {
      const snap = await firestore().collection('Users').doc(uid).get();
      const data = snap.data();
      return data?.image || fallbackUrl || null;
    } catch {
      return fallbackUrl || null;
    }
  };

  const uploadToStorage = async () => {
    if (!me) {
      Alert.alert('Auth', 'You must be logged in.');
      return null;
    }
    if (!asset) {
      Alert.alert('Select', 'Please choose a photo or video.');
      return null;
    }

    setUploading(true);
    setProgress(0);

    const isVideo = !!asset.type?.startsWith('video');
    const ext =
      asset.fileName?.split('.').pop()?.toLowerCase() ||
      (isVideo ? 'mp4' : 'jpg');
    const path = `Stories/${me.uid}/${Date.now()}.${ext}`;
    const ref = storage().ref(path);

    try {
      if (isVideo) {
        const task = ref.putFile(asset.uri, {
          contentType: asset.type || 'video/mp4',
        });
        task.on('state_changed', snap => {
          if (snap.totalBytes) {
            setProgress(
              Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
            );
          }
        });
        await task;
      } else if (asset.base64) {
        const task = ref.putString(asset.base64, 'base64', {
          contentType: asset.type || 'image/jpeg',
        });
        task.on('state_changed', snap => {
          if (snap.totalBytes) {
            setProgress(
              Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
            );
          }
        });
        await task;
      } else {
        const task = ref.putFile(asset.uri, {
          contentType: asset.type || 'image/jpeg',
        });
        task.on('state_changed', snap => {
          if (snap.totalBytes) {
            setProgress(
              Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
            );
          }
        });
        await task;
      }

      const url = await ref.getDownloadURL();
      return {
        url,
        isVideo,
        contentType: asset.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      };
    } catch (e) {
      console.log('Upload error:', e);
      Alert.alert('Upload Error', e?.message || 'Could not upload media.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const writeStory = async (download, { replace = false } = {}) => {
    if (!me || !download) return;

    const ownerAvatar = await getMyAvatar(me.uid, me.photoURL || null);

    const payload = {
      userId: me.uid,
      username: me.displayName || me.email?.split('@')[0] || 'Me',
      ownerAvatar: ownerAvatar || null,
      authorPrivacy: myPrivacy, // NEW — required by the Stories security rule
      createdAt: firestore.FieldValue.serverTimestamp(),
      views: 0,
    };

    if (download.isVideo) {
      payload.video = download.url;
      payload.videoDuration = Math.min(asset?.duration || 60, 60);
    } else {
      payload.image = download.url;
    }

    if (replace && latestStoryId) {
      await firestore()
        .collection('Stories')
        .doc(latestStoryId)
        .set(payload, { merge: true });
    } else {
      await firestore().collection('Stories').add(payload);
    }
  };

  const onSubmit = async (replace = false) => {
    const uploaded = await uploadToStorage();
    if (!uploaded) return;

    try {
      await writeStory(uploaded, { replace });
      Alert.alert(
        'Story',
        replace ? 'Replaced your latest story.' : 'Story posted!',
      );
      navigation.goBack();
    } catch (e) {
      console.log('Firestore write error:', e);
      Alert.alert('Error', 'Failed to save story.');
    }
  };

  const isVideo = !!asset?.type?.startsWith('video');

  return (
    <View style={styles.root}>
      {/* Header — matches the gradient header used across EditProfileScreen /
          UserProfile, with a real safe-area top inset so it never sits
          behind a status bar / punch-hole camera. */}
      <LinearGradient colors={GRADIENT} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add to Story</Text>
            <View style={styles.iconBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Your Story */}
        <TouchableOpacity
          onPress={openMyStory}
          activeOpacity={0.85}
          style={styles.card}
        >
          <View style={styles.myRow}>
            <LinearGradient colors={GRADIENT} style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {myLatestThumb ? (
                  <Image
                    source={{ uri: myLatestThumb }}
                    style={styles.myThumb}
                  />
                ) : (
                  <View style={[styles.myThumb, styles.myThumbEmpty]}>
                    <Ionicons name="add" size={24} color={COLORS.primary} />
                  </View>
                )}
              </View>
            </LinearGradient>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={styles.myTitle}>
                {hasRecentStory ? 'Your Story' : 'Add Story'}
              </Text>
              <Text style={styles.mySubtitle}>
                {hasRecentStory ? 'Tap to view' : 'Tap to add a photo or video'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.sub} />
          </View>
        </TouchableOpacity>

        {/* New story */}
        <Text style={styles.sectionLabel}>NEW STORY</Text>

        {!asset ? (
          <TouchableOpacity
            onPress={chooseMedia}
            activeOpacity={0.85}
            style={styles.pickerCard}
            disabled={uploading}
          >
            <View style={styles.pickerIconCircle}>
              <Ionicons
                name="images-outline"
                size={26}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.pickerTitle}>Choose photo or video</Text>
            <Text style={styles.pickerSubtitle}>Videos up to 60 seconds</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.card}>
            <View style={styles.previewWrap}>
              {isVideo ? (
                <Video
                  source={{ uri: asset.uri }}
                  style={styles.preview}
                  resizeMode="cover"
                  paused
                />
              ) : (
                <Image
                  source={{ uri: asset.uri }}
                  style={styles.preview}
                  resizeMode="cover"
                />
              )}

              <View style={styles.mediaTypeBadge}>
                <Ionicons
                  name={isVideo ? 'videocam' : 'image'}
                  size={13}
                  color="#fff"
                />
              </View>

              <TouchableOpacity
                onPress={chooseMedia}
                style={styles.changeBadge}
                disabled={uploading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="swap-horizontal" size={14} color="#fff" />
                <Text style={styles.changeBadgeText}>Change</Text>
              </TouchableOpacity>
            </View>

            {uploading ? (
              <View style={styles.progressWrap}>
                <ProgressBar
                  progress={progress / 100}
                  width={null}
                  height={8}
                  color={COLORS.primary}
                  unfilledColor="#ede9fe"
                  borderWidth={0}
                  borderRadius={4}
                />
                <Text style={styles.progressText}>Uploading… {progress}%</Text>
              </View>
            ) : (
              <View style={styles.actionsWrap}>
                <AppButton
                  title="Post to Story"
                  onPress={() => onSubmit(false)}
                  color={COLORS.primary}
                  leftIcon="paper-plane-outline"
                />

                {hasRecentStory && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => onSubmit(true)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={17}
                      color={COLORS.primary}
                    />
                    <Text style={styles.secondaryBtnText}>
                      Replace latest story
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 14,
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 6,
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

  content: { padding: 16 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 16,
  },

  myRow: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#fff',
    padding: 2,
  },
  myThumb: { width: '100%', height: '100%', borderRadius: 28 },
  myThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.chip,
  },
  myTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  mySubtitle: { color: COLORS.sub, marginTop: 2, fontSize: 13 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.sub,
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 2,
  },

  pickerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
    paddingVertical: 36,
    alignItems: 'center',
    marginBottom: 16,
  },
  pickerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  pickerSubtitle: { fontSize: 12, color: COLORS.sub, marginTop: 4 },

  previewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    aspectRatio: 9 / 12,
    maxHeight: 380,
  },
  preview: { width: '100%', height: '100%' },
  mediaTypeBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
  },
  changeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  progressWrap: { marginTop: 14, alignItems: 'center' },
  progressText: {
    marginTop: 8,
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: '600',
  },

  actionsWrap: { marginTop: 14, gap: 10 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#faf5ff',
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
});
