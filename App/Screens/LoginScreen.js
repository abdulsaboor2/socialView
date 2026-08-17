import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Ionicons from 'react-native-vector-icons/Ionicons';

import AppButton from '../Components/AppButton';
import AppInput from '../Components/AppInput';
import KeyboardScreenWrapper from '../Components/KeyboardScreenWrapper';

import auth from '@react-native-firebase/auth';

import GoogleButton from '../Components/GoogleButton';
import { signInWithGoogle } from '../utils/googleAuth';
import { isValidEmail, mapAuthErr } from '../utils/authHelpers';

const BRAND = '#fe4c74';
const BRAND_DARK = '#e8365f';
const TEXT_DARK = '#14121a';
const TEXT_MUTED = '#7a7686';
const BG = '#ffffff';
const CARD_BG = '#faf9fb';
const BORDER = '#ece9f0';

// Which field a given Firebase Auth error code should be attached to.
// null => not field-specific, show as a general banner instead.
const FIELD_FOR_CODE = {
  'auth/invalid-email': 'email',
  'auth/user-not-found': 'email',
  'auth/user-disabled': 'email',
  'auth/wrong-password': 'password',
  'auth/invalid-credential': 'password',
  'auth/too-many-requests': null,
  'auth/network-request-failed': null,
};

const LoginScreen = ({ navigation }) => {
  const [emailRaw, setEmailRaw] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [gLoading, setGLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendTimer = useRef(null);

  // Server-side (Firebase) error, kept separate from client validation so
  // typing in the field clears it independently.
  const [serverError, setServerError] = useState({ field: null, message: '' });

  const email = useMemo(() => emailRaw.trim().toLowerCase(), [emailRaw]);

  const emailValidationError = useMemo(() => {
    if (!(emailTouched || submitted)) return null;
    if (!email) return 'Email is required.';
    if (!isValidEmail(email)) return 'Enter a valid email address.';
    return null;
  }, [email, emailTouched, submitted]);

  const passwordValidationError = useMemo(() => {
    if (!(passwordTouched || submitted)) return null;
    if (!password) return 'Password is required.';
    return null;
  }, [password, passwordTouched, submitted]);

  const emailError =
    emailValidationError ||
    (serverError.field === 'email' ? serverError.message : null);
  const passwordError =
    passwordValidationError ||
    (serverError.field === 'password' ? serverError.message : null);

  const isFormFilled = email.length > 0 && password.length > 0;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const loginScale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(loginScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  const pressOut = () =>
    Animated.spring(loginScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  useEffect(() => {
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(60);
    resendTimer.current = setInterval(() => {
      setResendCooldown(s => {
        if (s <= 1) {
          clearInterval(resendTimer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // Users/{uid} doc creation and identity syncing is now handled directly
  // inside signInWithGoogle() (see utils/googleAuth.js) — first-time login
  // creates the full profile with defaults (including profilePrivacy),
  // returning logins only sync identity fields without touching bio/phone/
  // privacy settings. This used to be duplicated here as ensureUserDoc(),
  // firing a second near-identical read-then-write on every Google sign-in
  // right after signInWithGoogle() had already done the same work.
  const handleGoogle = async () => {
    if (gLoading) return;
    try {
      setGLoading(true);
      await signInWithGoogle();
      navigation.replace('Home');
    } catch (e) {
      const msg =
        e?.code === '12501' || e?.code === 12501
          ? 'Sign in cancelled.'
          : e?.message || 'Google Sign‑In failed.';
      setServerError({ field: 'general', message: msg });
    } finally {
      setGLoading(false);
    }
  };

  const resendVerification = async (emailArg, passwordArg) => {
    if (!emailArg || !passwordArg) {
      return Alert.alert(
        'Missing info',
        'Enter your email and password first.',
      );
    }
    if (!isValidEmail(emailArg)) {
      return Alert.alert('Invalid email', 'Please enter a valid email.');
    }

    try {
      const cred = await auth().signInWithEmailAndPassword(
        emailArg,
        passwordArg,
      );
      await cred.user.sendEmailVerification();
      await auth().signOut();
      Alert.alert('Sent', 'Verification email has been sent.');
      startCooldown();
    } catch (e) {
      Alert.alert(
        'Error',
        mapAuthErr(e?.code, e?.message || 'Could not send verification email.'),
      );
    }
  };

  const handleLogin = useCallback(async () => {
    if (isLoading) return;

    setSubmitted(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setServerError({ field: null, message: '' });

    if (!email || !isValidEmail(email) || !password) {
      return;
    }

    try {
      setIsLoading(true);
      const cred = await auth().signInWithEmailAndPassword(email, password);

      const user = cred.user;
      const providers = (user.providerData || []).map(p => p.providerId);
      if (providers.includes('password') && !user.emailVerified) {
        await auth().signOut();

        Alert.alert(
          'Verify your email',
          'Please verify your email before logging in. Check your Spam/Junk folder if you don’t see it in your inbox.',
          [
            {
              text: resendCooldown
                ? `Resend (${resendCooldown}s)`
                : 'Resend link',
              onPress: resendCooldown
                ? undefined
                : () => resendVerification(email, password),
            },
            { text: 'OK' },
          ],
        );
        return;
      }

      navigation.replace('Home');
    } catch (e) {
      const message = mapAuthErr(
        e?.code,
        'Could not sign in. Please try again.',
      );
      const field = FIELD_FOR_CODE[e?.code];
      setServerError({
        field: field === undefined ? 'general' : field ?? 'general',
        message,
      });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, isLoading, navigation, password, resendCooldown]);

  return (
    <View style={styles.safeArea}>
      <StatusBar backgroundColor={BG} barStyle="dark-content" />
      <KeyboardScreenWrapper
        backgroundColor={BG}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topAccent} />

        <Animated.View
          style={[
            styles.animatedWrap,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Image
            style={styles.logo}
            source={require('../Images/loginLogo.png')}
            resizeMode="contain"
            accessibilityLabel="Login illustration"
          />

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Log in to keep the conversation going.
          </Text>

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
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              value={emailRaw}
              onChangeText={t => {
                setEmailRaw(t);
                if (!emailTouched) setEmailTouched(true);
                if (serverError.field === 'email')
                  setServerError({ field: null, message: '' });
              }}
              onBlur={() => setEmailTouched(true)}
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="email"
              textContentType="username"
              returnKeyType="next"
              error={emailError}
              containerStyle={styles.inputSpacing}
            />

            <AppInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={t => {
                setPassword(t);
                if (!passwordTouched) setPasswordTouched(true);
                if (serverError.field === 'password')
                  setServerError({ field: null, message: '' });
              }}
              onBlur={() => setPasswordTouched(true)}
              autoCapitalize="none"
              secureTextEntry={!showPassword}
              textContentType="password"
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowPassword(s => !s)}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              error={passwordError}
              containerStyle={styles.inputSpacingTight}
            />

            <TouchableOpacity
              style={styles.forgotWrap}
              onPress={() => navigation.navigate('Forget Password')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: loginScale }] }}>
              <AppButton
                title="Login"
                onPress={handleLogin}
                onPressIn={pressIn}
                onPressOut={pressOut}
                color={isFormFilled ? BRAND : BRAND}
                loading={isLoading}
                disabled={isLoading}
                accessibilityLabel="Login"
              />
            </Animated.View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <GoogleButton onPress={handleGoogle} loading={gLoading} />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.footerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardScreenWrapper>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  topAccent: {
    width: '100%',
    height: 6,
    backgroundColor: BRAND,
  },
  animatedWrap: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 150,
    height: 150,
    marginTop: 24,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 20,
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  banner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F6C6C6',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    color: '#B3261E',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  inputSpacing: {
    marginBottom: 14,
  },
  inputSpacingTight: {
    marginBottom: 4,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 18,
    marginTop: 4,
  },
  forgotText: {
    color: BRAND_DARK,
    fontWeight: '700',
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_MUTED,
    letterSpacing: 1,
  },
  footerRow: {
    flexDirection: 'row',
    marginTop: 20,
  },
  footerText: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
  footerLink: {
    color: BRAND_DARK,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default LoginScreen;
