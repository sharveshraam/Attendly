import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'password' | 'name' | 'off';
  multiline?: boolean;
  numberOfLines?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete = 'off',
  multiline = false,
  numberOfLines = 1,
  icon,
  editable = true,
  style,
  testID,
}: InputProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [hidden, setHidden] = useState(secureTextEntry);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <Text style={[styles.label, { color: c.textSecondary, fontFamily: theme.typography.fontFamily.medium }]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: c.inputBackground,
            borderColor: error ? c.danger : focused ? c.primary : c.border,
            borderRadius: theme.radius.md,
            minHeight: multiline ? 96 : 48,
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={c.textTertiary} style={styles.icon} /> : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            {
              color: c.text,
              fontFamily: theme.typography.fontFamily.regular,
              textAlignVertical: multiline ? 'top' : 'center',
              paddingVertical: multiline ? theme.spacing.md : 0,
            },
          ]}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={c.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.message, { color: c.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.message, { color: c.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 14 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15 },
  message: { fontSize: 12 },
});
