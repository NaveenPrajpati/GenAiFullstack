import { Card } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SectionNav, { useWideNav } from '@/components/ui/SectionNav';
import { useColors } from '@/components/ui/theme';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ChatMarkdown } from '@/features/learning/components/Markdown';
import { LEARNING_GUIDE_MARKDOWN } from '@/features/learning/learningGuideContent';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * How the assistant works, in the assistant.
 *
 * The same guide that sits in the repo as LEARNING_ASSISTANT.md, bundled by
 * `npm run gen:learning-guide` — one source, so the answer a learner reads here
 * can't drift from the one anybody else reads.
 *
 * It earns a screen rather than a modal because most of it only makes sense once
 * you've hit the thing it explains: why a topic won't tick off, why the retry is
 * held, why the same question never comes back twice. That is something you go
 * looking for mid-session, from the nav, not something you're shown once on
 * first run and never find again.
 */
export default function HelpScreen() {
  const colors = useColors();
  const wide = useWideNav();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View className="bg-bg flex-1">
        <ScreenHeader
          title="How it works"
          subtitle="What the assistant does, and why"
          showMenu={!wide}
          actions={<ThemeToggle />}>
          <SectionNav />
        </ScreenHeader>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          <PageBody className="pt-3">
            <Card>
              <ChatMarkdown markdown={LEARNING_GUIDE_MARKDOWN} />
            </Card>
          </PageBody>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
