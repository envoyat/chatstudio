export const tokyoNightTheme = {
  light: {
    bg: '#e6e7ed',
    bgSecondary: '#d6d8df',
    text: '#343b59',
    textMuted: '#888b94',
    border: '#c1c2c7',
    primary: '#65359d',
    accent: '#006c86',
    string: '#385f0d',
    keyword: '#65359d',
    function: '#2959aa',
    comment: '#888b94',
    operator: '#006C86',
    number: '#965027',
    builtin: '#006c86',
    error: '#8c4351',
  },
  dark: {
    bg: '#24283b',
    bgSecondary: '#1f2335',
    bgTertiary: '#2c324a',
    border: '#1b1e2e',
    text: '#a9b1d6',
    textMuted: '#8089b3',
    textComment: '#5f6996',
    primary: '#7aa2f7',
    accent: '#bb9af7',
    string: '#9ece6a',
    keyword: '#bb9af7',
    function: '#7aa2f7',
    operator: '#89ddff',
    number: '#ff9e64',
    builtin: '#2ac3de',
    error: '#f7768e',
  }
} as const

export type TokyoNightColorScheme = typeof tokyoNightTheme

/**
 * Get Tokyo Night colors based on theme
 */
export const getTokyoNightColors = (isDark: boolean) => {
  return isDark ? tokyoNightTheme.dark : tokyoNightTheme.light
}

/**
 * Tokyo Night color classes for Tailwind
 */
export const tokyoNightClasses = {
  light: {
    bg: 'bg-[#e6e7ed]',
    bgSecondary: 'bg-[#d6d8df]',
    text: 'text-[#343b59]',
    textMuted: 'text-[#888b94]',
    border: 'border-[#c1c2c7]',
    primary: 'text-[#65359d]',
    accent: 'text-[#006c86]',
  },
  dark: {
    bg: 'bg-[#24283b]',
    bgSecondary: 'bg-[#1f2335]',
    bgTertiary: 'bg-[#2c324a]',
    text: 'text-[#a9b1d6]',
    textMuted: 'text-[#8089b3]',
    border: 'border-[#1b1e2e]',
    primary: 'text-[#7aa2f7]',
    accent: 'text-[#bb9af7]',
  }
} as const 