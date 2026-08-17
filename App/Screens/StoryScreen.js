// App/Screens/StoryScreen.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  PanResponder,
  Animated,
  Platform,
  StatusBar,
  TextInput,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';

import { normalizeFirebaseDownloadUrl } from '../utils/fbUrl';

const { width, height } = Dimensions.get('window');
const BAR_COUNT_MAX = 20;
const IMAGE_MS = 5000;
const VIDEO_CAP_MS = 60000; // 60s cap

const fixUrl = u => (u ? normalizeFirebaseDownloadUrl(u) : u);

export default function StoryScreen({ route, navigation }) {
  const me = auth().currentUser;
  const {
    stories: rawStories = [],
    isCurrentUser = false,
    startIndex = 0,
  } = route.params || {};

  const REACTIONS = useMemo(() => ['❤️', '😂', '😮', '🔥', '👏', '🙌'], []);

  const [viewCount, setViewCount] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // last 24h only
  const stories = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (rawStories || [])
      .filter(s => (s?.createdAt?.toMillis?.() ?? s?.createdAt ?? 0) > cutoff)
      .slice(0, BAR_COUNT_MAX);
  }, [rawStories]);

  // index/story MUST be declared before any callback that references them in
  // its dependency array (handleDeleteStory below) — declaring them after
  // (as in the previous version) caused a ReferenceError (temporal dead
  // zone) on every render, which crashed this screen before it could paint
  // anything. This was the actual "can't see the story" bug.
  const [index, setIndex] = useState(
    Math.min(Math.max(0, startIndex), Math.max(0, stories.length - 1)),
  );
  const story = stories[index];

  // Delete a Firebase Storage object given its download URL
  async function deleteStorageByUrl(url) {
    if (!url) return;
    try {
      const ref = storage().refFromURL(url);
      await ref.delete();
    } catch (e) {
      console.log('Storage delete skipped:', e?.message || e);
    }
  }

  const handleDeleteStory = useCallback(async () => {
    if (!isCurrentUser || !story?.id) return;

    Alert.alert(
      'Delete story',
      'Are you sure you want to delete this story?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([
                deleteStorageByUrl(story.image),
                deleteStorageByUrl(story.video),
                deleteStorageByUrl(story.videoThumb),
              ]);

              // NEW: `.where('ownerId', '==', me.uid)` added alongside the
              // existing storyId filter. Firestore security rules can't
              // protect a list query unless the query's own filters prove
              // the rule condition (see firestore.rules — StoryViews read
              // rule checks resource.data.ownerId == request.auth.uid).
              // Without this second filter, this query gets rejected
              // outright once real rules are deployed, since only owners
              // are allowed to list every viewer of a story.
              const viewsQ = await firestore()
                .collection('StoryViews')
                .where('storyId', '==', story.id)
                .where('ownerId', '==', me.uid)
                .get();

              const batch = firestore().batch();
              viewsQ.forEach(d => batch.delete(d.ref));

              const storyRef = firestore().collection('Stories').doc(story.id);
              batch.delete(storyRef);

              await batch.commit();

              if (index < stories.length - 1) {
                setIndex(i => i + 1);
              } else if (index > 0) {
                setIndex(i => i - 1);
              } else {
                navigation.goBack();
              }
            } catch (e) {
              Alert.alert('Error', e?.message || 'Failed to delete story.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  }, [
    isCurrentUser,
    story?.id,
    story?.image,
    story?.video,
    story?.videoThumb,
    index,
    stories.length,
    navigation,
  ]);

  const progress = useRef(stories.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (progress.length === stories.length) return;
    while (progress.length < stories.length)
      progress.push(new Animated.Value(0));
    while (progress.length > stories.length) progress.pop();
  }, [stories.length]); // eslint-disable-line

  const [paused, setPaused] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState(IMAGE_MS);
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
        onPanResponderMove: Animated.event([null, { dy: translateY }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 120) {
            Animated.timing(translateY, {
              toValue: height,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              navigation.goBack();
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [navigation, translateY],
  );

  useEffect(() => {
    if (!isCurrentUser || !story?.id) {
      setViewCount(0);
      return;
    }
    // NEW: `.where('ownerId', '==', me.uid)` added — same reasoning as the
    // delete query above. This listener only ever runs for the story's
    // owner (guarded by isCurrentUser), so the filter doesn't change what
    // the owner sees — it just makes the query provably safe under rules.
    const unsub = firestore()
      .collection('StoryViews')
      .where('storyId', '==', story.id)
      .where('ownerId', '==', me.uid)
      .onSnapshot(
        snap => setViewCount(snap.size || 0),
        () => setViewCount(0),
      );
    return () => unsub();
  }, [isCurrentUser, story?.id]);

  const markSeen = useCallback(
    async s => {
      if (!me || !s?.id) return;
      if (me.uid === s.userId) return;

      const storyRef = firestore().collection('Stories').doc(s.id);
      const viewRef = firestore()
        .collection('StoryViews')
        .doc(`${s.id}_${me.uid}`);

      let viewerName = me.displayName || me.email || 'Someone';
      let viewerProfile = me.photoURL || null;
      try {
        const prof = await firestore().collection('Users').doc(me.uid).get();
        const pd = prof.data();
        if (pd) {
          viewerName = pd.name || pd.displayName || viewerName;
          viewerProfile = pd.image || pd.photoURL || viewerProfile;
        }
      } catch {}

      await firestore()
        .runTransaction(async tx => {
          const snap = await tx.get(viewRef);
          if (snap.exists) return;
          tx.set(viewRef, {
            storyId: s.id,
            // NEW: denormalized owner id, required by the StoryViews
            // security rule so owners can list/delete all views on their
            // own story without needing an unsafe unfiltered query.
            ownerId: s.userId,
            viewerUid: me.uid,
            viewerName,
            viewerProfile,
            viewedAt: firestore.FieldValue.serverTimestamp(),
          });
          tx.set(
            storyRef,
            { views: firestore.FieldValue.increment(1) },
            { merge: true },
          );
        })
        .catch(() => {});
    },
    [me],
  );

  const runProgress = useCallback(
    ms => {
      const bar = progress[index];
      if (!bar) return;
      bar.stopAnimation();
      bar.setValue(0);
      Animated.timing(bar, {
        toValue: 1,
        duration: ms,
        isInteraction: false,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) return;
        if (index < stories.length - 1) setIndex(i => i + 1);
        else navigation.goBack();
      });
    },
    [index, progress, stories.length, navigation],
  );

  const pause = useCallback(
    toPaused => {
      setPaused(toPaused);
      const bar = progress[index];
      if (!bar) return;
      if (toPaused) {
        bar.stopAnimation();
      } else {
        bar.stopAnimation(v => {
          const totalMs = story?.video ? videoDurationMs : IMAGE_MS;
          const remain = totalMs * (1 - v);
          runProgress(Math.max(200, remain));
        });
      }
    },
    [index, progress, story?.video, videoDurationMs, runProgress],
  );

  useEffect(() => {
    if (!story) return;
    setVideoReady(false);
    markSeen(story);

    if (!story.video) {
      setVideoDurationMs(IMAGE_MS);
      runProgress(IMAGE_MS);
    }
    const next = stories[index + 1];
    if (next?.image) Image.prefetch(fixUrl(next.image)).catch(() => {});
    progress.forEach((p, i) => {
      if (i < index) p.setValue(1);
      if (i > index) p.setValue(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, story?.id]);

  const onVideoLoad = meta => {
    const durMsRaw = Math.floor((meta?.duration || 0) * 1000);
    const durMs = Math.min(60000, Math.max(1500, durMsRaw));
    setVideoDurationMs(durMs);
    runProgress(durMs);
    setVideoReady(true);
  };

  // sendReply must be declared before sendReaction, since sendReaction's
  // useCallback depends on it — declaring it after (as in the previous
  // version) caused a "Cannot access 'sendReply' before initialization"
  // crash on every render.
  const sendReply = useCallback(
    async text => {
      const t = (text || '').trim();
      if (!me || !story?.userId || !t) return;
      try {
        const id = Math.random().toString(36).slice(2);
        const msgDoc = {
          _id: id,
          text: t,
          createdAt: new Date(),
          user: {
            _id: me.uid,
            name: me.displayName || 'Me',
            avatar: me.photoURL || '',
          },
          meta: { repliedToStoryId: story.id || null },
        };
        const myRef = firestore()
          .collection('Chats')
          .doc(me.uid)
          .collection(story.userId)
          .doc(id);
        const peerRef = firestore()
          .collection('Chats')
          .doc(story.userId)
          .collection(me.uid)
          .doc(id);
        await Promise.all([myRef.set(msgDoc), peerRef.set(msgDoc)]);
      } catch {}
    },
    [me, story?.id, story?.userId],
  );

  const sendReaction = useCallback(
    async emoji => {
      if (!emoji) return;
      await sendReply(emoji);
    },
    [sendReply],
  );

  const [textReply, setTextReply] = useState('');

  if (!story) return null;

  const isVideo = !!story.video;
  const avatarUri = fixUrl(story?.ownerAvatar || story?.avatar || null);
  const posterUri = fixUrl(
    story?.videoThumb || story?.image || story?.ownerAvatar || null,
  );
  const imageUri = fixUrl(story.image);
  const videoUri = fixUrl(story.video);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <Animated.View
        style={[styles.animateWrap, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView>
          <View style={styles.bars}>
            {stories.map((_, i) => (
              <View key={String(i)} style={styles.barBg}>
                <Animated.View
                  style={[styles.barFill, { flex: progress[i] }]}
                />
              </View>
            ))}
          </View>

          <View style={styles.topRow}>
            <View style={styles.userRow}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={18} color="#e5e7eb" />
                </View>
              )}
              <Text numberOfLines={1} style={styles.name}>
                {story.username || 'User'}
              </Text>
              <Text style={styles.timeDot}>•</Text>
              <Text style={styles.time}>{timeAgo(story.createdAt)}</Text>
            </View>

            <View
              style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}
            >
              {isCurrentUser && (
                <>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('StoryViewers', { storyId: story.id })
                    }
                    hitSlop={10}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Ionicons name="eye" size={20} color="#fff" />
                    <Text
                      style={{
                        color: '#fff',
                        marginLeft: 6,
                        fontWeight: '700',
                      }}
                    >
                      {viewCount}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleDeleteStory} hitSlop={10}>
                    <Ionicons name="trash-outline" size={22} color="#ffb4b4" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => navigation.navigate('AddStory')}
                    hitSlop={10}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Ionicons name="add-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.flexFill}>
          <TouchableWithoutFeedback
            onPressIn={() => pause(true)}
            onPressOut={() => pause(false)}
          >
            <View style={styles.mediaWrap}>
              {isVideo ? (
                <>
                  {!videoReady &&
                    (posterUri ? (
                      <Image
                        source={{ uri: posterUri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[StyleSheet.absoluteFill, styles.posterFallback]}
                      >
                        <Ionicons
                          name="play-circle"
                          size={72}
                          color="#e5e7eb"
                        />
                      </View>
                    ))}

                  <Video
                    source={{ uri: videoUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    paused={paused}
                    onLoad={onVideoLoad}
                    onError={() => runProgress(5000)}
                    poster={posterUri || undefined}
                    posterResizeMode="cover"
                    ignoreSilentSwitch="obey"
                  />

                  {!videoReady && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                    </View>
                  )}
                </>
              ) : (
                <Image
                  source={{ uri: imageUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              )}
            </View>
          </TouchableWithoutFeedback>

          <View style={styles.tapLayer}>
            <TouchableOpacity
              style={styles.sideTap}
              activeOpacity={1}
              onPress={() => {
                progress[index]?.setValue(0);
                if (index > 0) setIndex(i => i - 1);
                else navigation.goBack();
              }}
            />
            <TouchableOpacity
              style={styles.centerTap}
              activeOpacity={1}
              onPress={() => pause(!paused)}
            />
            <TouchableOpacity
              style={styles.sideTap}
              activeOpacity={1}
              onPress={() => {
                if (index < stories.length - 1) setIndex(i => i + 1);
                else navigation.goBack();
              }}
            />
          </View>
        </View>

        {!isCurrentUser && (
          <SafeAreaView>
            <View style={styles.replyRow}>
              {REACTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={styles.reactBtn}
                  onPress={() => sendReaction(r)}
                >
                  <Text style={styles.reactTxt}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.replyRow}>
              <TextInput
                value={textReply}
                onChangeText={setTextReply}
                placeholder="Send message"
                placeholderTextColor="#cbd5e1"
                style={styles.input}
                onFocus={() => pause(true)}
                onBlur={() => pause(false)}
              />
              <TouchableOpacity
                onPress={() => {
                  sendReply(textReply);
                  setTextReply('');
                }}
                style={styles.sendBtn}
              >
                <Ionicons name="send" size={18} color="#0b1220" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Animated.View>
    </View>
  );
}

function timeAgo(ts) {
  const ms = ts?.toMillis?.() ?? ts ?? Date.now();
  const diff = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  animateWrap: { flex: 1, backgroundColor: 'black' },
  bars: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'android' ? 8 : 6,
  },
  barBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { backgroundColor: '#fff', borderRadius: 3 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: width * 0.7,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#111827',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontWeight: '700', marginRight: 6 },
  timeDot: { color: '#cbd5e1', marginHorizontal: 4 },
  time: { color: '#cbd5e1' },
  flexFill: { flex: 1 },
  mediaWrap: { flex: 1 },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
  },
  tapLayer: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  sideTap: { flex: 0.25 },
  centerTap: { flex: 0.5 },
  reactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  reactTxt: { fontSize: 18, color: '#fff' },
  topRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderBottomColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: 'white',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#cfe4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
