// App/Screens/StoryViewersScreen.jsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StoryViewersScreen({ route }) {
  const { storyId } = route.params || {};
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const me = auth().currentUser;

  useEffect(() => {
    if (!storyId || !me?.uid) {
      setLoading(false);
      return;
    }
    // `.where('ownerId', '==', me.uid)` added alongside the existing
    // storyId filter — this screen only ever opens for the story's own
    // owner (see the "eye" button in StoryScreen.jsx, only shown when
    // isCurrentUser), so this doesn't change who sees what. It's required
    // because Firestore rules can't protect a list query unless the
    // query's own filters prove the rule condition — the StoryViews read
    // rule checks resource.data.ownerId == request.auth.uid, and without
    // a matching where() clause here, this query gets rejected outright.
    const q = firestore()
      .collection('StoryViews')
      .where('storyId', '==', storyId)
      .where('ownerId', '==', me.uid);

    const unsub = q.onSnapshot(
      snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort(
            (a, b) =>
              (b?.viewedAt?.toMillis?.() ?? 0) -
              (a?.viewedAt?.toMillis?.() ?? 0),
          );
        setViewers(list);
        setLoading(false);
      },
      err => {
        console.log('StoryViews listener failed:', err?.message || err);
        setLoading(false);
      },
    );
    return () => unsub && unsub();
  }, [storyId, me?.uid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e90ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header — paddingTop uses the real device inset instead of relying
          on the default paddingVertical alone, so this never sits behind
          a status bar / punch-hole camera on Android. */}
      <View style={[styles.header, { paddingTop: insets.top + 15 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Story Viewers</Text>
        <View style={{ width: 28 }} />
      </View>

      {viewers.length > 0 ? (
        <FlatList
          data={viewers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.viewerItem}>
              <Image
                source={
                  item.viewerProfile
                    ? { uri: item.viewerProfile }
                    : require('../Images/defaultProfile.png')
                }
                style={styles.profilePicture}
                resizeMode="cover"
              />
              <Text style={styles.username}>
                {item.viewerName || 'Someone'}
              </Text>
            </View>
          )}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: insets.bottom + 10 },
          ]}
        />
      ) : (
        <View style={styles.noViewersContainer}>
          <Ionicons name="eye-off-outline" size={64} color="#ccc" />
          <Text style={styles.noViewersText}>No viewers yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9',
    elevation: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  listContainer: { paddingHorizontal: 20, paddingVertical: 10 },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#da1e72',
  },
  username: { fontSize: 16, color: '#333' },
  noViewersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noViewersText: {
    fontSize: 18,
    color: '#aaa',
    marginTop: 10,
    textAlign: 'center',
  },
});
