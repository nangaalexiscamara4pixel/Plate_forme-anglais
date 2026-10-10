import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "as-needed",
  localeCookie: { name: "gs.locale", sameSite: "lax" },
});

export type Locale = (typeof routing.locales)[number];
