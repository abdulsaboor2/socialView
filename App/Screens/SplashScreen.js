// App/Screens/SplashScreen.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { showMessage } from 'react-native-flash-message';

const { width, height } = Dimensions.get('window');

// --- Timings ---
const ANIM_IN_MS = 1200;
const MIN_SPLASH_MS = 3600;
const ROTATE_MS = 4800;
const BLOB_MS = 9000;
const PULSE_MS = 3600;

// Safety net: if Firebase Auth's listener never responds (corrupted local
// persistence, missing Google Play Services, etc.), initializing would
// otherwise stay true forever with no way forward.
const AUTH_TIMEOUT_MS = 8000;

export default function SplashScreen({ navigation }) {
  // --- Animation values ---
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const titleY = useRef(new Animated.Value(12)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  // CHANGED: was `Array.from(...)` with no useRef, recreated every
  // render — the animation loop (set up once) ended up driving values
  // that were never the same objects the JSX actually rendered, which is
  // why the dots visually stopped animating. Wrapping in useRef keeps
  // the same three Animated.Value instances for the component's whole
  // lifetime.
  const dots = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0)),
  ).current;

  const blob1X = useRef(new Animated.Value(0)).current;
  const blob1Y = useRef(new Animated.Value(0)).current;
  const blob2X = useRef(new Animated.Value(0)).current;
  const blob2Y = useRef(new Animated.Value(0)).current;

  const pulse = useRef(new Animated.Value(0)).current;

  // --- Auth state ---
  const [initializing, setInitializing] = useState(true);
  const startedAt = useRef(Date.now());
  const navigated = useRef(false);
  const desiredRoute = useRef(null);

  // --- Auth listener ---
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(async user => {
      if (!user) {
        desiredRoute.current = 'Login';
      } else {
        const providers = (user.providerData || []).map(p => p.providerId);
        const needsVerify =
          providers.includes('password') && !user.emailVerified;
        if (needsVerify) {
          try {
            await auth().signOut();
          } catch (e) {
            // Sign-out failing here isn't fatal — routing to Login
            // regardless — but swallowing it entirely hides real issues
            // from dev-time visibility.
            console.warn(
              'SplashScreen: sign-out during verify-check failed',
              e,
            );
          }
          desiredRoute.current = 'Login';
          showMessage({
            message: 'Please verify your email before signing in',
            description:
              'Check your inbox for the verification link, then log in again.',
            type: 'info',
            duration: 4000,
          });
        } else {
          desiredRoute.current = 'Home';
        }
      }
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  // Restored: forces a decision if the listener above never fires at all.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!desiredRoute.current) {
        console.warn(
          'SplashScreen: auth state listener did not respond within timeout — defaulting to Login',
        );
        desiredRoute.current = 'Login';
        setInitializing(false);
      }
    }, AUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  // --- Navigation gate ---
  useEffect(() => {
    if (initializing || !desiredRoute.current || navigated.current) return;
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;
      navigation.reset({
        index: 0,
        routes: [{ name: desiredRoute.current }],
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [initializing, navigation]);

  // --- Animations ---
  useEffect(() => {
    // Collect every looping animation so we can stop them explicitly on
    // unmount — otherwise they keep ticking (some on the JS thread)
    // after this screen has been fully replaced in the stack.
    const loops = [];

    // Logo entrance
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: ANIM_IN_MS,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: ANIM_IN_MS,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // Infinite rotate
    const rotateLoop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: ROTATE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    rotateLoop.start();
    loops.push(rotateLoop);

    // Title fade-up
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        delay: 250,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(titleY, {
        toValue: 0,
        delay: 250,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Dots loop — slightly more polished stagger + a soft overshoot on
    // the way up so each dot has a touch of bounce instead of a flat
    // linear pulse.
    dots.forEach((dot, i) => {
      const dotLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 420,
            delay: i * 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      dotLoop.start();
      loops.push(dotLoop);
    });

    // Floating blobs — now actually animates both X and Y (previously
    // `float` accepted a vy argument but only ever animated vx, leaving
    // the blobs moving in a straight horizontal line despite the name).
    const float = (vx, vy, range) => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(vx, {
              toValue: range,
              duration: BLOB_MS,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(vy, {
              toValue: range * 0.6,
              duration: BLOB_MS * 1.15,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(vx, {
              toValue: -range,
              duration: BLOB_MS,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(vy, {
              toValue: -range * 0.6,
              duration: BLOB_MS * 1.15,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      anim.start();
      loops.push(anim);
    };
    float(blob1X, blob1Y, 28);
    float(blob2X, blob2Y, 22);

    // Background pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    pulseLoop.start();
    loops.push(pulseLoop);

    return () => {
      loops.forEach(anim => anim.stop());
    };
  }, []);

  // --- Interpolations ---
  const rotateDeg = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const bgColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['#0b1220', '#111827'],
  });

  // CHANGED: was a separate bare-spinner render while `initializing` was
  // true, then a hard cut to this fully animated view once auth
  // resolved. That switch was jarring — two unrelated visual treatments
  // stitched together. Since MIN_SPLASH_MS guarantees at least 3.6s on
  // this screen regardless, there's no reason not to show the full
  // branded splash from the very first frame; the dots alone
  // communicate "loading" for the entire duration now.
  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Background blobs */}
      <Animated.View
        style={[
          styles.blob,
          {
            backgroundColor: '#1f2a44',
            top: -width * 0.25,
            left: -width * 0.1,
            transform: [{ translateX: blob1X }, { translateY: blob1Y }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          {
            backgroundColor: '#172136',
            bottom: -width * 0.4,
            right: -width * 0.2,
            transform: [{ translateX: blob2X }, { translateY: blob2Y }],
          },
        ]}
      />

      {/* Logo */}
      <Animated.Image
        source={require('../Images/SplashLogo.png')}
        resizeMode="contain"
        accessibilityLabel="SocialView logo"
        style={[
          styles.logo,
          { opacity: fade, transform: [{ scale }, { rotate: rotateDeg }] },
        ]}
      />

      {/* Title */}
      <Animated.View
        style={{
          alignItems: 'center',
          marginTop: 8,
          transform: [{ translateY: titleY }],
          opacity: titleOpacity,
        }}
      >
        <Text style={styles.title}>SocialView</Text>
        <Text style={styles.subtitle}>Connect • Share • Thrive</Text>
      </Animated.View>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: v,
                transform: [
                  {
                    scale: v.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 1.15],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      {/* Footer */}
      <Text style={styles.footer}>Powered by WebRat Solutions</Text>
    </Animated.View>
  );
}

const BLOB_SIZE = Math.max(width, height) * 0.6;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blob: {
    position: 'absolute',
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    opacity: 0.45,
  },
  logo: {
    width: Math.min(180, width * 0.45),
    height: Math.min(180, width * 0.45),
  },
  title: {
    color: '#e5ecff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#9db4ff',
    marginTop: 6,
    fontSize: 14,
  },
  dotsRow: {
    position: 'absolute',
    bottom: height * 0.2,
    flexDirection: 'row',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#b9ccff',
    shadowColor: '#b9ccff',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    color: '#9db4ff',
    fontSize: 12,
  },
});
