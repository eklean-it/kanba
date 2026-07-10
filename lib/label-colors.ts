// Shared label palette so cards, the picker, and filters render the same colors.
export const LABEL_COLORS: Record<string, string> = {
  gray: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  red: 'bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200',
  amber: 'bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  green: 'bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-200',
  blue: 'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  purple: 'bg-purple-200 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  pink: 'bg-pink-200 text-pink-900 dark:bg-pink-900/40 dark:text-pink-200',
};
export const LABEL_COLOR_KEYS = Object.keys(LABEL_COLORS);
export const labelClass = (color?: string) => LABEL_COLORS[color || 'gray'] || LABEL_COLORS.gray;
