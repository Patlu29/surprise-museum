// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Module boundaries (docs/architecture.md, section 4). Each layer may only import from the layers
 * listed in the architecture doc. These rules make the boundaries fail the lint step.
 */
const noUi = {
  group: ['@/ui/*', '@/ui'],
  message: 'Only src/App.tsx and src/ui may import UI code.',
};
// Static imports only. A lazy `import('@/scene/Experience')` is allowed (the rule does not see
// dynamic imports) and is the only way the UI may load the scene, keeping three.js out of the
// first-view chunk (NFR-2, NFR-4).
const noScene = {
  group: ['@/scene/*', '@/scene'],
  message: "Load the 3D scene lazily: lazy(() => import('@/scene/Experience')).",
};
const noRendering = {
  group: [
    'react',
    'react-dom',
    'react/*',
    'three',
    'three/*',
    '@react-three/*',
    'zustand',
    'zustand/*',
  ],
  message: 'src/domain and src/api must stay free of React, three.js and stores (ADR 0006).',
};
const noStateOrApi = {
  group: ['@/state/*', '@/api/*', '@/media/*', '@/scene/*', '@/hooks/*'],
  message: 'This layer must not depend on application layers above it.',
};

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    // Edge Functions run on Deno and are linted with `deno lint` (supabase/README.md).
    'supabase/functions/**',
    '!supabase/functions/_shared',
    '!supabase/functions/_shared/contract.ts',
  ]),
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
  },
  {
    // R3F mutates three.js objects inside useFrame by design.
    files: ['src/scene/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['src/domain/**/*.ts', 'supabase/functions/_shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [noRendering, noUi, noStateOrApi, { group: ['@/scene/*', '@/scene'] }] },
      ],
    },
  },
  {
    files: ['src/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noRendering,
            noUi,
            { group: ['@/state/*', '@/scene/*', '@/media/*', '@/hooks/*'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/media/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noRendering, noUi, noStateOrApi] }],
    },
  },
  {
    files: ['src/scene/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noUi,
            {
              group: ['@/api/*', '@/media/*'],
              message: 'The scene reads data from stores, not from the API.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/state/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [noUi, noScene, { group: ['three', '@react-three/*'] }] },
      ],
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noScene,
            {
              group: ['three', 'three/*', '@react-three/*'],
              message: 'UI is DOM only; 3D belongs in src/scene.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{ts,js}', 'tests/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
