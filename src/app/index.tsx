import { useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

const APPS = [
  {
    href: '/rag-chatbot',
    emoji: '🤖',
    title: 'RAG Chatbot',
    desc: 'Upload PDFs or text files and ask questions. Get accurate answers powered by retrieval-augmented generation.',
    iconBg: 'bg-blue-100',
    btnBg: 'bg-blue-600',
    bar: 'bg-blue-500',
  },
  {
    href: '/meal-planner',
    emoji: '📝',
    title: 'Meal Plannner',
    desc: 'Transform long articles, reports, and meeting notes into clear, concise summaries.',
    iconBg: 'bg-violet-100',
    btnBg: 'bg-violet-600',
    bar: 'bg-violet-500',
  },
  {
    href: '/learning',
    emoji: '📝',
    title: 'Learning Planner',
    desc: 'Transform long articles, reports, and meeting notes into clear, concise summaries.',
    iconBg: 'bg-violet-100',
    btnBg: 'bg-violet-600',
    bar: 'bg-violet-500',
  },

  {
    href: '/personal-assistant',
    emoji: '✉️',
    title: 'Personal Assistant',
    desc: 'Draft replies, summarize threads, fix grammar, or improve your email writing style.',
    iconBg: 'bg-sky-100',
    btnBg: 'bg-sky-600',
    bar: 'bg-sky-500',
  },
  {
    href: '/recipe-generator',
    emoji: '🍳',
    title: 'Recipe Generator',
    desc: 'Pick your ingredients, cuisine, and dietary preference to get personalized recipe ideas.',
    iconBg: 'bg-amber-100',
    btnBg: 'bg-amber-500',
    bar: 'bg-amber-500',
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 bg-gray-50">
        <View className="border-b border-gray-200 bg-white px-6 py-8">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600">
            <Text className="text-2xl text-white">🤖</Text>
          </View>
          <Text className="mb-2 text-3xl font-bold text-gray-900">AI Toolkit</Text>
          <Text className="text-base leading-relaxed text-gray-600">
            A collection of AI-powered tools to boost your productivity. Select an app to get
            started.
          </Text>
        </View>

        <View className="gap-4 p-4">
          {APPS.map((app) => (
            <View
              key={app.href}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white"
              style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
              <View className={`h-1.5 ${app.bar}`} />
              <View className="p-5">
                <View className="flex-row items-start gap-4">
                  <View
                    className={`h-12 w-12 ${app.iconBg} items-center justify-center rounded-xl`}>
                    <Text className="text-2xl">{app.emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="mb-1 text-lg font-semibold text-gray-900">{app.title}</Text>
                    <Text className="mb-4 text-sm leading-relaxed text-gray-600">{app.desc}</Text>
                    <TouchableOpacity
                      onPress={() => router.navigate(app.href)}
                      className={`${app.btnBg} self-start rounded-lg px-4 py-2`}
                      activeOpacity={0.8}>
                      <Text className="text-sm font-medium text-white">Launch →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
