import { useRef } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import Spinner from './Spinner';

interface Props {
  onUpload: (file: File) => void;
  isUploading: boolean;
  uploadStatus: string;
}

export default function WebFileUpload({ onUpload, isUploading, uploadStatus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <View className="mt-3">
      <TouchableOpacity
        onPress={() => inputRef.current?.click()}
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
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
    </View>
  );
}
