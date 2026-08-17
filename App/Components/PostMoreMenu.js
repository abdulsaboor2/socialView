// App/Components/PostMoreMenu.js
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ToastAndroid,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import Share from 'react-native-share';
import Clipboard from '@react-native-clipboard/clipboard';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReportModal from './ReportModal';

export default function PostMoreMenu({
  post,
  navigation,
  onDeleted,
  onEditCaption,
  cascadeDelete = true,
}) {
  const me = auth().currentUser?.uid || null;
  const isOwner = !!(me && post?.uid && post.uid === me);
  const [busy, setBusy] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const media0 = useMemo(() => String(post?.media?.[0] || ''), [post?.media]);
  const toast = msg => {
    if (!msg) return;
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('', msg);
  };

  // EDIT
  const doEdit = useCallback(() => {
    const payload = {
      postId: post?.id,
      caption: post?.caption || '',
      media: Array.isArray(post?.media) ? post.media : [],
      mediaMeta: Array.isArray(post?.mediaMeta) ? post.mediaMeta : [],
      type: post?.type || '',
      uid: post?.uid || '',
    };
    if (onEditCaption) onEditCaption(payload);
    else if (navigation?.navigate) navigation.navigate('Edit Post', payload);
    else
      Alert.alert(
        'Edit',
        'No navigation provided. Pass onEditCaption or navigation.',
      );
  }, [navigation, onEditCaption, post]);

  // DELETE helpers
  const deleteStorageFiles = useCallback(async () => {
    const urls = Array.isArray(post?.media) ? post.media : [];
    await Promise.allSettled(
      urls.map(u => {
        try {
          return storage().refFromURL(String(u)).delete();
        } catch {
          return Promise.resolve();
        }
      }),
    );
  }, [post?.media]);

  const deleteRelatedDocs = useCallback(async () => {
    const batchedDelete = async query => {
      const snap = await query.get();
      if (snap.empty) return 0;
      const batch = firestore().batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return snap.size;
    };
    // NOTE: the Likes collection query here is a harmless no-op now —
    // likes moved to Posts.likedBy (an array field on the post document
    // itself), so deleting the post already removes them. Safe to
    // remove entirely whenever convenient.
    const likesQ = firestore()
      .collection('Likes')
      .where('postId', '==', post.id)
      .limit(500);
    const commentsQ = firestore()
      .collection('Comments')
      .where('postId', '==', post.id)
      .limit(500);
    let n;
    do {
      n = await batchedDelete(likesQ);
    } while (n === 500);
    do {
      n = await batchedDelete(commentsQ);
    } while (n === 500);
  }, [post?.id]);

  const handleDelete = useCallback(() => {
    if (!isOwner) {
      Alert.alert('Not allowed', 'Only the owner can delete this post.');
      return;
    }
    Alert.alert('Delete post?', 'This will permanently remove the post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: busy ? 'Deleting…' : 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          try {
            if (cascadeDelete) {
              await deleteStorageFiles();
              await deleteRelatedDocs();
            }
            await firestore().collection('Posts').doc(post.id).delete();
            try {
              onDeleted?.(post.id);
            } catch {}
            if (navigation?.canGoBack && navigation.canGoBack())
              navigation.goBack();
            toast('Post deleted');
          } catch (e) {
            console.warn('Delete post failed:', e);
            Alert.alert('Error', 'Could not delete the post.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [
    busy,
    cascadeDelete,
    deleteRelatedDocs,
    deleteStorageFiles,
    isOwner,
    navigation,
    onDeleted,
    post?.id,
  ]);

  // UTIL
  const handleCopyLink = () => {
    if (!media0) return toast('No media link to copy');
    Clipboard.setString(media0);
    toast('Link copied');
  };
  const handleCopyCaption = () => {
    const c = String(post?.caption || '');
    if (!c) return toast('No caption to copy');
    Clipboard.setString(c);
    toast('Caption copied');
  };
  const handleShare = async () => {
    try {
      await Share.open({
        title: 'Share Post',
        message: post?.caption || 'Check this out',
        url: media0 || undefined,
      });
    } catch {}
  };

  const openReport = () => setReportVisible(true);

  function Row({ icon, label, danger }) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={danger ? '#ef4444' : '#374151'}
          style={{ marginRight: 10 }}
        />
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: danger ? '#ef4444' : '#111827',
          }}
        >
          {label}
        </Text>
      </View>
    );
  }

  function Divider() {
    return (
      <View
        style={{
          height: 1,
          backgroundColor: '#e5e7eb',
          marginVertical: 4,
          opacity: 0.9,
        }}
      />
    );
  }

  return (
    <>
      <Menu>
        <MenuTrigger hitSlop={8} disabled={busy}>
          {busy ? (
            <Ionicons name="hourglass" size={20} color="#737373" />
          ) : (
            <Feather name="more-horizontal" size={22} color="#737373" />
          )}
        </MenuTrigger>

        <MenuOptions customStyles={{ optionsContainer: styles.menu }}>
          {isOwner ? (
            <>
              <MenuOption onSelect={doEdit}>
                <Row icon="create-outline" label="Edit post" />
              </MenuOption>
              <MenuOption onSelect={handleDelete} disabled={busy}>
                <Row
                  icon="trash-outline"
                  label={busy ? 'Deleting…' : 'Delete post'}
                  danger
                />
              </MenuOption>
              <Divider />
              <MenuOption onSelect={handleShare}>
                <Row icon="share-social-outline" label="Share…" />
              </MenuOption>
              <MenuOption onSelect={handleCopyLink}>
                <Row icon="link-outline" label="Copy media link" />
              </MenuOption>
              <MenuOption onSelect={handleCopyCaption}>
                <Row icon="copy-outline" label="Copy caption" />
              </MenuOption>
            </>
          ) : (
            <>
              <MenuOption onSelect={handleShare}>
                <Row icon="share-social-outline" label="Share…" />
              </MenuOption>
              <MenuOption onSelect={handleCopyLink}>
                <Row icon="link-outline" label="Copy media link" />
              </MenuOption>
              <MenuOption onSelect={handleCopyCaption}>
                <Row icon="copy-outline" label="Copy caption" />
              </MenuOption>
              <Divider />
              <MenuOption onSelect={openReport}>
                <Row icon="flag-outline" label="Report post" danger />
              </MenuOption>
            </>
          )}
        </MenuOptions>
      </Menu>

      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        targetType="post"
        targetId={post?.id}
        reportedUid={post?.uid}
      />
    </>
  );
}

const styles = StyleSheet.create({
  menu: { paddingVertical: 4, borderRadius: 12, minWidth: 210 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rowIcon: { marginRight: 10 },
  rowText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowDanger: { color: '#ef4444' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
});
