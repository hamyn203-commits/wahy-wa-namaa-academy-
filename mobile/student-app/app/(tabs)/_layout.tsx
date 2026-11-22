import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Bell, BookOpen, CalendarClock, Home, User } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { colors, fonts, radius, shadows } from '../../src/theme/tokens';

function TabIconWrap({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      {children}
    </View>
  );
}

export default function TabsLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useI18n();

  if (!loading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.emerald,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.borderSoft,
          height: Platform.OS === 'ios' ? 84 : 70,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          paddingTop: 8,
          ...shadows.tabBar,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: fonts.bold,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.home,
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrap focused={focused}>
              <Home size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: t.tabs.sessions,
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrap focused={focused}>
              <CalendarClock size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="homework"
        options={{
          title: t.tabs.homework,
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrap focused={focused}>
              <BookOpen size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t.tabs.notifications,
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrap focused={focused}>
              <Bell size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrap focused={focused}>
              <User size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </TabIconWrap>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 44,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.emeraldSoft,
  },
});
