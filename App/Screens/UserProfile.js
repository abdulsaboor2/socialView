// App/Screens/UserProfile.js
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Linking,
  Share as RNShare,
  Dimensions,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AppButton from '../Components/AppButton';
import AppPost from '../Components/AppPost';
import PrivateProfileGate from '../Components/PrivateProfileGate';
import ReportModal from '../Components/ReportModal';
import {
  blockUser,
  unblockUser,
  subscribeIsBlockedByMe,
  subscribeAmIBlockedBy,
} from '../utils/blockService';
import { normalizeFirebaseDownloadUrl } from '../utils/fbUrl';

const AVATAR = 112;
const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#7c3aed',
  primary2: '#db2777',
  text: '#111827',
  sub: '#6b7280',
  card: '#ffffff',
  line: '#E5E7EB',
  chip: '#f3f4f6',
  chipText: '#111827',
};

const CONTENT_CONTAINER_STYLE = { paddingBottom: 24 };

const EMPTY_PROFILE = {
  displayName: '',
  email: '',
  phone: '',
  phonePrivacy: 'public',
  profilePrivacy: 'public',
  bio: '',
  photoURL: '',
  createdAt: null,
};

export default function UserProfile({ navigation, route }) {
  const token = route?.params?.token;
  const myUid = auth().currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [postCount, setPostCount] = useState(null); // null = not known yet
  const [reportVisible, setReportVisible] = useState(false);

  // NEW: block state, tracked in both directions.
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const isBlocked = blockedByMe || blockedMe;

  const viewingOwnProfile = useMemo(
    () => !!myUid && myUid === token,
    [myUid, token],
  );
  const isPrivateForViewer =
    profile.profilePrivacy === 'private' && !viewingOwnProfile;
  const contentHidden = isPrivateForViewer || isBlocked;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const unsub = firestore()
      .collection('Users')
      .doc(token)
      .onSnapshot(
        doc => {
          const d = doc.data() || {};
          const next = {
            displayName: d.displayName || d.name || '',
            email: d.email || '',
            phone: d.phone || '',
            phonePrivacy: d.phonePrivacy || 'public',
            profilePrivacy:
              d.profilePrivacy === 'private' ? 'private' : 'public',
            bio: typeof d.bio === 'string' ? d.bio : '',
            photoURL: d.photoURL || d.image || '',
            createdAt: d.createdAt || null,
          };
          setProfile(prev => {
            const changed = Object.keys(next).some(k => prev[k] !== next[k]);
            return changed ? next : prev;
          });
          setLoading(false);
        },
        () => setLoading(false),
      );
    return () => unsub();
  }, [token]);

  // NEW: subscribe to both block directions.
  useEffect(() => {
    if (!myUid || !token || myUid === token) {
      setBlockedByMe(false);
      setBlockedMe(false);
      return;
    }
    const unsub1 = subscribeIsBlockedByMe(
      { blockerId: myUid, blockedId: token },
      setBlockedByMe,
    );
    const unsub2 = subscribeAmIBlockedBy(
      { myUid, otherUid: token },
      setBlockedMe,
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [myUid, token]);

  const avatarUri = useMemo(
    () =>
      profile.photoURL ? normalizeFirebaseDownloadUrl(profile.photoURL) : '',
    [profile.photoURL],
  );

  const openMail = async () => {
    if (!profile.email) return;
    const url = `mailto:${profile.email}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
  };

  const openPhone = async () => {
    if (!profile.phone) return;
    const url = `tel:${profile.phone}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
  };

  const onShareProfile = async () => {
    try {
      const text = `Check out ${
        profile.displayName || 'this user'
      } on SocialView!`;
      await RNShare.share({ message: text });
    } catch {}
  };

  const onNavigationChat = async () => {
    try {
      const me = myUid;
      if (!me || !token || me === token) return;
      await firestore()
        .collection('ListOfCollection')
        .doc(me)
        .collection('Chat')
        .doc(token)
        .set({ id: token }, { merge: true });
      await firestore()
        .collection('ListOfCollection')
        .doc(token)
        .collection('Chat')
        .doc(me)
        .set({ id: me }, { merge: true });
      navigation.navigate('Chat', {
        token,
        name: profile.displayName || 'User',
        image: profile.photoURL || '',
      });
    } catch {}
  };

  // NEW: block/unblock, with a confirmation step either direction.
  const handleToggleBlock = useCallback(() => {
    if (!myUid || !token || viewingOwnProfile) return;

    if (blockedByMe) {
      Alert.alert(
        'Unblock this account?',
        `You'll be able to see ${
          profile.displayName || 'their'
        } posts and message them again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              setBlockBusy(true);
              try {
                await unblockUser({ blockerId: myUid, blockedId: token });
              } catch (e) {
                console.warn('Unblock failed:', e);
                Alert.alert('Error', 'Could not unblock. Please try again.');
              } finally {
                setBlockBusy(false);
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Block this account?',
        `${
          profile.displayName || 'This user'
        } won't be able to message you, and their posts will be hidden from you.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              setBlockBusy(true);
              try {
                await blockUser({ blockerId: myUid, blockedId: token });
              } catch (e) {
                console.warn('Block failed:', e);
                Alert.alert('Error', 'Could not block. Please try again.');
              } finally {
                setBlockBusy(false);
              }
            },
          },
        ],
      );
    }
  }, [myUid, token, viewingOwnProfile, blockedByMe, profile.displayName]);

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

  const handleNavigation = useCallback(
    (screen, params) => navigation.navigate(screen, params),
    [navigation],
  );

  const goToUploadPost = useCallback(
    () => navigation.navigate('Upload Post'),
    [navigation],
  );

  const postStat =
    postCount !== null && !contentHidden
      ? `${postCount} ${postCount === 1 ? 'post' : 'posts'}`
      : null;

  const Header = useMemo(
    () => (
      <>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primary2]}
          style={styles.headerGradient}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={onShareProfile}
                hitSlop={8}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Share profile"
              >
                <Feather name="share-2" size={20} color="#fff" />
              </TouchableOpacity>
              {!viewingOwnProfile && (
                <>
                  <TouchableOpacity
                    onPress={() => setReportVisible(true)}
                    hitSlop={8}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Report this account"
                  >
                    <Ionicons name="flag-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleToggleBlock}
                    hitSlop={8}
                    style={styles.iconBtn}
                    disabled={blockBusy}
                    accessibilityRole="button"
                    accessibilityLabel={
                      blockedByMe
                        ? 'Unblock this account'
                        : 'Block this account'
                    }
                  >
                    <Ionicons
                      name={
                        blockedByMe
                          ? 'person-add-outline'
                          : 'person-remove-outline'
                      }
                      size={20}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={['#a78bfa', '#f472b6']}
              style={styles.avatarRing}
            >
              {loading ? (
                <View
                  style={[
                    styles.avatar,
                    { overflow: 'hidden', backgroundColor: '#e5e7eb' },
                  ]}
                >
                  <Animated.View
                    style={[styles.shimmer, { transform: [{ translateX }] }]}
                  />
                </View>
              ) : (
                <Image
                  source={
                    avatarUri
                      ? { uri: avatarUri }
                      : require('../Images/defaultProfile.png')
                  }
                  style={styles.avatar}
                  accessibilityLabel={`${
                    profile.displayName || 'User'
                  }'s profile photo`}
                />
              )}
            </LinearGradient>
            <Text style={styles.nameText} numberOfLines={1}>
              {loading ? ' ' : profile.displayName || 'User'}
            </Text>
            {!loading && !!postStat && (
              <Text style={styles.statText}>{postStat}</Text>
            )}
            {isPrivateForViewer && !isBlocked && (
              <View style={styles.privateBadge}>
                <Ionicons
                  name="lock-closed"
                  size={12}
                  color="rgba(255,255,255,0.95)"
                />
                <Text style={styles.privateBadgeText}>Private account</Text>
              </View>
            )}
            {!contentHidden && !!profile.bio && (
              <Text style={styles.bioText} numberOfLines={3}>
                {profile.bio}
              </Text>
            )}
            {!contentHidden && (
              <View style={styles.chipsRow}>
                {!!profile.email && (
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={openMail}
                    activeOpacity={0.9}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={16}
                      color={COLORS.chipText}
                    />
                    <Text numberOfLines={1} style={styles.chipText}>
                      {profile.email}
                    </Text>
                  </TouchableOpacity>
                )}
                {!!profile.phone &&
                  (viewingOwnProfile || profile.phonePrivacy !== 'private') && (
                    <TouchableOpacity
                      style={styles.chip}
                      onPress={openPhone}
                      activeOpacity={0.9}
                    >
                      <Ionicons
                        name="call-outline"
                        size={16}
                        color={COLORS.chipText}
                      />
                      <Text numberOfLines={1} style={styles.chipText}>
                        {profile.phone}
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
            )}
            <View style={styles.ctaRow}>
              {viewingOwnProfile ? (
                <>
                  <AppButton
                    title="Edit Profile"
                    onPress={() => navigation.navigate('Edit Profile')}
                    color={COLORS.primary}
                    leftIcon="create-outline"
                    accessibilityLabel="Edit profile"
                    style={{ flex: 1 }}
                  />
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Profile')}
                    style={styles.settingsBtn}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Settings"
                  >
                    <Ionicons name="settings-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : !isBlocked ? (
                <AppButton
                  title="Send Message"
                  onPress={onNavigationChat}
                  color={COLORS.primary}
                  leftIcon="chatbubble-ellipses-outline"
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          </View>
        </LinearGradient>
        {!isBlocked && (
          <View style={styles.postsHeaderRow}>
            <Text style={styles.sectionTitle}>Posts</Text>
          </View>
        )}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loading,
      profile,
      avatarUri,
      viewingOwnProfile,
      isPrivateForViewer,
      isBlocked,
      blockedByMe,
      blockBusy,
      contentHidden,
      postStat,
      translateX,
      navigation,
    ],
  );

  const EmptyState = useMemo(() => {
    if (isPrivateForViewer) {
      return (
        <PrivateProfileGate
          isPrivate
          isOwnProfile={false}
          displayName={profile.displayName}
        />
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconCircle}>
          <Feather name="camera" size={26} color={COLORS.primary} />
        </View>
        {viewingOwnProfile ? (
          <>
            <Text style={styles.emptyTitle}>Share your first post</Text>
            <Text style={styles.emptySub}>
              Photos and videos you share will show up here.
            </Text>
            <AppButton
              title="Create a Post"
              onPress={goToUploadPost}
              color={COLORS.primary}
              leftIcon="add-circle-outline"
              style={styles.emptyCta}
            />
          </>
        ) : (
          <>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySub}>
              {profile.displayName || 'This user'} hasn't shared anything yet.
            </Text>
          </>
        )}
      </View>
    );
  }, [
    isPrivateForViewer,
    viewingOwnProfile,
    profile.displayName,
    goToUploadPost,
  ]);

  if (!token) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={{ fontSize: 16, color: '#555' }}>No user specified.</Text>
      </View>
    );
  }

  // NEW: when blocked in either direction, don't mount AppPost at all.
  // A blocked user's PUBLIC posts are still normally readable (blocking
  // isn't the same as privacy) — if this just customized the empty
  // state like the private-profile case above, their post grid would
  // still load and display underneath since AppPost would successfully
  // fetch real data. This renders a dedicated view instead, so no post
  // query ever runs for a blocked profile.
  if (isBlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {Header}
        <View style={styles.emptyWrap}>
          <View
            style={[styles.emptyIconCircle, { backgroundColor: '#fee2e2' }]}
          >
            <Ionicons name="ban-outline" size={26} color="#ef4444" />
          </View>
          {blockedByMe ? (
            <>
              <Text style={styles.emptyTitle}>You blocked this account</Text>
              <Text style={styles.emptySub}>
                You won't see their posts, and they can't message you.
              </Text>
              <AppButton
                title={blockBusy ? 'Unblocking…' : 'Unblock'}
                onPress={handleToggleBlock}
                color={COLORS.primary}
                leftIcon="person-add-outline"
                style={styles.emptyCta}
                disabled={blockBusy}
              />
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>
                This account isn't available
              </Text>
              <Text style={styles.emptySub}>
                You can't view this profile right now.
              </Text>
            </>
          )}
        </View>

        <ReportModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          targetType="user"
          targetId={token}
          reportedUid={token}
        />
      </View>
    );
  }

  return (
    <>
      <AppPost
        profileUser
        userId={token}
        layout="grid"
        handleNavigation={handleNavigation}
        headerComponent={Header}
        emptyComponent={EmptyState}
        onItemsChange={setPostCount}
        contentContainerStyle={CONTENT_CONTAINER_STYLE}
      />

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="user"
        targetId={token}
        reportedUid={token}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  headerGradient: {
    paddingBottom: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
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
  avatarWrap: { alignItems: 'center', paddingTop: 4, paddingHorizontal: 16 },
  avatarRing: {
    width: AVATAR + 10,
    height: AVATAR + 10,
    borderRadius: (AVATAR + 10) / 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#e5e7eb',
  },
  shimmer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  nameText: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    maxWidth: '90%',
    textAlign: 'center',
  },
  statText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  bioText: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    maxWidth: '92%',
    textAlign: 'center',
  },
  privateBadge: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
  },
  privateBadgeText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: '700',
  },
  chipsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.chip,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    maxWidth: '90%',
  },
  chipText: { color: COLORS.chipText, maxWidth: '88%' },
  ctaRow: {
    marginTop: 14,
    width: '100%',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postsHeaderRow: {
    marginTop: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginVertical: 8,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 16,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.sub,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCta: {
    marginTop: 18,
    width: '80%',
  },
});
