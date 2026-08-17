// App/utils/authHelpers.js
import auth from '@react-native-firebase/auth';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
export const isValidEmail = (e) => EMAIL_RE.test(String(e || '').trim().toLowerCase());

export async function getProvidersForEmail(email) {
  try {
    return await auth().fetchSignInMethodsForEmail(email.trim().toLowerCase());
  } catch {
    return [];
  }
}

export const mapAuthErr = (code, fallback = 'Something went wrong.') => {
  switch (code) {
    case 'auth/email-already-in-use':   return 'That email is already in use.';
    case 'auth/invalid-email':          return 'The email address is invalid.';
    case 'auth/weak-password':          return 'Use at least 6 characters.';
    case 'auth/wrong-password':         return 'Incorrect password.';
    case 'auth/user-not-found':         return 'No account found for that email.';
    case 'auth/too-many-requests':      return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default:                            return fallback;
  }
};
