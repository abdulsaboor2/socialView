// App/Screens/RegisterScreen.js
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
import firestore from '@react-native-firebase/firestore';

import {
  isValidEmail,
  mapAuthErr,
  getProvidersForEmail,
} from '../utils/authHelpers';

const BRAND = '#fe4c74';
const BRAND_DARK = '#e8365f';
const TEXT_DARK = '#14121a';
const TEXT_MUTED = '#7a7686';
const BG = '#ffffff';
const CARD_BG = '#faf9fb';
const BORDER = '#ece9f0';
const GOOD = '#1fa971';

const capitalizeWords = t => t.replace(/\b\w/g, c => c.toUpperCase());

// Which field a given Firebase Auth error code belongs to.
// null => not field-specific, show as a general (dismissible) banner instead.
const FIELD_FOR_CODE = {
  'auth/email-already-in-use': 'email',
  'auth/invalid-email': 'email',
  'auth/weak-password': 'password',
  'auth/operation-not-allowed': null,
  'auth/network-request-failed': null,
};

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [emailRaw, setEmailRaw] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Server-side (Firebase / lookup) error, kept separate from client
  // validation so editing a field clears its own error independently.
  const [serverError, setServerError] = useState({ field: null, message: '' });

  const email = useMemo(() => emailRaw.trim().toLowerCase(), [emailRaw]);

  // ---- Client-side validation (shows once a field has been touched OR the user tried to submit) ----
  const nameValidationError = useMemo(() => {
    if (!(nameTouched || submitted)) return null;
    if (!name.trim()) return 'Full name is required.';
    return null;
  }, [name, nameTouched, submitted]);

  const emailValidationError = useMemo(() => {
    if (!(emailTouched || submitted)) return null;
    if (!email) return 'Email is required.';
    if (!isValidEmail(email)) return 'Enter a valid email address.';
    return null;
  }, [email, emailTouched, submitted]);

  const passwordValidationError = useMemo(() => {
    if (!(passwordTouched || submitted)) return null;
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Use at least 6 characters.';
    return null;
  }, [password, passwordTouched, submitted]);

  const confirmValidationError = useMemo(() => {
    if (!(confirmTouched || submitted)) return null;
    if (!confirm) return 'Please confirm your password.';
    if (confirm !== password) return 'Passwords do not match.';
    return null;
  }, [confirm, password, confirmTouched, submitted]);

  // Client error takes priority; otherwise show a server error attached to this field.
  const nameError = nameValidationError;
  const emailError =
    emailValidationError ||
    (serverError.field === 'email' ? serverError.message : null);
  const passwordError =
    passwordValidationError ||
    (serverError.field === 'password' ? serverError.message : null);
  const confirmError = confirmValidationError;

  // simple strength hint, purely visual — not a gate
  const passwordStrength = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) return { label: 'Too short', color: '#E5484D' };
    if (password.length < 10) return { label: 'Okay', color: '#E0A100' };
    return { label: 'Strong', color: GOOD };
  }, [password]);

  // ---- Entrance animation ----
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

  // ---- Button press feedback ----
  const btnScale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  const pressOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const handleRegister = useCallback(async () => {
    if (isLoading) return;

    setSubmitted(true);
    setNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmTouched(true);
    setServerError({ field: null, message: '' });

    // Client-side validation errors render inline under each field.
    if (
      !name.trim() ||
      !email ||
      !isValidEmail(email) ||
      !password ||
      password.length < 6 ||
      !confirm ||
      confirm !== password
    ) {
      return;
    }

    try {
      setIsLoading(true);

      const providers = await getProvidersForEmail(email);
      if (providers.includes('google.com')) {
        setServerError({
          field: 'email',
          message:
            'This email is registered with Google. Use "Sign in with Google" instead.',
        });
        setIsLoading(false);
        return;
      }

      const cred = await auth().createUserWithEmailAndPassword(email, password);
      const user = cred.user;

      try {
        await user.updateProfile({ displayName: capitalizeWords(name.trim()) });
      } catch {}

      await firestore()
        .collection('Users')
        .doc(user.uid)
        .set(
          {
            uid: user.uid,
            displayName: capitalizeWords(name.trim()),
            email,
            image: '',
            onlineStatus: false,
            bio: '',
            lastMsg: '',
            lastMsgTime: '',
            phone: '',
            phonePrivacy: 'public',
            profilePrivacy: 'public',
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

      await user.sendEmailVerification();
      await auth().signOut();

      Alert.alert(
        'Verify your email',
        'We sent a verification link to your email. Please verify, then log in.',
      );
      navigation.replace('Login');
    } catch (e) {
      const message = mapAuthErr(
        e?.code,
        e?.message || 'Could not create your account. Please try again.',
      );
      const field = FIELD_FOR_CODE[e?.code];
      setServerError({
        field: field === undefined ? 'general' : field ?? 'general',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [confirm, email, isLoading, name, password, navigation]);

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
            source={require('../Images/registerLogo.png')}
            resizeMode="contain"
            accessibilityLabel="Register logo"
          />

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Join in a few seconds — no spam, ever.
          </Text>

          {/* Non field-specific errors (Google account conflict handled separately above;
              this covers network issues, disabled registration, etc.) */}
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
              keyboardType="default"
              value={name}
              onChangeText={t => {
                setName(capitalizeWords(t));
                if (!nameTouched) setNameTouched(true);
              }}
              onBlur={() => setNameTouched(true)}
              autoCapitalize="words"
              textContentType="name"
              returnKeyType="next"
              error={nameError}
              containerStyle={styles.inputSpacing}
            />

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
              textContentType="emailAddress"
              returnKeyType="next"
              error={emailError}
              containerStyle={styles.inputSpacing}
            />

            <AppInput
              label="Password"
              placeholder="Enter a password"
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
              textContentType="newPassword"
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowPassword(s => !s)}
              returnKeyType="next"
              error={passwordError}
              containerStyle={styles.inputSpacingTight}
            />

            {passwordStrength && !passwordError ? (
              <View style={styles.strengthRow}>
                <View
                  style={[
                    styles.strengthDot,
                    { backgroundColor: passwordStrength.color },
                  ]}
                />
                <Text
                  style={[
                    styles.strengthText,
                    { color: passwordStrength.color },
                  ]}
                >
                  {passwordStrength.label}
                </Text>
              </View>
            ) : (
              <View style={styles.strengthSpacer} />
            )}

            <AppInput
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirm}
              onChangeText={t => {
                setConfirm(t);
                if (!confirmTouched) setConfirmTouched(true);
              }}
              onBlur={() => setConfirmTouched(true)}
              autoCapitalize="none"
              secureTextEntry={!showConfirm}
              textContentType="newPassword"
              rightIcon={showConfirm ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowConfirm(s => !s)}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              error={confirmError}
              containerStyle={styles.inputSpacing}
            />

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <AppButton
                title="Create account"
                onPress={handleRegister}
                onPressIn={pressIn}
                onPressOut={pressOut}
                color={BRAND}
                loading={isLoading}
                disabled={isLoading}
                accessibilityLabel="Create account"
              />
            </Animated.View>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <Text style={styles.footerLink}>Log in</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legalText}>
            By continuing, you agree to our Terms & Privacy Policy.
          </Text>
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
    width: 120,
    height: 120,
    marginTop: 20,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT_DARK,
    letterSpacing: 0.2,
    textAlign: 'center',
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
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  inputSpacing: {
    marginBottom: 10,
  },
  inputSpacingTight: {
    marginBottom: 2,
  },
  strengthRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 2,
    paddingLeft: 2,
  },
  strengthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '700',
  },
  strengthSpacer: {
    height: 14,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
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
  legalText: {
    marginTop: 10,
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default RegisterScreen;
