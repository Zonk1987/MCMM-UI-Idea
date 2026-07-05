import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    ignores: ['js/vendor/**', 'css/vendor/**'],
  },
  prettier,
  {
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
];
