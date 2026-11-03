import { useCallback, useState } from 'react';
import type { z } from 'zod';
import { fieldErrors } from '@/lib/validation';

/** Lightweight controlled-form state with Zod validation (no extra deps). */
export function useForm<T extends Record<string, unknown>>(schema: z.ZodType<T>, initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  const validate = useCallback((): T | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    setErrors(fieldErrors(result.error));
    return null;
  }, [schema, values]);

  const reset = useCallback((next?: T) => {
    setValues(next ?? initial);
    setErrors({});
  }, [initial]);

  return { values, errors, setValue, validate, reset, setErrors };
}
