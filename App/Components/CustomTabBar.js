// App/Components/CustomTabBar.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GRADIENT = ['#7c3aed', '#db2777'];

const ICONS = {
  'News Feed': { active: 'home', inactive: 'home-outline', label: 'Feed' },
  Stories: { active: 'play', inactive: 'play-outline', label: 'Stories' },
  'Upload Post': { active: 'add', inactive: 'add-outline', label: 'Post' },
  Calls: { active: 'call', inactive: 'call-outline', label: 'Calls' },
  Profile: { active: 'person', inactive: 'person-outline', label: 'Profile' },
};

const DEFAULT_TAB_ICON = {
  active: 'ellipse',
  inactive: 'ellipse-outline',
  label: '',
};

const iconSetFor = routeName => ICONS[routeName] || DEFAULT_TAB_ICON;

export default function CustomTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();

  const [slots, setSlots] = useState([]);
  const fabLeft = useRef(new Animated.Value(0)).current;

  const fabSize = 40;
  const barPadH = 8;

  // Memoized layout handler (prevents re-renders)
  const onSlotLayout = useCallback(
    index => e => {
      const { x, width } = e.nativeEvent.layout;
      setSlots(prev => {
        const next = [...prev];
        next[index] = { x, w: width };
        return next;
      });
    },
    [],
  );

  // Smooth animation when active tab changes
  useEffect(() => {
    const idx = state.index;
    if (!slots[idx]) return;

    const center = slots[idx].x + slots[idx].w / 2;
    const left = center - fabSize / 2 + barPadH;

    Animated.spring(fabLeft, {
      toValue: left,
      useNativeDriver: false,
      damping: 16,
      stiffness: 180,
      mass: 0.6,
    }).start();
  }, [state.index, slots]);

  // Initial position after first layout
  useEffect(() => {
    if (!slots[state.index]) return;

    const center = slots[state.index].x + slots[state.index].w / 2;
    fabLeft.setValue(center - fabSize / 2 + barPadH);
  }, [slots.length]);

  const activeRoute = state.routes[state.index];
  const activeIcon = iconSetFor(activeRoute.name).active;

  return (
    <LinearGradient
      colors={GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.gradient, { paddingBottom: Math.max(insets.bottom, 8) }]}
      onLayout={e => {
        navigation.setParams({ tabBarHeight: e.nativeEvent.layout.height });
      }}
    >
      <View style={styles.container}>
        <View style={styles.barShadow}>
          <View style={styles.bar}>
            {/* Floating highlight */}
            <Animated.View
              style={[
                styles.fabTrack,
                {
                  left: fabLeft,
                  width: fabSize,
                  height: fabSize,
                  borderRadius: fabSize / 2,
                },
              ]}
            >
              <LinearGradient
                colors={['#db2777', '#7c3aed']}
                style={styles.fabInner}
              >
                <Ionicons name={activeIcon} size={20} color="#fff" />
              </LinearGradient>
            </Animated.View>

            {/* Tabs */}
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              const iconSet = iconSetFor(route.name);

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={() => navigation.navigate(route.name)}
                  onLayout={onSlotLayout(index)}
                  activeOpacity={0.85}
                  style={styles.item}
                >
                  <View style={styles.iconWrap}>
                    {isFocused ? (
                      <View style={{ width: 20, height: 20 }} />
                    ) : (
                      <Ionicons
                        name={iconSet.inactive}
                        size={21}
                        color={'#f3e8ff'}
                      />
                    )}
                  </View>

                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      {
                        color: isFocused ? '#ffffff' : '#f3e8ff',
                        fontWeight: isFocused ? '800' : '700',
                      },
                    ]}
                  >
                    {iconSet.label || route.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    paddingTop: 1,
    paddingBottom: 1,
  },
  gradient: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
  barShadow: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 780,
    borderRadius: 16,
  },
  bar: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 2,
    minHeight: 35,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  iconWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  fabTrack: {
    position: 'absolute',
    top: -16,
    zIndex: 20,
  },
  fabInner: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
