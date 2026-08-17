// App/Components/ChatHeader.js
import React, { useEffect, useState, memo, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import {
  startCall,
  resumeCall,
  getActiveCallBetween,
} from '../../utils/callService';

const PALETTE = {
  bgHeaderFrom: '#f8fafc',
  bgHeaderTo: '#eef2ff',
  text: '#0f172a',
  sub: '#64748b',
  ring: 'rgba(99,102,241,0.35)',
  dotOn: '#22c55e',
  dotOff: '#9ca3af',
  accent: '#0ea5e9',
  danger: '#ef4444',
  border: '#e5e7eb',
  menuBg: '#ffffff',
};

const timeAgo = date => {
  if (!date) return '';
  const d = date?.getTime ? date : new Date(date);
  const diff = Math.max(0, Date.now() - d.getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d`;
  const w = Math.floor(day / 7);
  if (w < 5) return `${w}w`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo`;
  const y = Math.floor(day / 365);
  return `${y}y`;
};

const ChatHeader = memo(function ChatHeader({
  Back,
  Profile,
  name = 'User',
  image,
  token,
  navigation,
  online,
  lastSeen,
  typing,
  onDeleteChat,
}) {
  const [peerOnlineInChat, setPeerOnlineInChat] = useState(false);
  const [callBusy, setCallBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    const unsub = firestore()
      .collection('Users')
      .doc(token)
      .onSnapshot(s => {
        setPeerOnlineInChat(!!s.data()?.onlineInChat);
      });
    return () => unsub();
  }, [token]);

  const presenceText = typing
    ? 'typing…'
    : online || peerOnlineInChat
    ? 'Online'
    : lastSeen
    ? `Last seen ${timeAgo(lastSeen)}`
    : 'Offline';

  // Single implementation shared by both Voice Call and Video Call — the
  // two previously duplicated this entire block, meaning any bug fix had
  // to be applied twice. Also adds a busy-guard (both buttons could
  // otherwise be double-tapped mid-request and start two calls) and
  // surfaces real errors to the user instead of silently swallowing them.
  const startOrResumeCall = useCallback(
    async callType => {
      if (callBusy) return;
      const me = auth().currentUser;
      if (!me) return;

      setCallBusy(true);
      try {
        const existing = await getActiveCallBetween({
          aUid: me.uid,
          bUid: token,
        });
        if (existing) {
          await resumeCall({ myUid: me.uid, otherUid: token });
          navigation.navigate('ForVideoCall', {
            channel: existing.A.channel,
            callType: existing.A.callType,
            peerUid: token,
          });
          return;
        }

        const res = await startCall({ uid: token, name, image }, callType);

        if (res?.busy) {
          Alert.alert('User busy', `${name} is on another call right now.`);
          return;
        }
        if (res?.ongoing) {
          await resumeCall({ myUid: me.uid, otherUid: token });
          navigation.navigate('ForVideoCall', {
            channel: res.channel,
            callType: res.callType,
            peerUid: token,
          });
          return;
        }

        navigation.navigate('CallingScreen', {
          channel: res.channel,
          callType: res.callType,
          token: res.receiverUid,
          isCaller: true,
          receiverUid: res.receiverUid,
        });
      } catch (e) {
        console.warn('Call start failed:', e);
        Alert.alert(
          'Call failed',
          'Could not start the call. Please try again.',
        );
      } finally {
        setCallBusy(false);
      }
    },
    [callBusy, token, name, image, navigation],
  );

  return (
    <LinearGradient
      colors={[PALETTE.bgHeaderFrom, PALETTE.bgHeaderTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.header}
    >
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={Back}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <FontAwesome5 name="arrow-left" size={18} color={PALETTE.text} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.center}
        onPress={Profile}
        activeOpacity={0.85}
      >
        <View style={styles.avatarWrap}>
          <Image
            source={
              image
                ? { uri: image }
                : require('../../Images/defaultProfile.png')
            }
            style={styles.avatar}
          />
          <View
            style={[
              styles.dot,
              {
                backgroundColor:
                  typing || online || peerOnlineInChat
                    ? PALETTE.dotOn
                    : PALETTE.dotOff,
              },
            ]}
          />
        </View>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text numberOfLines={1} style={styles.sub}>
            {presenceText}
          </Text>
        </View>
      </TouchableOpacity>

      <Menu>
        <MenuTrigger disabled={callBusy}>
          <View style={styles.iconHitbox}>
            {callBusy ? (
              <ActivityIndicator size="small" color={PALETTE.accent} />
            ) : (
              <MaterialIcons
                name="phone-in-talk"
                size={22}
                color={PALETTE.accent}
              />
            )}
          </View>
        </MenuTrigger>
        <MenuOptions
          customStyles={{
            optionsContainer: {
              paddingVertical: 6,
              backgroundColor: PALETTE.menuBg,
              borderRadius: 10,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: PALETTE.border,
            },
            optionWrapper: { paddingVertical: 10, paddingHorizontal: 14 },
          }}
        >
          <MenuOption
            onSelect={() => startOrResumeCall('audio')}
            disabled={callBusy}
          >
            <View style={styles.menuRow}>
              <MaterialIcons name="call" size={18} color={PALETTE.accent} />
              <Text style={styles.menuText}>Voice Call</Text>
            </View>
          </MenuOption>

          <MenuOption
            onSelect={() => startOrResumeCall('video')}
            disabled={callBusy}
          >
            <View style={styles.menuRow}>
              <MaterialIcons name="videocam" size={18} color={PALETTE.accent} />
              <Text style={styles.menuText}>Video Call</Text>
            </View>
          </MenuOption>
        </MenuOptions>
      </Menu>

      {/* Chat-level actions (distinct from the call menu above) */}
      <Menu>
        <MenuTrigger>
          <View
            style={styles.iconHitbox}
            accessibilityRole="button"
            accessibilityLabel="Chat options"
          >
            <MaterialIcons name="more-vert" size={22} color={PALETTE.text} />
          </View>
        </MenuTrigger>
        <MenuOptions
          customStyles={{
            optionsContainer: {
              paddingVertical: 6,
              backgroundColor: PALETTE.menuBg,
              borderRadius: 10,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: PALETTE.border,
            },
            optionWrapper: { paddingVertical: 10, paddingHorizontal: 14 },
          }}
        >
          <MenuOption onSelect={onDeleteChat}>
            <View style={styles.menuRow}>
              <MaterialIcons
                name="delete-outline"
                size={18}
                color={PALETTE.danger}
              />
              <Text style={[styles.menuText, { color: PALETTE.danger }]}>
                Delete Chat
              </Text>
            </View>
          </MenuOption>
        </MenuOptions>
      </Menu>
    </LinearGradient>
  );
});

const AVATAR = 40;

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  iconBtn: { marginRight: 6, padding: 6 },
  iconHitbox: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  avatarWrap: {
    position: 'relative',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: PALETTE.ring,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%', borderRadius: AVATAR / 2 },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: { fontWeight: '800', fontSize: 16, color: PALETTE.text },
  sub: { color: PALETTE.sub, fontSize: 12, marginTop: 1 },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  menuText: { marginLeft: 10, color: PALETTE.text, fontWeight: '600' },
});

export default ChatHeader;
