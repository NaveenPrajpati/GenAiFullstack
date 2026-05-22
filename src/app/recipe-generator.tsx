import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { useStreaming } from '../hooks/useStreaming';
import Spinner from '../components/ui/Spinner';
import { INGREDIENTS, CATEGORY_EMOJIS, isNonVeg, IngredientCategory } from '../data/ingredients';

type Diet = 'veg' | 'non-veg';

const CUISINES: { id: string; flag: string }[] = [
  { id: 'Indian', flag: '🇮🇳' },
  { id: 'Chinese', flag: '🇨🇳' },
  { id: 'Italian', flag: '🇮🇹' },
  { id: 'Mexican', flag: '🇲🇽' },
  { id: 'Thai', flag: '🇹🇭' },
  { id: 'Japanese', flag: '🇯🇵' },
  { id: 'Continental', flag: '🌍' },
  { id: 'Korean', flag: '🇰🇷' },
  { id: 'Mediterranean', flag: '🫒' },
];

const ALL_CATEGORIES = Object.keys(INGREDIENTS) as IngredientCategory[];

export default function RecipeGeneratorScreen() {
  const [diet, setDiet] = useState<Diet>('veg');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<IngredientCategory | null>(null);
  const { text, loading, error, stream, stop, reset } = useStreaming();

  const visibleCategories =
    diet === 'veg' ? ALL_CATEGORIES.filter((c) => !isNonVeg(c)) : ALL_CATEGORIES;

  const suggestions = useMemo(() => {
    if (!searchText.trim()) return [];
    const q = searchText.toLowerCase();
    const results: { item: string; category: IngredientCategory }[] = [];
    for (const cat of visibleCategories) {
      for (const item of INGREDIENTS[cat]) {
        if (item.toLowerCase().includes(q) && !selectedIngredients.split(',').includes(item)) {
          results.push({ item, category: cat });
          if (results.length >= 12) return results;
        }
      }
    }
    return results;
  }, [searchText, diet, selectedIngredients, visibleCategories]);

  const addIngredient = (item: string) => {
    if (!selectedIngredients.split(',').includes(item))
      setSelectedIngredients((p) => (p ? `${p},${item}` : item));
    setSearchText('');
  };

  const removeIngredient = (item: string) =>
    setSelectedIngredients((p) => p.split(',').filter((i) => i !== item).join(','));

  const switchDiet = (d: Diet) => {
    setDiet(d);
    if (d === 'veg') {
      setSelectedIngredients((prev) =>
        prev
          .split(',')
          .filter((item) => {
            for (const cat of ALL_CATEGORIES) {
              if (isNonVeg(cat) && INGREDIENTS[cat].includes(item)) return false;
            }
            return true;
          })
          .join(',')
      );
    }
  };

  const handleGenerate = () => {
    if (!selectedIngredients || loading) return;
    stream('/recipe-generator/generate/stream', {
      ingredients: selectedIngredients,
      diet,
      cuisine: cuisine ?? 'Any',
    });
  };

  const handleClearAll = () => {
    setSelectedIngredients('');
    setSearchText('');
    setCuisine(null);
    reset();
  };

  const handleCopy = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="border-b border-gray-200 bg-white px-5 py-4">
        <Text className="text-xl font-bold text-gray-900">🍳 Recipe Generator</Text>
        <Text className="mt-1 text-sm text-gray-500">
          Pick ingredients and generate personalized recipes
        </Text>
      </View>

      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        {/* Diet Toggle */}
        <View className="mb-4 flex-row gap-3">
          {(['veg', 'non-veg'] as Diet[]).map((d) => (
            <TouchableOpacity
              key={d}
              onPress={() => switchDiet(d)}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3 ${
                diet === d
                  ? d === 'veg'
                    ? 'border-green-600 bg-green-600'
                    : 'border-red-600 bg-red-600'
                  : 'border-gray-200 bg-white'
              }`}
              activeOpacity={0.7}>
              <Text className="text-base">{d === 'veg' ? '🌿' : '🍗'}</Text>
              <Text className={`font-medium ${diet === d ? 'text-white' : 'text-gray-700'}`}>
                {d === 'veg' ? 'Veg' : 'Non-Veg'}
              </Text>
              {diet === d && <Text className="text-xs font-bold text-white">✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Cuisine */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-gray-700">Cuisine Style</Text>
          <View className="flex-row flex-wrap gap-2">
            {CUISINES.map(({ id, flag }) => (
              <TouchableOpacity
                key={id}
                onPress={() => setCuisine(cuisine === id ? null : id)}
                className={`flex-row items-center gap-1.5 rounded-lg border px-3 py-1.5 ${
                  cuisine === id ? 'border-amber-500 bg-amber-500' : 'border-gray-200 bg-gray-50'
                }`}
                activeOpacity={0.7}>
                <Text className="text-base">{flag}</Text>
                <Text
                  className={`text-sm ${cuisine === id ? 'font-medium text-white' : 'text-gray-700'}`}>
                  {id}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Ingredient Search */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-gray-700">Add Ingredients</Text>

          <View className="mb-2 flex-row gap-2">
            <TextInput
              className="flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-800"
              placeholder="Search ingredients..."
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.trim() && suggestions.length > 0 && (
              <TouchableOpacity
                onPress={() => addIngredient(suggestions[0].item)}
                className="items-center justify-center rounded-lg bg-amber-500 px-4"
                activeOpacity={0.8}>
                <Text className="text-sm font-medium text-white">Add</Text>
              </TouchableOpacity>
            )}
          </View>

          {suggestions.length > 0 && (
            <View className="mb-2 overflow-hidden rounded-lg border border-gray-200">
              {suggestions.map(({ item, category }) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => addIngredient(item)}
                  className="flex-row items-center justify-between border-b border-gray-100 px-4 py-2.5"
                  activeOpacity={0.7}>
                  <Text className="text-sm text-gray-800">{item}</Text>
                  <View className="rounded bg-gray-100 px-2 py-0.5">
                    <Text className="text-xs text-gray-500">
                      {CATEGORY_EMOJIS[category]} {category}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedIngredients.length > 0 && (
            <View>
              <Text className="mb-2 text-xs text-gray-500">
                Selected ({selectedIngredients.split(',').length})
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {selectedIngredients.split(',').map((item) => (
                  <View
                    key={item}
                    className="flex-row items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1">
                    <Text className="text-sm text-amber-800">{item}</Text>
                    <TouchableOpacity onPress={() => removeIngredient(item)} activeOpacity={0.7}>
                      <Text className="text-lg leading-none text-amber-600">×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Category Browse */}
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="mb-3 text-sm font-semibold text-gray-700">Browse by Category</Text>
          {visibleCategories.map((category) => (
            <View key={category} className="mb-2">
              <TouchableOpacity
                onPress={() => setExpandedCategory(expandedCategory === category ? null : category)}
                className="flex-row items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5"
                activeOpacity={0.7}>
                <View className="flex-row items-center gap-2">
                  <Text className="text-base">{CATEGORY_EMOJIS[category]}</Text>
                  <Text className="text-sm font-medium text-gray-700">{category}</Text>
                </View>
                <Text className="text-xs text-gray-400">
                  {expandedCategory === category ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {expandedCategory === category && (
                <View className="mt-2 flex-row flex-wrap gap-1.5 px-1">
                  {INGREDIENTS[category].map((item) => {
                    const isSelected = selectedIngredients.split(',').includes(item);
                    return (
                      <TouchableOpacity
                        key={item}
                        onPress={() => (isSelected ? removeIngredient(item) : addIngredient(item))}
                        className={`rounded-full border px-2.5 py-1 ${
                          isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-200 bg-white'
                        }`}
                        activeOpacity={0.7}>
                        <Text className={`text-xs ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Actions */}
        <View className="mb-4 flex-row gap-3">
          <TouchableOpacity
            onPress={handleClearAll}
            className="flex-1 items-center rounded-xl border border-gray-300 bg-white py-3"
            activeOpacity={0.7}>
            <Text className="font-medium text-gray-600">Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={loading ? stop : handleGenerate}
            disabled={!selectedIngredients && !loading}
            className={`flex-1 items-center justify-center rounded-xl py-3 ${loading ? 'bg-red-500' : 'bg-amber-500'} ${!selectedIngredients.length && !loading ? 'opacity-50' : ''}`}
            activeOpacity={0.8}>
            {loading ? (
              <View className="flex-row items-center gap-2">
                <Spinner size="small" color="white" />
                <Text className="font-medium text-white">Stop</Text>
              </View>
            ) : (
              <Text className="font-medium text-white">Generate Recipe</Text>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        ) : null}

        {text || loading ? (
          <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-700">Your Recipe</Text>
              {text && !loading && (
                <TouchableOpacity
                  onPress={handleCopy}
                  className="rounded-lg bg-gray-100 px-3 py-1"
                  activeOpacity={0.7}>
                  <Text className="text-xs text-gray-600">Copy</Text>
                </TouchableOpacity>
              )}
            </View>
            {loading && !text ? (
              <View className="flex-row items-center gap-2 py-2">
                <Spinner size="small" color="#f59e0b" />
                <Text className="text-sm text-gray-500">Generating recipe...</Text>
              </View>
            ) : (
              <Text className="text-sm leading-relaxed text-gray-800">
                {text}
                {loading ? '▌' : ''}
              </Text>
            )}
          </View>
        ) : (
          <View className="mb-4 items-center py-10">
            <Text className="mb-3 text-5xl">🍽️</Text>
            <Text className="text-center text-sm text-gray-400">
              Select ingredients and press Generate Recipe
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
