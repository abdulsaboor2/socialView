// App.js
import React, { useEffect } from 'react';
import { Appearance, StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import { NavigationContainer } from '@react-navigation/native';
import FlashMessage from 'react-native-flash-message';
import { MenuProvider } from 'react-native-popup-menu';
import { enableScreens } from 'react-native-screens';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import storage from '@react-native-firebase/storage';

import { navigationRef } from './App/Navigation/NavigationService';
import TabNavigation from './App/Navigation/TabNavigation';

import CallWatcher from './App/Components/CallWatcher';
import MiniCallBar from './App/Components/MiniCallBar';

import StackNavigation from './App/Navigation/StackNavigation';
import { MyLightTheme } from './App/Navigation/theme';

enableScreens();
LogBox.ignoreLogs(['new NativeEventEmitter']);

storage().setMaxUploadRetryTime(30000);
storage().setMaxOperationRetryTime(30000);

export default function App() {
  useEffect(() => {
    Appearance.setColorScheme?.('light');
    GoogleSignin.configure({
      webClientId:
        '161426501800-0je5ib6ufsbr4meuo18psq4aaivvur7g.apps.googleusercontent.com',
      offlineAccess: true,
    });
  }, []);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <MenuProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <NavigationContainer theme={MyLightTheme} ref={navigationRef}>
            <CallWatcher />
            <MiniCallBar />
            <StackNavigation />
            <FlashMessage position="top" />
          </NavigationContainer>
        </MenuProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
