import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const tokens = {
  colors: {
    brandFrom: '#a78bfa',
    brandTo: '#f472b6',
    ringSeen: 'rgba(0,0,0,0.08)',
    text: '#111827',
    textMuted: '#6B7280',
    card: '#fff',
    line: '#E5E7EB',
    myGreenA: '#34d399',
    myGreenB: '#10b981',
  },
  radius: { round: 999, md: 12 },
};

const AVATAR = 56;
const DAY_MS = 24 * 60 * 60 * 1000;
const CUTOFF_REFRESH_MS = 60 * 1000;

function Ring({ children, variant }) {
  if (variant === 'mine') {
    return (
      <LinearGradient
        colors={[tokens.colors.myGreenA, tokens.colors.myGreenB]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ring}
      >
        {children}
      </LinearGradient>
    );
  }
  if (variant === 'seen') {
    return <View style={[styles.ring, styles.ringSeen]}>{children}</View>;
  }
  return (
    <LinearGradient
      colors={[tokens.colors.brandFrom, tokens.colors.brandTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.ring}
    >
      {children}
    </LinearGradient>
  );
}

function timeLabel(ts) {
  const ms = ts?.toMillis?.() ?? ts ?? Date.now();
  const d = new Date(ms);
  const now = new Date();
  const pad = n => (n < 10 ? `0${n}` : String(n));
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate();

  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) return `Today, ${hhmm}`;
  if (isYesterday) return `Yesterday, ${hhmm}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(
    d.getFullYear(),
  ).slice(-2)}, ${hhmm}`;
}

export default function AppStoriesRow({
  navigation,
  refreshing = false,
  onRefresh = () => {},
  title = '',
  filter = '',
}) {
  const userId = auth().currentUser?.uid || null;

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [myStories, setMyStories] = useState([]);
  const [seenSet, setSeenSet] = useState(() => new Set());

  const [cutoffMs, setCutoffMs] = useState(() => Date.now() - DAY_MS);
  useEffect(() => {
    const id = setInterval(
      () => setCutoffMs(Date.now() - DAY_MS),
      CUTOFF_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, []);

  const [publicDocs, setPublicDocs] = useState([]);
  const [ownDocs, setOwnDocs] = useState([]);

  useEffect(() => {
    setLoading(true);
    const cutoffTs = firestore.Timestamp.fromMillis(cutoffMs);

    const publicQ = firestore()
      .collection('Stories')
      .where('authorPrivacy', '==', 'public')
      .where('createdAt', '>=', cutoffTs)
      .orderBy('createdAt', 'desc');

    const ownQ = firestore()
      .collection('Stories')
      .where('userId', '==', userId || '__signed_out__')
      .where('createdAt', '>=', cutoffTs)
      .orderBy('createdAt', 'desc');

    let publicLoaded = false;
    let ownLoaded = false;
    const maybeStopLoading = () => {
      if (publicLoaded && ownLoaded) setLoading(false);
    };

    const unsubPublic = publicQ.onSnapshot(
      snap => {
        setPublicDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        publicLoaded = true;
        maybeStopLoading();
      },
      () => {
        publicLoaded = true;
        maybeStopLoading();
      },
    );

    const unsubOwn = ownQ.onSnapshot(
      snap => {
        setOwnDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        ownLoaded = true;
        maybeStopLoading();
      },
      () => {
        ownLoaded = true;
        maybeStopLoading();
      },
    );

    return () => {
      unsubPublic && unsubPublic();
      unsubOwn && unsubOwn();
    };
  }, [userId, cutoffMs]);

  useEffect(() => {
    const seen = new Set();
    const all = [];
    ownDocs.forEach(s => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        all.push(s);
      }
    });
    publicDocs.forEach(s => {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        all.push(s);
      }
    });

    const byUser = new Map();
    for (const s of all) {
      if (!s.userId) continue;
      if (!byUser.has(s.userId)) {
        byUser.set(s.userId, {
          userId: s.userId,
          username: s.username || 'User',
          stories: [],
        });
      }
      byUser.get(s.userId).stories.push(s);
    }

    const arr = Array.from(byUser.values()).map(g => ({
      ...g,
      stories: g.stories.sort(
        (a, b) =>
          (b?.createdAt?.toMillis?.() ?? 0) - (a?.createdAt?.toMillis?.() ?? 0),
      ),
    }));

    const mine = userId ? arr.find(g => g.userId === userId) : null;
    const others = userId ? arr.filter(g => g.userId !== userId) : arr;

    others.sort(
      (A, B) =>
        (B.stories[0]?.createdAt?.toMillis?.() ?? 0) -
        (A.stories[0]?.createdAt?.toMillis?.() ?? 0),
    );

    setGroups(others);
    setMyStories(mine?.stories ?? []);
  }, [ownDocs, publicDocs, userId]);

  useEffect(() => {
    if (!userId) return;
    const unsub = firestore()
      .collection('StoryViews')
      .where('viewerUid', '==', userId)
      .onSnapshot(
        snap => {
          const s = new Set();
          snap.forEach(d => {
            const sd = d.data();
            if (sd?.storyId) s.add(sd.storyId);
          });
          setSeenSet(s);
        },
        () => setSeenSet(new Set()),
      );
    return () => unsub && unsub();
  }, [userId]);

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => (g.username || '').toLowerCase().includes(q));
  }, [groups, filter]);

  const yourStoryThumb = useMemo(() => {
    const latest = myStories[0];
    return latest?.image || latest?.videoThumb || latest?.ownerAvatar || null;
  }, [myStories]);

  const yourLatestAt = myStories[0]?.createdAt ?? null;

  const openAddStory = useCallback(
    () => navigation.navigate('AddStory'),
    [navigation],
  );

  const openGroupStories = useCallback(
    group => {
      navigation.navigate('StoryScreen', {
        stories: group.stories,
        isCurrentUser: group.userId === userId,
        startIndex: 0,
      });
    },
    [navigation, userId],
  );

  const openYourStorySmart = useCallback(() => {
    if (!userId) return openAddStory();
    if (myStories.length) {
      navigation.navigate('StoryScreen', {
        stories: myStories,
        isCurrentUser: true,
        startIndex: 0,
      });
    } else {
      openAddStory();
    }
  }, [userId, myStories, navigation, openAddStory]);

  const sections = useMemo(() => {
    const rows = filteredGroups.map(g => {
      const latest = g.stories?.[0];
      const thumb =
        latest?.image || latest?.videoThumb || latest?.ownerAvatar || null;
      const seen = latest ? seenSet.has(latest.id) : false;
      return {
        userId: g.userId,
        username: g.username || 'User',
        thumb,
        seen,
        createdAt: latest?.createdAt ?? null,
        stories: g.stories,
      };
    });

    const recent = rows.filter(r => !r.seen);
    const viewed = rows.filter(r => r.seen);

    return [
      {
        title: 'My Status',
        data: [
          {
            userId: 'mine',
            isMine: true,
            label: yourStoryThumb ? 'My Status' : 'Add to My Status',
            thumb: yourStoryThumb,
            createdAt: yourLatestAt,
            onPress: openYourStorySmart,
          },
        ],
      },
      ...(recent.length
        ? [
            {
              title: 'Recent updates',
              data: recent.map(r => ({
                ...r,
                isMine: false,
                onPress: () =>
                  openGroupStories({ userId: r.userId, stories: r.stories }),
              })),
            },
          ]
        : []),
      ...(viewed.length
        ? [
            {
              title: 'Viewed updates',
              data: viewed.map(r => ({
                ...r,
                isMine: false,
                onPress: () =>
                  openGroupStories({ userId: r.userId, stories: r.stories }),
              })),
            },
          ]
        : []),
    ];
  }, [
    filteredGroups,
    seenSet,
    yourStoryThumb,
    yourLatestAt,
    openGroupStories,
    openYourStorySmart,
  ]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <ActivityIndicator
          size="small"
          color={tokens.colors.brandFrom}
          style={{ marginVertical: 12 }}
        />
      </View>
    );
  }

  if (sections.length === 1 && !sections[0]?.data?.[0]?.thumb) {
    return (
      <View style={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.85}
          onPress={openYourStorySmart}
          accessibilityRole="button"
          accessibilityLabel="My Status, tap to add status update"
        >
          <Ring variant="mine">
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.plus}>+</Text>
              </View>
            </View>
          </Ring>
          <View style={styles.rowText}>
            <Text style={styles.name}>My Status</Text>
            <Text style={styles.time}>Tap to add status update</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.emptyHint}>No recent updates</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <SectionList
        sections={sections}
        keyExtractor={item => String(item.userId)}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const isMine = !!item.isMine;
          const variant = isMine ? 'mine' : item.seen ? 'seen' : 'unseen';
          const label = isMine ? 'My Status' : item.username;
          const sub = isMine
            ? item.createdAt
              ? timeLabel(item.createdAt)
              : 'Tap to add status update'
            : item.createdAt
            ? timeLabel(item.createdAt)
            : '—';

          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.85}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Ring variant={variant}>
                <View style={styles.avatarWrap}>
                  {item.thumb ? (
                    <Image
                      source={{ uri: item.thumb }}
                      style={styles.avatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarEmpty]}>
                      <Text style={styles.fallbackIcon}>
                        {isMine ? '+' : '?'}
                      </Text>
                    </View>
                  )}
                </View>
              </Ring>

              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.time} numberOfLines={1}>
                  {sub}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 8 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.colors.card,
    borderTopColor: tokens.colors.line,
    borderBottomColor: tokens.colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: tokens.colors.text },

  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.textMuted,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 1,
  },
  sep: {
    marginLeft: 16 + AVATAR + 12,
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.line,
  },

  ring: {
    width: AVATAR + 8,
    height: AVATAR + 8,
    borderRadius: (AVATAR + 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSeen: {
    borderWidth: 2,
    borderColor: tokens.colors.ringSeen,
    backgroundColor: 'transparent',
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR / 2,
    backgroundColor: '#e5e7eb',
  },
  avatarEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    fontSize: 22,
    color: tokens.colors.textMuted,
    fontWeight: '800',
  },

  rowText: { marginLeft: 12, flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: tokens.colors.text },
  time: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: tokens.colors.textMuted,
  },
  emptyHint: { marginLeft: 20}
});
