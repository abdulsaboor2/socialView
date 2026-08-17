// screens/ChatListScreen.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Text,
  Alert,
  Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Feather from 'react-native-vector-icons/Feather';
import AppHeader from '../Components/AppHeader/AppHeader';
import ChatListBox from '../Components/ChatListBox';
import { deleteConversation } from '../utils/chatService';

const timeAgo = ts => {
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d`;
    const w = Math.floor(days / 7);
    if (w < 5) return `${w}w`;
    const mon = Math.floor(days / 30);
    if (mon < 12) return `${mon}mo`;
    const y = Math.floor(days / 365);
    return `${y}y`;
  } catch {
    return '';
  }
};

const REFRESH_SAFETY_TIMEOUT_MS = 5000;

const ChatListScreen = ({ navigation }) => {
  const me = auth().currentUser?.uid || null;
  const [filter, setFilter] = useState(''); // used by onSearchChange
  const [rows, setRows] = useState([]); // [{peerId, lastMsg, lastMsgTime, unread, pinned, pinnedAt}]
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const profilesRef = useRef(new Map()); // peerId -> {displayName, photoURL, online, lastActive}
  const profileUnsubsRef = useRef(new Map()); // peerId -> unsub
  const refreshTimeoutRef = useRef(null);

  // NEW: uids blocked in either direction — mirrors the same pattern used
  // in AppPost.js for feed filtering.
  const [hiddenUids, setHiddenUids] = useState(() => new Set());

  useEffect(() => {
    if (!me) {
      setHiddenUids(new Set());
      return;
    }

    const blockedByMe = new Set();
    const blockedMe = new Set();

    const recompute = () => {
      setHiddenUids(new Set([...blockedByMe, ...blockedMe]));
    };

    const unsub1 = firestore()
      .collection('Blocks')
      .where('blockerId', '==', me)
      .onSnapshot(
        snap => {
          blockedByMe.clear();
          snap.forEach(d => blockedByMe.add(d.data().blockedId));
          recompute();
        },
        () => {},
      );

    const unsub2 = firestore()
      .collection('Blocks')
      .where('blockedId', '==', me)
      .onSnapshot(
        snap => {
          blockedMe.clear();
          snap.forEach(d => blockedMe.add(d.data().blockerId));
          recompute();
        },
        () => {},
      );

    return () => {
      unsub1();
      unsub2();
    };
  }, [me]);

  const subscribePeerProfile = useCallback(peerId => {
    if (profileUnsubsRef.current.has(peerId)) return;
    const unsub = firestore()
      .collection('Users')
      .doc(peerId)
      .onSnapshot(doc => {
        const d = doc.data() || {};
        profilesRef.current.set(peerId, {
          displayName: d.displayName || d.name || 'User',
          photoURL: d.photoURL || d.image || '',
          online: !!d.online,
          lastActive: d.lastActive || null,
        });
        setRows(prev => [...prev]);
      });
    profileUnsubsRef.current.set(peerId, unsub);
  }, []);

  useEffect(() => {
    if (!me) {
      setLoading(false);
      return;
    }
    const unsub = firestore()
      .collection('ListOfCollection')
      .doc(me)
      .collection('Chat')
      .onSnapshot(
        snap => {
          const next = snap.docs.map(d => {
            const data = d.data() || {};
            const peerId = d.id;
            subscribePeerProfile(peerId);
            return {
              peerId,
              lastMsg: data.lastMsg || '',
              lastMsgTime: data.lastMsgTime || null,
              unread: Number(data.unread || 0),
              pinned: !!data.pinned,
              pinnedAt: data.pinnedAt || null,
            };
          });
          next.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            const aT = a.pinnedAt || a.lastMsgTime || 0;
            const bT = b.pinnedAt || b.lastMsgTime || 0;
            return (bT?.toMillis?.() ?? bT) - (aT?.toMillis?.() ?? aT);
          });
          setRows(next);
          setLoading(false);
          setRefreshing(false);
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
            refreshTimeoutRef.current = null;
          }
        },
        e => {
          console.log('chat list snapshot error:', e);
          setLoading(false);
          setRefreshing(false);
        },
      );
    return () => {
      unsub && unsub();
      profileUnsubsRef.current.forEach(fn => fn && fn());
      profileUnsubsRef.current.clear();
      profilesRef.current.clear();
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [me, subscribePeerProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshing(false);
      refreshTimeoutRef.current = null;
    }, REFRESH_SAFETY_TIMEOUT_MS);
  }, []);

  const onPressRow = useCallback(
    peerId => {
      const p = profilesRef.current.get(peerId) || {};
      navigation.navigate('Chat', {
        token: peerId,
        name: p.displayName || 'User',
        image: p.photoURL || '',
      });
    },
    [navigation],
  );

  const onDeleteRow = useCallback(
    (peerId, name) => {
      if (!me) return;
      Alert.alert(
        'Delete conversation?',
        `This removes your chat with ${
          name || 'this user'
        } from your list. It won't delete it for them.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteConversation({ me, peerId });
              } catch (e) {
                console.log('delete chat error:', e);
                Alert.alert('Error', 'Could not delete the conversation.');
              }
            },
          },
        ],
      );
    },
    [me],
  );

  const onPinRow = useCallback(
    async (peerId, pinned) => {
      if (!me) return;
      try {
        await firestore()
          .collection('ListOfCollection')
          .doc(me)
          .collection('Chat')
          .doc(peerId)
          .set(
            {
              pinned: !pinned,
              pinnedAt: !pinned ? firestore.FieldValue.serverTimestamp() : null,
            },
            { merge: true },
          );
      } catch (e) {
        console.log('pin chat error:', e);
      }
    },
    [me],
  );

  // NEW: blocked-in-either-direction rows are removed before search
  // filtering — someone you've blocked (or who's blocked you) shouldn't
  // show up in the list at all, regardless of what's typed in search.
  const visibleRows = useMemo(
    () => rows.filter(r => !hiddenUids.has(r.peerId)),
    [rows, hiddenUids],
  );

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return visibleRows;
    return visibleRows.filter(row => {
      const p = profilesRef.current.get(row.peerId) || {};
      const name = (p.displayName || '').toLowerCase();
      const msg = (row.lastMsg || '').toLowerCase();
      return name.includes(q) || msg.includes(q);
    });
  }, [visibleRows, filter]);

  const renderItem = useCallback(
    ({ item }) => {
      const p = profilesRef.current.get(item.peerId) || {};
      const when = item.lastMsgTime ? timeAgo(item.lastMsgTime) : '';
      return (
        <ChatListBox
          peerId={item.peerId}
          name={p.displayName || 'User'}
          message={item.lastMsg || 'Say hi 👋'}
          image={p.photoURL || ''}
          online={!!p.online}
          time={when}
          unread={item.unread}
          pinned={item.pinned}
          onPress={onPressRow}
          onDelete={onDeleteRow}
          onPin={onPinRow}
        />
      );
    },
    [onPressRow, onDeleteRow, onPinRow],
  );

  const keyExtractor = useCallback(it => it.peerId, []);

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator color="#7c3aed" />
      </View>
    );
  }

  const hasAnyConversations = rows.length > 0;
  const hasSearchTerm = filter.trim().length > 0;

  return (
    <View style={styles.container}>
      <AppHeader
        title="Chats"
        search={() => navigation.navigate('Search')}
        showAdd
        onAddPress={() => navigation.navigate('Search')}
        enableInlineSearch
        onSearchChange={text => setFilter(text)}
        showChat={false}
        unread={0}
      />
      {filteredRows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Feather
              name={hasAnyConversations ? 'search' : 'message-circle'}
              size={26}
              color="#7c3aed"
            />
          </View>
          <Text style={styles.emptyTitle}>
            {hasAnyConversations && hasSearchTerm
              ? 'No matches'
              : 'No conversations yet'}
          </Text>
          <Text style={styles.emptySub}>
            {hasAnyConversations && hasSearchTerm
              ? 'Try a different name or search term.'
              : 'Start a new chat from the + button.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7c3aed"
              colors={['#7c3aed']}
            />
          }
          removeClippedSubviews={Platform.OS === 'ios'}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },
  emptyWrap: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  emptySub: { marginTop: 6, color: '#6b7280', textAlign: 'center' },
});

export default ChatListScreen;
