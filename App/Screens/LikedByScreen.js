// App/Screens/LikedByScreen.js
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';

const GRADIENT = ['#7c3aed', '#db2777'];
const AVATAR = 44;

const LikerRow = memo(function LikerRow({ uid, name, photoURL, onPress }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(uid)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`View ${name}'s profile`}
    >
      <Image
        source={
          photoURL ? { uri: photoURL } : require('../Images/defaultProfile.png')
        }
        style={styles.avatar}
      />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
});

export default function LikedByScreen({ navigation, route }) {
  const postId = route?.params?.postId;
  const [likerUids, setLikerUids] = useState([]);
  const [loading, setLoading] = useState(true);

  const profilesRef = useRef(new Map());
  const profileUnsubsRef = useRef(new Map());
  const [profileVersion, forcePaint] = useState(0);

  // CHANGED: was querying the Likes collection with
  // .where('postId', '==', postId) — that collection has zero documents
  // now, permanently, since toggleLike writes directly to
  // Posts.likedBy instead. This reads that array off the post itself.
  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }

    const unsub = firestore()
      .collection('Posts')
      .doc(postId)
      .onSnapshot(
        snap => {
          const data = snap.data() || {};
          const rawUids = Array.isArray(data.likedBy) ? data.likedBy : [];
          // arrayUnion appends to the end, so the most recently-liked
          // uid is last — reverse so the list reads most-recent-first.
          const uids = [...rawUids].reverse();

          setLikerUids(uids);
          setLoading(false);

          uids.forEach(uid => {
            if (
              profilesRef.current.has(uid) ||
              profileUnsubsRef.current.has(uid)
            )
              return;
            const u = firestore()
              .collection('Users')
              .doc(uid)
              .onSnapshot(s => {
                const d = s.data() || {};
                profilesRef.current.set(uid, {
                  displayName: d.displayName || d.name || 'User',
                  photoURL: d.photoURL || d.image || '',
                });
                forcePaint(n => n + 1);
              });
            profileUnsubsRef.current.set(uid, u);
          });
        },
        () => setLoading(false),
      );

    return () => {
      unsub && unsub();
      profileUnsubsRef.current.forEach(fn => fn && fn());
      profileUnsubsRef.current.clear();
      profilesRef.current.clear();
    };
  }, [postId]);

  const openProfile = useCallback(
    uid => {
      navigation.navigate('User Profile', { token: uid });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item: uid }) => {
      const p = profilesRef.current.get(uid) || {};
      return (
        <LikerRow
          uid={uid}
          name={p.displayName || 'User'}
          photoURL={p.photoURL}
          onPress={openProfile}
        />
      );
    },
    [openProfile],
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={GRADIENT} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Liked by</Text>
            <View style={styles.iconBtn} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7c3aed" />
        </View>
      ) : likerUids.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={28} color="#9CA3AF" />
          <Text style={styles.emptyText}>No likes yet.</Text>
        </View>
      ) : (
        <FlatList
          data={likerUids}
          keyExtractor={uid => uid}
          renderItem={renderItem}
          extraData={profileVersion}
          contentContainerStyle={{ padding: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingBottom: 10,
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9CA3AF', marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#e5e7eb',
    marginRight: 12,
  },
  name: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
});
