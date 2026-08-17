// App/Screens/StoriesTabScreen.jsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import AppStoriesRow from '../Components/AppStoriesRow';
import AppHeader from '../Components/AppHeader/AppHeader';

export default function StoriesTabScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Stories"
        search={() => navigation.navigate('Search')}
        showAdd
        onAddPress={() => navigation.navigate('AddStory')}
        enableInlineSearch
        onSearchChange={text => setFilter(text.trim())}
        showChat={false}
        unread={0}
      />
      {/* FIX: `filter` was tracked in state but never actually reached
          AppStoriesRow — the search box updated state that nothing read.
          AppStoriesRow now accepts a `filter` prop and applies it. */}
      <AppStoriesRow
        navigation={navigation}
        refreshing={refreshing}
        onRefresh={onRefresh}
        filter={filter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
