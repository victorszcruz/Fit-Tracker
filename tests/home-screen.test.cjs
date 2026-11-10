const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { transformFileSync } = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('compiled home renders while local data is loading or unavailable', () => {
  // Exercise the production compiler: it memoizes coverage before data arrives.
  const { code } = transformFileSync(
    path.join(__dirname, '../src/app/(tabs)/index.tsx'),
    {
      babelrc: false,
      configFile: false,
      presets: ['babel-preset-expo'],
      caller: {
        name: 'metro',
        platform: 'android',
        supportsReactCompiler: true,
        isDev: false,
        supportsStaticESM: false,
      },
    },
  );
  let state = { data: null, loading: true, error: null, refresh: async () => {} };
  const children = ({ children }) => React.createElement('div', null, children);
  const mocks = {
    'expo-router': { router: {} },
    'react-native': { View: children },
    '@/components/ui/Form': {
      Screen: children, Panel: children, Note: children,
      Action: ({ label }) => React.createElement('button', null, label),
      formStyles: {}, useNumberFormat: () => String,
    },
    '@/context/LanguageContext': { useLanguage: () => ({ isPt: true, language: 'pt' }) },
    '@/hooks/useLocalData': { useLocalData: () => state, useTodayKey: () => '2026-11-09' },
    '@/i18n/translations': { v2Translations: { pt: { nutrients: {} } } },
    '@/theme/tokens': { colors: {} },
  };
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(
    (name) => mocks[name] ?? (name.startsWith('@/')
      ? new Proxy({}, { get: () => () => null })
      : require(name)),
    module, module.exports,
  );
  const render = () => renderToStaticMarkup(React.createElement(module.exports.default));
  assert.match(render(), /Carregando/);
  state = { ...state, loading: false, error: 'Falha ao carregar' };
  assert.match(render(), /Falha ao carregar/);
});
