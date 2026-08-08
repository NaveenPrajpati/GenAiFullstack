import { View, type ViewProps } from 'react-native';

export function Card({ className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View className={`border-line bg-surface rounded-2xl border p-4 ${className}`} {...props} />
  );
}

export function DashedCard({ className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`border-line bg-surface rounded-2xl border-[1.5px] border-dashed p-4 ${className}`}
      {...props}
    />
  );
}

/** A quieter card for rows that sit *inside* another card (quiz options, notes). */
export function InsetCard({ className = '', ...props }: ViewProps & { className?: string }) {
  return <View className={`bg-surface-alt rounded-xl p-3 ${className}`} {...props} />;
}
