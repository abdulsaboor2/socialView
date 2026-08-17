// App/Screens/CallHistory.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AppHeader from '../Components/AppHeader/AppHeader';

const fmt = ms => (ms ? new Date(ms).toLocaleString() : '—');
const fmtDur = s => (typeof s === 'number' ? `${s}s` : '—');

const avatarOf = u => u?.photoURL || u?.image || u?.avatar || '';
const nameOf = u => u?.displayName || u?.name || u?.username || '';

const AVATAR = 40;

const CallHistoryRow = memo(function CallHistoryRow({
  item,
  peerId,
  displayName,
  avatar,
  onOpenChat,
  onRemove,
}) {
  const isVideo = item.callType === 'video';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={18} color="#9ca3af" />
              </View>
            )}
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={isVideo ? 'videocam' : 'call'}
                size={16}
                color={isVideo ? '#2563eb' : '#10b981'}
              />
              <Text style={styles.title} numberOfLines={1}>
                {isVideo ? 'Video' : 'Audio'} • {displayName}
              </Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              Ended: {fmt(item.endedAt)} {item.status ? `• ${item.status}` : ''}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              Duration: {fmtDur(item.durationSec)}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => onOpenChat(peerId, displayName, avatar)}
            style={[styles.iconBtn, { backgroundColor: '#2563eb' }]}
            accessibilityRole="button"
            accessibilityLabel={`Message ${displayName}`}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onRemove(item.id)}
            style={[styles.iconBtn, { backgroundColor: '#ef4444' }]}
            accessibilityRole="button"
            accessibilityLabel="Delete this call from history"
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function CallHistory({ navigation }) {
  const me = auth().currentUser;
  const [items, setItems] = useState([]);

  const profilesRef = useRef(new Map());
  const profileUnsubsRef = useRef(new Map());

  // FIX: this was `const [, forcePaint] = useState(0)` — the counter
  // value itself was discarded, only the setter kept. That's harmless on
  // its own (bumping unused state still re-renders CallHistory), but
  // FlatList does its OWN internal memoization and only re-renders its
  // rows when `data`, `renderItem`, or `extraData` change by reference.
  // Since `items` doesn't change when a profile snapshot arrives, and
  // `renderItem` is memoized on deps that also don't change, FlatList had
  // no signal that anything changed — a caller's real name/avatar could
  // finish loading into `profilesRef` and never actually appear on
  // screen. Keeping the counter and passing it as `extraData` below is
  // exactly what that prop exists for.
  const [profileVersion, forcePaint] = useState(0);

  useEffect(() => {
    if (!me) return;
    const ref = firestore()
      .collection('callHistory')
      .doc(me.uid)
      .collection('items')
      .orderBy('endedAt', 'desc');

    const unsub = ref.onSnapshot(snap => {
      const next = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(next);

      const needUids = new Set();
      next.forEach(it => {
        const otherUid =
          it.callerUid === me.uid ? it.receiverUid : it.callerUid;
        if (
          otherUid &&
          !profilesRef.current.has(otherUid) &&
          !profileUnsubsRef.current.has(otherUid)
        ) {
          needUids.add(otherUid);
        }
      });

      needUids.forEach(uid => {
        const u = firestore()
          .collection('Users')
          .doc(uid)
          .onSnapshot(s => {
            const d = s.data() || {};
            profilesRef.current.set(uid, {
              displayName: nameOf(d) || uid,
              photoURL: avatarOf(d) || '',
            });
            forcePaint(n => n + 1);
          });
        profileUnsubsRef.current.set(uid, u);
      });
    });

    return () => {
      unsub && unsub();
      profileUnsubsRef.current.forEach(fn => fn && fn());
      profileUnsubsRef.current.clear();
      profilesRef.current.clear();
    };
  }, [me?.uid]);

  const onOpenChat = useCallback(
    (peerId, displayName, avatar) => {
      navigation.navigate('Chat', {
        token: peerId,
        name: displayName,
        image: avatar || null,
      });
    },
    [navigation],
  );

  const onRemove = useCallback(
    id => {
      if (!me) return;
      Alert.alert(
        'Delete this call?',
        "This removes it from your call history. It stays in the other person's history.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await firestore()
                  .collection('callHistory')
                  .doc(me.uid)
                  .collection('items')
                  .doc(id)
                  .delete();
              } catch {
                Alert.alert('Error', 'Could not delete.');
              }
            },
          },
        ],
      );
    },
    [me],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const otherUid =
        item.callerUid === me.uid ? item.receiverUid : item.callerUid;
      const prof = profilesRef.current.get(otherUid) || {};
      return (
        <CallHistoryRow
          item={item}
          peerId={otherUid}
          displayName={prof.displayName || otherUid}
          avatar={prof.photoURL}
          onOpenChat={onOpenChat}
          onRemove={onRemove}
        />
      );
    },
    [me?.uid, onOpenChat, onRemove],
  );

  const keyExtractor = useCallback(it => it.id, []);

  const listEmpty = useMemo(
    () => (
      <View style={styles.center}>
        <Text style={{ color: '#6b7280' }}>No calls yet.</Text>
      </View>
    ),
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <AppHeader
        chat={() => navigation.navigate('Chat List')}
        search={() => navigation.navigate('Search')}
        onAddPress={() => navigation.navigate('Upload Post')}
        unread={0}
        onTitlePress={() => {
          /* scroll to top */
        }}
        onSearchChange={q => {
          /* live filter */
        }}
      />
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        // See profileVersion comment above — this is what actually makes
        // a profile finishing its fetch visible on screen.
        extraData={profileVersion}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 24, flexGrow: 1 }}
        ListEmptyComponent={listEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },

  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
  },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarFallback: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { marginLeft: 6, fontWeight: '700', color: '#111827', flex: 1 },
  meta: { color: '#6b7280', marginTop: 2, fontSize: 12 },

  actions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
