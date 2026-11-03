import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useForm } from '@/hooks/useForm';
import { groupSchema } from '@/lib/validation';
import { useCreateGroup } from '@/hooks/useGroups';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export default function NewGroup() {
  const router = useRouter();
  const { theme } = useTheme();
  const createGroup = useCreateGroup();
  const [error, setError] = useState<string | null>(null);
  const form = useForm(groupSchema, { name: '' });

  const submit = async () => {
    const values = form.validate();
    if (!values) return;
    setError(null);
    try {
      const group = await createGroup.mutateAsync(values.name);
      router.replace(`/groups/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the group.');
    }
  };

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Create a group</Text>
      <Text variant="small" tone="secondary">
        Groups share a timetable and calendar with classmates. Everyone's personal attendance stays
        private.
      </Text>
      <Card style={styles.infoCard}>
        <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.secondary} />
        <Text variant="caption" tone="secondary" style={styles.flex}>
          You'll become the group owner. Share the invite code so classmates can join as members.
        </Text>
      </Card>
      <Input label="Group name" value={form.values.name} onChangeText={(v) => form.setValue('name', v)} placeholder="e.g. CSE Batch 2026" icon="people-outline" error={form.errors.name} />
      {error ? <Text variant="small" tone="danger">{error}</Text> : null}
      <Button label="Create group" fullWidth size="lg" loading={createGroup.isPending} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingTop: 16 },
  infoCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
