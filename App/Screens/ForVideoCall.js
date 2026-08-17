// App/Screens/ForVideoCall.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  BackHandler,
  InteractionManager,
  PermissionsAndroid,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { endCallForBoth, minimizeCall } from '../utils/callService';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';

const AGORA_APP_ID = 'c6bc44bf04af4729bde9447d18468aa4';

async function requestCallPermissions(callType) {
  if (Platform.OS !== 'android') return true;
  try {
    const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (callType === 'video') perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    const results = await PermissionsAndroid.requestMultiple(perms);
    return perms.every(p => results[p] === PermissionsAndroid.RESULTS.GRANTED);
  } catch {
    return false;
  }
}

const formatDuration = totalSeconds => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ForVideoCall = ({ navigation, route }) => {
  const { channel, callType = 'video', peerUid } = route.params || {};
  const me = auth().currentUser;
  // Depend on the primitive, not the object — see safeEnd/onMinimize
  // below for why this matters here specifically.
  const myUid = me?.uid;

  const [inCall, setInCall] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(callType === 'video');
  const [previewStarted, setPreviewStarted] = useState(false);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState(null);
  const [engineError, setEngineError] = useState(null);
  const [peerProfile, setPeerProfile] = useState({ name: '', image: '' });

  const [connectedAt, setConnectedAt] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const engineRef = useRef(null);
  const endedRef = useRef(false);
  const mountedRef = useRef(true);
  const minimizingRef = useRef(false);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const safeEnd = useCallback(
    async ({ remoteHangup = false } = {}) => {
      if (endedRef.current) return;
      endedRef.current = true;

      const run = async () => {
        try {
          if (!remoteHangup && myUid && peerUid) {
            await endCallForBoth({ callerUid: myUid, receiverUid: peerUid });
          }
        } catch (e) {
          // Don't let this become an unhandled promise rejection — ending
          // a call should never crash silently. The person still leaves
          // the screen via `finally` below regardless of whether the
          // Firestore write succeeded.
          console.warn('endCallForBoth failed:', e?.message || e);
        } finally {
          if (!mountedRef.current) return;
          setInCall(false);
          navigation?.canGoBack?.() && navigation.goBack();
        }
      };

      setTimeout(() => InteractionManager.runAfterInteractions(run), 0);
    },
    [myUid, peerUid, navigation],
  );

  // ---- Agora engine lifecycle: create, join, tear down on unmount ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const allowed = await requestCallPermissions(callType);
      if (!allowed) {
        if (!cancelled) {
          Alert.alert(
            'Permission needed',
            `Please grant ${
              callType === 'video' ? 'camera and microphone' : 'microphone'
            } access to make this call.`,
          );
          safeEnd();
        }
        return;
      }

      try {
        const engine = createAgoraRtcEngine();
        engineRef.current = engine;

        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            if (!mountedRef.current) return;
            setJoined(true);
          },
          onUserJoined: (_connection, uid) => {
            if (!mountedRef.current) return;
            setRemoteUid(uid);
          },
          onUserOffline: (_connection, uid) => {
            if (!mountedRef.current) return;
            setRemoteUid(prev => (prev === uid ? null : prev));
          },
          onError: err => {
            console.warn('Agora engine error:', err);
          },
        });

        engine.enableAudio();
        engine.setEnableSpeakerphone(callType === 'video');

        if (callType === 'video') {
          engine.enableVideo();
          engine.startPreview();
          engine.muteLocalVideoStream(false);
          if (!cancelled) setPreviewStarted(true);
        } else {
          engine.disableVideo();
        }

        engine.joinChannel(null, channel || 'default', 0, {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        });
      } catch (e) {
        console.warn('Agora init failed:', e);
        if (!cancelled)
          setEngineError(e?.message || 'Could not start the call.');
      }
    })();

   return () => {
      cancelled = true;

      try {
        engineRef.current?.leaveChannel();
        engineRef.current?.release();
      } catch {}

      engineRef.current = null;
    };
  }, [channel, callType, safeEnd]);

  // If the other side ends/deletes → end here too. Also doubles as the
  // source for the peer's name/photo (already stored on this same doc by
  // callService.js), so the audio-call UI has something to show without
  // needing extra params passed from whichever screen launched the call.
  useEffect(() => {
    if (!myUid) return;
    const unsub = firestore()
      .collection('calls')
      .doc(myUid)
      .onSnapshot(s => {
        const call = s.data();
        if (!call || call.active === false) {
          setTimeout(() => safeEnd({ remoteHangup: true }), 0);
          return;
        }
        const isCaller = call.callerUid === myUid;
        setPeerProfile({
          name: (isCaller ? call.receiverName : call.callerName) || '',
          image: (isCaller ? call.receiverImage : call.callerImage) || '',
        });
      });
    return () => unsub && unsub();
  }, [myUid, safeEnd]);

  // Start the duration clock once the remote side actually joins.
  useEffect(() => {
    if (remoteUid != null && connectedAt == null) {
      setConnectedAt(Date.now());
    }
  }, [remoteUid, connectedAt]);

  useEffect(() => {
    if (connectedAt == null) return;
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - connectedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [connectedAt]);

  const onMinimize = useCallback(async () => {
    if (!myUid) return;

    try {
      await minimizeCall({
        myUid,
      });

      // Tell the screen that we are intentionally hiding it.
      minimizingRef.current = true;

      navigation?.canGoBack?.() && navigation.goBack();
    } catch (e) {
      console.warn('minimizeCall failed:', e?.message || e);
    }
  }, [myUid, navigation]);

  // HW back → minimize like WhatsApp
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onMinimize();
      return true;
    });
    return () => sub.remove();
  }, [onMinimize]);

  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      engineRef.current?.muteLocalAudioStream(next);
      return next;
    });
  }, []);

  const toggleVideo = useCallback(() => {
    setIsVideoOn(v => {
      const next = !v;
      engineRef.current?.muteLocalVideoStream(!next);
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(s => {
      const next = !s;
      engineRef.current?.setEnableSpeakerphone(next);
      return next;
    });
  }, []);

  const switchCamera = useCallback(() => {
    try {
      engineRef.current?.switchCamera();
    } catch (e) {
      console.warn('switchCamera failed:', e);
    }
  }, []);

  if (!inCall) return null;

  const statusText =
    remoteUid != null
      ? formatDuration(elapsedSec)
      : joined
      ? 'Waiting for the other side…'
      : 'Connecting…';

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1220' }}>
      <SafeAreaView>
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onMinimize}
            style={styles.topBtn}
            activeOpacity={0.9}
          >
            <Ionicons name="chevron-down" size={22} color="#e6f0ff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {callType === 'video' ? 'Video Call' : 'Voice Call'}
            {remoteUid != null ? ` · ${formatDuration(elapsedSec)}` : ''}
          </Text>
          <View style={styles.topBtn} />
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {engineError ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={32} color="#fca5a5" />
            <Text style={styles.errorText}>{engineError}</Text>
          </View>
        ) : callType === 'video' ? (
          <>
            {remoteUid != null ? (
              <RtcSurfaceView canvas={{ uid: remoteUid }} style={{ flex: 1 }} />
            ) : (
              <View style={styles.center}>
                <Text style={styles.waitingText}>
                  {joined
                    ? 'Waiting for the other side to join…'
                    : 'Connecting…'}
                </Text>
              </View>
            )}
            {isVideoOn && previewStarted && (
              <View style={styles.localPreview}>
                <RtcSurfaceView canvas={{ uid: 0 }} style={{ flex: 1 }} />
              </View>
            )}
          </>
        ) : (
          <View style={styles.center}>
            <View style={styles.audioAvatarWrap}>
              {peerProfile.image ? (
                <Image
                  source={{ uri: peerProfile.image }}
                  style={styles.audioAvatar}
                />
              ) : (
                <View style={[styles.audioAvatar, styles.audioAvatarFallback]}>
                  <Ionicons name="person" size={48} color="#9aa4b2" />
                </View>
              )}
            </View>
            <Text style={styles.audioName} numberOfLines={1}>
              {peerProfile.name || 'User'}
            </Text>
            <Text style={styles.waitingText}>{statusText}</Text>
          </View>
        )}
      </View>

      <SafeAreaView>
        <View style={styles.controls}>
          <Circle
            onPress={toggleMute}
            active={isMuted}
            icon={isMuted ? 'mic-off' : 'mic'}
            label={isMuted ? 'Unmute' : 'Mute'}
          />
          <Circle
            onPress={toggleSpeaker}
            active={isSpeakerOn}
            icon={isSpeakerOn ? 'volume-high' : 'ear-outline'}
            label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
          />
          {callType === 'video' && (
            <>
              <Circle
                onPress={toggleVideo}
                active={!isVideoOn}
                icon={isVideoOn ? 'videocam' : 'videocam-off'}
                label={isVideoOn ? 'Camera' : 'Camera Off'}
              />
              <Circle
                onPress={switchCamera}
                icon="camera-reverse-outline"
                label="Flip"
              />
            </>
          )}
          <Circle danger onPress={() => safeEnd()} icon="call" label="End" />
        </View>
      </SafeAreaView>
    </View>
  );
};

const Circle = ({ onPress, icon, label, danger, active }) => (
  <View style={{ alignItems: 'center' }}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.circleBtn,
        danger && styles.danger,
        active && styles.active,
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={danger ? '#fff' : active ? '#0b1220' : '#e6f0ff'}
      />
    </TouchableOpacity>
    <Text style={styles.btnLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  topBar: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#d8e7ff', fontWeight: '700', fontSize: 14 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  waitingText: { color: '#93c5fd', marginTop: 10, textAlign: 'center' },
  errorText: { color: '#fca5a5', marginTop: 10, textAlign: 'center' },
  audioAvatarWrap: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  audioAvatar: { width: '100%', height: '100%', borderRadius: 66 },
  audioAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioName: { color: 'white', fontSize: 22, fontWeight: '800' },
  localPreview: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: '#111827',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  circleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: { color: '#cbd5e1', fontSize: 12, marginTop: 6 },
  danger: { backgroundColor: '#ef4444' },
  active: { backgroundColor: '#cfe4ff' },
});

export default ForVideoCall;
