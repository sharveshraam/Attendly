import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useActiveSemester, useAssignments, useCourseStats, useEvents, useSessions } from '@/hooks/useAcademicData';
import { answerQuestion, QUICK_QUESTIONS, type AssistantAnswer } from '@/lib/assistant/answers';
import { useTheme } from '@/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  action?: AssistantAnswer['action'];
}

export default function Assistant() {
  const router = useRouter();
  const { theme } = useTheme();
  const { active } = useActiveSemester();
  const semesterId = active?.id ?? null;
  const { stats, courses } = useCourseStats(semesterId);
  const { sessions } = useSessions(semesterId);
  const assignmentsQuery = useAssignments(semesterId);
  const eventsQuery = useEvents(semesterId);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', text: 'Hi! I am the Attendly Assistant. I answer from your own attendance data using deterministic calculations — nothing is invented or sent to an external AI. Ask me a question below.' },
  ]);
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const answer = answerQuestion(trimmed, {
      semester: active,
      courses,
      stats,
      sessions,
      assignments: assignmentsQuery.data ?? [],
      events: eventsQuery.data ?? [],
    });
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: trimmed },
      { id: `a-${Date.now()}`, role: 'assistant', text: answer.text, action: answer.action },
    ]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <Screen scroll={false} padded={false} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primarySoft }]}>
          <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="subtitle" weight="bold">Attendly Assistant</Text>
          <Text variant="caption" tone="secondary">Deterministic · private · on-device</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        {messages.map((message) => (
          <View key={message.id} style={[styles.bubbleRow, message.role === 'user' ? styles.userRow : styles.assistantRow]}>
            <View style={[styles.bubble, { backgroundColor: message.role === 'user' ? theme.colors.primary : theme.colors.surface }]}>
              <Text variant="small" tone={message.role === 'user' ? 'inverse' : 'primary'} style={styles.bubbleText}>{message.text}</Text>
              {message.action ? (
                <Pressable onPress={() => router.push(message.action!.route as never)} style={styles.actionLink}>
                  <Text variant="caption" weight="semiBold" style={{ color: message.role === 'user' ? '#FFFFFF' : theme.colors.primary }}>
                    {message.action.label} →
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.quickWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {QUICK_QUESTIONS.map((q) => (
            <Pressable key={q} onPress={() => ask(q)} style={[styles.quickChip, { backgroundColor: theme.colors.surfaceSecondary }]}>
              <Text variant="caption" weight="medium" tone="secondary">{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.inputRow, { borderTopColor: theme.colors.border }]}>
        <Input value={input} onChangeText={setInput} placeholder="Ask about your attendance…" style={styles.flex} />
        <Button label="Send" icon="send" onPress={() => ask(input)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  messages: { padding: 16, gap: 12, paddingBottom: 8 },
  bubbleRow: { flexDirection: 'row' },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 16, gap: 8 },
  bubbleText: { lineHeight: 19 },
  actionLink: { alignSelf: 'flex-start' },
  quickWrap: { paddingBottom: 8 },
  quickRow: { gap: 8, paddingHorizontal: 16 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
