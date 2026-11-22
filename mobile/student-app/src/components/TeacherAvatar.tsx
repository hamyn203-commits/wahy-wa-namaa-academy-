import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

interface TeacherAvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  highlight?: boolean;
}

export function TeacherAvatar({ uri, name, size = 56, highlight = true }: TeacherAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const initial = (name || 'م').trim().charAt(0) || 'م';
  const radius = size / 2;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: highlight ? colors.gold : colors.borderStrong,
          borderWidth: highlight ? 2 : 1.5,
        },
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: size - 4, height: size - 4, borderRadius: radius }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.39) }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.emeraldDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: colors.goldBright,
    fontFamily: fonts.extraBold,
  },
});
