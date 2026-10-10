// Fallback pour les URL qui ne correspondent à aucune langue (rare).
export default function GlobalNotFound() {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "Georgia, serif", background: "#FAF8F3", color: "#1A1F2E", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <p style={{ letterSpacing: 4, color: "#8a7340" }}>404</p>
          <h1 style={{ fontWeight: 500 }}>Page introuvable · Page not found</h1>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hors contexte de langue */}
          <a href="/" style={{ color: "#0B1B3A" }}>GlobeSpeak Academy</a>
        </main>
      </body>
    </html>
  );
}
