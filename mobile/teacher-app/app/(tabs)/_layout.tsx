import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { BookOpenCheck, CalendarClock, Home, LayoutGrid, Users } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { useI18n } from '../../src/i18n/I18nProvider';
import { TeacherApprovalGate } from '../../src/components/TeacherApprovalGate';
import { colors, fonts, radius, shadows } from '../../src/theme/tokens';

function TabIconWrap({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      {children}
    </View>
  );
}

export default function TeacherTabsLayout() {
  const { isAuthenticated, isApprovedTeacher, loading } = useAuth();
  const { palette } = useTheme();
  const { t } = useI18n();

  if (!loading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!loading && isAuthenticated && !isApprovedTeacher) {
    return <TeacherApprovalGate />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.emerald,
        tabBarInactiveTintColor: palette.textTertiary,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopWidth: 1,
          borderTopColor: palette.border,
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
        name="students"
        options={{
          title: t.tabs.students,
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrap focused={focused}>
              <Users size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
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
              <BookOpenCheck size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </TabIconWrap>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t.tabs.more,
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrap focused={focused}>
              <LayoutGrid size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
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
