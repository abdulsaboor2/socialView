// App/Screens/EditProfileScreen.js
import React, { useMemo, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';

import AppButton from '../Components/AppButton';
import AppInput from '../Components/AppInput';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { successMessage } from '../Components/MessageAlert';

const AVATAR_SIZE = 110;
const AVATAR_RADIUS = AVATAR_SIZE / 2;

const EditProfileScreen = ({ navigation, route }) => {
  const user = auth().currentUser;
  const { name, email, phone, image, bio } = route.params || {};

  // Google (and any other federated) accounts can't reliably use
  // Firebase's updateEmail() — it errors for provider-linked accounts,
  // and the email is meant to be managed by the provider anyway. Only
  // gate the field for that specific reason, not unconditionally —
  // password accounts should still be able to change their email (that's
  // what the auth/requires-recent-login handling in save() below is for).
  const providerIds = (user?.providerData || []).map(p => p.providerId);
  const isGoogleLinked = providerIds.includes('google.com');

  const [saving, setSaving] = useState(false);
  const [names, setName] = useState(name || user?.displayName || '');
  const [emails, setEmail] = useState(email || user?.email || '');
  const [phones, setPhone] = useState(phone || '');
  const [bios, setBio] = useState(typeof bio === 'string' ? bio : '');
  const [phonePrivacy, setPhonePrivacy] = useState('public');
  const [profilePrivacy, setProfilePrivacy] = useState('public');
  const [initialProfilePrivacy, setInitialProfilePrivacy] = useState('public');
  const [avatar, setAvatar] = useState(image || user?.photoURL || '');

  const [serverError, setServerError] = useState({ field: null, message: '' });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  const isEmailValid = !emails || EMAIL_RE.test(emails.trim().toLowerCase());
  const isNameValid = (names || '').trim().length >= 2;

  useEffect(() => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    firestore()
      .collection('Users')
      .doc(uid)
      .get()
      .then(doc => {
        const d = doc.data() || {};
        if (d.phonePrivacy === 'private' || d.phonePrivacy === 'public') {
          setPhonePrivacy(d.phonePrivacy);
        }
        const pp = d.profilePrivacy === 'private' ? 'private' : 'public';
        setProfilePrivacy(pp);
        setInitialProfilePrivacy(pp);
      })
      .catch(() => {});
  }, []);

  const hasChanges = useMemo(() => {
    return (
      (names || '') !== (name || user?.displayName || '') ||
      (emails || '') !== (email || user?.email || '') ||
      (phones || '') !== (phone || '') ||
      (bios || '') !== (typeof bio === 'string' ? bio : '') ||
      (avatar || '') !== (image || user?.photoURL || '') ||
      profilePrivacy !== initialProfilePrivacy
    );
  }, [
    names,
    emails,
    phones,
    bios,
    avatar,
    profilePrivacy,
    initialProfilePrivacy,
    name,
    email,
    phone,
    image,
    user,
  ]);

  const capitalizeWords = text => text.replace(/\b\w/g, c => c.toUpperCase());

  const pickImage = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (asset?.uri) setAvatar(asset.uri);
  };

  const uploadAvatarIfNeeded = async (uid, localOrRemote) => {
    if (!localOrRemote) return '';
    const isRemote =
      typeof localOrRemote === 'string' && /^https?:\/\//i.test(localOrRemote);
    if (isRemote) return localOrRemote;

    const path = `users/${uid}/avatar.jpg`;
    const ref = storage().ref(path);
    await ref.putFile(localOrRemote);
    return await ref.getDownloadURL();
  };

  const updateAvatarOnComments = async (uid, photoURL, displayName) => {
    const base = firestore().collection('Comments').where('userId', '==', uid);
    let last = null;
    const PAGE = 400;
    for (;;) {
      let q = base.limit(PAGE);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;

      const batch = firestore().batch();
      snap.docs.forEach(doc => {
        batch.set(
          doc.ref,
          {
            commenterProfile: photoURL || '',
            commenterName: displayName || 'User',
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
      await batch.commit();

      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE) break;
    }
  };

  const syncPostsPrivacy = async (uid, privacy) => {
    const base = firestore().collection('Posts').where('uid', '==', uid);
    let last = null;
    const PAGE = 400;
    for (;;) {
      let q = base.limit(PAGE);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;

      const batch = firestore().batch();
      snap.docs.forEach(doc => {
        batch.set(doc.ref, { authorPrivacy: privacy }, { merge: true });
      });
      await batch.commit();

      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE) break;
    }
  };

  const save = async () => {
    setServerError({ field: null, message: '' });

    if (!user) {
      setServerError({
        field: 'general',
        message: 'You must be signed in to save changes.',
      });
      return;
    }
    if (!isNameValid || !isEmailValid) return;

    try {
      setSaving(true);

      const photoURL = await uploadAvatarIfNeeded(user.uid, avatar);
      const displayName = capitalizeWords((names || '').trim());

      await user.updateProfile({ displayName, photoURL });
      await updateAvatarOnComments(user.uid, photoURL || '', displayName);

      // Only attempt to change the Auth email for non-Google accounts —
      // the field is disabled in the UI for Google accounts, but this
      // guard protects against stale route params too.
      const normalizedEmail = (emails || '').trim().toLowerCase();
      if (
        !isGoogleLinked &&
        normalizedEmail &&
        normalizedEmail !== user.email
      ) {
        try {
          await user.updateEmail(normalizedEmail);
        } catch (e) {
          if (e?.code === 'auth/requires-recent-login') {
            setServerError({
              field: 'email',
              message:
                'Please log out and back in to change your email, then try again.',
            });
          } else {
            setServerError({
              field: 'email',
              message: e?.message || 'Could not update email.',
            });
          }
        }
      }

      await firestore()
        .collection('Users')
        .doc(user.uid)
        .set(
          {
            uid: user.uid,
            displayName,
            email:
              (isGoogleLinked ? user.email : normalizedEmail) ||
              user.email ||
              '',
            phone: phones || '',
            bio: bios || '',
            photoURL: photoURL || '',
            phonePrivacy: phonePrivacy || 'public',
            profilePrivacy: profilePrivacy || 'public',
            image: photoURL || '',
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

      if (profilePrivacy !== initialProfilePrivacy) {
        await syncPostsPrivacy(user.uid, profilePrivacy);
        setInitialProfilePrivacy(profilePrivacy);
      }

      try {
        await updateAvatarOnPosts(user.uid, photoURL || '', displayName);
      } catch (e) {
        console.log('updateAvatarOnPosts skipped:', e?.code || e?.message || e);
      }

      successMessage('Profile updated!');
      navigation.goBack();
    } catch (e) {
      console.log('Edit profile error:', e);
      setServerError({
        field: 'general',
        message: e?.message || 'Failed to update profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      <LinearGradient colors={['#7c3aed', '#db2777']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.iconBtn}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <View style={styles.iconBtn} />
          </View>
        </SafeAreaView>

        <View style={styles.avatarWrap}>
          <Image
            source={
              avatar ? { uri: avatar } : require('../Images/defaultProfile.png')
            }
            style={styles.avatar}
          />
          <TouchableOpacity
            onPress={pickImage}
            activeOpacity={0.9}
            style={styles.editBadge}
          >
            <Ionicons name="camera" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {serverError.field === 'general' && !!serverError.message && (
            <View style={styles.banner}>
              <Ionicons name="alert-circle" size={18} color="#E5484D" />
              <Text style={styles.bannerText}>{serverError.message}</Text>
              <TouchableOpacity
                onPress={() => setServerError({ field: null, message: '' })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={16} color="#E5484D" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.card}>
            <AppInput
              label="Full name"
              placeholder="Enter your full name"
              value={names}
              onChangeText={t => setName(capitalizeWords(t))}
              autoCapitalize="words"
              returnKeyType="next"
              leftIcon="person-outline"
              error={
                !isNameValid ? 'Please enter at least 2 characters.' : undefined
              }
            />

            <AppInput
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              value={emails}
              onChangeText={t => {
                setEmail(t);
                if (serverError.field === 'email')
                  setServerError({ field: null, message: '' });
              }}
              autoCapitalize="none"
              inputMode="email"
              textContentType="emailAddress"
              returnKeyType="next"
              leftIcon="mail-outline"
              error={
                !isEmailValid
                  ? 'Invalid email address.'
                  : serverError.field === 'email'
                  ? serverError.message
                  : undefined
              }
              helperText={
                isGoogleLinked ? 'Managed by your Google account' : undefined
              }
              disabled={isGoogleLinked}
            />

            <AppInput
              label="Phone"
              placeholder="03xx-xxxxxxx"
              keyboardType="phone-pad"
              value={phones}
              onChangeText={setPhone}
              textContentType="telephoneNumber"
              returnKeyType="next"
              leftIcon="call-outline"
              helperText="Optional"
            />

            <View style={{ marginTop: 4 }}>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>
                Phone visibility
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setPhonePrivacy('public')}
                  style={{
                    paddingHorizontal: 12,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      phonePrivacy === 'public' ? '#7c3aed' : '#eef2ff',
                  }}
                >
                  <Text
                    style={{
                      color: phonePrivacy === 'public' ? '#fff' : '#111',
                    }}
                  >
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPhonePrivacy('private')}
                  style={{
                    paddingHorizontal: 12,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      phonePrivacy === 'private' ? '#7c3aed' : '#eef2ff',
                  }}
                >
                  <Text
                    style={{
                      color: phonePrivacy === 'private' ? '#fff' : '#111',
                    }}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* NEW: whole-profile visibility */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: '700', marginBottom: 2 }}>
                Account privacy
              </Text>
              <Text style={{ color: '#6b7280', fontSize: 12, marginBottom: 6 }}>
                {profilePrivacy === 'private'
                  ? 'Only you can see your posts and profile. You can still message anyone.'
                  : 'Anyone can see your posts and profile.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setProfilePrivacy('public')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor:
                      profilePrivacy === 'public' ? '#7c3aed' : '#eef2ff',
                  }}
                >
                  <Ionicons
                    name="globe-outline"
                    size={15}
                    color={profilePrivacy === 'public' ? '#fff' : '#111'}
                  />
                  <Text
                    style={{
                      color: profilePrivacy === 'public' ? '#fff' : '#111',
                    }}
                  >
                    Public
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setProfilePrivacy('private')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor:
                      profilePrivacy === 'private' ? '#7c3aed' : '#eef2ff',
                  }}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={15}
                    color={profilePrivacy === 'private' ? '#fff' : '#111'}
                  />
                  <Text
                    style={{
                      color: profilePrivacy === 'private' ? '#fff' : '#111',
                    }}
                  >
                    Private
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <AppInput
              label="Bio"
              placeholder="Tell people about yourself"
              value={bios}
              onChangeText={setBio}
              multiline
              inputStyle={{ minHeight: 90 }}
              leftIcon="create-outline"
              helperText={`${(bios || '').length}/100`}
              containerStyle={{ marginTop: 12 }}
            />
            <AppButton
              title="Update"
              onPress={save}
              color="#7c3aed"
              loading={saving}
              disabled={saving || !hasChanges || !isNameValid || !isEmailValid}
            />
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { paddingBottom: 32 },
  headerRow: {
    paddingHorizontal: 16,
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

  avatarWrap: { alignItems: 'center', marginTop: 6 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  editBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#db2777',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F6C6C6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  bannerText: { flex: 1, color: '#B3261E', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    gap: 8,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
});

export default EditProfileScreen;
