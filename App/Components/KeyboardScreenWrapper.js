// App/Components/KeyboardScreenWrapper.js
//
// Drop-in replacement for: SafeAreaView + KeyboardAvoidingView + ScrollView.
// Fixes (for every screen that uses it):
//   1. Content hidden behind punch-hole camera / status bar on Android.
//   2. Bottom of the form unreachable when the keyboard is open.
//
// Usage:
//   <KeyboardScreenWrapper backgroundColor={BG}>
//     ...your screen content...
//   </KeyboardScreenWrapper>
//
import React from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const KeyboardScreenWrapper = ({
  children,
  contentContainerStyle,
  backgroundColor = '#ffffff',
  bottomOffset = 24, // extra breathing room above the keyboard
  topInset = true, // set false if the screen already handles its own top padding (e.g. a full-bleed header image)
  ...rest
}) => {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor }}
      contentContainerStyle={[
        {
          flexGrow: 1,
          paddingTop: topInset ? insets.top : 0,
          // insets.bottom covers the gesture bar; add a little extra so the
          // last field/button never sits flush against it or the keyboard.
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      bottomOffset={bottomOffset}
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {children}
    </KeyboardAwareScrollView>
  );
};

export default KeyboardScreenWrapper;
