// App/Screens/IncomingCallScreen.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Image,
  InteractionManager,
  Alert,
} from 'react-native';
// FIX: same bug already found and fixed in CallingScreen.jsx — this was
// destructured from 'react-native' (core RN's SafeAreaView, unreliable on
// Android) instead of 'react-native-safe-area-context'. Lower visible
// impact here since everything on this screen is vertically centered
// rather than pinned to an edge, but it's the same underlying bug.
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { pickCallForBoth, endCallForBoth } from '../utils/callService';

const IncomingCallScreen = ({ route, navigation }) => {
  const {
    token,
    callerName: pName,
    callerImage: pImage,
    callType: pType,
    callerUid: pCallerUid,
  } = route.params || {};
  const me = auth().currentUser;

  const [call, setCall] = useState(null);
  const name = call?.callerName || pName || 'Someone';
  const image = call?.callerImage || pImage || null;
  const callType = call?.callType || pType || 'video';
  const peerUid = useMemo(
    () => (call?.callerUid ? call.callerUid : pCallerUid),
    [call?.callerUid, pCallerUid],
  );

  const navigatedRef = useRef(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    Vibration.vibrate([400, 600], true);
    return () => Vibration.cancel();
  }, []);

  // Only receivers get this screen
  useEffect(() => {
    if (!me) return;
    const unsub = firestore()
      .collection('calls')
      .doc(me.uid)
      .onSnapshot(snap => {
        const data = snap.data();
        if (!data || data.active === false) {
          Vibration.cancel();
          navigation.canGoBack() && navigation.goBack();
          return;
        }
        if (data.role !== 'receiver') return;
        if (data.picked && !navigatedRef.current) {
          navigatedRef.current = true;
          Vibration.cancel();
          InteractionManager.runAfterInteractions(() => {
            navigation.replace('ForVideoCall', {
              channel: data.channel,
              callType: data.callType,
              peerUid: data.callerUid,
            });
          });
          return;
        }
        setCall(data);
      });
    return () => unsub && unsub();
  }, [me?.uid, navigation]);

  const acceptCall = async () => {
    if (!me || !peerUid || !call?.channel || accepting) return;
    setAccepting(true);
    Vibration.cancel();
    try {
      await pickCallForBoth({ myUid: me.uid, otherUid: peerUid });
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      InteractionManager.runAfterInteractions(() => {
        navigation.replace('ForVideoCall', {
          channel: call.channel,
          callType: call.callType,
          peerUid,
        });
      });
    } catch (e) {
      // FIX: previously had no try/catch at all — a failed accept meant
      // the person tapped the button and nothing happened, with no
      // indication anything went wrong or that they should try again.
      // This needs a visible alert (not just a console log) since
      // there's no other feedback mechanism on this screen for it.
      console.warn('pickCallForBoth failed:', e?.message || e);
      setAccepting(false);
      Alert.alert('Error', "Couldn't accept the call. Please try again.");
    }
  };

  const declineCall = async () => {
    if (!me || !peerUid) {
      navigation.canGoBack() && navigation.goBack();
      return;
    }
    Vibration.cancel();
    await endCallForBoth({ callerUid: peerUid, receiverUid: me.uid }).catch(
      e => {
        console.warn('endCallForBoth (decline) failed:', e?.message || e);
      },
    );
    navigation.canGoBack() && navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.center}>
          <Ionicons
            name={callType === 'video' ? 'videocam' : 'call'}
            size={28}
            color="#93c5fd"
            style={{ marginBottom: 10 }}
          />
          <View style={styles.avatarWrap}>
            {image ? (
              <Image source={{ uri: image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={44} color="#c7d2fe" />
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.subtitle}>is calling…</Text>
          <View style={styles.actions}>
            <Round
              bg="#22c55e"
              icon="call"
              onPress={acceptCall}
              label={accepting ? 'Accepting…' : 'Accept'}
              disabled={accepting}
            />
            <Round
              bg="#ef4444"
              icon="close"
              onPress={declineCall}
              label="Decline"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const Round = ({ bg, icon, onPress, label, disabled }) => (
  <View style={{ alignItems: 'center' }}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
      style={[
        styles.round,
        { backgroundColor: bg },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.btnText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1220' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  avatarWrap: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: '#60a5fa',
    padding: 4,
    marginTop: 6,
    marginBottom: 14,
  },
  avatar: { flex: 1, borderRadius: 66 },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#e5e7eb', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#93c5fd', marginTop: 6, marginBottom: 26 },
  actions: { flexDirection: 'row', gap: 40 },
  round: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  btnText: { color: '#d1d5db', marginTop: 8, fontSize: 12, fontWeight: '700' },
});

export default IncomingCallScreen;
