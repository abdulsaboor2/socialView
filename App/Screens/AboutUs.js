// App/Screens/AboutUs.js
import React from 'react';
import {View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Linking} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

const AboutUs = () => {
  const open = (url) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{flex: 1, backgroundColor: '#f6f7fb'}}>
      {/* Header */}
      <LinearGradient colors={['#7c3aed', '#db2777']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>About SocialView</Text>
            <Ionicons name="information-circle-outline" size={22} color="#fff" />
          </View>

          {/* Hero / Author */}
          <View style={styles.hero}>
            <Image source={require('../Images/absaboor.jpg')} style={styles.profileImage} />
            <Text style={styles.heroTitle}>SocialView</Text>
            <Text style={styles.heroSubtitle}>Connect • Share • Discover</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Vision */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Our Vision</Text>
          <Text style={styles.cardText}>
            SocialView is your go‑to platform for connecting with friends, sharing stories, and exploring new trends.
            Our mission is to bring people together through a seamless, modern, and privacy‑minded experience.
          </Text>
        </View>

        {/* What makes us unique */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What makes us unique?</Text>

          <View style={styles.bullet}>
            <Ionicons name="sparkles-outline" size={18} color="#7c3aed" />
            <Text style={styles.bulletText}>Beautiful, responsive design with delightful micro‑interactions.</Text>
          </View>
          <View style={styles.bullet}>
            <Ionicons name="film-outline" size={18} color="#7c3aed" />
            <Text style={styles.bulletText}>Rich media feed: photos, videos, stories, and real‑time updates.</Text>
          </View>
          <View style={styles.bullet}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#7c3aed" />
            <Text style={styles.bulletText}>Safety first: Report/Block controls and transparent privacy settings.</Text>
          </View>
        </View>

        {/* Quote */}
        <View style={styles.quoteCard}>
          <Ionicons name="chatbubbles-outline" size={22} color="#db2777" />
          <Text style={styles.quote}>
            “Connecting people through seamless interactions, where every voice matters.”
          </Text>
        </View>

        {/* Socials */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Follow Us</Text>
          <Text style={styles.cardText}>
            Stay updated with the latest features and improvements. Follow us and be part of the SocialView community!
          </Text>

          <View style={styles.socialRow}>
            <TouchableOpacity onPress={() => open('https://facebook.com/abdulsaboor.official2')} style={styles.socialBtn} activeOpacity={0.8}>
              <Ionicons name="logo-facebook" size={18} color="#fff" />
              <Text style={styles.socialText}>Facebook</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => open('https://instagram.com/zain_shahid16')} style={[styles.socialBtn, {backgroundColor: '#e1306c'}]} activeOpacity={0.8}>
              <Ionicons name="logo-instagram" size={18} color="#fff" />
              <Text style={styles.socialText}>Instagram</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{height: 16}} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingBottom: 10},
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '800'},

  hero: {alignItems: 'center', paddingBottom: 12},
  profileImage: {width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)'},
  heroTitle: {color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8},
  heroSubtitle: {color: 'rgba(255,255,255,0.9)', marginTop: 2},

  content: {padding: 16, paddingBottom: 24},
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 8},
  cardText: {fontSize: 15, color: '#444', lineHeight: 22},

  bullet: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8},
  bulletText: {flex: 1, color: '#333', fontSize: 15, lineHeight: 22},

  quoteCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#db2777',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  quote: {flex: 1, fontStyle: 'italic', fontSize: 16, color: '#555'},
  socialRow: {flexDirection: 'row', gap: 10, marginTop: 12},
  socialBtn: {flex: 1, backgroundColor: '#1877f2', paddingVertical: 10, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6},
  socialText: {color: '#fff', fontWeight: '700'},
});

export default AboutUs;
