// Tailwind CSS v4 via PostCSS : Next.js suit les fichiers analysés par Tailwind, donc une
// nouvelle classe dans un composant régénère le CSS immédiatement en développement.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
