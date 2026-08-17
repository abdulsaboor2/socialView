// App/Screens/ChangePassword.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppButton from '../Components/AppButton';
import AppInput from '../Components/AppInput';
import KeyboardScreenWrapper from '../Components/KeyboardScreenWrapper';

import auth from '@react-native-firebase/auth';
import { successMessage } from '../Components/MessageAlert';

// Which field a given Firebase Auth error code belongs to.
// null => not field-specific, show as a general (dismissible) banner.
const FIELD_FOR_CODE = {
  'auth/wrong-password': 'old',
  'auth/invalid-credential': 'old',
  'auth/requires-recent-login': null, // session is stale, not "you typed it wrong"
  'auth/too-many-requests': null,
};

const ChangePassword = ({ navigation }) => {
  const user = auth().currentUser;

  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [oldTouched, setOldTouched] = useState(false);
  const [newTouched, setNewTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [serverError, setServerError] = useState({ field: null, message: '' });

  const isMatch = useMemo(
    () => newPassword === confirmPassword,
    [newPassword, confirmPassword],
  );
  const isLongEnough = useMemo(
    () => (newPassword || '').length >= 6,
    [newPassword],
  );
  const isSameAsOld = useMemo(
    () => !!oldPassword && !!newPassword && oldPassword === newPassword,
    [oldPassword, newPassword],
  );

  const oldValidationError = useMemo(() => {
    if (!(oldTouched || submitted)) return null;
    if (!oldPassword) return 'Current password is required.';
    return null;
  }, [oldPassword, oldTouched, submitted]);

  const newValidationError = useMemo(() => {
    if (!(newTouched || submitted)) return null;
    if (!newPassword) return 'New password is required.';
    if (!isLongEnough) return 'Use at least 6 characters.';
    if (isSameAsOld)
      return 'New password cannot be the same as your current password.';
    return null;
  }, [newPassword, newTouched, submitted, isLongEnough, isSameAsOld]);

  const confirmValidationError = useMemo(() => {
    if (!(confirmTouched || submitted)) return null;
    if (!confirmPassword) return 'Please confirm your new password.';
    if (!isMatch) return 'Passwords do not match.';
    return null;
  }, [confirmPassword, confirmTouched, submitted, isMatch]);

  const oldError =
    oldValidationError ||
    (serverError.field === 'old' ? serverError.message : null);
  const newError = newValidationError;
  const confirmError = confirmValidationError;

  const mapAuthError = code => {
    switch (code) {
      case 'auth/requires-recent-login':
        return 'Your session has expired. Please log out and back in, then try again.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Your current password is incorrect.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again in a moment.';
      default:
        return 'Could not change password. Please try again.';
    }
  };

  const updatePassword = async () => {
    setSubmitted(true);
    setOldTouched(true);
    setNewTouched(true);
    setConfirmTouched(true);
    setServerError({ field: null, message: '' });

    if (!user?.email) {
      setServerError({ field: 'general', message: 'You must be signed in.' });
      return;
    }

    // Client-side validation errors render inline under each field.
    if (
      !oldPassword ||
      !newPassword ||
      !confirmPassword ||
      !isLongEnough ||
      !isMatch ||
      isSameAsOld
    ) {
      return;
    }

    try {
      setLoading(true);

      const credential = auth.EmailAuthProvider.credential(
        user.email,
        oldPassword,
      );
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);

      successMessage('Password updated successfully.');
      navigation.goBack();
    } catch (e) {
      const message =
        mapAuthError(e?.code) || e?.message || 'Could not change password.';
      const field = FIELD_FOR_CODE[e?.code];
      setServerError({
        field: field === undefined ? 'general' : field ?? 'general',
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      {/* paddingTop uses the real device inset via SafeAreaView, so this
          never sits behind a status bar / punch-hole camera on Android —
          this header previously had no safe-area handling at all. */}
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
            <Text style={styles.headerTitle}>Change Password</Text>
            <View style={styles.iconBtn} />
          </View>

          <View style={styles.iconWrap}>
            <FontAwesome5 name="lock" size={64} color="#fff" />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* KeyboardScreenWrapper replaces a plain KeyboardAvoidingView +
          static View — the old version had behavior=undefined on Android
          (no keyboard avoidance at all) AND no scroll container, so on a
          small screen with the keyboard open there was no way to reach
          the Update Password button at all. */}
      <KeyboardScreenWrapper
        backgroundColor="#f6f7fb"
        topInset={false}
        contentContainerStyle={styles.content}
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
            label="Current password"
            placeholder="Enter current password"
            value={oldPassword}
            onChangeText={t => {
              setOld(t);
              if (!oldTouched) setOldTouched(true);
              if (serverError.field === 'old')
                setServerError({ field: null, message: '' });
            }}
            onBlur={() => setOldTouched(true)}
            secureTextEntry={!showOld}
            leftIcon="lock-closed-outline"
            rightIcon={showOld ? 'eye-off' : 'eye'}
            onRightIconPress={() => setShowOld(s => !s)}
            returnKeyType="next"
            textContentType="password"
            error={oldError}
          />

          <AppInput
            label="New password"
            placeholder="Enter new password"
            value={newPassword}
            onChangeText={t => {
              setNew(t);
              if (!newTouched) setNewTouched(true);
            }}
            onBlur={() => setNewTouched(true)}
            secureTextEntry={!showNew}
            leftIcon="key-outline"
            rightIcon={showNew ? 'eye-off' : 'eye'}
            onRightIconPress={() => setShowNew(s => !s)}
            helperText={!newError ? 'At least 6 characters' : undefined}
            error={newError}
            returnKeyType="next"
            textContentType="newPassword"
          />

          <AppInput
            label="Confirm new password"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChangeText={t => {
              setConfirm(t);
              if (!confirmTouched) setConfirmTouched(true);
            }}
            onBlur={() => setConfirmTouched(true)}
            secureTextEntry={!showConfirm}
            leftIcon="shield-checkmark-outline"
            rightIcon={showConfirm ? 'eye-off' : 'eye'}
            onRightIconPress={() => setShowConfirm(s => !s)}
            error={confirmError}
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={updatePassword}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('Forget Password')}
            style={{ alignSelf: 'flex-end', marginTop: 6 }}
            hitSlop={8}
          >
            <Text style={{ color: '#7c3aed', fontWeight: '700' }}>
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </View>

        <AppButton
          title="Update Password"
          onPress={updatePassword}
          color="#7c3aed"
          loading={loading}
          disabled={loading}
          style={{ marginTop: 12 }}
          leftIcon="checkmark-done-outline"
        />
      </KeyboardScreenWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  iconWrap: { alignItems: 'center', paddingVertical: 6 },

  content: { padding: 16 },
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
});

export default ChangePassword;
