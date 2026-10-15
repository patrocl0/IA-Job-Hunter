import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  { ...js.configs.recommended, files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: { ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  ...ts.configs.recommended.map(config => ({ ...config, files: ['frontend/src/**/*.ts', 'frontend/src/**/*.tsx'] })),
  { files: ['frontend/src/**/*.ts','frontend/src/**/*.tsx'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/screenshots.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
];
