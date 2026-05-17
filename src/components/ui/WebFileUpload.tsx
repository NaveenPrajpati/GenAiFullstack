import * as DocumentPicker from 'expo-document-picker';
import { TouchableOpacity, Text, View } from 'react-native';
import Spinner from './Spinner';

interface Props {
  onUpload: (asset: DocumentPicker.DocumentPickerAsset) => void;
  isUploading: boolean;
  uploadStatus: string;
}

export default function WebFileUpload({ onUpload, isUploading, uploadStatus }: Props) {
  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) onUpload(result.assets[0]);
  };

  return (
    <View className="mt-3">
      <TouchableOpacity
        onPress={handlePick}
        disabled={isUploading}
        className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 self-start ${isUploading ? 'opacity-50' : ''}`}
        activeOpacity={0.7}>
        {isUploading && <Spinner size="small" color="#3b82f6" />}
        <Text className="text-blue-600 text-sm font-medium">
          {isUploading ? 'Uploading...' : '📎 Upload PDF / Text'}
        </Text>
      </TouchableOpacity>
      {uploadStatus ? (
        <Text
          className={`text-xs mt-1.5 ${uploadStatus.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
          {uploadStatus}
        </Text>
      ) : null}
    </View>
  );
}
