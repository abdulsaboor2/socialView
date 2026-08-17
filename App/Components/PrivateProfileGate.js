// App/Components/PrivateProfileGate.js
//
// Wrap the parts of a profile screen that show POSTS / BIO / STATS with
// this. It does NOT gate anything related to messaging — the name, avatar,
// and "Message" button should stay outside this component so two private
// accounts can always find and message each other.
//
// Usage in your "User Profile" screen:
//
//   <ProfileHeader name={user.displayName} avatar={user.photoURL} />
//   <MessageButton onPress={...} />          {/* always visible */}
//
//   <PrivateProfileGate
//     isPrivate={user.profilePrivacy === 'private'}
//     isOwnProfile={user.uid === myUid}
//     displayName={user.displayName}
//   >
//     <PostsGrid posts={posts} />
//     <BioSection bio={user.bio} />
//   </PrivateProfileGate>
//
// Remember: this is a UI convenience only. The actual enforcement has to
// live in your Firestore Security Rules (see FIRESTORE_PRIVACY_RULES.md) —
// otherwise someone can bypass this screen entirely and query Posts
// directly with the Firestore SDK.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const PrivateProfileGate = ({
  isPrivate,
  isOwnProfile,
  displayName,
  children,
}) => {
  if (!isPrivate || isOwnProfile) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed" size={28} color="#7c3aed" />
      </View>
      <Text style={styles.title}>This Account is Private</Text>
      <Text style={styles.subtitle}>
        {displayName ? `${displayName}'s` : "This user's"} posts and profile
        details are only visible to them. You can still send a message.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 19,
  },
});

export default PrivateProfileGate;
