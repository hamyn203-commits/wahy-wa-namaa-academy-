import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors } from '../src/theme/tokens';

export default function EntryScreen() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
