import { ActivityIndicator, View } from 'react-native';

interface SpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  className?: string;
}

export default function Spinner({ size = 'small', color = '#6366f1', className }: SpinnerProps) {
  return (
    <View className={className}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}
