// App/Screens/ChatScreen.js
import React, {
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import {
  GiftedChat,
  Send,
  Bubble,
  Day,
  InputToolbar,
  Composer,
} from 'react-native-gifted-chat';
import Icon from 'react-native-vector-icons/MaterialIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatHeader from '../Components/AppHeader/ChatHeader';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import Video from 'react-native-video';
import { deleteConversation } from '../utils/chatService';
import {
  subscribeIsBlockedByMe,
  subscribeAmIBlockedBy,
} from '../utils/blockService';

const COLORS = {
  bg: '#F6F7FB',
  primary: '#7c3aed',
  primary2: '#db2777',
  text: '#111827',
  sub: '#6b7280',
  bubbleMe: '#EDE9FE', // soft violet
  bubblePeer: '#FFFFFF', // white
  send: '#7c3aed',
};

// ---- Video bubble as its own component ----
function ChatVideoBubble({ uri }) {
  const [paused, setPaused] = useState(true);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setPaused(p => !p)}
      style={styles.videoBubble}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Play video' : 'Pause video'}
    >
      <Video
        source={{ uri }}
        style={styles.videoPlayer}
        resizeMode="cover"
        controls
        paused={paused}
        repeat={false}
        onEnd={() => setPaused(true)}
      />
    </TouchableOpacity>
  );
}

async function requestGalleryPermissions() {
  if (Platform.OS !== 'android') return true;
  try {
    const apiLevel = Number(Platform.Version);
    if (apiLevel >= 33) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      ]);
      return Object.values(results).some(
        r => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message:
          'We need access to your media to let you send photos or videos.',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const ChatScreen = ({ navigation, route }) => {
  const { token, name, image } = route.params || {};
  const me = auth().currentUser;
  const peerId = route.params?.peerId || token;
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  // NEW: block state, both directions. Either one means the whole input
  // area gets replaced with a banner instead — the security rule already
  // stops the write, but showing a normal-looking input that silently
  // fails on send is a bad experience, and this makes it impossible to
  // reach that state at all.
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const isBlocked = blockedByMe || blockedMe;

  useEffect(() => {
    if (!me?.uid || !peerId) return;
    const unsub1 = subscribeIsBlockedByMe(
      { blockerId: me.uid, blockedId: peerId },
      setBlockedByMe,
    );
    const unsub2 = subscribeAmIBlockedBy(
      { myUid: me.uid, otherUid: peerId },
      setBlockedMe,
    );
    return () => {
      unsub1();
      unsub2();
    };
  }, [me?.uid, peerId]);

  const typingPulse = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(typingPulse, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [typingPulse]);

  useLayoutEffect(() => {
    if (!peerId || !me?.uid) {
      navigation.goBack();
    }
  }, [peerId, me?.uid, navigation]);

  useLayoutEffect(() => {
    if (!peerId) return;
    const unsubUser = firestore()
      .collection('Users')
      .doc(peerId)
      .onSnapshot(d => {
        const data = d.data() || {};
        setPeerOnline(!!data.onlineInChat);
        setPeerLastSeen(data.lastSeen?.toDate?.() || null);
        setPeerTyping(data.typingTo === me?.uid);
      });
    return () => unsubUser();
  }, [peerId, me?.uid]);

  useLayoutEffect(() => {
    if (!me?.uid) return;
    const setOnline = () =>
      firestore().collection('Users').doc(me.uid).set(
        {
          onlineInChat: true,
          lastSeen: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    const setOffline = () =>
      firestore().collection('Users').doc(me.uid).set(
        {
          onlineInChat: false,
          lastSeen: firestore.FieldValue.serverTimestamp(),
          typingTo: null,
        },
        { merge: true },
      );
    setOnline();
    const unsubscribeFocus = navigation.addListener('blur', setOffline);
    return () => {
      unsubscribeFocus?.();
      setOffline();
    };
  }, [me?.uid, navigation]);

  useLayoutEffect(() => {
    if (!me?.uid || !peerId) return () => {};
    const unsub = firestore()
      .collection('Chats')
      .doc(me.uid)
      .collection(peerId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        setMessages(
          snap.docs.map(doc => {
            const d = doc.data() || {};
            return {
              _id: d._id,
              text: d.text || '',
              createdAt: d.createdAt?.toDate?.() || new Date(),
              user: d.user,
              image: d.image || undefined,
              video: d.video || undefined,
            };
          }),
        );
      });
    return () => unsub();
  }, [me?.uid, peerId]);

  const onSend = useCallback(
    async (msgs = []) => {
      if (!msgs[0]) return;
      // Defensive — the input UI is already hidden when blocked, but this
      // guards the actual write path too, independent of what's rendered.
      if (isBlocked) return;

      const { _id, createdAt, text = '', user } = msgs[0];
      const trimmed = (text || '').trim();
      if (!trimmed && !msgs[0].image && !msgs[0].video) return;

      setMessages(prev =>
        GiftedChat.append(prev, [{ ...msgs[0], text: trimmed }]),
      );

      // CHANGED: this whole block previously had no try/catch at all — a
      // failed write (network drop, offline, or now also a block) left
      // the message showing as "sent" in the UI forever with no actual
      // delivery and no feedback. Now rolls the optimistic message back
      // and tells the user if it didn't actually go through.
      try {
        const batch = firestore().batch();
        const messageDoc = {
          _id,
          text: trimmed,
          createdAt: firestore.FieldValue.serverTimestamp(),
          localCreatedAt: createdAt,
          user,
        };
        const myRef = firestore()
          .collection('Chats')
          .doc(me.uid)
          .collection(peerId)
          .doc(_id);
        const peerRef = firestore()
          .collection('Chats')
          .doc(peerId)
          .collection(me.uid)
          .doc(_id);
        batch.set(myRef, messageDoc, { merge: true });
        batch.set(peerRef, messageDoc, { merge: true });

        const chatMeta = {
          lastMsg:
            trimmed ||
            (msgs[0].image ? '📷 Photo' : msgs[0].video ? '🎬 Video' : ''),
          lastMsgTime: firestore.FieldValue.serverTimestamp(),
          unread: 0,
        };
        batch.set(
          firestore()
            .collection('ListOfCollection')
            .doc(me.uid)
            .collection('Chat')
            .doc(peerId),
          chatMeta,
          { merge: true },
        );
        batch.set(
          firestore()
            .collection('ListOfCollection')
            .doc(peerId)
            .collection('Chat')
            .doc(me.uid),
          chatMeta,
          { merge: true },
        );

        await batch.commit();
      } catch (e) {
        console.warn('Send message failed:', e);
        setMessages(prev => prev.filter(m => m._id !== _id));
        Alert.alert(
          'Message not sent',
          'Please check your connection and try again.',
        );
      }
    },
    [me?.uid, peerId, isBlocked],
  );

  const onInputTextChanged = useCallback(
    async txt => {
      if (!me?.uid || isBlocked) return;
      try {
        await firestore()
          .collection('Users')
          .doc(me.uid)
          .set(
            {
              typingTo: txt?.trim()?.length ? peerId : null,
              lastTypingAt: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      } catch {}
    },
    [me?.uid, peerId, isBlocked],
  );

  const handleDeleteChat = useCallback(() => {
    Alert.alert(
      'Delete this chat?',
      `This removes your conversation with ${
        name || 'this user'
      } from your chat list. It won't delete it for them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation({ me: me?.uid, peerId });
              navigation.goBack();
            } catch (e) {
              console.log('delete chat error:', e);
              Alert.alert('Error', 'Could not delete the conversation.');
            }
          },
        },
      ],
    );
  }, [me?.uid, peerId, name, navigation]);

  // ---------- UI customizations ----------
  const renderBubble = props => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: COLORS.bubbleMe,
            padding: 2,
            borderRadius: 16,
            marginBottom: 1,
          },
          left: {
            backgroundColor: COLORS.bubblePeer,
            padding: 2,
            borderRadius: 16,
            marginBottom: 1,
          },
        }}
        textStyle={{
          right: { color: COLORS.text },
          left: { color: COLORS.text },
        }}
        tickStyle={{ color: COLORS.sub }}
        timeTextStyle={{
          right: { color: COLORS.sub },
          left: { color: COLORS.sub },
        }}
      />
    );
  };

  const renderDay = props => (
    <Day
      {...props}
      textStyle={{ color: COLORS.sub, fontWeight: '600' }}
      containerStyle={{ marginVertical: 8 }}
    />
  );

  // CHANGED: when blocked, this replaces the normal toolbar entirely with
  // a plain banner — no text input, no send button, nothing that could
  // create the impression a message might go through.
  const renderInputToolbar = props => {
    if (isBlocked) {
      return (
        <View style={styles.blockedBanner}>
          <Icon name="block" size={18} color="#9CA3AF" />
          <Text style={styles.blockedBannerText}>
            {blockedByMe
              ? "You've blocked this person. Unblock them from their profile to send messages."
              : "You can't message this person right now."}
          </Text>
        </View>
      );
    }
    return (
      <InputToolbar
        {...props}
        containerStyle={styles.toolbar}
        primaryStyle={{ flexDirection: 'row', alignItems: 'flex-end' }}
        renderComposer={p => (
          <Composer
            {...p}
            placeholder="Message..."
            textInputStyle={styles.composer}
            textInputProps={{ multiline: true }}
          />
        )}
      />
    );
  };

  const renderActions = props => {
    if (isBlocked) return null; // no attachment button when blocked
    return (
      <TouchableOpacity
        onPress={chooseMedia}
        style={styles.actionBtn}
        activeOpacity={0.8}
      >
        <Icon name="attach-file" size={22} color="#6b7280" />
      </TouchableOpacity>
    );
  };

  const renderSend = props => (
    <Send {...props} disabled={!props.text?.trim()}>
      <View
        style={[styles.sendButton, !props.text?.trim() && { opacity: 0.4 }]}
      >
        <Icon name="send" size={22} color="#fff" />
      </View>
    </Send>
  );

  const renderMessageVideo = ({ currentMessage }) => {
    if (!currentMessage?.video) return null;
    return <ChatVideoBubble uri={currentMessage.video} />;
  };

  const renderScrollToBottom = () => (
    <View style={styles.scrollToBottom}>
      <Icon name="keyboard-arrow-down" size={20} color="#fff" />
    </View>
  );

  const askCameraPerms = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const chooseMedia = () => {
    if (isBlocked) return; // defensive — button is hidden anyway
    Alert.alert('Send media', 'Choose a source', [
      { text: 'Photo/Video Library', onPress: handleAttach },
      { text: 'Camera', onPress: handleCapture },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAttach = async () => {
    if (isBlocked) return;
    const allowed = await requestGalleryPermissions();
    if (!allowed) {
      Alert.alert(
        'Permission needed',
        'Please grant Photos/Media permission in Settings to send images or videos.',
      );
      return;
    }
    try {
      const res = await launchImageLibrary({
        mediaType: 'mixed',
        quality: 0.9,
        videoQuality: 'high',
        selectionLimit: 1,
      });
      if (res?.didCancel) return;
      const asset = res?.assets?.[0];
      if (!asset?.uri) return;
      await uploadAndSend(asset);
    } catch {
      Alert.alert('Error', 'Could not open gallery.');
    }
  };

  const handleCapture = async () => {
    if (isBlocked) return;
    const allowed = await askCameraPerms();
    if (!allowed) {
      Alert.alert(
        'Permission needed',
        'Please grant Camera permission in Settings to take a photo or video.',
      );
      return;
    }
    try {
      const res = await launchCamera({
        mediaType: 'mixed',
        quality: 0.9,
        videoQuality: 'high',
        durationLimit: 30,
        saveToPhotos: true,
      });
      if (res?.didCancel) return;
      const asset = res?.assets?.[0];
      if (!asset?.uri) return;
      await uploadAndSend(asset);
    } catch {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  const uploadAndSend = async asset => {
    if (isBlocked) return;
    try {
      const isVideo =
        (asset.type || '').includes('video') ||
        /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(asset.fileName || asset.uri);
      const fileName = `${uuidv4()}_${
        asset.fileName || (isVideo ? 'video.mp4' : 'image.jpg')
      }`;
      const path = `Chats/${me.uid}/${peerId}/${fileName}`;
      const ref = storage().ref(path);
      await ref.putFile(asset.uri);
      const url = await ref.getDownloadURL();
      const _id = uuidv4();
      const base = {
        _id,
        text: '',
        createdAt: firestore.FieldValue.serverTimestamp(),
        user: {
          _id: me.uid,
          name: me.displayName || me.email || 'Me',
          avatar: me.photoURL || undefined,
        },
      };
      const message = isVideo
        ? { ...base, video: url }
        : { ...base, image: url };
      setMessages(prev =>
        GiftedChat.append(prev, [{ ...message, createdAt: new Date() }]),
      );
      const myRef = firestore()
        .collection('Chats')
        .doc(me.uid)
        .collection(peerId)
        .doc(_id);
      const peerRef = firestore()
        .collection('Chats')
        .doc(peerId)
        .collection(me.uid)
        .doc(_id);
      await Promise.all([myRef.set(message), peerRef.set(message)]);
      const chatMeta = {
        lastMsg: isVideo ? '🎬 Video' : '📷 Photo',
        lastMsgTime: firestore.FieldValue.serverTimestamp(),
        unread: 0,
      };
      await Promise.all([
        firestore()
          .collection('ListOfCollection')
          .doc(me.uid)
          .collection('Chat')
          .doc(peerId)
          .set(chatMeta, { merge: true }),
        firestore()
          .collection('ListOfCollection')
          .doc(peerId)
          .collection('Chat')
          .doc(me.uid)
          .set(chatMeta, { merge: true }),
      ]);
    } catch {
      Alert.alert('Upload failed', 'Could not send media.');
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={{ paddingTop: insets.top }}
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <ChatHeader
          name={name}
          token={peerId}
          image={image}
          online={peerOnline || peerTyping}
          lastSeen={peerLastSeen}
          typing={peerTyping}
          Back={() => navigation.goBack()}
          Profile={() => navigation.navigate('User Profile', { token: peerId })}
          navigation={navigation}
          onDeleteChat={handleDeleteChat}
        />
      </View>
      <View style={styles.chatContainer}>
        <GiftedChat
          messages={messages}
          onSend={onSend}
          user={{
            _id: me?.uid,
            name: me?.displayName || me?.email || 'Me',
            avatar: me?.photoURL || undefined,
          }}
          onInputTextChanged={onInputTextChanged}
          renderBubble={renderBubble}
          renderInputToolbar={renderInputToolbar}
          renderSend={renderSend}
          renderDay={renderDay}
          alwaysShowSend
          showUserAvatar={false}
          renderActions={renderActions}
          showAvatarForEveryMessage={false}
          scrollToBottom
          renderMessageVideo={renderMessageVideo}
          scrollToBottomComponent={renderScrollToBottom}
          keyboardShouldPersistTaps="handled"
          placeholder="Message..."
          disableKeyboardProvider
          keyboardAvoidingViewProps={{
            keyboardVerticalOffset: headerHeight,
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bg },
  chatContainer: { flex: 1 },
  toolbar: {
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    minHeight: 50,
    paddingHorizontal: 1,
    paddingBottom: Platform.OS === 'android' ? 4 : 12,
  },
  actionBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 6 : 8,
    marginLeft: 8,
    marginRight: -6,
  },
  composerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingRight: 8,
    paddingVertical: Platform.OS === 'ios' ? 8 : 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  composer: {
    color: COLORS.text,
    paddingTop: Platform.OS === 'ios' ? 6 : 2,
    fontSize: 16,
    backgroundColor: '#fff',
    borderRadius: 5,
    paddingHorizontal: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  sendButton: {
    backgroundColor: COLORS.send,
    marginRight: 6,
    marginBottom: Platform.OS === 'ios' ? 6 : 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBubble: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: 240,
    height: 180,
  },
  scrollToBottom: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  blockedBannerText: {
    flex: 1,
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ChatScreen;
