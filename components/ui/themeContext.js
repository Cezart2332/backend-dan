import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColor } from './colorAdapt';

const STORAGE_KEY = 'theme_preference';
const PREFERENCES = ['system', 'light', 'dark'];

function adaptList(adapt) {
  return (color, role) => (Array.isArray(color) ? color.map((c) => adapt(c, role)) : adapt(color, role));
}

const lightTc = adaptList((color) => color);
const darkTc = adaptList(darkColor);

const ThemeContext = createContext({
  scheme: 'light',
  isDark: false,
  preference: 'system',
  setPreference: () => {},
  tc: lightTc,
});

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (PREFERENCES.includes(stored)) setPreferenceState(stored);
      })
      .catch(() => {});

    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => subscription.remove();
  }, []);

  const setPreference = useCallback((value) => {
    if (!PREFERENCES.includes(value)) return;
    setPreferenceState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  }, []);

  const scheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({
      scheme,
      isDark: scheme === 'dark',
      preference,
      setPreference,
      tc: scheme === 'dark' ? darkTc : lightTc,
    }),
    [scheme, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * `tc(color, role)` întoarce culoarea potrivită temei curente
 * ('fg' = text/iconițe, 'bg' = fundaluri/borduri; acceptă și liste de culori).
 */
export function useTheme() {
  return useContext(ThemeContext);
}

const stylesCache = new WeakMap();

/**
 * Stilurile unui ecran, create o singură dată per temă din `factory(tc)`.
 *
 * @param {(tc: Function) => object} factory
 */
export function useThemedStyles(factory) {
  const { scheme, tc } = useTheme();
  let entry = stylesCache.get(factory);
  if (!entry) {
    entry = {};
    stylesCache.set(factory, entry);
  }
  if (!entry[scheme]) entry[scheme] = factory(tc);
  return entry[scheme];
}
