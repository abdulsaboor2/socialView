// App/Components/PostDetails.js
import 'react-native-get-random-values';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { errorMessage, successMessage } from './MessageAlert';

import { normalizeFirebaseDownloadUrl } from '../utils/fbUrl';

const MAX_LEN = 220;
const GRADIENT = ['#7c3aed', '#db2777'];

const PostDetails = ({
  selectedMedia = [],
  navigation,
  onPickMore,
  onRemoveMedia,
}) => {
  const [postText, setPostText] = useState('');
  const [loading, setLoading] = useState(false);
  // Note: postId is generated fresh inside handleUpload (below), not here —
  // a stable per-mount id previously caused every post created without
  // this screen remounting in between (e.g. from a tab that stays mounted)
  // to silently overwrite the same Firestore document.

  const hasMedia = selectedMedia.length > 0;
  const counter = `${postText.length}/${MAX_LEN}`;

  const renderItem = ({ item, index }) => {
    const isVideo = (item.type || '').startsWith('video/');
    return (
      <View style={styles.tile}>
        {isVideo ? (
          <View style={styles.videoTile}>
            <Ionicons name="play-circle" size={28} color="#fff" />
            <Text style={styles.videoText}>Video</Text>
          </View>
        ) : (
          <Image source={{ uri: item.uri }} style={styles.imageTile} />
        )}

        {!!onRemoveMedia && (
          <TouchableOpacity
            onPress={() => onRemoveMedia(index)}
            style={styles.removeBtn}
            hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
          >
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleUpload = async () => {
    if (!hasMedia) {
      errorMessage('Please select at least one photo or video.');
      return;
    }
    try {
      setLoading(true);
      const user = auth().currentUser;
      if (!user) throw new Error('Not signed in');

      const postId = uuidv4(); // fresh ID every time this actually runs, not per mount

      // Preload profile info
      const usersDoc = await firestore()
        .collection('Users')
        .doc(user.uid)
        .get();
      const u = usersDoc.exists ? usersDoc.data() : {};
      const displayName = u?.displayName || user.displayName || 'User';
      const photoURL = u?.photoURL || u?.image || user.photoURL || '';
      // NEW: same field Posts already need to be filtered by everywhere
      // else (the feed's public/own-post split, someone else's profile
      // grid, and the Posts security rule itself). Sourced from the same
      // Users doc read above, so no extra request needed. Defaults to
      // 'public' if the field isn't set yet (e.g. an account created
      // before this feature existed).
      const authorPrivacy =
        u?.profilePrivacy === 'private' ? 'private' : 'public';

      // Upload files
      const urls = await Promise.all(
        selectedMedia.map(async (asset, idx) => {
          const extFromAsset = a => {
            if (a.fileName && a.fileName.includes('.'))
              return a.fileName.split('.').pop().toLowerCase();
            if ((a.type || '').includes('jpeg')) return 'jpg';
            if ((a.type || '').includes('png')) return 'png';
            if ((a.type || '').includes('gif')) return 'gif';
            if ((a.type || '').includes('mp4')) return 'mp4';
            return 'dat';
          };

          const ext = extFromAsset(asset);
          const path = `PostsMedia/${user.uid}/${postId}/${idx}.${ext}`;
          const ref = storage().ref(path);

          const contentType =
            asset.type ||
            (ext === 'jpg' || ext === 'jpeg'
              ? 'image/jpeg'
              : ext === 'png'
              ? 'image/png'
              : ext === 'gif'
              ? 'image/gif'
              : ext === 'mp4'
              ? 'video/mp4'
              : 'application/octet-stream');

          await ref.putFile(asset.uri, {
            contentType,
            cacheControl: 'public,max-age=31536000,immutable',
          });

          let downloadURL = await ref.getDownloadURL();
          downloadURL = normalizeFirebaseDownloadUrl(downloadURL);

          return {
            url: downloadURL,
            type: asset.type || '',
            width: asset.width || null,
            height: asset.height || null,
            duration: asset.duration || null,
          };
        }),
      );

      // Create post — likes always starts at 0. "isLiked" is never stored
      // here; it's derived per-viewer from the Likes collection, so a
      // freshly created post can never appear pre-liked to anyone.
      await firestore()
        .collection('Posts')
        .doc(postId)
        .set({
          id: postId,
          uid: user.uid,
          authorPrivacy, // NEW — required by the Posts security rule
          caption: postText.trim(),
          media: urls.map(m => m.url),
          mediaMeta: urls,
          type: urls[0]?.type || '',
          likes: 0,
          likedBy: [],
          comments: 0,
          displayName,
          photoURL,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          topComments: [],
        });

      successMessage('Post uploaded!');
      navigation.replace('Home');
    } catch (e) {
      console.log('Error uploading post:', e);
      errorMessage(e?.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Create a Post</Text>
          <TouchableOpacity onPress={onPickMore} hitSlop={8}>
            <Ionicons name="images-outline" size={22} color="#7c3aed" />
          </TouchableOpacity>
        </View>

        {/* Grid previews */}
        {hasMedia ? (
          <FlatList
            data={selectedMedia}
            keyExtractor={(it, i) => `${it.uri}-${i}`}
            renderItem={renderItem}
            numColumns={3}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            contentContainerStyle={{ paddingVertical: 8 }}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyArea}>
            <Ionicons name="images-outline" size={28} color="#9ca3af" />
            <Text style={styles.emptyText}>No media selected</Text>
            <TouchableOpacity onPress={onPickMore} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnTxt}>Pick media</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Caption */}
        <View style={styles.inputBox}>
          <TextInput
            placeholder="Write something..."
            placeholderTextColor="#9ca3af"
            multiline
            value={postText}
            onChangeText={t => t.length <= MAX_LEN && setPostText(t)}
            style={styles.input}
            textAlignVertical="top"
          />
          <View style={styles.counterPill}>
            <Text style={styles.counterTxt}>{counter}</Text>
          </View>
        </View>

        {/* Upload */}
        <TouchableOpacity
          onPress={handleUpload}
          activeOpacity={0.9}
          disabled={loading || !hasMedia}
          style={[styles.uploadBtn, (!hasMedia || loading) && { opacity: 0.6 }]}
        >
          <LinearGradient colors={GRADIENT} style={styles.uploadInner}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.uploadTxt}>Upload Post</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111' },
  tile: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#eef',
    marginBottom: 10,
  },
  imageTile: { width: '100%', height: '100%' },
  videoTile: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: { color: '#fff', marginTop: 4, fontSize: 12 },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyArea: {
    height: 140,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  emptyText: { color: '#9ca3af', marginTop: 8, marginBottom: 6 },
  emptyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
  },
  emptyBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  inputBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fafafa',
  },
  input: { minHeight: 96, fontSize: 16, color: '#111' },
  counterPill: {
    alignSelf: 'flex-end',
    marginTop: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterTxt: { fontSize: 11, color: '#475569', fontWeight: '700' },
  uploadBtn: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  uploadInner: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadTxt: { color: '#fff', fontWeight: '800' },
});

export default PostDetails;
