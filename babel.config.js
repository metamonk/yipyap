module.exports = function (api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Transform import.meta for Node.js compatibility in tests
      ...(isTest ? [
        ['@babel/plugin-syntax-import-meta'],
        ['babel-plugin-transform-import-meta', {
          replaceWith: {
            'import.meta.url': 'new URL("file:" + __filename).href'
          }
        }]
      ] : []),
      // Only include worklets plugin in non-test environments
      ...(!isTest ? ['react-native-worklets/plugin'] : []),
    ],
  };
};
