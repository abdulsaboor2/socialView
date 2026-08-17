// App/Screens/NewsFeedScreen.js
import React, { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, InteractionManager } from 'react-native';
import AppHeader from '../Components/AppHeader/AppHeader';
import AppPost from '../Components/AppPost';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const NewsFeedScreen = ({ navigation, route }) => {
  const { token } = route.params || {};
  const [feedReady, setFeedReady] = useState(false);
  const me = auth().currentUser?.uid || null;
  const [unreadCount, setUnreadCount] = useState(0);
  // NEW: drives the feed's local search filter — see AppPost's
  // `searchQuery` prop.
  const [searchQuery, setSearchQuery] = useState('');

  const tabBarHeight = route.params?.tabBarHeight || 0;

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() =>
      setFeedReady(true),
    );
    return () => task?.cancel?.();
  }, []);

  useEffect(() => {
    if (!me) return;
    const unsub = firestore()
      .collection('ListOfCollection')
      .doc(me)
      .collection('Chat')
      .onSnapshot(snap => {
        let total = 0;
        snap.forEach(d => (total += Number(d.data()?.unread || 0)));
        setUnreadCount(total);
      });
    return () => unsub();
  }, [me]);

  const go = useCallback(
    (screen, params) => navigation.navigate(screen, params),
    [navigation],
  );

  return (
    <View style={styles.container}>
      <AppHeader
        chat={() => navigation.navigate('Chat List')}
        search={() => navigation.navigate('Search')}
        showAdd
        onAddPress={() => navigation.navigate('Upload Post')}
        unread={unreadCount}
        onTitlePress={() => {
          /* scroll to top */
        }}
        // CHANGED: was a no-op comment. Now actually drives the feed's
        // local filter — see the note in AppPost about what this does
        // and doesn't search.
        onSearchChange={setSearchQuery}
      />
      {feedReady ? (
        <View style={{ flex: 1 }}>
          <AppPost
            handleNavigation={go}
            profileUser={Boolean(token)}
            userId={token}
            liveListenersMode="all"
            searchQuery={searchQuery}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: tabBarHeight + 600,
              paddingHorizontal: 12,
            }}
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <View
            style={{
              height: 280,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              marginBottom: 12,
            }}
          />
          <View
            style={{
              height: 280,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              marginBottom: 12,
            }}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});

export default NewsFeedScreen;
