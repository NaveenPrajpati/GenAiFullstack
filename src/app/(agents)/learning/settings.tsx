import ScreenHeader from '@/components/ui/ScreenHeader';
import { useColors } from '@/components/ui/theme';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { useLearningStore } from '@/features/learning/store';
import type { Difficulty, Memory } from '@/features/learning/types';
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

const SKILL_LEVELS: Difficulty[] = ['beginner', 'intermediate', 'advanced'];

type FormState = {
  skill_level: string;
  preferred_resource_types: string;
  goals: string;
  /** Backs `availability.minutes_per_day`, which is what the backend stores. */
  minutes_per_day: string;
  known_topics: string;
};

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
  const [form, setForm] = useState<FormState>({
    skill_level: '',
    preferred_resource_types: '',
    goals: '',
    minutes_per_day: '',
    known_topics: '',
  });
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
        skill_level: memory.skill_level ?? '',
        preferred_resource_types: arrToStr(memory.preferred_resource_types),
        goals: arrToStr(memory.goals),
        minutes_per_day: memory.availability?.minutes_per_day?.toString() ?? '',
        known_topics: arrToStr(memory.known_topics),
      });
    }
  }, [memory]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const minutes = parseInt(form.minutes_per_day, 10);
      const data: Partial<Memory> = {
        // The backend types skill_level as an enum, so only send a recognised
        // value — free text would be rejected by the profile schema.
        skill_level: SKILL_LEVELS.find((l) => l === form.skill_level.trim().toLowerCase()),
        preferred_resource_types: strToArr(form.preferred_resource_types),
        goals: strToArr(form.goals),
        availability: Number.isFinite(minutes)
          ? { ...(memory?.availability ?? {}), minutes_per_day: minutes }
          : undefined,
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
            setForm({
              skill_level: '',
              preferred_resource_types: '',
              goals: '',
              minutes_per_day: '',
              known_topics: '',
            });
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

  const setField = (key: keyof FormState) => (value: string) =>
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
              <View className="mb-4">
                <Text className="text-ink-faint mb-1 text-xs font-semibold">Skill Level</Text>
                <TextInput
                  className="border-line bg-surface-alt text-ink rounded-xl border px-4 py-3 text-sm"
                  placeholder="e.g. beginner, intermediate, advanced"
                  placeholderTextColor={colors.inkFaint}
                  value={form.skill_level}
                  onChangeText={setField('skill_level')}
                />
              </View>

              <View className="mb-4">
                <Text className="text-ink-faint mb-0.5 text-xs font-semibold">Available Time</Text>
                <Text className="text-ink-faint mb-1 text-xs">
                  Minutes you can study per day — used to pace your roadmap
                </Text>
                <TextInput
                  className="border-line bg-surface-alt text-ink rounded-xl border px-4 py-3 text-sm"
                  placeholder="e.g. 60"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="number-pad"
                  value={form.minutes_per_day}
                  onChangeText={setField('minutes_per_day')}
                />
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
                  Preferred Resources
                </Text>
                <Text className="text-ink-faint mb-1 text-xs">Comma-separated</Text>
                <TextInput
                  className="border-line bg-surface-alt text-ink rounded-xl border px-4 py-3 text-sm"
                  placeholder="e.g. videos, articles, interactive exercises"
                  placeholderTextColor={colors.inkFaint}
                  value={form.preferred_resource_types}
                  onChangeText={setField('preferred_resource_types')}
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
