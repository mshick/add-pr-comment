module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:prettier/recommended', 'plugin:import/errors', 'plugin:import/warnings'],
  plugins: ['prettier'],
  env: {
    node: true,
    es6: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:import/typescript',
        'plugin:@typescript-eslint/recommended',
        'prettier/@typescript-eslint',
        'plugin:prettier/recommended',
      ],
      parserOptions: {
        ecmaVersion: 2018,
        project: ['tsconfig.json'],
        sourceType: 'module',
        tsconfigRootDir: __dirname,
      },
      env: {
        node: true,
        es6: true,
      },
    },
  ],
}
