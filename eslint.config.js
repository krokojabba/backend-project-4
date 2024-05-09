import path from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import pluginJs from '@eslint/js';

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname, recommendedConfig: pluginJs.configs.recommended });

export default [
  {/* languageOptions: { globals: globals.node } */},
  /*   ...compat.extends("airbnb-base", "plugin:jest/recommended"),
  ...compat.env({ node: true }),
  ...compat.plugins("jest"), */
  ...compat.config({
    plugins: ['jest'],
    extends: ['airbnb-base', 'plugin:jest/recommended'],
    env: {
      node: true,
      es2020: true,
    },
    rules: {
      'import/extensions': 0,
      'import/no-named-as-default': 0,
      'import/no-named-as-default-member': 0,
    },
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  }),
  {
    ignores: ['temp.js', '__fixtures__/*', 'eslint.config.js'],
  },
  /* {
    rules: {
      "import/extensions": 0,
    }
  },
  {
    plugins: { jest, importPlugin },
    rules: {
      ...jest.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules
    },
    languageOptions: {
      globals: {
        ...globals.jest,
      }
    }
  } */
];
