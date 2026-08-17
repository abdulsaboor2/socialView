// App/Navigation/TabNavigation.jsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import NewsFeedScreen from '../Screens/NewsFeedScreen';
import StoriesTabScreen from '../Screens/StoriesTabScreen';
import GalleryScreen from '../Screens/GalleryScreen';
import CallHistory from '../Screens/CallHistory';
import ProfileScreen from '../Screens/ProfileScreen';

import CustomTabBar from '../Components/CustomTabBar';

const Tab = createBottomTabNavigator();

export default function TabNavigation() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: 'transparent' },
        sceneStyle: { backgroundColor: '#fff' },
        lazy: true,
      }}
      tabBar={props => <CustomTabBar {...props} />}
    >
      <Tab.Screen
        name="News Feed"
        component={NewsFeedScreen}
        initialParams={{ tabBarHeight: 0 }}
      />
      <Tab.Screen
        name="Stories"
        component={StoriesTabScreen}
        options={{ unmountOnBlur: true }}
      />
      <Tab.Screen name="Upload Post" component={GalleryScreen} />
      <Tab.Screen name="Calls" component={CallHistory} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
