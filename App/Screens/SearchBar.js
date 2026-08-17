import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/Feather';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const DEBOUNCE_MS = 250;
const PAGE_SIZE = 30;
const GRADIENT = ['#7c3aed', '#db2777'];

const capitalizeWords = t => t.replace(/\b\w/g, c => c.toUpperCase());

export default function SearchBar({ navigation }) {
  const [query, setQuery] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  const [items, setItems] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [endReached, setEndReached] = useState(false);
  const [error, setError] = useState('');

  const currentUidRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    currentUidRef.current = auth().currentUser?.uid || null;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const buildQuery = useCallback(() => {
    const base = firestore().collection('Users');
    if (!qDebounced) {
      return base.orderBy('displayName');
    }
    const isEmailQuery = qDebounced.includes('@');
    if (isEmailQuery) {
      const start = qDebounced.toLowerCase();
      const end = start + '\uf8ff';
      return base
        .orderBy('email')
        .where('email', '>=', start)
        .where('email', '<', end);
    }
    const start = capitalizeWords(qDebounced);
    const end = start + '\uf8ff';
    return base
      .orderBy('displayName')
      .where('displayName', '>=', start)
      .where('displayName', '<', end);
  }, [qDebounced]);

  const fetchPage = useCallback(
    async (mode = 'first') => {
      if (isFetching || (endReached && mode === 'next')) return;
      setIsFetching(true);
      setError('');

      try {
        let q = buildQuery().limit(PAGE_SIZE);
        if (mode === 'next' && cursor) q = q.startAfter(cursor);

        const snap = await q.get();
        if (!mountedRef.current) return;

        const me = currentUidRef.current;
        const fresh = snap.docs
          .map(d => ({ id: d.id, ...(d.data() || {}) }))
          .filter(u => (u.uid || u.id) !== me);

        setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
        if (snap.docs.length < PAGE_SIZE) setEndReached(true);

        setItems(prev => {
          if (mode !== 'next') return fresh;
          const existingIds = new Set(prev.map(u => String(u.id || u.uid)));
          const uniqueFresh = fresh.filter(
            u => !existingIds.has(String(u.id || u.uid)),
          );
          return [...prev, ...uniqueFresh];
        });
      } catch (e) {
        console.warn('Users query failed:', e);
        setError('Could not load users.');
      } finally {
        if (mountedRef.current) {
          setIsFetching(false);
          if (mode === 'first') setRefreshing(false);
        }
      }
    },
    [buildQuery, cursor, endReached, isFetching],
  );

  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setEndReached(false);
    fetchPageRef.current('first');
  }, [qDebounced]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCursor(null);
    setEndReached(false);
    fetchPage('first');
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (!isFetching && !endReached && !error) fetchPage('next');
  }, [endReached, error, fetchPage, isFetching]);

  const clearQuery = useCallback(() => setQuery(''), []);

  const keyExtractor = useCallback(
    (item, index) => String(item.id || item.uid || `user-${index}`),
    [],
  );

  const onPressUser = useCallback(
    u => navigation.navigate('User Profile', { token: u.uid || u.id }),
    [navigation],
  );

  const renderHighlight = useCallback(
    text => {
      if (!qDebounced)
        return <Text style={styles.userName}>{text || 'Unknown User'}</Text>;
      const t = String(text || '');
      const idx = t.toLowerCase().indexOf(qDebounced.toLowerCase());
      if (idx < 0)
        return <Text style={styles.userName}>{t || 'Unknown User'}</Text>;
      const before = t.slice(0, idx);
      const match = t.slice(idx, idx + qDebounced.length);
      const after = t.slice(idx + qDebounced.length);
      return (
        <Text style={styles.userName}>
          {before}
          <Text style={styles.userNameHighlight}>{match}</Text>
          {after}
        </Text>
      );
    },
    [qDebounced],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const online = !!item.onlineInChat;
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onPressUser(item)}
          style={styles.userItem}
        >
          <View style={styles.avatarWrap}>
            <Image
              style={styles.userImage}
              source={
                item.image
                  ? { uri: item.image }
                  : require('../Images/defaultProfile.png')
              }
            />
            <View
              style={[
                styles.dot,
                { backgroundColor: online ? '#22c55e' : '#9ca3af' },
              ]}
            />
          </View>
          <View style={styles.userInfo}>
            {renderHighlight(item.displayName)}
            <Text style={styles.userEmail}>{item.email || 'No email'}</Text>
          </View>
          <Icon name="chevron-right" size={18} color="#9ca3af" />
        </TouchableOpacity>
      );
    },
    [onPressUser, renderHighlight],
  );

  const isInitialLoading = items.length === 0 && isFetching;

  const ListEmpty = useCallback(() => {
    if (isInitialLoading) {
      return (
        <View style={{ padding: 16 }}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <View style={styles.skeletonAvatar} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.skeletonLine} />
                <View
                  style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]}
                />
              </View>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View
        style={{ alignItems: 'center', marginTop: 48, paddingHorizontal: 20 }}
      >
        <Icon name="users" size={36} color="#bdbfc7" />
        <Text style={styles.emptyTitle}>No users found</Text>
        <Text style={styles.emptyText}>
          {qDebounced
            ? 'Try a different name or email — search matches from the start of the name/email.'
            : 'No users to show yet.'}
        </Text>
      </View>
    );
  }, [isInitialLoading, qDebounced]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENT} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Search</Text>
            <View style={styles.iconBtn} />
          </View>

          <View style={styles.searchBar}>
            <Icon
              name="search"
              size={18}
              color="#fff"
              style={{ marginLeft: 10 }}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search users…"
              placeholderTextColor="rgba(255,255,255,0.75)"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search users by name or email"
            />
            {!!query && (
              <TouchableOpacity
                onPress={clearQuery}
                hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Icon
                  name="x"
                  size={20}
                  color="#fff"
                  style={{ paddingHorizontal: 10 }}
                />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.metaRow}>
        {isInitialLoading ? (
          <View style={styles.chip}>
            <ActivityIndicator size="small" color="#7c3aed" />
          </View>
        ) : (
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              {items.length} loaded{endReached ? '' : '+'}
            </Text>
          </View>
        )}
        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={<ListEmpty />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetching && items.length > 0 ? (
            <ActivityIndicator
              size="small"
              color="#7c3aed"
              style={{ marginVertical: 16 }}
            />
          ) : endReached && items.length > 0 ? (
            <Text
              style={{ textAlign: 'center', color: '#999', marginVertical: 16 }}
            >
              No more users
            </Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7c3aed"
            colors={['#7c3aed']}
          />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        removeClippedSubviews
        windowSize={11}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },

  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 12,
  },
  headerRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 24,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    height: 46,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: 'white',
    paddingLeft: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    gap: 8,
  },
  chip: {
    backgroundColor: '#ede9fe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: '#7c3aed', fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },

  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    elevation: 2,
  },
  avatarWrap: { position: 'relative' },
  userImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e5e7eb',
  },
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: '#111' },
  userNameHighlight: { color: '#7c3aed' },
  userEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  emptyTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#6b7280',
  },
  emptyText: {
    marginTop: 2,
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },

  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    marginHorizontal: 12,
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e5e7eb',
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    width: '60%',
  },
});
