import pino from "pino";

/**
 * Logger structuré. Les champs sensibles sont masqués quelle que soit leur profondeur :
 * aucun mot de passe, jeton, cookie ou lien Meet ne doit apparaître dans les logs.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: [
      "password",
      "*.password",
      "newPassword",
      "*.newPassword",
      "token",
      "*.token",
      "secret",
      "*.secret",
      "cookie",
      "*.cookie",
      "headers.authorization",
      "headers.cookie",
      "meetUrl",
      "*.meetUrl",
      "url",
      "*.url",
    ],
    censor: "[redacted]",
  },
  base: undefined,
});
