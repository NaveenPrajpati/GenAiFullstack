/**
 * Full-screen modal that renders the RAG feature guide (RAG_FEATURES.md) using
 * the shared markdown renderer. Opened from the info button in the RAG chatbot.
 */
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ChatMarkdown } from '@/features/learning/components/Markdown';
import { RAG_FEATURES_MARKDOWN } from './ragFeaturesContent';

export function RagFeaturesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View className="flex-1 bg-black/40">
        <View className="mt-auto max-h-[88%] rounded-t-3xl bg-white sm:m-auto sm:max-h-[85%] sm:w-[92%] sm:max-w-2xl sm:rounded-3xl">
          <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4">
            <Text className="text-lg font-bold text-gray-900">RAG Features</Text>
            <TouchableOpacity
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Text className="text-base text-gray-500">✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingVertical: 18 }}
            showsVerticalScrollIndicator={false}>
            <ChatMarkdown markdown={RAG_FEATURES_MARKDOWN} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
