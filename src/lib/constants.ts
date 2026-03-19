// Shared constants for item categories across the app

export const CATEGORIES = [
  { value: 'car', label: 'Car', emoji: '🚗' },
  { value: 'truck', label: 'Truck', emoji: '🛻' },
  { value: 'boat', label: 'Boat', emoji: '🚤' },
  { value: 'motorcycle', label: 'Motorcycle', emoji: '🏍️' },
  { value: 'trailer', label: 'Trailer', emoji: '🚛' },
  { value: 'rv', label: 'RV', emoji: '🚐' },
  { value: 'atv', label: 'ATV', emoji: '🏎️' },
  { value: 'jetski', label: 'Jet Ski', emoji: '🚤' },
  { value: 'lawnmower', label: 'Lawnmower', emoji: '🌿' },
  { value: 'generator', label: 'Generator', emoji: '⚡' },
  { value: 'equipment', label: 'Equipment', emoji: '🔧' },
  { value: 'other', label: 'Other', emoji: '📦' },
]

// Quick lookup map: category value → emoji
export const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((cat) => [cat.value, cat.emoji])
)
