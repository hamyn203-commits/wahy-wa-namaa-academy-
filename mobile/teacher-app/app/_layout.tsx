import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { UpdateGate } from '../src/components/UpdateGate';
import { colors } from '../src/theme/tokens';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Amiri_400Regular,
    Amiri_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splashHold}>
        <StatusBar style="light" backgroundColor={colors.emeraldDeep} />
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <StatusBar style="light" backgroundColor={colors.emeraldDeep} />
              <UpdateGate>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.ivory },
                    animation: 'slide_from_right',
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="ai-copilot" />
                  <Stack.Screen name="achievement-card" />
                  <Stack.Screen name="mushaf-board" />
                  <Stack.Screen name="circle-queue" />
                  <Stack.Screen name="wallet" />
                  <Stack.Screen name="schedule" />
                  <Stack.Screen name="updates" />
                  <Stack.Screen name="analytics" />
                  <Stack.Screen name="reviews" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="profile" />
                  <Stack.Screen name="student/[studentId]" />
                  <Stack.Screen name="session-chat/[sessionId]" />
                  <Stack.Screen name="live/[roomId]" options={{ animation: 'fade' }} />
                </Stack>
              </UpdateGate>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashHold: {
    flex: 1,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
