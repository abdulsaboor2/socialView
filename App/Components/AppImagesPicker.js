// App/Components/AppImagesPicker.js
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';

async function requestMediaPermissions(mediaType) {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Number(Platform.Version);

  try {
    if (apiLevel >= 33) {
      const wantsImages = mediaType === 'photo' || mediaType === 'mixed';
      const wantsVideo = mediaType === 'video' || mediaType === 'mixed';

      const permissionsToRequest = [
        ...(wantsImages
          ? [PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES]
          : []),
        ...(wantsVideo
          ? [PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO]
          : []),
      ];

      const results = await PermissionsAndroid.requestMultiple(
        permissionsToRequest,
      );

      // Grant if the user allowed at least one relevant permission —
      // covers partial/"selected photos only" access on Android 14+,
      // and avoids requiring video access when the user only wants photos.
      return permissionsToRequest.some(
        p => results[p] === PermissionsAndroid.RESULTS.GRANTED,
      );
    }

    // Android 12 and below
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission',
        message:
          'We need access to your media to let you upload photos and videos.',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    console.log('Permission error:', e);
    return false;
  }
}

const AppImagesPicker = forwardRef(
  (
    { onSelect, selectionLimit = 8, mediaType = 'mixed', alertOnError = true },
    ref,
  ) => {
    const inFlight = useRef(false);

    const open = async () => {
      if (inFlight.current) return; // guard against double-tap race
      inFlight.current = true;

      try {
        const allowed = await requestMediaPermissions(mediaType);
        if (!allowed) {
          if (alertOnError) {
            Alert.alert(
              'Permission needed',
              'Please grant Photos/Media permission in Settings to select images or videos.',
            );
          }
          return;
        }

        const res = await launchImageLibrary({
          mediaType,
          selectionLimit,
          quality: 0.95,
          includeExtra: true,
          presentationStyle: 'fullScreen', // iOS
        });

        if (res.didCancel) return;

        if (res.errorCode) {
          console.log('ImagePicker error:', res.errorMessage || res.errorCode);
          if (alertOnError) {
            Alert.alert('Picker error', res.errorMessage || res.errorCode);
          }
          return;
        }

        const assets = (res.assets || []).map(a => ({
          uri: a.uri,
          type: a.type,
          fileName: a.fileName,
          width: a.width,
          height: a.height,
          duration: a.duration,
        }));

        onSelect?.(assets);
      } finally {
        inFlight.current = false;
      }
    };

    useImperativeHandle(ref, () => ({ open }));
    return null; // headless
  },
);

export default AppImagesPicker;
