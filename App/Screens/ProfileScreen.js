// App/Screens/ProfileScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ProgressBar from 'react-native-progress/Bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import SettingListItem from '../Components/SettingListItem';
import { successMessage, errorMessage } from '../Components/MessageAlert';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const AVATAR_SIZE = 120;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
const GRADIENT = ['#7c3aed', '#db2777'];

// Helper: only accept http(s) images; otherwise treat as "no image"
const toHttpUrlOrEmpty = v =>
  typeof v === 'string' && /^https?:\/\//i.test(v) ? v : '';

export default function ProfileScreen({ navigation }) {
  const [state, setState] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    imageUrl: '', // http(s) only; empty means use local default
  });
  const [imgError, setImgError] = useState(false); // separate from state.imageUrl so a
  // failed load doesn't permanently
  // stomp on the real photoURL — the
  // next successful fetch just clears this
  const [profileCompletion, setProfileCompletion] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const me = auth().currentUser || null;
  const uid = me?.uid || null;
  const mounted = useRef(true);

  const tabBarHeight = useBottomTabBarHeight();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(u => {
      if (!u) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [navigation]);

  const calcCompletion = useCallback(docData => {
    let c = 0;
    if (docData?.displayName || docData?.name) c += 0.25;
    if (docData?.phone) c += 0.25;
    if (docData?.email) c += 0.25;
    if (docData?.bio) c += 0.25;
    setProfileCompletion(c);
  }, []);

  // Depend on the specific primitives read below, not the whole `me`
  // object — see identical reasoning already applied elsewhere in this
  // codebase: depending on an object that's re-derived fresh every render
  // risks unnecessary effect re-runs if its identity ever changes without
  // the values themselves changing.
  const meDisplayName = me?.displayName;
  const meEmail = me?.email;
  const mePhotoURL = me?.photoURL;

  const hydrateFromDoc = useCallback(
    docOrData => {
      const d =
        typeof docOrData?.data === 'function'
          ? docOrData.data() || {}
          : docOrData || {};

      const fallbackName =
        d.displayName ||
        d.name ||
        (meDisplayName ?? (meEmail ? meEmail.split('@')[0] : ''));

      const imageUrl = toHttpUrlOrEmpty(
        d.photoURL || d.image || mePhotoURL || '',
      );

      setState({
        name: fallbackName || '',
        email: d.email || meEmail || '',
        phone: d.phone || '',
        bio: (d.bio && String(d.bio).trim()) || '',
        imageUrl, // empty string => render local default
      });
      setImgError(false); // fresh data — give the new URL a chance
      calcCompletion(d);
    },
    [calcCompletion, meDisplayName, meEmail, mePhotoURL],
  );

  // Fast first paint from cache, then live updates
  useEffect(() => {
    if (!authReady || !uid) return;

    let unsubSnapshot = null;
    let didShowCache = false;

    (async () => {
      try {
        const cached = await firestore()
          .collection('Users')
          .doc(uid)
          .get({ source: 'cache' });
        if (cached.exists) {
          didShowCache = true;
          if (mounted.current) {
            hydrateFromDoc(cached);
            setLoading(false);
          }
        }
      } catch {
        // cache might be cold; ignore
      }

      unsubSnapshot = firestore()
        .collection('Users')
        .doc(uid)
        .onSnapshot(
          doc => {
            // FIX: previously this returned early when doc.exists was
            // false, WITHOUT calling hydrateFromDoc at all — so `state`
            // stayed at its blank initial value forever. This is exactly
            // what happened for a first-time Google sign-in before the
            // corresponding LoginScreen fix: the Firestore doc didn't
            // exist yet, so the profile screen showed nothing, even
            // though auth().currentUser already had the real name/photo.
            // hydrateFromDoc's own fallback logic (d.field || me.field)
            // already handles a missing/empty doc correctly — it just
            // needs to actually be called.
            hydrateFromDoc(doc.exists ? doc : null);
            if (mounted.current) setLoading(false);
          },
          () => {
            if (mounted.current) setLoading(false);
          },
        );
    })();

    return () => unsubSnapshot && unsubSnapshot();
  }, [authReady, uid, hydrateFromDoc]);

  const onRefresh = useCallback(async () => {
    if (!uid) return;
    setRefreshing(true);
    try {
      const d = await firestore()
        .collection('Users')
        .doc(uid)
        .get({ source: 'server' });
      hydrateFromDoc(d.exists ? d : null);
    } catch (e) {
      errorMessage('Could not refresh your profile. Please try again.');
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [uid, hydrateFromDoc]);


  const handleDeleteAccount = useCallback(() => {
    const user = auth().currentUser;

    if (!user) {
      Alert.alert('Error', 'No signed-in account was found.');
      return;
    }

    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const uid = user.uid;

              // Delete the main Firestore user profile.
              await firestore().collection('Users').doc(uid).delete();

              // Delete the Firebase Authentication account.
              await user.delete();

              // Google session may still exist.
              try {
                await GoogleSignin.signOut();
              } catch {}

              successMessage('Your account has been deleted.');

              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (err) {
              console.warn('Delete account error:', err);

              if (err?.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Sign In Required',
                  'For security, please sign in again and then delete your account.',
                );
                return;
              }

              errorMessage(
                err?.message ||
                  'Unable to delete your account. Please try again.',
              );
            }
          },
        },
      ],
    );
  }, [navigation]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            const u = auth().currentUser;
            if (u?.uid) {
              await firestore().collection('Users').doc(u.uid).set(
                {
                  onlineStatus: false,
                  onlineInChat: false,
                  lastSeen: firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
              );
            }

            try {
              await GoogleSignin.signOut();
            } catch {}
            await auth().signOut();
            successMessage('Logged out successfully');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch (err) {
            errorMessage(err?.message || String(err));
          }
        },
      },
    ]);
  };

  if (!authReady) {
    return (
      <View style={styles.fullScreenLoading}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  const { name, email, phone, bio, imageUrl } = state;
  const showLocalAvatar = !imageUrl || imgError;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7c3aed"
            colors={['#7c3aed']}
          />
        }
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header / Cover */}
        <LinearGradient colors={GRADIENT} style={styles.header}>
          <SafeAreaView edges={['top', 'left', 'right']}>
            <View style={styles.headerRow}>
              <View style={{ width: 44 }} />
              <Text style={styles.appTitle}>Profile</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Edit Profile', {
                    name,
                    bio,
                    email,
                    phone,
                    image: imageUrl,
                  })
                }
                style={styles.editBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
              >
                <MaterialCommunityIcons name="pencil" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <View style={styles.centerWrap}>
            <View style={styles.avatarRing}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Image
                  source={
                    showLocalAvatar
                      ? require('../Images/defaultProfile.png')
                      : { uri: imageUrl }
                  }
                  style={styles.avatar}
                  accessibilityLabel={`${name || 'User'}'s profile photo`}
                  onError={() => {
                    if (mounted.current) setImgError(true);
                  }}
                />
              )}
            </View>

            <Text style={styles.nameText} numberOfLines={1}>
              {loading ? 'Loading…' : name || 'User'}
            </Text>
            {!!bio && (
              <Text style={styles.bioText} numberOfLines={2}>
                {bio}
              </Text>
            )}

            <View style={styles.progressWrap}>
              <ProgressBar
                progress={profileCompletion}
                width={220}
                height={8}
                color="#fff"
                unfilledColor="rgba(255,255,255,0.35)"
                borderWidth={0}
                accessibilityLabel={`Profile ${Math.round(
                  profileCompletion * 100,
                )}% complete`}
              />
              <Text style={styles.progressText}>
                Profile {Math.round(profileCompletion * 100)}% complete
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Details card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <MaterialCommunityIcons name="phone" size={18} color="#7c3aed" />
            </View>
            <Text style={styles.rowText} numberOfLines={1}>
              {phone || 'No phone number added'}
            </Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <MaterialCommunityIcons name="email" size={18} color="#7c3aed" />
            </View>
            <Text style={styles.rowText} numberOfLines={1}>
              {email || 'No email added'}
            </Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>General</Text>
        </View>

        <View style={styles.list}>
          <SettingListItem
            title="Change Password"
            IconName="account-lock"
            onPress={() => navigation.navigate('Change Password')}
          />
          <SettingListItem
            title="About us"
            IconName="information"
            onPress={() => navigation.navigate('About')}
          />
          <SettingListItem
            title="Contact us"
            IconName="android-messages"
            onPress={() => navigation.navigate('Contact')}
          />
          <SettingListItem
            title="Terms & Conditions"
            IconName="file-document-edit"
            onPress={() => navigation.navigate('TermsConditions')}
          />
          <SettingListItem
            title="Logout"
            IconName="power"
            onPress={handleLogout}
            destructive
            showArrow={false}
          />
        </View>
          <Text onPress={handleDeleteAccount} style={styles.deleteAccountText}>
            Delete Account
          </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  fullScreenLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  header: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 22,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  centerWrap: { alignItems: 'center', paddingHorizontal: 16, marginTop: 10 },
  avatarRing: {
    width: AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    borderRadius: AVATAR_RADIUS + 5,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    backgroundColor: '#eee',
  },
  nameText: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 4 },
  bioText: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  progressWrap: { marginTop: 14, alignItems: 'center' },
  progressText: {
    color: '#fff',
    marginTop: 6,
    fontWeight: '600',
    fontSize: 12,
  },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { marginLeft: 12, fontSize: 15, color: '#1f2937', flex: 1 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },

  sectionHeader: { marginTop: 22, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: { paddingHorizontal: 16, paddingTop: 10 },
  deleteAccountBtn: {
    marginTop: 14,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  deleteAccountText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    alignSelf: 'center',
    marginTop: 20,
    textDecorationLine: 'underline',
    
  },
});
