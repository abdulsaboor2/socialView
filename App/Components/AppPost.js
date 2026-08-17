// App/Components/AppPost.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Share from 'react-native-share';
import AntDesign from 'react-native-vector-icons/AntDesign';
import Feather from 'react-native-vector-icons/Feather';
import MediaCarousel from './MediaCarousel';
import PostMoreMenu from './PostMoreMenu';
import { normalizeFirebaseDownloadUrl } from '../utils/fbUrl';
import { toggleLike as toggleLikeShared } from '../utils/postService';

const PAGE_SIZE = 8;
const { width } = Dimensions.get('window');

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const GRID_TILE_SIZE = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const COLORS = {
  bg: '#F6F7FB',
  card: '#ffffff',
  text: '#111827',
  sub: '#6B7280',
  line: '#E5E7EB',
  like: '#EF4444',
  primary: '#7c3aed',
  primary2: '#db2777',
  icon: '#737373',
};

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 60 };

const toUrlString = v => {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return v.uri || v.url || '';
  return '';
};

const fixFirebaseUrl = u => {
  if (!u) return u;
  let v = u.replace(/%252F/gi, '%2F');
  v = v.replace(/\\u0026/gi, '&');
  return normalizeFirebaseDownloadUrl(v);
};

const looksLikeVideo = (url, type) => {
  if (type && String(type).toLowerCase().includes('video')) return true;
  const u = toUrlString(url);
  return /\.(mp4|mov|m4v|webm|avi)$/i.test(u);
};

const timeAgo = ts => {
  if (!ts) return '';
  const d = ts?.toDate
    ? ts.toDate()
    : typeof ts === 'number'
    ? new Date(ts)
    : ts;
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d`;
  const w = Math.floor(day / 7);
  if (w < 5) return `${w}w`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo`;
  const y = Math.floor(day / 365);
  return `${y}y`;
};

const formatCompactNumber = n => {
  const num = Number(n) || 0;
  if (num < 1000) return String(num);
  if (num < 1000000) {
    const v = num / 1000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  const v = num / 1000000;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
};

const PressScale = memo(function PressScale({
  onPress,
  children,
  style,
  accessibilityLabel,
  hitSlop,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.82,
      useNativeDriver: true,
      speed: 50,
      bounciness: 6,
    }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
});

const Skeleton = memo(function Skeleton() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
    ).start();
  }, [shimmer]);
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });
  return (
    <View style={styles.feedItem}>
      <View style={styles.userBar}>
        <View style={styles.skelAvatar} />
        <View style={{ flex: 1 }}>
          <View style={[styles.skelLine, { width: 140, marginBottom: 6 }]} />
          <View style={[styles.skelLine, { width: 90 }]} />
        </View>
      </View>
      <View style={styles.postMedia}>
        <Animated.View
          style={[styles.shimmer, { transform: [{ translateX }] }]}
        />
      </View>
      <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <View style={[styles.skelLine, { width: 80, marginBottom: 6 }]} />
        <View style={[styles.skelLine, { width: '90%' }]} />
      </View>
    </View>
  );
});

const GridTile = memo(function GridTile({ item, isLastInRow, onPress }) {
  const mediaUrl = toUrlString(item.media?.[0]);
  const isVideo = looksLikeVideo(mediaUrl, item.type);
  const hasMultiple = (item.media || []).length > 1;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(item)}
      style={[styles.gridTile, !isLastInRow && { marginRight: GRID_GAP }]}
      accessibilityRole="button"
      accessibilityLabel={isVideo ? 'Open video post' : 'Open photo post'}
    >
      {isVideo ? (
        <View style={[styles.gridMedia, styles.gridVideoPlaceholder]}>
          <Feather name="play" size={22} color="rgba(255,255,255,0.9)" />
        </View>
      ) : (
        <Image
          source={{ uri: fixFirebaseUrl(mediaUrl) }}
          style={styles.gridMedia}
        />
      )}
      {hasMultiple && (
        <View style={styles.gridBadge}>
          <Feather name="copy" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
});

const PostRow = memo(function PostRow({
  item,
  isViewable,
  onToggleLike,
  onNavigate,
  onShare,
  onDeleted,
}) {
  const tapTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);
  const TAP_DELAY = 230;
  const mediaUrl = toUrlString(item.media?.[0]);
  const isVideo = looksLikeVideo(mediaUrl, item.type);
  const heartScale = useRef(new Animated.Value(0)).current;
  const bounceLike = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        stiffness: 260,
        damping: 18,
      }),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();
  }, [heartScale]);
  const paused = isVideo ? !isViewable : true;
  const handleMediaPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_DELAY) {
      lastTapRef.current = 0;
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (!item.isLiked) {
        bounceLike();
        onToggleLike(item.id);
      }
      return;
    }
    lastTapRef.current = now;
    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null;
      onNavigate('Post', { ...item });
    }, TAP_DELAY);
  };
  useEffect(
    () => () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    },
    [],
  );
  const [expanded, setExpanded] = useState(false);
  const hasLongCaption = (item.caption || '').length > 120;
  const shownCaption = useMemo(() => {
    if (!item.caption) return '';
    return expanded ? item.caption : item.caption.slice(0, 120);
  }, [expanded, item.caption]);
  const totalComments = Number(item.comments) || 0;
  const previewCount = item.topComments?.length || 0;
  return (
    <View style={styles.feedItem}>
      <View style={styles.userBar}>
        <TouchableOpacity
          onPress={() => onNavigate('User Profile', { token: item.uid })}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.displayName || 'user'}'s profile`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient
              colors={['#a78bfa', '#f472b6']}
              style={styles.avatarRing}
            >
              <Image
                source={
                  item.photoURL
                    ? { uri: fixFirebaseUrl(item.photoURL) }
                    : require('../Images/defaultProfile.png')
                }
                style={styles.profileImage}
                fadeDuration={0}
                resizeMethod="resize"
              />
            </LinearGradient>
            <View style={{ marginLeft: 10, maxWidth: width - 160 }}>
              <Text style={styles.displayName} numberOfLines={1}>
                {item.displayName || 'User'}
              </Text>
              <Text style={styles.timeAgo}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <PostMoreMenu
          post={item}
          onEditCaption={payload => onNavigate('Edit Post', payload)}
          onDeleted={() => onDeleted?.(item.id)}
        />
      </View>
      <View style={styles.postMedia} renderToHardwareTextureAndroid>
        <MediaCarousel
          media={item.media || []}
          mediaMeta={item.mediaMeta || []}
          isViewable={isViewable}
          paused={paused}
          onSlidePress={handleMediaPress}
          mode="feed"
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bigHeart,
            {
              transform: [
                {
                  scale: heartScale.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 1],
                  }),
                },
              ],
              opacity: heartScale,
            },
          ]}
        >
          <AntDesign name="heart" size={88} color={COLORS.like} />
        </Animated.View>
      </View>
      <View style={styles.iconBar}>
        <View style={styles.iconGroup}>
          <View style={styles.actionPill}>
            <PressScale
              onPress={() => {
                if (!item.isLiked) bounceLike();
                onToggleLike(item.id);
              }}
              hitSlop={8}
              accessibilityLabel={item.isLiked ? 'Unlike post' : 'Like post'}
            >
              <AntDesign
                name={item.isLiked ? 'heart' : 'hearto'}
                size={24}
                color={item.isLiked ? COLORS.like : COLORS.icon}
              />
            </PressScale>
            {Number(item.likes) > 0 && (
              <TouchableOpacity
                onPress={() => onNavigate('Liked By', { postId: item.id })}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`See who liked this post — ${item.likes} likes`}
              >
                <Text
                  style={[
                    styles.actionCount,
                    item.isLiked && styles.actionCountActive,
                  ]}
                >
                  {formatCompactNumber(item.likes)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <PressScale
            style={styles.actionPill}
            onPress={() => onNavigate('Post', item)}
            hitSlop={8}
            accessibilityLabel="View comments"
          >
            <Feather name="message-circle" size={24} color={COLORS.icon} />
            {totalComments > 0 && (
              <Text style={styles.actionCount}>
                {formatCompactNumber(totalComments)}
              </Text>
            )}
          </PressScale>
          <PressScale
            style={styles.actionPill}
            onPress={() => onShare(item)}
            hitSlop={8}
            accessibilityLabel="Share post"
          >
            <Feather name="share" size={24} color={COLORS.icon} />
          </PressScale>
        </View>
      </View>
      {!!item.caption && (
        <Text style={styles.description}>
          {shownCaption}
          {hasLongCaption && !expanded ? (
            <Text onPress={() => setExpanded(true)} style={styles.moreLess}>
              {' '}
              more
            </Text>
          ) : hasLongCaption ? (
            <Text onPress={() => setExpanded(false)} style={styles.moreLess}>
              {' '}
              less
            </Text>
          ) : null}
        </Text>
      )}
      {previewCount > 0 && (
        <View style={styles.commentsSection}>
          {item.topComments.slice(0, 3).map((c, i) => (
            <Text key={i} style={styles.comment}>
              <Text style={styles.commentAuthor}>{c.displayName}: </Text>
              {c.text}
            </Text>
          ))}
          {totalComments > previewCount ? (
            <TouchableOpacity onPress={() => onNavigate('Post', item)}>
              <Text style={styles.viewComments}>
                View all {totalComments} comments
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => onNavigate('Post', item)}>
              <Text style={styles.viewComments}>View comments</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {previewCount === 0 && totalComments > 0 && (
        <TouchableOpacity
          onPress={() => onNavigate('Post', item)}
          style={styles.commentsSection}
        >
          <Text style={styles.viewComments}>
            View all {totalComments} comments
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const AppPost = ({
  handleNavigation = () => {},
  profileUser = false,
  userId,
  headerComponent = null,
  contentContainerStyle = undefined,
  embedded = false,
  liveListenersMode = 'visible',
  emptyComponent = null,
  onItemsChange = null,
  layout = 'feed',
  searchQuery = '', // NEW
}) => {
  const currentUserId = auth().currentUser?.uid || '';
  const isMainFeed = !(profileUser && userId);
  const isGrid = layout === 'grid';
  const [items, setItems] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [cursorPublic, setCursorPublic] = useState(null);
  const [cursorOwn, setCursorOwn] = useState(null);
  const [endReached, setEndReached] = useState(false);
  const [errorText, setErrorText] = useState('');
  const mountedRef = useRef(true);
  const userCacheRef = useRef(new Map());
  const docSubsRef = useRef(new Map());
  const viewableItemsRef = useRef(new Set());
  const [, forceViewableRerender] = useState(0);

  const hiddenUidsRef = useRef(new Set());
  const [hiddenUids, setHiddenUids] = useState(() => new Set());

  useEffect(() => {
    if (!currentUserId) {
      hiddenUidsRef.current = new Set();
      setHiddenUids(new Set());
      return;
    }
    const blockedByMe = new Set();
    const blockedMe = new Set();
    const recompute = () => {
      const next = new Set([...blockedByMe, ...blockedMe]);
      hiddenUidsRef.current = next;
      setHiddenUids(next);
    };
    const unsub1 = firestore()
      .collection('Blocks')
      .where('blockerId', '==', currentUserId)
      .onSnapshot(
        snap => {
          blockedByMe.clear();
          snap.forEach(d => blockedByMe.add(d.data().blockedId));
          recompute();
        },
        () => {},
      );
    const unsub2 = firestore()
      .collection('Blocks')
      .where('blockedId', '==', currentUserId)
      .onSnapshot(
        snap => {
          blockedMe.clear();
          snap.forEach(d => blockedMe.add(d.data().blockerId));
          recompute();
        },
        () => {},
      );
    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (hiddenUids.size === 0) return;
    setItems(prev => {
      const toRemove = prev.filter(p => hiddenUids.has(p.uid));
      if (toRemove.length === 0) return prev;
      toRemove.forEach(p => {
        const unsub = docSubsRef.current.get(p.id);
        if (unsub) {
          try {
            unsub();
          } catch (e) {}
          docSubsRef.current.delete(p.id);
        }
      });
      return prev.filter(p => !hiddenUids.has(p.uid));
    });
  }, [hiddenUids]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      docSubsRef.current.forEach(unsub => {
        try {
          unsub();
        } catch (e) {}
      });
      docSubsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    onItemsChange?.(items.length);
  }, [items.length, onItemsChange]);

  useEffect(() => {
    if (!currentUserId) return;
    const unsub = firestore()
      .collection('Users')
      .doc(currentUserId)
      .onSnapshot(doc => {
        const nextURL = doc.data()?.photoURL || doc.data()?.image || '';
        setItems(prev =>
          prev.map(p =>
            p.uid === currentUserId ? { ...p, photoURL: nextURL } : p,
          ),
        );
        if (nextURL) {
          const cached = userCacheRef.current.get(currentUserId) || {};
          userCacheRef.current.set(currentUserId, {
            ...cached,
            photoURL: nextURL,
          });
        }
      });
    return () => unsub();
  }, [currentUserId]);

  const upsertItemFromSnap = useCallback(
    docSnap => {
      const id = docSnap.id;
      const d = docSnap.data();
      setItems(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx === -1) return prev;
        if (!d) return prev.filter(p => p.id !== id);
        const likedBy = Array.isArray(d.likedBy) ? d.likedBy : [];
        const isLiked = currentUserId ? likedBy.includes(currentUserId) : false;
        const current = prev[idx];
        let changed = isLiked !== current.isLiked;
        if (!changed) {
          for (const key in d) {
            if (d[key] !== current[key]) {
              changed = true;
              break;
            }
          }
        }
        if (!changed) return prev;
        const newItems = [...prev];
        newItems[idx] = { ...current, ...d, isLiked };
        return newItems;
      });
    },
    [currentUserId],
  );

  const attachDocListener = useCallback(
    id => {
      if (!id || docSubsRef.current.has(id)) return;
      const unsub = firestore()
        .collection('Posts')
        .doc(id)
        .onSnapshot(
          snap => {
            if (!snap.exists) {
              setItems(prev => prev.filter(p => p.id !== id));
              try {
                unsub();
              } catch (e) {}
              docSubsRef.current.delete(id);
              return;
            }
            upsertItemFromSnap(snap);
          },
          err => {
            console.warn('Post listener error:', err);
            if (err?.code === 'permission-denied') {
              setItems(prev => prev.filter(p => p.id !== id));
              docSubsRef.current.delete(id);
            }
          },
        );
      docSubsRef.current.set(id, unsub);
    },
    [upsertItemFromSnap],
  );

  const buildQuery = useCallback(() => {
    let q = firestore().collection('Posts');
    if (profileUser && userId) {
      q = q.where('uid', '==', userId);
      if (userId !== currentUserId) {
        q = q.where('authorPrivacy', '==', 'public');
      }
    }
    return q.orderBy('createdAt', 'desc').orderBy('__name__', 'desc');
  }, [profileUser, userId, currentUserId]);

  const hydrateDoc = useCallback(
    async docSnap => {
      const data = docSnap.data() || {};
      const docId = docSnap.id;
      let cached = userCacheRef.current.get(data.uid);
      if (!cached) {
        try {
          const userDoc = await firestore()
            .collection('Users')
            .doc(data.uid)
            .get();
          const u = userDoc.data() || {};
          cached = {
            displayName: u.displayName || u.name || 'User',
            photoURL: u.photoURL || u.image || '',
          };
          userCacheRef.current.set(data.uid, cached);
        } catch (error) {
          cached = {
            displayName: 'User',
            photoURL: '',
          };
        }
      }
      const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
      const isLiked = currentUserId ? likedBy.includes(currentUserId) : false;
      return {
        id: docId,
        ...data,
        ...cached,
        isLiked,
      };
    },
    [currentUserId],
  );

  const fetchPage = useCallback(
    async (mode = 'next') => {
      if (isFetching || (endReached && mode !== 'refresh')) return;
      setIsFetching(true);
      setErrorText('');
      try {
        let docs = [];
        if (isMainFeed) {
          let publicQ = firestore()
            .collection('Posts')
            .where('authorPrivacy', '==', 'public')
            .orderBy('createdAt', 'desc')
            .orderBy('__name__', 'desc')
            .limit(PAGE_SIZE);
          let ownQ = firestore()
            .collection('Posts')
            .where('uid', '==', currentUserId || '__signed_out__')
            .orderBy('createdAt', 'desc')
            .orderBy('__name__', 'desc')
            .limit(PAGE_SIZE);
          if (mode === 'next') {
            if (cursorPublic) publicQ = publicQ.startAfter(cursorPublic);
            if (cursorOwn) ownQ = ownQ.startAfter(cursorOwn);
          }
          const [publicSnap, ownSnap] = await Promise.all([
            publicQ.get(),
            ownQ.get(),
          ]);
          const seenIds = new Set();
          const merged = [];
          ownSnap.docs.forEach(d => {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              merged.push(d);
            }
          });
          publicSnap.docs.forEach(d => {
            if (!seenIds.has(d.id)) {
              seenIds.add(d.id);
              merged.push(d);
            }
          });
          merged.sort((a, b) => {
            const at = a.data()?.createdAt?.toMillis?.() ?? 0;
            const bt = b.data()?.createdAt?.toMillis?.() ?? 0;
            return bt - at;
          });
          docs = merged;
          if (mountedRef.current) {
            setCursorPublic(
              publicSnap.docs.length
                ? publicSnap.docs[publicSnap.docs.length - 1]
                : cursorPublic,
            );
            setCursorOwn(
              ownSnap.docs.length
                ? ownSnap.docs[ownSnap.docs.length - 1]
                : cursorOwn,
            );
          }
          if (
            publicSnap.docs.length < PAGE_SIZE &&
            ownSnap.docs.length < PAGE_SIZE
          ) {
            setEndReached(true);
          }
        } else {
          let q = buildQuery().limit(PAGE_SIZE);
          if (mode === 'next' && cursor) q = q.startAfter(cursor);
          const snap = await q.get();
          docs = snap.docs;
          if (mountedRef.current) {
            setCursor(docs.length ? docs[docs.length - 1] : null);
          }
          if (docs.length < PAGE_SIZE) setEndReached(true);
        }
        if (hiddenUidsRef.current.size > 0) {
          docs = docs.filter(d => !hiddenUidsRef.current.has(d.data()?.uid));
        }
        const enriched = await Promise.all(docs.map(hydrateDoc));
        if (!mountedRef.current) return;
        if (mode === 'refresh') {
          docSubsRef.current.forEach(unsub => {
            try {
              unsub();
            } catch {}
          });
          docSubsRef.current.clear();
          setItems(enriched);
          if (liveListenersMode === 'all') {
            enriched.forEach(post => {
              attachDocListener(post.id);
            });
          }
        } else {
          setItems(prev => {
            const seen = new Set(prev.map(p => p.id));
            const fresh = enriched.filter(p => !seen.has(p.id));
            return [...prev, ...fresh];
          });
          if (liveListenersMode === 'all') {
            docs.forEach(doc => {
              attachDocListener(doc.id);
            });
          }
        }
      } catch (e) {
        console.warn('Fetch page error:', e);
        setErrorText('Could not load posts. Pull to refresh to try again.');
      } finally {
        if (mountedRef.current) {
          setIsFetching(false);
          if (mode === 'refresh') setRefreshing(false);
        }
      }
    },
    [
      isMainFeed,
      buildQuery,
      cursor,
      cursorPublic,
      cursorOwn,
      currentUserId,
      endReached,
      hydrateDoc,
      isFetching,
      liveListenersMode,
      attachDocListener,
    ],
  );

  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  useEffect(() => {
    userCacheRef.current.clear();
    setItems([]);
    setCursor(null);
    setCursorPublic(null);
    setCursorOwn(null);
    setEndReached(false);
    fetchPageRef.current('refresh');
  }, [profileUser, userId, currentUserId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(null);
    setCursorPublic(null);
    setCursorOwn(null);
    setEndReached(false);
    fetchPage('refresh');
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (!isFetching && !endReached && !errorText) fetchPage('next');
  }, [endReached, errorText, fetchPage, isFetching]);

  const likeThrottleRef = useRef(new Set());

  const toggleLike = useCallback(
    async postId => {
      if (!currentUserId || !postId) return;
      if (likeThrottleRef.current.has(postId)) return;
      likeThrottleRef.current.add(postId);
      let previousLiked = false;
      setItems(prev =>
        prev.map(p => {
          if (p.id !== postId) return p;
          previousLiked = Boolean(p.isLiked);
          return {
            ...p,
            isLiked: !previousLiked,
            likes: Math.max(Number(p.likes || 0) + (previousLiked ? -1 : 1), 0),
          };
        }),
      );
      try {
        await toggleLikeShared({ postId, currentUserId });
      } catch (error) {
        console.warn('Like toggle failed:', error);
        setItems(prev =>
          prev.map(p =>
            p.id === postId
              ? {
                  ...p,
                  isLiked: previousLiked,
                  likes: Math.max(
                    Number(p.likes || 0) + (previousLiked ? 1 : -1),
                    0,
                  ),
                }
              : p,
          ),
        );
      } finally {
        likeThrottleRef.current.delete(postId);
      }
    },
    [currentUserId],
  );

  const handleShare = useCallback(async item => {
    try {
      const url = toUrlString(item.media?.[0]);
      await Share.open({
        title: 'Share Post',
        message: `Check out this post from ${item.displayName}: ${
          item.caption || ''
        }`,
        url: url ? fixFirebaseUrl(url) : undefined,
      });
    } catch (error) {
      console.warn('Share failed:', error);
    }
  }, []);

  const handleRowDeleted = useCallback(postId => {
    setItems(prev => prev.filter(p => p.id !== postId));
  }, []);

  const keyExtractor = useCallback(item => String(item.id), []);

  const renderItemMemo = useCallback(
    ({ item, index }) => {
      if (isGrid) {
        const isLastInRow = (index + 1) % GRID_COLUMNS === 0;
        return (
          <GridTile
            item={item}
            isLastInRow={isLastInRow}
            onPress={it => handleNavigation('Post', it)}
          />
        );
      }
      return (
        <PostRow
          item={item}
          isViewable={viewableItemsRef.current.has(item.id)}
          onToggleLike={toggleLike}
          onNavigate={handleNavigation}
          onShare={handleShare}
          onDeleted={handleRowDeleted}
        />
      );
    },
    [isGrid, handleNavigation, handleRowDeleted, handleShare, toggleLike],
  );

  const onViewableItemsChanged = useRef(({ changed }) => {
    let mutated = false;
    changed.forEach(({ item, isViewable }) => {
      if (isViewable) {
        if (!viewableItemsRef.current.has(item.id)) mutated = true;
        viewableItemsRef.current.add(item.id);
        attachDocListener(item.id);
      } else {
        if (viewableItemsRef.current.has(item.id)) mutated = true;
        viewableItemsRef.current.delete(item.id);
        if (liveListenersMode !== 'all') {
          const unsub = docSubsRef.current.get(item.id);
          if (unsub) {
            try {
              unsub();
            } catch (e) {}
            docSubsRef.current.delete(item.id);
          }
        }
      }
    });
    if (mutated) forceViewableRerender(n => n + 1);
  }).current;

  // NEW: local search filter, applied over whatever's currently loaded in
  // `items`. Feed mode only — grid (profile) view ignores it. This does
  // NOT search posts beyond what's been fetched/paginated in.
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (isGrid || !q) return items;
    return items.filter(p => {
      const caption = (p.caption || '').toLowerCase();
      const name = (p.displayName || '').toLowerCase();
      return caption.includes(q) || name.includes(q);
    });
  }, [items, searchQuery, isGrid]);

  if (items.length === 0 && isFetching) {
    if (isGrid) {
      return (
        <View style={styles.gridSkeletonWrap}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.gridTile,
                styles.gridSkeletonTile,
                (i + 1) % GRID_COLUMNS !== 0 && { marginRight: GRID_GAP },
              ]}
            />
          ))}
        </View>
      );
    }
    return (
      <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </View>
    );
  }

  const defaultEmpty = (
    <View style={{ alignItems: 'center', marginTop: 32 }}>
      <Feather name="inbox" size={28} color="#9CA3AF" />
      <Text style={{ color: '#9CA3AF', marginTop: 8 }}>
        {profileUser ? 'No posts yet.' : 'No posts to show.'}
      </Text>
    </View>
  );

  // NEW: distinct empty state for "search found nothing in what's
  // currently loaded" vs. "there's genuinely nothing here at all".
  const searchEmpty = (
    <View style={{ alignItems: 'center', marginTop: 32 }}>
      <Feather name="search" size={28} color="#9CA3AF" />
      <Text style={{ color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
        No matches in your loaded feed.{'\n'}Scroll down to load more, then try
        again.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {errorText ? (
        <Text style={{ textAlign: 'center', color: '#d00', marginVertical: 8 }}>
          {errorText}
        </Text>
      ) : null}
      <FlatList
        data={filteredItems}
        keyExtractor={keyExtractor}
        renderItem={renderItemMemo}
        numColumns={isGrid ? GRID_COLUMNS : 1}
        key={isGrid ? 'grid' : 'feed'}
        ListHeaderComponent={headerComponent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          !isFetching
            ? searchQuery.trim() && items.length > 0
              ? searchEmpty
              : emptyComponent || defaultEmpty
            : null
        }
        ListFooterComponent={
          isFetching && items.length > 0 ? (
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
              style={{ marginVertical: 16 }}
            />
          ) : endReached && items.length > 0 ? (
            <Text
              style={{ textAlign: 'center', color: '#999', marginVertical: 16 }}
            >
              No more posts
            </Text>
          ) : null
        }
        removeClippedSubviews={false}
        maxToRenderPerBatch={isGrid ? 12 : 6}
        updateCellsBatchingPeriod={100}
        windowSize={isGrid ? 8 : 10}
        initialNumToRender={isGrid ? 12 : 5}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
        contentContainerStyle={
          contentContainerStyle ||
          (isGrid ? undefined : { paddingBottom: 8, paddingHorizontal: 12 })
        }
        showsVerticalScrollIndicator={false}
        scrollEnabled={!embedded}
      />
    </View>
  );
};

const CARD_RADIUS = 16;
const styles = StyleSheet.create({
  feedItem: {
    backgroundColor: COLORS.card,
    marginBottom: 14,
    borderRadius: CARD_RADIUS,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 5 },
    }),
    overflow: 'hidden',
  },
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: COLORS.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  avatarRing: {
    padding: 2,
    borderRadius: 28,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
  },
  displayName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  timeAgo: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.sub,
  },
  postMedia: {
    width: '100%',
    height: width,
  },
  bigHeart: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 22,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  actionCount: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.sub,
  },
  actionCountActive: {
    color: COLORS.like,
  },
  description: {
    marginHorizontal: 12,
    marginBottom: 8,
    fontSize: 15,
    color: COLORS.text,
  },
  moreLess: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  commentsSection: {
    marginHorizontal: 12,
    marginBottom: 12,
  },
  comment: {
    fontSize: 14,
    color: COLORS.text,
  },
  commentAuthor: {
    fontWeight: '700',
  },
  viewComments: {
    marginTop: 6,
    color: COLORS.sub,
  },
  skelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    marginRight: 10,
  },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  gridTile: {
    width: GRID_TILE_SIZE,
    height: GRID_TILE_SIZE,
    marginBottom: GRID_GAP,
    backgroundColor: '#eee',
    position: 'relative',
  },
  gridMedia: {
    width: '100%',
    height: '100%',
  },
  gridVideoPlaceholder: {
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridSkeletonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridSkeletonTile: {
    backgroundColor: '#E5E7EB',
  },
});
export default AppPost;
