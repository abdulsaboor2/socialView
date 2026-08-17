// App/Components/CallWatcher.jsx
import React, { useEffect, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { navigationRef } from '../Navigation/NavigationService';

const CALL_SCREENS = new Set([
  'IncomingCallScreen',
  'CallingScreen',
  'ForVideoCall',
]);


export default function CallWatcher() {
  const lastNavRef = useRef(0);

  useEffect(() => {
    let callUnsub = null;
    
    const authUnsub = auth().onAuthStateChanged(user => {
      if (callUnsub) {
        callUnsub();
        callUnsub = null;
      }
      if (!user) return;

      callUnsub = firestore()
        .collection('calls')
        .doc(user.uid)
        .onSnapshot(snap => {
          const call = snap.data();
          const now = Date.now();
          if (!call) return;
          if (call.role !== 'receiver') return;
          if (!call.active || call.picked) return;
          if (!navigationRef.isReady()) return;

          const activeRoute = navigationRef.getCurrentRoute()?.name;
          if (CALL_SCREENS.has(activeRoute)) return;
          if (now - lastNavRef.current < 500) return; // throttle

          lastNavRef.current = now;
          navigationRef.navigate('IncomingCallScreen', {
            token: user.uid,
            callerName: call.callerName,
            callerImage: call.callerImage,
            callType: call.callType,
            callerUid: call.callerUid,
          });
        });
    });

    return () => {
      authUnsub();
      callUnsub && callUnsub();
    };
  }, []);

  return null;
}
