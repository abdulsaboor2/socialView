import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

import AppInput from '../Components/AppInput';
import AppButton from '../Components/AppButton';
import { successMessage, errorMessage } from '../Components/MessageAlert';

const MAX_MESSAGE = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const ContactUs = () => {
  const user = auth().currentUser;

  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const isEmailValid = useMemo(() => !email || EMAIL_RE.test(email.trim().toLowerCase()), [email]);
  const isFormValid = useMemo(
    () =>
      name.trim().length >= 2 &&
      EMAIL_RE.test((email || '').trim().toLowerCase()) &&
      subject.trim().length >= 2 &&
      message.trim().length >= 10,
    [name, email, subject, message]
  );

  const handleSubmit = async () => {
    if (!isFormValid) {
      errorMessage?.('Please complete all fields correctly.') ||
        alert('Please complete all fields correctly.');
      return;
    }

    try {
      setSending(true);
      await firestore().collection('contactMessages').add({
        uid: user?.uid || null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        clientTime: new Date().toISOString(),
        timestamp: firestore.FieldValue.serverTimestamp(),
      });

      successMessage?.('Message sent successfully!') || alert('Message sent successfully!');
      setSubject('');
      setMessage('');
    } catch (e) {
      console.log(e);
      errorMessage?.('Failed to send message. Please try again.') ||
        alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const openMail = () => Linking.openURL('mailto:absaboor019@gmail.com').catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f7fb' }}>
      {/* Header */}
      <LinearGradient colors={['#7c3aed', '#db2777']} style={styles.header}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Contact Us</Text>
            <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
          </View>

          {/* Developer card */}
          <View style={styles.devCard}>
            <Image
              source={require('../Images/absaboor.jpg')}
              style={styles.devAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.devName}>Abdul Saboor</Text>
              <Text style={styles.devCompany}>WebRat Solutions</Text>
              <Text onPress={openMail} style={styles.devEmail}>
                absaboor019@gmail.com
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <AppInput
              label="Your name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon="person-outline"
              error={
                name && name.trim().length < 2
                  ? 'Please enter at least 2 characters.'
                  : undefined
              }
              returnKeyType="next"
            />

            <AppInput
              label="Your email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              inputMode="email"
              textContentType="emailAddress"
              leftIcon="mail-outline"
              error={!isEmailValid ? 'Invalid email address.' : undefined}
              returnKeyType="next"
              disabled={true}
            />

            <AppInput
              label="Subject"
              placeholder="How can we help?"
              value={subject}
              onChangeText={setSubject}
              leftIcon="help-circle-outline"
              error={
                subject && subject.trim().length < 2
                  ? 'Please add a subject.'
                  : undefined
              }
              returnKeyType="next"
            />

            <AppInput
              label="Message"
              placeholder="Write your message"
              value={message}
              onChangeText={t => t.length <= MAX_MESSAGE && setMessage(t)}
              multiline
              returnKeyType="done"
              inputStyle={{ minHeight: 90 }}
              leftIcon="create-outline"
              helperText={`${message.length}/${MAX_MESSAGE}`}
              error={
                message && message.trim().length < 10
                  ? 'Please provide at least 10 characters.'
                  : undefined
              }
              containerStyle={{ marginTop: 12 }}
              textAlignVertical="top"
            />
          </View>

          {/* Socials */}
          <View style={styles.socialCard}>
            <Text style={styles.followText}>Follow Us — WebRat Solutions</Text>
            <View style={styles.socialRow}>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://www.webratsolutions.com')
                }
              >
                <Image
                  source={require('../Images/facebook.jpg')}
                  style={styles.socialIcon}
                />
              </TouchableOpacity>

              {/* Instagram Link */}
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://www.instagram.com/webratsolutions')
                }
              >
                <Image
                  source={require('../Images/instagram.jpg')}
                  style={[styles.socialIcon, { marginLeft: 16 }]}
                />
              </TouchableOpacity>
            </View>
          </View>

          <AppButton
            title="Send Message"
            onPress={handleSubmit}
            color="#7c3aed"
            loading={sending}
            disabled={sending || !isFormValid}
            leftIcon="send-outline"
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { paddingBottom: 10, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },

  devCard: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  devAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  devName: { color: '#fff', fontWeight: '800' },
  devCompany: { color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  devEmail: { color: '#fff', marginTop: 2, textDecorationLine: 'underline' },

  content: { padding: 16, paddingBottom: 28 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },

  socialCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  followText: { fontSize: 16, fontWeight: '700', color: '#111' },
  socialRow: { flexDirection: 'row', marginTop: 10 },
  socialIcon: { width: 44, height: 44, borderRadius: 8, resizeMode: 'cover' },
});

export default ContactUs;
