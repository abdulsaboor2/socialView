// App/Screens/IndividualPostScreen.js
import 'react-native-get-random-values';
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
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Feather from 'react-native-vector-icons/Feather';
import AntDesign from 'react-native-vector-icons/AntDesign';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import Share from 'react-native-share';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardStickyView } from 'react-native-keyboard-controller';

import MediaCarousel from '../Components/MediaCarousel';
import PostMoreMenu from '../Components/PostMoreMenu';
import {
  toggleLike as toggleLikeShared,
  formatLikeCount,
} from '../utils/postService';

const { width } = Dimensions.get('window');
const PAGE_SIZE = 20;
const TAP_DELAY = 230;

const COLORS = {
  primary: '#7c3aed',
  primary2: '#db2777',
  text: '#111827',
  sub: '#6b7280',
  card: '#ffffff',
  line: '#E5E7EB',
  bg: '#f6f7fb',
};

const timeAgo = dateLike => {
  try {
    const d = dateLike?.toDate ? dateLike.toDate() : new Date(dateLike);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d`;
    const w = Math.floor(days / 7);
    if (w < 5) return `${w}w`;
    const mon = Math.floor(days / 30);
    if (mon < 12) return `${mon}mo`;
    const y = Math.floor(days / 365);
    return `${y}y`;
  } catch {
    return '';
  }
};

const getImageSource = (uri, fallback) =>
  uri && typeof uri === 'string' ? { uri } : fallback;

const CommentRow = memo(function CommentRow({
  item,
  currentUid,
  avatar,
  name,
  onOpenProfile,
  onDelete,
}) {
  const isMine = item.userId === currentUid;
  return (
    <View style={styles.commentContainer}>
      <View style={styles.commentInfo}>
        <TouchableOpacity
          onPress={() => onOpenProfile(item.userId)}
          hitSlop={8}
        >
          <Image
            source={
              avatar ? { uri: avatar } : require('../Images/defaultProfile.png')
            }
            style={styles.commentProfileImage}
          />
        </TouchableOpacity>
        <View style={styles.commentTextContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={styles.commentAuthor} numberOfLines={1}>
              {name}
            </Text>
            {!!item.createdAt && (
              <Text style={styles.commentTime}>
                {' '}
                · {timeAgo(item.createdAt)}
              </Text>
            )}
          </View>
          <Text style={styles.comment}>{item.comment}</Text>
        </View>

        {isMine ? (
          <TouchableOpacity
            hitSlop={8}
            onPress={() => onDelete(item.id, item.userId)}
            accessibilityRole="button"
            accessibilityLabel="Delete comment"
          >
            <Feather name="trash-2" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

export default function IndividualPostScreen({ route, navigation }) {
  const initial = route?.params || {};
  const postId = initial.id;
  const currentUid = auth().currentUser?.uid || null;

  const [post, setPost] = useState({
    id: postId || '',
    uid: initial.uid || '',
    displayName: initial.displayName || 'User',
    photoURL: initial.photoURL || '',
    caption: initial.caption || '',
    media: Array.isArray(initial.media) ? initial.media : [],
    mediaMeta: Array.isArray(initial.mediaMeta) ? initial.mediaMeta : [],
    type: initial.type || '',
    likes: Number(initial.likes || 0),
    isLiked: Boolean(initial.isLiked),
  });

  const [postUnavailable, setPostUnavailable] = useState(false);

  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentLimit, setCommentLimit] = useState(PAGE_SIZE);
  const [hasMoreComments, setHasMoreComments] = useState(true);

  const [userMap, setUserMap] = useState({});
  const commenterSubsRef = useRef(new Map());

  const lastTapRef = useRef(0);
  const likeThrottleRef = useRef(false);

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const burst = useCallback(() => {
    heartScale.setValue(0);
    heartOpacity.setValue(0.9);
    Animated.parallel([
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(heartOpacity, {
        toValue: 0,
        delay: 220,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heartOpacity, heartScale]);

  /* --------- Post subscription --------- */
  useEffect(() => {
    if (!postId) {
      setLoadingPost(false);
      return;
    }
    const unsub = firestore()
      .collection('Posts')
      .doc(postId)
      .onSnapshot(
        async snap => {
          const data = snap.data();
          if (!data) {
            setLoadingPost(false);
            return;
          }

          let displayName = data.displayName || initial.displayName || '';
          let photoURL = data.photoURL || initial.photoURL || '';
          if (!displayName || !photoURL) {
            try {
              const u = await firestore()
                .collection('Users')
                .doc(data.uid)
                .get();
              const ud = u.data() || {};
              displayName = displayName || ud.displayName || ud.name || 'User';
              photoURL = photoURL || ud.photoURL || ud.image || '';
            } catch {}
          }

          const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
          const isLiked = currentUid ? likedBy.includes(currentUid) : false;

          setPost(prev => ({
            id: snap.id,
            uid: data.uid,
            displayName: displayName || 'User',
            photoURL,
            caption: data.caption || '',
            media: Array.isArray(data.media) ? data.media : [],
            mediaMeta: Array.isArray(data.mediaMeta) ? data.mediaMeta : [],
            type: data.type || '',
            likes: Number(data.likes || 0),
            isLiked,
          }));
          setLoadingPost(false);
        },
        err => {
          console.warn('Post listener error:', err);
          setLoadingPost(false);
          if (err?.code === 'permission-denied') {
            setPostUnavailable(true);
            setPost(p => ({
              ...p,
              caption: '',
              media: [],
              mediaMeta: [],
              likes: 0,
            }));
          }
        },
      );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  /* --------- Comments subscription --------- */
  const commentsUnsubRef = useRef(null);
  const subscribeComments = useCallback(
    limit => {
      commentsUnsubRef.current && commentsUnsubRef.current();
      setLoadingComments(true);

      const unsub = firestore()
        .collection('Comments')
        .where('postId', '==', post.id)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .onSnapshot(
          snap => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setComments(list);
            setHasMoreComments(list.length >= limit);
            setLoadingComments(false);
          },
          () => setLoadingComments(false),
        );

      commentsUnsubRef.current = unsub;
    },
    [post.id],
  );

  useEffect(() => {
    if (!post.id || postUnavailable) {
      setLoadingComments(false);
      return;
    }
    subscribeComments(commentLimit);
    return () => {
      commentsUnsubRef.current && commentsUnsubRef.current();
    };
  }, [post.id, commentLimit, subscribeComments, postUnavailable]);

  /* --------- LIVE commenter profile joins --------- */
  useEffect(() => {
    const wanted = new Set(comments.map(c => c.userId).filter(Boolean));

    wanted.forEach(uid => {
      if (commenterSubsRef.current.has(uid)) return;
      const unsub = firestore()
        .collection('Users')
        .doc(uid)
        .onSnapshot(doc => {
          const d = doc.data() || {};
          setUserMap(prev => ({
            ...prev,
            [uid]: {
              displayName: d.displayName || d.name || 'User',
              photoURL: d.photoURL || d.image || '',
            },
          }));
        });
      commenterSubsRef.current.set(uid, unsub);
    });

    commenterSubsRef.current.forEach((unsub, uid) => {
      if (!wanted.has(uid)) {
        try {
          unsub();
        } catch {}
        commenterSubsRef.current.delete(uid);
      }
    });

    return () => {};
  }, [comments]);

  useEffect(() => {
    return () => {
      commenterSubsRef.current.forEach(u => {
        try {
          u();
        } catch {}
      });
      commenterSubsRef.current.clear();
    };
  }, []);

  /* --------- Add / Delete comment (optimistic) --------- */
  const handleAddComment = useCallback(async () => {
    const txt = (comment || '').trim();
    if (!txt || !currentUid || !post.id) return;

    const user = auth().currentUser;
    const localId = uuidv4();

    const optimistic = {
      id: localId,
      postId: post.id,
      userId: currentUid,
      commenterName: user?.displayName || 'Anonymous',
      commenterProfile: user?.photoURL || '',
      comment: txt,
      createdAt: new Date(),
    };

    setComments(prev => [optimistic, ...prev]);
    setComment('');

    try {
      await firestore()
        .collection('Comments')
        .doc(localId)
        .set({
          ...optimistic,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      await firestore()
        .collection('Posts')
        .doc(post.id)
        .set({ comments: firestore.FieldValue.increment(1) }, { merge: true });
    } catch (e) {
      setComments(prev => prev.filter(c => c.id !== localId));
      setComment(txt);
      Alert.alert('Error', 'Could not post your comment. Please try again.');
    }
  }, [comment, currentUid, post.id]);

  const handleDeleteComment = useCallback(
    (commentId, ownerId) => {
      if (!currentUid || currentUid !== ownerId) return;
      Alert.alert('Delete comment?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const prev = comments;
            setComments(p => p.filter(c => c.id !== commentId));
            try {
              await firestore().collection('Comments').doc(commentId).delete();
              await firestore()
                .collection('Posts')
                .doc(post.id)
                .set(
                  { comments: firestore.FieldValue.increment(-1) },
                  { merge: true },
                );
            } catch {
              setComments(prev);
              Alert.alert('Error', 'Could not delete the comment.');
            }
          },
        },
      ]);
    },
    [comments, currentUid, post.id],
  );

  /* --------- Like / Share --------- */
  const handleLikePress = useCallback(async () => {
    if (likeThrottleRef.current || !currentUid || !post.id) {
      return;
    }

    likeThrottleRef.current = true;

    try {
      await toggleLikeShared({
        postId: post.id,
        currentUserId: currentUid,
      });
    } catch (error) {
      console.warn('Like toggle failed:', error);
    } finally {
      likeThrottleRef.current = false;
    }
  }, [currentUid, post.id]);

  const handleShare = useCallback(async () => {
    try {
      await Share.open({
        title: 'Check out this post!',
        message: `${post.displayName || 'Someone'}: ${post.caption || ''}`,
        url: post.media?.[0],
      });
    } catch {}
  }, [post.caption, post.displayName, post.media]);

  const onMediaTap = useCallback(() => {
    const now = Date.now();

    if (now - lastTapRef.current < TAP_DELAY) {
      lastTapRef.current = 0;

      if (!post.isLiked) {
        burst();
        handleLikePress();
      }

      return;
    }

    lastTapRef.current = now;
  }, [burst, handleLikePress, post.isLiked]);

  const openProfile = useCallback(
    uid => navigation.navigate('User Profile', { token: uid }),
    [navigation],
  );

  const renderComment = useCallback(
    ({ item }) => {
      const live = userMap[item.userId] || {};
      const avatar = live.photoURL || item.commenterProfile;
      const name = live.displayName || item.commenterName || 'User';
      return (
        <CommentRow
          item={item}
          currentUid={currentUid}
          avatar={avatar}
          name={name}
          onOpenProfile={openProfile}
          onDelete={handleDeleteComment}
        />
      );
    },
    [userMap, currentUid, openProfile, handleDeleteComment],
  );

  if (!post.id) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Text style={{ color: '#666' }}>No post found.</Text>
      </View>
    );
  }

  if (postUnavailable) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primary2]}
          style={styles.headerGrad}
        >
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Feather name="arrow-left" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Post</Text>
              <View style={styles.iconBtn} />
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <Feather
            name="lock"
            size={28}
            color={COLORS.sub}
            style={{ marginBottom: 10 }}
          />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: COLORS.text,
              textAlign: 'center',
            }}
          >
            This post is no longer available
          </Text>
          <Text
            style={{ marginTop: 6, color: COLORS.sub, textAlign: 'center' }}
          >
            The person who shared it may have set their account to private.
          </Text>
        </View>
      </View>
    );
  }

  const likeText = formatLikeCount(post.likes);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primary2]}
        style={styles.headerGrad}
      >
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Post</Text>
            <View style={styles.iconBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        style={{ flex: 1 }}
        data={comments}
        keyExtractor={it => String(it.id)}
        renderItem={renderComment}
        contentContainerStyle={{ paddingBottom: 90 }}
        ListHeaderComponent={
          <View style={styles.postCard}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('User Profile', { token: post.uid })
              }
              hitSlop={8}
            >
              <View style={styles.userBar}>
                <Image
                  source={getImageSource(
                    post.photoURL,
                    require('../Images/defaultProfile.png'),
                  )}
                  style={styles.userImage}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.username} numberOfLines={1}>
                    {post.displayName || 'User'}
                  </Text>
                </View>
                <PostMoreMenu
                  post={post}
                  onDeleted={() => navigation.goBack()}
                  onEditCaption={() =>
                    navigation.navigate('Edit Post', {
                      postId: post.id,
                      initial: post.caption,
                    })
                  }
                />
              </View>
            </TouchableOpacity>

            <View
              style={[styles.mediaWrap, { position: 'relative' }]}
              collapsable={false}
            >
              <MediaCarousel
                media={post.media || []}
                mediaMeta={post.mediaMeta || []}
                isViewable={true}
                onSlidePress={onMediaTap}
                mode="detail"
              />

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.heartBurst,
                  {
                    zIndex: 2,
                    opacity: heartOpacity,
                    transform: [
                      {
                        scale: heartScale.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <AntDesign name="heart" size={96} color="rgba(255,39,88,0.9)" />
              </Animated.View>
            </View>

            <View style={styles.iconBar}>
              <View style={styles.iconGroup}>
                <TouchableOpacity
                  onPress={handleLikePress}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    post.isLiked ? 'Unlike post' : 'Like post'
                  }
                >
                  <AntDesign
                    name={post.isLiked ? 'heart' : 'hearto'}
                    size={28}
                    color={post.isLiked ? 'red' : '#111'}
                  />
                </TouchableOpacity>
                <View style={{ width: 16 }} />
                <FontAwesome
                  name="comment-o"
                  size={26}
                  color="#111"
                  accessibilityLabel="Comments"
                />
                <View style={{ width: 16 }} />
                <TouchableOpacity
                  onPress={handleShare}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Share post"
                >
                  <Feather name="share" size={26} color="#111" />
                </TouchableOpacity>
              </View>
            </View>

            {!!likeText && <Text style={styles.likes}>{likeText}</Text>}
            {!!post.caption && (
              <Text style={styles.description}>{post.caption}</Text>
            )}

            <View
              style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
            >
              <Text style={styles.commentsHeader}>Comments</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loadingComments ? null : (
            <Text style={{ paddingHorizontal: 16, color: '#666' }}>
              Be the first to comment.
            </Text>
          )
        }
        ListFooterComponent={
          <View style={{ paddingVertical: 12 }}>
            {loadingComments ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : hasMoreComments ? (
              <TouchableOpacity
                onPress={() => setCommentLimit(n => n + PAGE_SIZE)}
                style={styles.loadMoreBtn}
              >
                <Text style={styles.loadMoreText}>Load more comments</Text>
              </TouchableOpacity>
            ) : comments.length > 0 ? (
              <Text style={styles.endText}>No more comments</Text>
            ) : null}
          </View>
        }
        initialNumToRender={10}
        removeClippedSubviews={false}
        windowSize={10}
        showsVerticalScrollIndicator={false}
      />

      <KeyboardStickyView>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment…"
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={400}
            accessibilityLabel="Add a comment"
          />
          <TouchableOpacity
            style={[styles.postButton, { opacity: comment.trim() ? 1 : 0.5 }]}
            onPress={handleAddComment}
            disabled={!comment.trim()}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
          >
            <Text style={styles.postButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>

      {loadingPost && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  headerGrad: {
    paddingBottom: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 4,
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
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

  postCard: {
    backgroundColor: COLORS.card,
    margin: 12,
    borderRadius: 14,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  username: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  postMedia: { width: '100%', height: width, backgroundColor: '#000' },

  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },

  heartBurst: { position: 'absolute', alignSelf: 'center', top: '40%' },

  iconBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconGroup: { flexDirection: 'row', alignItems: 'center' },

  likes: {
    paddingHorizontal: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: COLORS.text,
  },
  description: { paddingHorizontal: 16, marginBottom: 10, color: '#333' },

  commentsHeader: { fontSize: 15, fontWeight: '800', color: COLORS.text },

  commentContainer: { paddingHorizontal: 16, paddingVertical: 8 },
  commentInfo: { flexDirection: 'row', alignItems: 'flex-start' },
  commentProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  commentTextContainer: { flex: 1 },
  commentAuthor: { fontWeight: '700', marginBottom: 2, color: COLORS.text },
  commentTime: { marginLeft: 6, fontSize: 12, color: COLORS.sub },
  comment: { color: '#444' },

  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 18,
    minHeight: 40,
    maxHeight: 120,
    color: COLORS.text,
  },
  postButton: {
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: { fontWeight: '700', color: COLORS.primary },

  loadMoreBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
  },
  loadMoreText: { color: COLORS.text, fontWeight: '700' },
  endText: { textAlign: 'center', color: '#9ca3af' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaWrap: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});
