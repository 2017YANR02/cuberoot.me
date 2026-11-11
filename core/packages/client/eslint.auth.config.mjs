import tsParser from '@typescript-eslint/parser';

// Shared by the ordinary lint command, focused CI check, and regression fixtures.
export default [{
  files: ['{app,components,hooks}/**/*.{ts,tsx}', 'lib/**/*.tsx'],
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  // This boundary has no per-file exemptions. Legacy React lint comments do not
  // configure this focused check; --quiet omits their no-effect warnings.
  linterOptions: { noInlineConfig: true },
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        regex: '(^|/)auth-store(?:\\.[cm]?[jt]s)?$',
        importNames: ['useAuthStore', 'isAdmin'],
        message: 'Render auth with useAuthUser()/useIsAdmin(). Use authActions for commands, getAuthUser() for async identity checks, and subscribeAuthUser() for subscriptions. Raw browser state cannot supply the hydration snapshot.',
      }],
    }],
  },
}];
