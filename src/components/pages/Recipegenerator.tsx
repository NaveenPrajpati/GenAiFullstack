import { useState, useRef, useCallback, useEffect } from "react";
import { Base_URL } from "../../service/endpoints";

// ── Cuisine options ──
const CUISINES = [
  { id: "Indian", label: "Indian", flag: "🇮🇳" },
  { id: "Chinese", label: "Chinese", flag: "🇨🇳" },
  { id: "Italian", label: "Italian", flag: "🇮🇹" },
  { id: "Mexican", label: "Mexican", flag: "🇲🇽" },
  { id: "Thai", label: "Thai", flag: "🇹🇭" },
  { id: "Japanese", label: "Japanese", flag: "🇯🇵" },
  { id: "Continental", label: "Continental", flag: "🌍" },
  { id: "Korean", label: "Korean", flag: "🇰🇷" },
  { id: "Mediterranean", label: "Mediterranean", flag: "🫒" },
];

// ── Local ingredient data (so it works without backend call) ──
const INGREDIENTS_DB = {
  vegetables: [
    "Potato",
    "Tomato",
    "Onion",
    "Garlic",
    "Ginger",
    "Green Chili",
    "Capsicum",
    "Carrot",
    "Cauliflower",
    "Broccoli",
    "Spinach",
    "Peas",
    "Corn",
    "Mushroom",
    "Cabbage",
    "Eggplant",
    "Okra",
    "Bottle Gourd",
    "Bitter Gourd",
    "Pumpkin",
    "Sweet Potato",
    "Beetroot",
    "Radish",
    "Cucumber",
    "Zucchini",
    "Bell Pepper",
    "Spring Onion",
    "Lettuce",
    "Avocado",
    "Celery",
  ],
  fruits: [
    "Lemon",
    "Lime",
    "Mango",
    "Banana",
    "Apple",
    "Coconut",
    "Pineapple",
    "Tamarind",
    "Pomegranate",
    "Orange",
  ],
  dairy: [
    "Milk",
    "Curd",
    "Paneer",
    "Butter",
    "Ghee",
    "Cream",
    "Cheese",
    "Mozzarella",
    "Yogurt",
    "Cottage Cheese",
    "Condensed Milk",
  ],
  proteins_veg: [
    "Tofu",
    "Soy Chunks",
    "Chickpeas",
    "Lentils",
    "Kidney Beans",
    "Black Beans",
    "Green Gram",
    "Bengal Gram",
    "Peanuts",
    "Cashew",
    "Almond",
    "Walnut",
    "Sesame Seeds",
  ],
  proteins_nonveg: [
    "Chicken",
    "Chicken Breast",
    "Mutton",
    "Lamb",
    "Fish",
    "Prawns",
    "Shrimp",
    "Eggs",
    "Salmon",
    "Tuna",
    "Pork",
    "Beef",
    "Turkey",
    "Bacon",
  ],
  grains: [
    "Rice",
    "Basmati Rice",
    "Wheat Flour",
    "Bread",
    "Pasta",
    "Noodles",
    "Oats",
    "Semolina",
    "Poha",
    "Quinoa",
    "Tortilla",
  ],
  spices: [
    "Turmeric",
    "Cumin",
    "Coriander Powder",
    "Red Chili Powder",
    "Garam Masala",
    "Mustard Seeds",
    "Curry Leaves",
    "Bay Leaf",
    "Cinnamon",
    "Cardamom",
    "Cloves",
    "Black Pepper",
    "Oregano",
    "Basil",
    "Thyme",
    "Rosemary",
    "Paprika",
    "Saffron",
  ],
  sauces: [
    "Soy Sauce",
    "Vinegar",
    "Sriracha",
    "Coconut Milk",
    "Tomato Ketchup",
    "Mustard",
    "Hot Sauce",
    "Tahini",
    "Pesto",
  ],
};

// ── Category display labels ──
const CATEGORY_LABELS = {
  vegetables: "Vegetables",
  fruits: "Fruits",
  dairy: "Dairy",
  proteins_veg: "Proteins (Veg)",
  proteins_nonveg: "Proteins (Non-Veg)",
  grains: "Grains & Carbs",
  spices: "Spices",
  sauces: "Sauces",
};

const CATEGORY_ICONS = {
  vegetables: "🥬",
  fruits: "🍋",
  dairy: "🧀",
  proteins_veg: "🫘",
  proteins_nonveg: "🍗",
  grains: "🍚",
  spices: "🌶️",
  sauces: "🫙",
};

export default function RecipeGenerator() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Selections
  const [diet, setDiet] = useState("veg");
  const [cuisine, setCuisine] = useState("Indian");
  const [ingredients, setIngredients] = useState([]);

  // Ingredient input
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ── Get all available ingredients based on diet ──
  const getAllIngredients = useCallback(() => {
    const all = [];
    for (const [category, items] of Object.entries(INGREDIENTS_DB)) {
      if (category === "proteins_nonveg" && diet === "veg") continue;
      items.forEach((item) => {
        if (!ingredients.includes(item)) {
          all.push({ name: item, category });
        }
      });
    }
    return all;
  }, [diet, ingredients]);

  // ── Filter suggestions based on input ──
  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      return;
    }
    const query = inputValue.toLowerCase();
    const filtered = getAllIngredients().filter((item) =>
      item.name.toLowerCase().includes(query),
    );
    setSuggestions(filtered.slice(0, 12));
  }, [inputValue, getAllIngredients]);

  // ── Close suggestions on outside click ──
  useEffect(() => {
    const handleClick = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Remove nonveg ingredients when switching to veg ──
  useEffect(() => {
    if (diet === "veg") {
      const nonvegItems = INGREDIENTS_DB.proteins_nonveg;
      setIngredients((prev) =>
        prev.filter((ing) => !nonvegItems.includes(ing)),
      );
    }
  }, [diet]);

  // ── Add ingredient ──
  const addIngredient = (name) => {
    if (!ingredients.includes(name)) {
      setIngredients((prev) => [...prev, name]);
    }
    setInputValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // ── Add custom ingredient (on Enter) ──
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      // If there are suggestions, pick the first one
      if (suggestions.length > 0) {
        addIngredient(suggestions[0].name);
      } else {
        // Add custom ingredient
        addIngredient(inputValue.trim());
      }
    }
  };

  // ── Remove ingredient ──
  const removeIngredient = (name) => {
    setIngredients((prev) => prev.filter((i) => i !== name));
  };

  // ── Quick-add from category browser ──
  const getCategoryItems = (category) => {
    if (category === "proteins_nonveg" && diet === "veg") return [];
    return (INGREDIENTS_DB[category] || []).filter(
      (item) => !ingredients.includes(item),
    );
  };

  // ── Stop streaming ──
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setStatus("");
    }
  }, []);

  // ── Generate recipe ──
  const handleGenerate = async () => {
    if (ingredients.length === 0 || loading) return;

    setLoading(true);
    setResponse("");
    setError("");
    setStatus("Starting...");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`${Base_URL}/recipe-generator/generate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: ingredients.join(", "),
          cuisine,
          diet,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                setStatus("");
                setResponse((prev) => prev + parsed.token);
              }
              if (parsed.status) setStatus(parsed.status);
              if (parsed.error) setError(parsed.error);
            } catch {
              setResponse((prev) => prev + data);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
      setStatus("");
      abortControllerRef.current = null;
    }
  };

  const handleClear = () => {
    setIngredients([]);
    setResponse("");
    setError("");
    setStatus("");
    setInputValue("");
  };

  const handleCopy = async () => {
    if (response) await navigator.clipboard.writeText(response);
  };

  // ── Available categories ──
  const availableCategories = Object.keys(INGREDIENTS_DB).filter(
    (cat) => !(cat === "proteins_nonveg" && diet === "veg"),
  );

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="p-4 border-b border-gray-200 space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Recipe Generator</h1>
          <p className="text-gray-500 text-sm">
            Add your available ingredients and get a personalized recipe
          </p>
        </div>

        {/* ── Diet Toggle ── */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">Diet:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button
              onClick={() => setDiet("veg")}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors ${
                diet === "veg"
                  ? "bg-green-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-sm border-2 ${
                  diet === "veg"
                    ? "border-white bg-green-300"
                    : "border-green-500 bg-green-500"
                }`}
              />
              Veg
            </button>
            <button
              onClick={() => setDiet("nonveg")}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium transition-colors border-l border-gray-300 ${
                diet === "nonveg"
                  ? "bg-red-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full border-2 ${
                  diet === "nonveg"
                    ? "border-white bg-red-300"
                    : "border-red-500 bg-red-500"
                }`}
              />
              Non-Veg
            </button>
          </div>
        </div>

        {/* ── Cuisine Selector ── */}
        <div>
          <span className="text-sm text-gray-600 font-medium block mb-1.5">
            Cuisine:
          </span>
          <div className="flex gap-2 flex-wrap">
            {CUISINES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCuisine(c.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all ${
                  cuisine === c.id
                    ? "bg-amber-100 text-amber-800 border border-amber-300 shadow-sm"
                    : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                }`}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Ingredient Input with Autocomplete ── */}
        <div>
          <span className="text-sm text-gray-600 font-medium block mb-1.5">
            Ingredients:
          </span>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              className="border border-gray-300 rounded-md w-full p-2.5 pr-20 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              placeholder="Type to search ingredients (e.g. paneer, chicken, rice)..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
            />
            {inputValue && (
              <button
                onClick={() => addIngredient(inputValue.trim())}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1 rounded transition-colors"
              >
                Add
              </button>
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto"
              >
                {suggestions.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => addIngredient(item.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-amber-50 transition-colors"
                  >
                    <span className="text-gray-700">{item.name}</span>
                    <span className="text-xs text-gray-400">
                      {CATEGORY_ICONS[item.category]}{" "}
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Selected ingredient tags ── */}
          {ingredients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {ingredients.map((ing) => (
                <span
                  key={ing}
                  className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-sm px-2.5 py-1 rounded-full"
                >
                  {ing}
                  <button
                    onClick={() => removeIngredient(ing)}
                    className="text-amber-400 hover:text-amber-700 font-bold leading-none"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* ── Category quick-add browser ── */}
          <div className="mt-3">
            <div className="flex gap-1.5 flex-wrap mb-2">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setActiveCategory(activeCategory === cat ? null : cat)
                  }
                  className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                    activeCategory === cat
                      ? "bg-gray-700 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {activeCategory && (
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-md border border-gray-200 max-h-32 overflow-y-auto">
                {getCategoryItems(activeCategory).length > 0 ? (
                  getCategoryItems(activeCategory).map((item) => (
                    <button
                      key={item}
                      onClick={() => addIngredient(item)}
                      className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
                    >
                      + {item}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">
                    All items from this category are already added
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {ingredients.length} ingredient{ingredients.length !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-2">
            {(ingredients.length > 0 || response) && (
              <button
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                onClick={handleClear}
              >
                Clear All
              </button>
            )}
            {loading ? (
              <button
                className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-1.5 rounded-md shadow transition-colors"
                onClick={handleStop}
              >
                Stop
              </button>
            ) : (
              <button
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white text-sm px-5 py-1.5 rounded-md shadow transition-colors font-medium"
                disabled={ingredients.length === 0}
                onClick={handleGenerate}
              >
                Generate Recipe
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Response area ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {status && (
          <div className="flex items-center gap-2 text-amber-600 text-sm mb-3">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {status}
          </div>
        )}

        {response && (
          <div className="relative bg-amber-50/50 border border-amber-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                Your Recipe
              </span>
              <button
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                onClick={handleCopy}
              >
                Copy
              </button>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {response}
            </div>
            {loading && (
              <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse rounded-sm ml-0.5" />
            )}
          </div>
        )}

        {!response && !loading && !error && (
          <div className="text-center mt-16">
            <p className="text-4xl mb-3">👨‍🍳</p>
            <p className="text-gray-300 text-sm">
              Add ingredients and hit "Generate Recipe" to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
