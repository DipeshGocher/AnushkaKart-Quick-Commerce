import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/prop-types': 'off',
      // Best-effort calls (localStorage, JSON.parse, vibrate) deliberately swallow errors.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // React Compiler guidance. The compiler is not enabled in this project, and
      // the remaining setState-in-effect sites sync with browser APIs, timers or
      // late-arriving props, so keep these visible as warnings, not build errors.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    // Jest test files
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    // Firebase messaging service worker (loads the SDK via importScripts)
    files: ['src/sw/**/*.js', 'public/**/*sw*.js'],
    languageOptions: { globals: { ...globals.serviceworker, firebase: 'readonly' } },
  },
])
