import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    // Fuseau par défaut ; les dates propres à un utilisateur passent son fuseau explicitement.
    timeZone: "Europe/Paris",
    // Référence des dates relatives (« il y a 5 minutes ») : l'instant du rendu.
    now: new Date(),
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
