import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import jsonc from 'eslint-plugin-jsonc';
import compat from 'eslint-plugin-compat';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
  {
    ignores: [
      'node_modules/**',
      'js/vendor/**',
      'css/vendor/**',
      'docs/**',
      'dist/**',
      'build/**',
      'reports/**',
      'package-lock.json',
    ],
  },

  js.configs.recommended,

  // Browser compatibility checks
  compat.configs['flat/recommended'],

  // JSDoc linting
  jsdoc.configs['flat/recommended-error'],

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

      // Optional: initially only warn about browser incompatibilities
      'compat/compat': 'warn',

      // Disable strict JSDoc requirements
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-returns-description': 'off',
    },
  },

  ...jsonc.configs['flat/recommended-with-jsonc'],

  // Prettier must remain near the end so it disables conflicting formatting rules.
  prettier,
];
