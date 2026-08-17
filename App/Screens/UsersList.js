import React from 'react';
import { View, StyleSheet } from 'react-native';
import SearchBar from './SearchBar';

export default function UsersList({ navigation }) {
  return (
    <View style={styles.container}>
      <SearchBar navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
});
