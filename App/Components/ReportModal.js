// App/Components/ReportModal.js
import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Ionicons from 'react-native-vector-icons/Ionicons';

const BRAND = '#7c3aed';
const REASONS = [
  'Spam',
  'Harassment or bullying',
  'Nudity or sexual content',
  'Hate speech',
  'False information',
  'Other',
];

const toast = msg => {
  if (!msg) return;
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('', msg);
};

/**
 * Shared report modal for both posts and user profiles.
 *
 * Props:
 * - visible: boolean
 * - onClose: () => void
 * - targetType: 'post' | 'user'
 * - targetId: the post's id, or the reported user's uid
 * - reportedUid: the uid of the person being reported (post author, or
 *   the profile owner) — used for moderation grouping, kept separate
 *   from targetId since for a post those two are different values.
 * - onSubmitted?: () => void  (called after a successful report)
 */
export default function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  reportedUid,
  onSubmitted,
}) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setReason(null);
    setDetails('');
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return; // don't let a stray tap dismiss mid-submit
    reset();
    onClose?.();
  }, [onClose, reset, submitting]);

  const handleSubmit = useCallback(async () => {
    const me = auth().currentUser?.uid;
    // Guarded defensively — this screen requires auth to be reachable
    // at all, so this should never actually fire, but if it somehow
    // did, silently writing an un-attributable report isn't useful for
    // moderation and would just get rejected by the security rule
    // anyway (reporterId must equal request.auth.uid, and there's no
    // request.auth at all if you're not signed in).
    if (!me) {
      Alert.alert('Sign in required', 'Please sign in to submit a report.');
      return;
    }
    if (!reason) {
      Alert.alert('Choose a reason', 'Please select a reason for this report.');
      return;
    }
    if (!targetId || !targetType) return;

    setSubmitting(true);
    try {
      await firestore()
        .collection('Reports')
        .add({
          type: targetType, // 'post' | 'user'
          targetId,
          reportedUid: reportedUid || null,
          reporterId: me,
          reason,
          details: reason === 'Other' ? details.trim().slice(0, 500) : '',
          status: 'pending',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      toast('Report submitted — thank you');
      onSubmitted?.();
      reset();
      onClose?.();
    } catch (e) {
      console.warn('Report submit failed:', e);
      Alert.alert('Error', 'Could not submit your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [
    details,
    onClose,
    onSubmitted,
    reason,
    reportedUid,
    reset,
    targetId,
    targetType,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>
          {targetType === 'user' ? 'Report this account' : 'Report this post'}
        </Text>
        <Text style={styles.subtitle}>
          Your report is anonymous to the person you're reporting.
        </Text>

        {REASONS.map(r => {
          const selected = reason === r;
          return (
            <TouchableOpacity
              key={r}
              style={styles.reasonRow}
              onPress={() => setReason(r)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.reasonText}>{r}</Text>
            </TouchableOpacity>
          );
        })}

        {reason === 'Other' && (
          <TextInput
            style={styles.detailsInput}
            placeholder="Tell us more (optional)"
            placeholderTextColor="#9CA3AF"
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={500}
          />
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={handleClose}
            disabled={submitting}
          >
            <Text style={styles.btnGhostText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnPrimary,
              (!reason || submitting) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={!reason || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Submit report</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 14 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: BRAND },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND,
  },
  reasonText: { fontSize: 15, color: '#111827', fontWeight: '600' },
  detailsInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 4,
    marginBottom: 4,
    color: '#111827',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: '#f3f4f6' },
  btnGhostText: { color: '#374151', fontWeight: '700' },
  btnPrimary: { backgroundColor: BRAND },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
});
