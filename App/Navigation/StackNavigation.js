// App/Navigation/StackNavigation.jsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SplashScreen from '../Screens/SplashScreen';
import TabNavigation from './TabNavigation';

import CallingScreen from '../Screens/CallingScreen';
import ForVideoCall from '../Screens/ForVideoCall';
import IncomingCallScreen from '../Screens/IncomingCallScreen';

import IndividualPostScreen from '../Screens/IndividualPostScreen';
import PostDetails from '../Components/PostDetails';

import AddStoryScreen from '../Screens/AddStoryScreen';
import StoryScreen from '../Screens/StoryScreen';
import StoryViewersScreen from '../Screens/StoryViewersScreen';

import ChatListScreen from '../Screens/ChatListScreen';
import ChatScreen from '../Screens/ChatScreen';
import UsersList from '../Screens/UsersList';
import UserProfile from '../Screens/UserProfile';

import ChangePassword from '../Screens/ChangePassword';
import EditProfileScreen from '../Screens/EditProfileScreen';
import LikedByScreen from '../Screens/LikedByScreen';

import SearchBar from '../Screens/SearchBar';
import EditPostScreen from '../Screens/EditPostScreen';

import LoginScreen from '../Screens/LoginScreen';
import RegisterScreen from '../Screens/RegisterScreen';
import ForgetPassword from '../Screens/ForgetPassword';

import BlogScreen from '../Screens/BlogScreen';
import ContactUs from '../Screens/ContactUs';
import AboutUs from '../Screens/AboutUs';

const Stack = createNativeStackNavigator();

export default function StackNavigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Home" component={TabNavigation} />

      {/* Calls */}
      <Stack.Screen name="CallingScreen" component={CallingScreen} />
      <Stack.Screen name="ForVideoCall" component={ForVideoCall} />
      <Stack.Screen name="IncomingCallScreen" component={IncomingCallScreen} />

      {/* Posts */}
      <Stack.Screen name="Post" component={IndividualPostScreen} />
      <Stack.Screen name="PostDetails" component={PostDetails} />

      {/* Stories */}
      <Stack.Screen name="AddStory" component={AddStoryScreen} />
      <Stack.Screen name="StoryScreen" component={StoryScreen} />
      <Stack.Screen name="StoryViewers" component={StoryViewersScreen} />

      {/* Chats */}
      <Stack.Screen name="Chat List" component={ChatListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Users" component={UsersList} />
      <Stack.Screen name="User Profile" component={UserProfile} />

      {/* Profile */}
      <Stack.Screen name="Change Password" component={ChangePassword} />
      <Stack.Screen name="Edit Profile" component={EditProfileScreen} />
      <Stack.Screen name="Liked By" component={LikedByScreen} />

      {/* Search */}
      <Stack.Screen name="Search" component={SearchBar} />
      <Stack.Screen name="Edit Post" component={EditPostScreen} />

      {/* Auth */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Forget Password" component={ForgetPassword} />

      {/* Static */}
      <Stack.Screen name="TermsConditions" component={BlogScreen} />
      <Stack.Screen name="Contact" component={ContactUs} />
      <Stack.Screen name="About" component={AboutUs} />
    </Stack.Navigator>
  );
}
