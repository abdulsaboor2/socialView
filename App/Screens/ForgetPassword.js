import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '../Components/AppButton';
import AppInput from '../Components/AppInput';
import KeyboardScreenWrapper from '../Components/KeyboardScreenWrapper';
import { isValidEmail, mapAuthErr } from '../utils/authHelpers';

import auth from '@react-native-firebase/auth';

const ForgetPassword = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [sent, setSent] = useState(false);

  const trimmedEmail = email.trim().toLowerCase();

  const validationError = (() => {
    if (!(touched || submitted)) return null;
    if (!trimmedEmail) return 'Please enter your email.';
    if (!isValidEmail(trimmedEmail))
      return 'Please enter a valid email address.';
    return null;
  })();

  const fieldError = validationError || serverError || null;

  const handleForgotPassword = async () => {
    setSubmitted(true);
    setTouched(true);
    setServerError('');
    setSent(false);

    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      return;
    }

    try {
      setIsLoading(true);
      await auth().sendPasswordResetEmail(trimmedEmail);
      setSent(true);
    } catch (e) {
      setServerError(
        mapAuthErr(e?.code, 'Could not send reset link. Please try again.'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      {/* paddingTop uses the real device inset, so this never sits behind
          a status bar / punch-hole camera on Android */}
      <LinearGradient
        colors={['#7c3aed', '#db2777']}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Forgot Password</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.iconWrap}>
          <Image
            style={styles.logo}
            source={require('../Images/forgetPasswordLogo.png')}
            resizeMode="contain"
          />
        </View>
      </LinearGradient>

      <KeyboardScreenWrapper
        backgroundColor="#f6f7fb"
        topInset={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          Enter the email linked to your account and we'll send you a link to
          reset your password.
        </Text>

        {sent && !fieldError && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#1a7f37" />
            <Text style={styles.successText}>
              Reset link sent — check your inbox (and spam folder).
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <AppInput
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            value={email}
            onChangeText={t => {
              setEmail(t);
              if (!touched) setTouched(true);
              if (serverError) setServerError('');
              if (sent) setSent(false);
            }}
            onBlur={() => setTouched(true)}
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
            textContentType="username"
            leftIcon="mail-outline"
            returnKeyType="done"
            onSubmitEditing={handleForgotPassword}
            error={fieldError}
          />
        </View>

        <AppButton
          title="Send Reset Link"
          onPress={handleForgotPassword}
          color="#7c3aed"
          loading={isLoading}
          disabled={isLoading}
          style={{ marginTop: 16 }}
          leftIcon="paper-plane-outline"
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
  logo: { width: 160, height: 160 },

  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#111', marginBottom: 6 },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9F7EF',
    borderWidth: 1,
    borderColor: '#BFE6CC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  successText: {
    flex: 1,
    color: '#1a7f37',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default ForgetPassword;
