// App/Components/SettingListItem.js
import React from 'react';
import {TouchableOpacity, View, Text, StyleSheet} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const SettingListItem = ({
  title,
  subtitle,
  IconName,
  onPress,
  IconColor = '#7c3aed',
  TextColor = '#111827',
  showArrow = true,
  rightElement,
  destructive = false,
}) => {
  const textColor = destructive ? '#fe4c74' : TextColor;
  const iconColor = destructive ? '#fe4c74' : IconColor;

  return (
    <TouchableOpacity style={styles.itemContainer} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons style={styles.icon} name={IconName} size={24} color={iconColor} />
      <View style={{flex: 1}}>
        <Text style={[styles.title, {color: textColor}]}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightElement
        ? rightElement
        : showArrow && <MaterialCommunityIcons name="chevron-right" size={22} color="#C7C9D1" />}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  icon: {marginRight: 12},
  title: {fontSize: 16, fontWeight: '600'},
  subtitle: {fontSize: 12, color: '#6B7280', marginTop: 2},
});

export default SettingListItem;
