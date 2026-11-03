import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  padded?: boolean;
}

export function Screen({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  keyboardAvoiding = false,
  padded = true,
}: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = padded ? theme.spacing.lg : 0;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        { padding, paddingBottom: padding + theme.spacing.xxl },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { padding }, contentContainerStyle]}>{children}</View>
  );

  const content = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: theme.colors.background, paddingTop: insets.top },
        style,
      ]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
