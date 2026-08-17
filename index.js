/**
 * @format
 */

import 'react-native-gesture-handler';
import 'react-native-reanimated';        // must be at the top
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import firestore from '@react-native-firebase/firestore';

// Optional: explicitly ensure persistence ON (not needed unless you disabled before)
try { 
    firestore().settings({ persistence: true });
} 
catch (e) {
  console.log('Firestore persistence setting error:', e);
}

AppRegistry.registerComponent(appName, () => App);