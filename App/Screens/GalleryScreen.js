// App/Screens/GalleryScreen.js
import React, { useRef, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

import AppImagesPicker from '../Components/AppImagesPicker';
import PostDetails from '../Components/PostDetails';
import KeyboardScreenWrapper from '../Components/KeyboardScreenWrapper';

const GRADIENT = ['#7c3aed', '#db2777'];

function GalleryScreen({ navigation }) {
  const [selectedMedia, setSelectedMedia] = useState([]);
  const pickerRef = useRef(null);

  const openPicker = () => pickerRef.current?.open?.();
  const mediaCount = selectedMedia.length;

  // remove a single item by index (passed to PostDetails)
  const onRemoveMedia = index => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient colors={GRADIENT} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <View style={styles.leftRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backBtn}
                hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>Create Post</Text>
            </View>

            {/* Counter pill & pick button */}
            <View style={styles.rightRow}>
              <View style={styles.countPill}>
                <Ionicons name="images-outline" size={14} color="#fff" />
                <Text style={styles.countPillTxt}>{mediaCount}</Text>
              </View>

              <TouchableOpacity
                onPress={openPicker}
                style={styles.pickBtn}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={18} color="#7c3aed" />
                <Text style={styles.pickTxt}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* KeyboardScreenWrapper — PostDetails contains a caption TextInput,
          but this screen previously had no scroll container or keyboard
          avoidance around it at all. With several media tiles selected
          plus the caption box plus the Upload button, content could
          exceed screen height even with the keyboard closed; with it
          open, the caption field and Upload button could become
          completely unreachable. Same root issue as every other screen
          fixed earlier in this pass, just one level removed since the
          TextInput lives inside a child component rather than directly
          in this screen. */}
      <KeyboardScreenWrapper backgroundColor="#f6f7fb" topInset={false}>
        <PostDetails
          selectedMedia={selectedMedia}
          navigation={navigation}
          onPickMore={openPicker}
          onRemoveMedia={onRemoveMedia}
        />
      </KeyboardScreenWrapper>

      {/* Headless picker */}
      <AppImagesPicker
        ref={pickerRef}
        onSelect={setSelectedMedia}
        selectionLimit={8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb' },

  header: {
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingBottom: 10,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },

  rightRow: { flexDirection: 'row', alignItems: 'center' },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  countPillTxt: {
    color: '#fff',
    fontWeight: '800',
    marginLeft: 6,
    fontSize: 12,
  },

  pickBtn: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickTxt: { color: '#7c3aed', fontWeight: '800', marginLeft: 6, fontSize: 12 },
});

export default GalleryScreen;
