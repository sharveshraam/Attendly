import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Text } from '@/components/ui';
import { useTheme } from '@/theme';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
}

export function StatCard({ label, value, sublabel, icon, accent }: StatCardProps) {
  const { theme } = useTheme();
  const color = accent ?? theme.colors.primary;
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
        ) : null}
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="headline" weight="bold" style={styles.value}>
        {value}
      </Text>
      {sublabel ? (
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 6, minWidth: 140 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  value: { marginTop: 2 },
});
