import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Screen, Text } from '@/components/ui';
import { inviteCodeSchema } from '@/lib/validation';
import { useJoinGroup } from '@/hooks/useGroups';

export default function JoinGroup() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const joinGroup = useJoinGroup();
  const [value, setValue] = useState(code ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) setValue(code);
  }, [code]);

  const submit = async () => {
    const parsed = inviteCodeSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid invite code.');
      return;
    }
    setError(null);
    try {
      const groupId = await joinGroup.mutateAsync(parsed.data);
      router.replace(`/groups/${groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the group. Check the invite code.');
    }
  };

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.container}>
      <Text variant="headline" weight="bold">Join a group</Text>
      <Text variant="small" tone="secondary">Enter the invite code shared by a classmate.</Text>
      <Input
        label="Invite code"
        value={value}
        onChangeText={(v) => setValue(v.toUpperCase())}
        placeholder="e.g. A1B2C3D4E5"
        autoCapitalize="characters"
        icon="key-outline"
        error={error ?? undefined}
      />
      <Button label="Join group" fullWidth size="lg" loading={joinGroup.isPending} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingTop: 16 },
});
