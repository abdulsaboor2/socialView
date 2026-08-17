// Components/ChatListBox.js
import React, { memo, useEffect, useMemo, useState } from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Octicons from 'react-native-vector-icons/Octicons';

const ChatListBox = memo(function ChatListBox({
  peerId,
  name,
  message,
  image,
  online = false,
  time = '',
  unread = 0,
  onPress,
  onDelete,
  onPin,
  pinned = false,
}) {
  const [imgError, setImgError] = useState(false);

  // FIX: previously nothing reset imgError when `image` changed — once a
  // load failed once (e.g. a transient network blip on an old URL),
  // imgError stayed true forever for this row instance (FlatList doesn't
  // remount rows, it reuses them), so even a brand-new, perfectly valid
  // avatar URL from the same peer would never be attempted again. Same
  // fix already applied in ProfileScreen for its own avatar.
  useEffect(() => {
    setImgError(false);
  }, [image]);

  const hasUnread = unread > 0;
  const messageColor = hasUnread ? '#111' : '#4b5563';
  const nameStyle = useMemo(
    () => [styles.nameText, hasUnread && styles.nameTextUnread],
    [hasUnread],
  );

  return (
    <TouchableOpacity
      onPress={() => onPress?.(peerId)}
      activeOpacity={0.88}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${name || 'User'}${
        hasUnread ? `, ${unread} unread messages` : ''
      }`}
    >
      <View style={styles.avatarWrap}>
        <Image
          style={styles.image}
          source={
            image && !imgError
              ? { uri: image }
              : require('../Images/defaultProfile.png')
          }
          onError={() => setImgError(true)}
        />
        <View
          style={[
            styles.statusDot,
            { backgroundColor: online ? '#10b981' : '#9ca3af' },
          ]}
        />
      </View>

      <View style={styles.center}>
        <View style={styles.nameRow}>
          <Text style={nameStyle} numberOfLines={1}>
            {name || 'User'}
          </Text>
          {pinned ? (
            <Ionicons
              style={styles.pinIcon}
              name="pin"
              size={14}
              color="#db2777"
            />
          ) : null}
        </View>

        <View style={styles.messageRow}>
          {hasUnread && (
            <Octicons
              name="dot-fill"
              size={12}
              color="#7c3aed"
              style={styles.unreadDot}
            />
          )}
          <Text
            numberOfLines={1}
            style={[styles.messageText, { color: messageColor }]}
          >
            {message || 'Say hi 👋'}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text style={styles.timeText}>{time}</Text>

        <Menu>
          <MenuTrigger>
            <View
              style={styles.moreBtn}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Ionicons name="ellipsis-vertical" size={18} color="#6b7280" />
            </View>
          </MenuTrigger>
          <MenuOptions
            customStyles={{ optionsContainer: { paddingVertical: 6 } }}
          >
            <MenuOption onSelect={() => onPin?.(peerId, pinned)}>
              <Text style={styles.menuText}>{pinned ? 'Unpin' : 'Pin'}</Text>
            </MenuOption>
            <MenuOption onSelect={() => onDelete?.(peerId, name)}>
              <Text style={[styles.menuText, styles.deleteText]}>Delete</Text>
            </MenuOption>
          </MenuOptions>
        </Menu>

        {hasUnread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  avatarWrap: { marginRight: 12 },
  image: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  statusDot: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  center: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  pinIcon: { marginLeft: 6 },
  messageRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  unreadDot: { marginRight: 6 },
  nameText: { fontWeight: '800', fontSize: 16, color: '#111' },
  nameTextUnread: { color: '#111' },
  messageText: { flex: 1, fontSize: 14 },
  right: { alignItems: 'flex-end', marginLeft: 8 },
  timeText: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    marginTop: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  menuText: { paddingHorizontal: 12, paddingVertical: 10, color: '#111' },
  deleteText: { color: '#db2777' },
});

export default ChatListBox;
