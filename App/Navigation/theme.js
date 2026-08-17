// App/Navigation/theme.js
import { DefaultTheme } from '@react-navigation/native';

export const MyLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#ffffff',
    card: '#ffffff',
    text: '#000000',
  },
};
