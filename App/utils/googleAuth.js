// // App/utils/googleAuth.js
// import {
//   GoogleSignin,
//   statusCodes,
// } from '@react-native-google-signin/google-signin';
// import auth from '@react-native-firebase/auth';
// import firestore from '@react-native-firebase/firestore';

// const cap = (t = '') => t.replace(/\b\w/g, c => c.toUpperCase());

// export async function signInWithGoogle() {
//   try {
//     await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

//     // Do not call signIn() more than once per attempt
//     const res = await GoogleSignin.signIn();

//     // v13+ returns { data: { idToken } }, older returns idToken at top level.
//     // NOTE: as of v10+, signIn()'s own response often does NOT include a
//     // usable accessToken (it can come back as "" or be missing entirely).
//     // The reliable way to get one is calling GoogleSignin.getTokens()
//     // explicitly right after signing in — that's what actually fixes the
//     // native "[auth/unknown] Exception in HostFunction: accessToken cannot
//     // be empty" crash, since an empty string is truthy-adjacent enough to
//     // slip past a naive falsy check in some SDK/bridge versions.
//     let idToken = res?.data?.idToken ?? res?.idToken ?? null;

//     if (!idToken) {
//       throw new Error(
//         'No idToken from Google (check webClientId / OAuth setup).',
//       );
//     }

//     let accessToken = null;
//     try {
//       const tokens = await GoogleSignin.getTokens();
//       accessToken = tokens?.accessToken || null;
//     } catch (tokenErr) {
//       console.log(
//         'getTokens() failed, continuing with idToken only:',
//         tokenErr?.message || tokenErr,
//       );
//     }

//     // Only pass accessToken when it's a real, non-empty string. Passing an
//     // empty string (or `undefined` explicitly as the 2nd arg) still crosses
//     // the RN bridge and trips the native Android check.
//     const credential =
//       typeof accessToken === 'string' && accessToken.length > 0
//         ? auth.GoogleAuthProvider.credential(idToken, accessToken)
//         : auth.GoogleAuthProvider.credential(idToken);

//     const { user, additionalUserInfo } = await auth().signInWithCredential(
//       credential,
//     );

//     const displayName = user.displayName
//       ? cap(user.displayName)
//       : user.email
//       ? cap(user.email.split('@')[0])
//       : 'User';

//     await firestore()
//       .collection('Users')
//       .doc(user.uid)
//       .set(
//         {
//           uid: user.uid,
//           displayName,
//           email: user.email || '',
//           image: user.photoURL || '',
//           phone: user.phoneNumber || '',
//           onlineInChat: false,
//           createdAt: firestore.FieldValue.serverTimestamp(),
//         },
//         { merge: true },
//       );

//     return { user, isNewUser: !!additionalUserInfo?.isNewUser };
//   } catch (e) {
//     // Map common google-signin errors
//     if (e?.code === statusCodes.SIGN_IN_CANCELLED || e?.code === 12501) {
//       throw new Error('Sign in cancelled.');
//     }
//     if (e?.code === statusCodes.IN_PROGRESS) {
//       throw new Error('Another sign-in is in progress.');
//     }
//     if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
//       throw new Error('Google Play Services not available or out of date.');
//     }
//     if (
//       e?.code === 10 ||
//       String(e?.message || '').includes('DEVELOPER_ERROR')
//     ) {
//       throw new Error(
//         'Developer Error: OAuth client / SHA mismatch. Update SHA-1/256 in Firebase, re-download google-services.json, then uninstall & reinstall the app.',
//       );
//     }
//     throw e instanceof Error ? e : new Error(String(e));
//   }
// }



// App/utils/googleAuth.js

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const cap = (t = '') => t.replace(/\b\w/g, c => c.toUpperCase());

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });

    const res = await GoogleSignin.signIn();

    let idToken = res?.data?.idToken ?? res?.idToken ?? null;

    if (!idToken) {
      throw new Error(
        'No idToken from Google (check webClientId / OAuth setup).',
      );
    }

    let accessToken = null;

    try {
      const tokens = await GoogleSignin.getTokens();
      accessToken = tokens?.accessToken || null;
    } catch (tokenErr) {
      console.log(
        'getTokens() failed, continuing with idToken only:',
        tokenErr?.message || tokenErr,
      );
    }

    const credential =
      typeof accessToken === 'string' && accessToken.length > 0
        ? auth.GoogleAuthProvider.credential(idToken, accessToken)
        : auth.GoogleAuthProvider.credential(idToken);

    const { user, additionalUserInfo } =
      await auth().signInWithCredential(credential);

    const displayName = user.displayName
      ? cap(user.displayName)
      : user.email
      ? cap(user.email.split('@')[0])
      : 'User';

    const userRef = firestore()
      .collection('Users')
      .doc(user.uid);

    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      // First Google login — create the complete profile.
      await userRef.set({
        uid: user.uid,
        displayName,
        email: user.email || '',
        image: user.photoURL || '',
        phone: user.phoneNumber || '',

        onlineStatus: true,
        onlineInChat: false,

        bio: '',
        lastMsg: '',
        lastMsgTime: '',

        phonePrivacy: 'public',
        profilePrivacy: 'public',

        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Existing user — update only Google/Auth information.
      // Do NOT overwrite bio, phone, privacy settings, etc.
      await userRef.set(
        {
          uid: user.uid,
          displayName,
          email: user.email || '',
          image: user.photoURL || '',
          onlineStatus: true,
          onlineInChat: false,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return {
      user,
      isNewUser: !userSnap.exists || !!additionalUserInfo?.isNewUser,
    };
  } catch (e) {
    if (
      e?.code === statusCodes.SIGN_IN_CANCELLED ||
      e?.code === 12501
    ) {
      throw new Error('Sign in cancelled.');
    }

    if (e?.code === statusCodes.IN_PROGRESS) {
      throw new Error('Another sign-in is in progress.');
    }

    if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error(
        'Google Play Services not available or out of date.',
      );
    }

    if (
      e?.code === 10 ||
      String(e?.message || '').includes('DEVELOPER_ERROR')
    ) {
      throw new Error(
        'Developer Error: OAuth client / SHA mismatch. Update SHA-1/256 in Firebase, re-download google-services.json, then uninstall & reinstall the app.',
      );
    }

    throw e instanceof Error ? e : new Error(String(e));
  }
}