export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: Object.fromEntries(
        [
          'bg',
          'surface',
          'border',
          'text',
          'muted',
          'primary',
          'accent',
          'success',
          'warning',
          'danger',
          'chart-visible',
          'chart-not-visible',
        ].map((token) => [token, `var(--${token})`]),
      ),
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      borderRadius: { lg: '8px' },
    },
  },
};
