import i18next from "i18next";
import Backend from "i18next-fs-backend";
import * as path from "node:path";

import { loadAvailableLocales } from "./localeLoader";

const i18n = i18next.createInstance();

const availableLocales = Array.from(loadAvailableLocales().keys());

i18n.use(Backend).init({
  lng: "en", // Default language
  fallbackLng: "en",
  preload: availableLocales,
  ns: ["translation"],
  defaultNS: "translation",
  backend: {
    loadPath: path.join(__dirname, "../locales/{{lng}}.json"),
  },
  interpolation: {
    escapeValue: false, // Discord handles escaping
  },
});

export default i18n;

/**
 * Helper to get a fixed T function for a specific locale.
 * @param locale The locale to use (e.g., 'en', 'es').
 * @returns A translation function.
 */
export const getT = (locale: string) => {
  // Normalize locale (e.g., 'es-ES' -> 'es')
  const normalizedLocale = locale.split("-")[0];
  return i18n.getFixedT(normalizedLocale);
};
