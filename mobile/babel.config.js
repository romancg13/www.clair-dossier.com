module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // react-native-reanimated 4 : le plugin worklets doit rester en DERNIER.
    plugins: ['react-native-worklets/plugin'],
  };
};
