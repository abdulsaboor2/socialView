// App/Components/AppHeader/AppHeader.js
import React, { useMemo, useState } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

const AppHeader = ({
  search,
  chat,
  title = 'SocialView',
  onTitlePress,
  showAdd = false,
  onAddPress,
  unread = 0,
  enableInlineSearch = true,
  onSearchChange,
  placeholder = 'Search…',
  showChat = true,
}) => {
  const [inlineOpen, setInlineOpen] = useState(false);
  const [query, setQuery] = useState('');

  const badge = useMemo(
    () => (typeof unread === 'number' && unread > 0 ? unread : null),
    [unread],
  );

  // CHANGED: was a single toggle that only flipped `inlineOpen`. Closing
  // the search box left `query` untouched and never told the parent the
  // filter cleared — the search UI disappeared but whatever it was
  // filtering stayed silently active. Now closing explicitly resets both.
  const openInline = () => setInlineOpen(true);
  const closeInline = () => {
    setInlineOpen(false);
    setQuery('');
    onSearchChange?.('');
  };
  const toggleInline = () => {
    if (!enableInlineSearch) {
      search?.();
      return;
    }
    if (inlineOpen) closeInline();
    else openInline();
  };

  const handleChange = t => {
    setQuery(t);
    onSearchChange?.(t);
  };

  return (
    <LinearGradient colors={['#7c3aed', '#db2777']} style={styles.gradient}>
      <SafeAreaView edges={['top', 'left', 'right']}>
        <View style={styles.headerContainer}>
          {/* Left: Search / Back-to-search */}
          <TouchableOpacity
            style={styles.iconHotspot}
            onPress={toggleInline}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Ionicons
              name={inlineOpen ? 'close' : 'search-outline'}
              size={24}
              color="white"
            />
          </TouchableOpacity>

          {/* Center: Title or Inline Search */}
          {inlineOpen ? (
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.8)" />
              <TextInput
                style={styles.searchInput}
                placeholder={placeholder}
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={query}
                onChangeText={handleChange}
                autoFocus
                returnKeyType="search"
                accessibilityLabel={placeholder}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.titleWrap}
              activeOpacity={onTitlePress ? 0.7 : 1}
              onPress={onTitlePress}
              accessibilityRole={onTitlePress ? 'button' : undefined}
              accessibilityLabel={title}
            >
              <Text style={styles.appNameText}>{title}</Text>
            </TouchableOpacity>
          )}

          {/* Right: Chat (with badge) or Add */}
          <View style={styles.rightCluster}>
            {showAdd && (
              <TouchableOpacity
                style={styles.iconHotspot}
                onPress={onAddPress}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Create post"
              >
                <Ionicons name="add-circle-outline" size={26} color="white" />
              </TouchableOpacity>
            )}
            {showChat && (
              <TouchableOpacity
                style={styles.iconHotspot}
                onPress={chat}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Open chats"
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={24}
                  color="white"
                />
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const HEIGHT = Platform.select({ ios: 56, android: 56, default: 56 });

const styles = StyleSheet.create({
  gradient: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  headerContainer: {
    height: HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  iconHotspot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  titleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 0.3,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#10b981',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  searchWrap: {
    flex: 1,
    marginHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 24,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 15,
  },
});

export default AppHeader;
