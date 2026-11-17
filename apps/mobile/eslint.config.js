// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*'],
  },
  {
    rules: {
      // Guards against HTML entity mistakes in web JSX. React Native <Text>
      // renders apostrophes and quotes literally, so it only adds noise here.
      'react/no-unescaped-entities': 'off',
    },
  },
]);
