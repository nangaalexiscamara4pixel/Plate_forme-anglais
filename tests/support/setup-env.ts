import { config } from "dotenv";

// Les tests utilisent EXCLUSIVEMENT la base de test (.env.test), jamais celle de développement.
config({ path: ".env.test", override: true, quiet: true });
Object.assign(process.env, { NODE_ENV: "test" });
