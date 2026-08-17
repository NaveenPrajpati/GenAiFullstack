import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { useColors } from '@/components/ui/theme';
import { useLearningStore } from '@/features/learning/store';
import type {
  Difficulty,
  ExplanationStyle,
  LearningAvailability,
  Memory,
  PreferredResourceType,
  QuizDifficulty,
} from '@/features/learning/types';
import { Picker } from '@expo/ui/community/picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const arrToStr = (a?: string[]) => (a ?? []).join(', ');
const strToArr = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Parses a numeric field, clamped to the range the server accepts so a typo
 *  cannot turn a save into a 422. An empty or unparseable field is `undefined`,
 *  which drops the key and clears the stored value. */
const toInt = (s: string, min?: number, max?: number) => {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max ?? n, Math.max(min ?? n, n));
};

/** One selectable value plus the wording shown for it. The values are the
 *  server's enums verbatim; only the labels are ours to phrase. */
type Option<T extends string> = { value: T; label: string };

const SKILL_LEVELS: Option<Difficulty>[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const RESOURCE_TYPES: Option<PreferredResourceType>[] = [
  { value: 'video', label: 'Videos' },
  { value: 'article', label: 'Articles' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'interactive', label: 'Interactive' },
  { value: 'project', label: 'Projects' },
  { value: 'book', label: 'Books' },
];

const EXPLANATION_STYLES: Option<ExplanationStyle>[] = [
  { value: 'concise', label: 'Concise' },
  { value: 'step_by_step', label: 'Step by step' },
  { value: 'examples_first', label: 'Examples first' },
  { value: 'visual', label: 'Visual' },
  { value: 'socratic', label: 'Socratic — ask me questions' },
];

const QUIZ_DIFFICULTIES: Option<QuizDifficulty>[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'adaptive', label: 'Adaptive' },
  { value: 'challenging', label: 'Challenging' },
];

/** Narrows a stored value to one of `options`, so a profile written by an older
 *  build (or by the agent itself) can never put the form into a state the
 *  server would reject on the next save. */
const asOption = <T extends string>(options: Option<T>[], value?: string): T | '' =>
  options.find((o) => o.value === value)?.value ?? '';

const asOptions = <T extends string>(options: Option<T>[], values?: string[]): T[] =>
  options.filter((o) => (values ?? []).includes(o.value)).map((o) => o.value);

type FormState = {
  skill_level: Difficulty | '';
  preferred_resource_types: PreferredResourceType[];
  preferred_explanation_style: ExplanationStyle | '';
  preferred_quiz_difficulty: QuizDifficulty | '';
  goals: string;
  /** Backs `availability.minutes_per_day`, which is what the backend stores. */
  minutes_per_day: string;
  /** Backs `availability.days_per_week`. */
  days_per_week: string;
  known_topics: string;
};

const EMPTY_FORM: FormState = {
  skill_level: '',
  preferred_resource_types: [],
  preferred_explanation_style: '',
  preferred_quiz_difficulty: '',
  goals: '',
  minutes_per_day: '',
  days_per_week: '',
  known_topics: '',
};

/** An enum field, backed by a native picker. The leading empty option is what
 *  clears the preference — the server treats every one of these as optional. */
function SelectField<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Option<T>[];
  value: T | '';
  onChange: (value: T | '') => void;
}) {
  const colors = useColors();
  return (
    <View className="mb-4">
      <Text className="text-ink-faint mb-0.5 text-xs font-semibold">{label}</Text>
      {!!hint && <Text className="text-ink-faint mb-1 text-xs">{hint}</Text>}
      <View className="border-line bg-surface-alt overflow-hidden rounded-xl border px-2">
        <Picker selectedValue={value} onValueChange={(v) => onChange(v as T | '')}>
          <Picker.Item label="No preference" value="" color={colors.inkFaint} />
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} color={colors.ink} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

/** The list-valued enum fields. A picker takes one value, so these are chips. */
function ChipField<T extends string>({
  label,
  hint,
  options,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  options: Option<T>[];
  values: T[];
  onChange: (values: T[]) => void;
}) {
  const toggle = (value: T) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  return (
    <View className="mb-4">
      <Text className="text-ink-faint mb-0.5 text-xs font-semibold">{label}</Text>
      {!!hint && <Text className="text-ink-faint mb-2 text-xs">{hint}</Text>}
      <View className="flex-row flex-wrap gap-1.5">
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <TouchableOpacity
              key={o.value}
              onPress={() => toggle(o.value)}
              className={`rounded-lg border px-2.5 py-1.5 ${
                on ? 'border-primary bg-primary-soft' : 'border-line bg-surface-alt'
              }`}
              activeOpacity={0.7}>
              <Text className={`text-xs ${on ? 'text-primary font-medium' : 'text-ink-soft'}`}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const {
    memory,
    memoryLoading,
    fetchMemory,
    saveMemory,
    deleteMemory,
    digestEnabled,
    digestHour,
    digestTimezone,
    digestLoading,
    digestSaving,
    fetchTriggers,
    toggleDigest,
    saveTriggerSettings,
  } = useLearningStore();

  const colors = useColors();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Local, editable copy of the digest schedule; synced from the store once the
  // triggers load and saved back via PATCH /trigger-settings.
  const [hour, setHour] = useState(digestHour);
  const [tz, setTz] = useState(digestTimezone);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    fetchMemory();
    fetchTriggers();
  }, []);

  useEffect(() => {
    setHour(digestHour);
    setTz(digestTimezone);
  }, [digestHour, digestTimezone]);

  const scheduleDirty = hour !== digestHour || tz.trim() !== digestTimezone;

  const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

  const handleSaveSchedule = async () => {
    setScheduleError('');
    try {
      await saveTriggerSettings({ schedule_hour: hour, timezone: tz.trim() });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
    } catch (e: any) {
      setScheduleError(e?.response?.data?.detail ?? 'Failed to save schedule.');
    }
  };

  useEffect(() => {
    if (memory) {
      setForm({
        skill_level: asOption(SKILL_LEVELS, memory.skill_level),
        preferred_resource_types: asOptions(RESOURCE_TYPES, memory.preferred_resource_types),
        preferred_explanation_style: asOption(
          EXPLANATION_STYLES,
          memory.preferred_explanation_style
        ),
        preferred_quiz_difficulty: asOption(QUIZ_DIFFICULTIES, memory.preferred_quiz_difficulty),
        goals: arrToStr(memory.goals),
        minutes_per_day: memory.availability?.minutes_per_day?.toString() ?? '',
        days_per_week: memory.availability?.days_per_week?.toString() ?? '',
        known_topics: arrToStr(memory.known_topics),
      });
    }
  }, [memory]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // `availability` is a single nested object on the server, so it goes up
      // whole — merged onto what is already stored so the parts this form does
      // not expose (`preferred_days`, `deadline`) survive the save.
      const availability: LearningAvailability = {
        ...(memory?.availability ?? {}),
        minutes_per_day: toInt(form.minutes_per_day),
        days_per_week: toInt(form.days_per_week, 1, 7),
      };
      const data: Partial<Memory> = {
        // Every enum below is optional on the server and each control's empty
        // option means "no preference", which is sent as an omitted field.
        skill_level: form.skill_level || undefined,
        preferred_resource_types: form.preferred_resource_types,
        preferred_explanation_style: form.preferred_explanation_style || undefined,
        preferred_quiz_difficulty: form.preferred_quiz_difficulty || undefined,
        goals: strToArr(form.goals),
        availability: Object.values(availability).some((v) => v != null) ? availability : undefined,
        known_topics: strToArr(form.known_topics),
      };
      await saveMemory(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearMemory = () => {
    Alert.alert('Clear Memory', 'Clear all learning profile data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await deleteMemory();
            setForm(EMPTY_FORM);
          } catch (e: any) {
            setError(e?.response?.data?.detail ?? 'Failed to clear memory.');
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  const handleToggleDigest = async () => {
    setToggling(true);
    try {
      await toggleDigest();
      fetchTriggers();
    } finally {
      setToggling(false);
    }
  };

  const setField =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  const wide = useWideNav();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }} className="bg-bg">
      <ScreenHeader
        title="Settings"
        subtitle="Personalize your learning experience"
        showMenu={!wide}>
        <SectionNav />
      </ScreenHeader>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Daily Digest Toggle */}
        <View className="border-line bg-surface mb-4 rounded-xl border p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-ink text-sm font-semibold">Daily Digests</Text>
              <Text className="text-ink-faint mt-0.5 text-xs leading-relaxed">
                Receive AI-curated summaries of your roadmap topics each day
              </Text>
            </View>
            {toggling || digestLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Switch
                value={digestEnabled}
                onValueChange={handleToggleDigest}
                trackColor={{ true: colors.primary, false: colors.line }}
                thumbColor={colors.surface}
              />
            )}
          </View>

          {!digestLoading && (
            <View className="border-line mt-4 border-t pt-4">
              <Text className="text-ink-faint mb-2 text-xs font-semibold">Delivery time</Text>
              <View className="border-line bg-surface-alt flex-row items-center justify-between rounded-xl border px-3 py-2">
                <TouchableOpacity
                  onPress={() => setHour((h) => (h + 23) % 24)}
                  className="bg-surface h-9 w-9 items-center justify-center rounded-lg"
                  activeOpacity={0.7}>
                  <Text className="text-ink-soft text-lg font-semibold">−</Text>
                </TouchableOpacity>
                <Text className="text-ink text-base font-semibold">{formatHour(hour)}</Text>
                <TouchableOpacity
                  onPress={() => setHour((h) => (h + 1) % 24)}
                  className="bg-surface h-9 w-9 items-center justify-center rounded-lg"
                  activeOpacity={0.7}>
                  <Text className="text-ink-soft text-lg font-semibold">+</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-ink-faint mt-4 mb-1 text-xs font-semibold">Timezone</Text>
              <TextInput
                className="border-line bg-surface-alt text-ink rounded-xl border px-4 py-3 text-sm"
                placeholder="e.g. Asia/Kolkata"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                value={tz}
                onChangeText={setTz}
              />

              {!!scheduleError && (
                <View className="border-danger bg-danger-soft mt-3 rounded-lg border p-3">
                  <Text className="text-danger text-sm">{scheduleError}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleSaveSchedule}
                disabled={digestSaving || !scheduleDirty || !tz.trim()}
                className={`mt-3 items-center rounded-xl py-3 ${
                  digestSaving
                    ? 'bg-surface-alt'
                    : scheduleSaved
                      ? 'bg-success'
                      : !scheduleDirty || !tz.trim()
                        ? 'bg-surface-alt'
                        : 'bg-primary'
                }`}
                activeOpacity={0.8}>
                {digestSaving ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text
                    className={`text-sm font-semibold ${
                      !scheduleDirty || !tz.trim() ? 'text-ink-faint' : 'text-on-primary'
                    }`}>
                    {scheduleSaved ? 'Saved!' : 'Save schedule'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Learning Profile */}
        <View className="border-line bg-surface mb-4 rounded-xl border p-4">
          <Text className="text-ink mb-1 text-sm font-semibold">Learning Profile</Text>
          <Text className="text-ink-faint mb-4 text-xs leading-relaxed">
            Shapes how new roadmaps are built and paced. Existing roadmaps will offer to update
            themselves once you change something here.
          </Text>

          {memoryLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator />
            </View>
          ) : (
            <>
              <SelectField
                label="Skill Level"
                options={SKILL_LEVELS}
                value={form.skill_level}
                onChange={setField('skill_level')}
              />

              <ChipField
                label="Preferred Resources"
                hint="What you want to be taught with — pick as many as you like"
                options={RESOURCE_TYPES}
                values={form.preferred_resource_types}
                onChange={setField('preferred_resource_types')}
              />

              <SelectField
                label="Explanation Style"
                hint="How the AI should walk you through a new topic"
                options={EXPLANATION_STYLES}
                value={form.preferred_explanation_style}
                onChange={setField('preferred_explanation_style')}
              />

              <SelectField
                label="Quiz Difficulty"
                hint="How hard recall checks and quizzes should be"
                options={QUIZ_DIFFICULTIES}
                value={form.preferred_quiz_difficulty}
                onChange={setField('preferred_quiz_difficulty')}
              />

              <View className="mb-4">
                <Text className="text-ink-faint mb-0.5 text-xs font-semibold">Available Time</Text>
                <Text className="text-ink-faint mb-1 text-xs">
                  Used to pace your roadmap — minutes per day, and how many days a week
                </Text>
                <View className="flex-row gap-2">
                  <TextInput
                    className="border-line bg-surface-alt text-ink flex-1 rounded-xl border px-4 py-3 text-sm"
                    placeholder="e.g. 60 min/day"
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="number-pad"
                    value={form.minutes_per_day}
                    onChangeText={setField('minutes_per_day')}
                  />
                  <TextInput
                    className="border-line bg-surface-alt text-ink flex-1 rounded-xl border px-4 py-3 text-sm"
                    placeholder="e.g. 5 days/wk"
                    placeholderTextColor={colors.inkFaint}
                    keyboardType="number-pad"
                    value={form.days_per_week}
                    onChangeText={setField('days_per_week')}
                  />
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-ink-faint mb-0.5 text-xs font-semibold">Goals</Text>
                <Text className="text-ink-faint mb-1 text-xs">Comma-separated</Text>
                <TextInput
                  className="border-line bg-surface-alt text-ink rounded-xl border px-4 py-3 text-sm"
                  placeholder="e.g. get a job, build projects, personal interest"
                  placeholderTextColor={colors.inkFaint}
                  value={form.goals}
                  onChangeText={setField('goals')}
                />
              </View>

              <View className="mb-4">
                <Text className="text-ink-faint mb-0.5 text-xs font-semibold">
                  Topics I Already Know
                </Text>
                <Text className="text-ink-faint mb-1 text-xs">
                  Comma-separated — AI will skip these in plans
                </Text>
                <TextInput
                  className="border-line bg-surface-alt text-ink rounded-xl border px-4 py-3 text-sm"
                  placeholder="e.g. Python basics, basic math, HTML"
                  placeholderTextColor={colors.inkFaint}
                  value={form.known_topics}
                  onChangeText={setField('known_topics')}
                />
              </View>
            </>
          )}

          {!!error && (
            <View className="border-danger bg-danger-soft mb-3 rounded-lg border p-3">
              <Text className="text-danger text-sm">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || memoryLoading}
            className={`items-center rounded-xl py-3 ${
              saving ? 'bg-surface-alt' : saved ? 'bg-success' : 'bg-primary'
            }`}
            activeOpacity={0.8}>
            {saving ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={colors.onPrimary} />
                <Text className="text-on-primary text-sm font-semibold">Saving…</Text>
              </View>
            ) : (
              <Text className="text-on-primary text-sm font-semibold">
                {saved ? 'Saved!' : 'Save Profile'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Danger zone */}
        <View className="border-danger bg-surface rounded-xl border p-4">
          <Text className="text-danger mb-1 text-sm font-semibold">Danger Zone</Text>
          <Text className="text-ink-faint mb-3 text-xs">
            Permanently clear all stored preferences and learning history from the AI&apos;s memory.
          </Text>
          <TouchableOpacity
            onPress={handleClearMemory}
            disabled={clearing}
            className={`items-center rounded-xl border py-3 ${
              clearing ? 'border-line bg-surface-alt' : 'border-danger bg-danger-soft'
            }`}
            activeOpacity={0.8}>
            {clearing ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" />
                <Text className="text-ink-faint text-sm">Clearing…</Text>
              </View>
            ) : (
              <Text className="text-danger text-sm font-medium">Clear All Memory</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
