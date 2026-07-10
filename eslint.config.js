import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import jsonc from 'eslint-plugin-jsonc';

export default [
  {
    ignores: [
      'node_modules/**',
      'js/vendor/**',
      'css/vendor/**',
      'dist/**',
      'build/**',
      'package-lock.json',
    ],
  },

  js.configs.recommended,

  prettier,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        Alpine: 'readonly',
        appSettings: 'readonly',
        t: 'readonly',
        showToast: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          varsIgnorePattern:
            '^(showToast|formatNum|formatDate|formatBytes|t|debounce|throttle|loadLanguage|applyVisualSettings|playerAvatarError)$',
        },
      ],
    },
  },

  ...jsonc.configs['flat/recommended-with-jsonc'],
];
