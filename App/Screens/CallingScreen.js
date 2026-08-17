// App/Screens/CallingScreen.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  Animated,
  Easing,
  InteractionManager,
} from 'react-native';
// FIX: this was destructured from 'react-native' (core RN's SafeAreaView),
// which has unreliable/inconsistent inset support on Android — the same
// root cause behind the camera-cutout bug fixed everywhere else in this
// app. react-native-safe-area-context's version is the one that actually
// reports correct insets on cutout devices.
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { endCallForBoth, minimizeCall } from '../utils/callService';

let LinearGradient = View;
try {
  LinearGradient = require('react-native-linear-gradient').default || View;
} catch {}

const CallingScreen = ({ navigation, route }) => {
  const {
    channel,
    callType = 'video',
    token,
    receiverUid,
    receiverName,
    receiverImage,
  } = route.params || {};
  const [name, setName] = useState(receiverName || 'Calling…');
  const [photo, setPhoto] = useState(receiverImage || '');
  const [status, setStatus] = useState('Ringing…');

  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    // FIX: `Animated.loop(...).start()` returns undefined — `.start()`
    // itself has no return value, so `l1`/`l2` were previously always
    // undefined and `l1?.stop?.()` below was a silent no-op every time.
    // Capturing the composite animation BEFORE calling .start() on it is
    // what actually gives the cleanup something real to call .stop() on.
    const l1 = loop(pulse1);
    const l2 = loop(pulse2, 600);
    l1.start();
    l2.start();

    return () => {
      pulse1.stopAnimation();
      pulse2.stopAnimation();
      l1.stop();
      l2.stop();
    };
  }, [pulse1, pulse2]);

  // Listen to RECEIVER doc. If picked → join; if inactive/deleted → leave.
  const navigatedRef = useRef(false);
  // FIX: the "picked" branch below already guards itself with
  // navigatedRef so it only navigates once. This timeout branch had no
  // equivalent guard — if the snapshot fires again before Firestore's
  // `active: false` write propagates back (a realistic race on a slow
  // connection), endCallForBoth could get invoked more than once
  // concurrently for the same call.
  const timeoutHandledRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    const unsub = firestore()
      .collection('calls')
      .doc(token)
      .onSnapshot(snap => {
        const call = snap.data();
        if (!call) {
          setStatus('Ended');
          InteractionManager.runAfterInteractions(
            () => navigation.canGoBack() && navigation.goBack(),
          );
          return;
        }

        // timeout if not picked within ring window
        if (!call.picked && call.ringUntilMs && Date.now() > call.ringUntilMs) {
          if (timeoutHandledRef.current) return;
          timeoutHandledRef.current = true;

          const me = auth().currentUser;
          const other = call.receiverUid || token;
          if (me && other) {
            endCallForBoth({
              callerUid: me.uid,
              receiverUid: other,
              reason: 'timeout',
            })
              .catch(e =>
                console.warn(
                  'endCallForBoth (timeout) failed:',
                  e?.message || e,
                ),
              )
              .finally(() =>
                InteractionManager.runAfterInteractions(
                  () => navigation.canGoBack() && navigation.goBack(),
                ),
              );
          }
          return;
        }

        if (call.receiverName && !receiverName) setName(call.receiverName);
        if (call.receiverImage && !receiverImage) setPhoto(call.receiverImage);
        if (call.active === false) {
          setStatus('Ended');
          InteractionManager.runAfterInteractions(
            () => navigation.canGoBack() && navigation.goBack(),
          );
          return;
        }
        if (call.picked && !navigatedRef.current) {
          navigatedRef.current = true;
          InteractionManager.runAfterInteractions(() => {
            navigation.replace('ForVideoCall', {
              channel: call.channel,
              callType: call.callType,
              peerUid: call.receiverUid,
            });
          });
        }
      });
    return () => unsub && unsub();
  }, [navigation, token, receiverImage, receiverName]);

  const onCancel = useCallback(async () => {
    const me = auth().currentUser;
    const other = receiverUid || token;
    try {
      if (me && other)
        await endCallForBoth({ callerUid: me.uid, receiverUid: other });
    } catch (e) {
      // Don't let this become an unhandled promise rejection — hanging up
      // should never crash or silently fail without at least a log. The
      // person still leaves the screen via `finally` below regardless.
      console.warn('endCallForBoth (cancel) failed:', e?.message || e);
    } finally {
      InteractionManager.runAfterInteractions(
        () => navigation.canGoBack() && navigation.goBack(),
      );
    }
  }, [navigation, receiverUid, token]);

  const onMinimize = useCallback(async () => {
    const me = auth().currentUser;
    const other = receiverUid || token;
    try {
      if (me && other)
        await minimizeCall({ myUid: me.uid, otherUid: other, seconds: 30 });
    } catch (e) {
      console.warn('minimizeCall failed:', e?.message || e);
    } finally {
      InteractionManager.runAfterInteractions(
        () => navigation.canGoBack() && navigation.goBack(),
      );
    }
  }, [navigation, receiverUid, token]);

  const ringStyle = val => ({
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    transform: [
      {
        scale: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.15],
        }),
      },
    ],
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }),
  });

  const hasPhoto = !!photo;
  const label = callType === 'video' ? 'Video Call' : 'Voice Call';

  const Header = (
    <View style={styles.topRow}>
      <View style={styles.badge}>
        <Ionicons
          name={callType === 'video' ? 'videocam' : 'call'}
          size={14}
          color="#9ecfff"
        />
        <Text style={styles.badgeTxt}>{label}</Text>
      </View>
      <TouchableOpacity
        style={styles.minBtn}
        onPress={onMinimize}
        activeOpacity={0.9}
      >
        <Ionicons name="chevron-down" size={22} color="#cfe7ff" />
      </TouchableOpacity>
    </View>
  );

  const Center = (
    <View style={styles.center}>
      <View
        style={{
          width: 240,
          height: 240,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View style={ringStyle(pulse1)} />
        <Animated.View style={ringStyle(pulse2)} />
        <View style={styles.avatarWrap}>
          {hasPhoto ? (
            <Image source={{ uri: photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={56} color="#9aa4b2" />
            </View>
          )}
        </View>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );

  const Footer = (
    <>
      <View style={styles.actions}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onCancel}
          style={[styles.circleBtn, styles.hangup]}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.helper}>Waiting for receiver to answer…</Text>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
      {hasPhoto ? (
        <ImageBackground
          source={{ uri: photo }}
          imageStyle={{ opacity: 0.18 }}
          style={{ flex: 1 }}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(11,18,32,0.7)', 'rgba(11,18,32,0.9)']}
            style={{ flex: 1 }}
          >
            <SafeAreaView style={styles.safe}>
              {Header}
              {Center}
              {Footer}
            </SafeAreaView>
          </LinearGradient>
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={['rgba(11,18,32,1)', 'rgba(11,18,32,1)']}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={styles.safe}>
            {Header}
            {Center}
            {Footer}
          </SafeAreaView>
        </LinearGradient>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: 18, paddingBottom: 20 },
  topRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: 'rgba(33,102,255,0.18)',
    borderColor: 'rgba(158,207,255,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeTxt: {
    color: '#cce4ff',
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  minBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarWrap: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 3,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%', borderRadius: 66 },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: 'white', fontSize: 22, fontWeight: '800', marginTop: 16 },
  subtitle: { color: '#cbd5e1', marginTop: 6 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  circleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  hangup: { backgroundColor: '#ef4344' },
  helper: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 10,
  },
});

export default CallingScreen;
