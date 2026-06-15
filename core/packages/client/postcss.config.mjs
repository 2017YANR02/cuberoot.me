// Tailwind v4 via @tailwindcss/postcss — required by `@import "tailwindcss"`
// in app/globals.css so utility classes (`flex` / `grid` / `p-4` / ...) used
// across a handful of pages actually render. Mirrors the Vite plugin setup.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
