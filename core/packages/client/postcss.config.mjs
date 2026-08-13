// Tailwind v4 via PostCSS for the Next/Turbopack frontend. Required by
// `@import "tailwindcss"` in app/globals.css so the few utility classes used
// across the site actually render.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
