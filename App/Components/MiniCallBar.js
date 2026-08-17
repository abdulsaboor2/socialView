// App/Components/MiniCallBar.jsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { endCallForBoth, resumeCall } from '../utils/callService';
import { navigationRef } from '../Navigation/NavigationService';


export default function MiniCallBar() {
  const [call, setCall] = useState(null);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    let callUnsub = null;

    const authUnsub = auth().onAuthStateChanged(user => {
      if (callUnsub) {
        callUnsub();
        callUnsub = null;
      }
      if (!user) {
        setCall(null);
        return;
      }

      callUnsub = firestore()
        .collection('calls')
        .doc(user.uid)
        .onSnapshot(snap => {
          const c = snap.data();
          if (c && c.active && c.minimized) {
            setCall(c);
          } else {
            setCall(null);
          }
        });
    });

    
    return () => {
      authUnsub();
      callUnsub && callUnsub();
    };
  }, []);

  if (!call) return null;

  const otherUid = call.role === 'receiver' ? call.callerUid : call.receiverUid;

  const onReturn = async () => {
    const me = auth().currentUser;
    if (!me || !otherUid) return;
    await resumeCall({
      myUid: me.uid,
    }).catch(e => {
      console.warn('resumeCall failed:', e);
    });
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('ForVideoCall', {
      channel: call.channel,
      callType: call.callType,
      peerUid: otherUid,
    });
  };

  const onHangup = async () => {
    await endCallForBoth({
      callerUid: call.callerUid,
      receiverUid: call.receiverUid,
    }).catch(() => {});
  };

  return (
    <View style={[styles.wrap, { bottom: (insets?.bottom || 0) + 72 }]}>
      <TouchableOpacity
        style={styles.body}
        onPress={onReturn}
        activeOpacity={0.85}
      >
        <Text style={styles.text} numberOfLines={1}>
          {call.callType === 'video' ? 'Video call' : 'Voice call'} • tap to
          return
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.hang} onPress={onHangup}>
        <Text style={styles.hangText}>End</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 6,
  },
  body: { flex: 1 },
  text: { color: 'white', fontWeight: '700' },
  hang: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  hangText: { color: 'white', fontWeight: '800' },
});
