"use client";

// Erreur fatale au niveau du layout racine : page autonome, sans dépendances.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "Georgia, serif", background: "#0B1B3A", color: "#FAF8F3", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24, maxWidth: 480 }}>
          <p style={{ letterSpacing: 4, color: "#C9A961" }}>500</p>
          <h1 style={{ fontWeight: 500 }}>Un incident est survenu · Something went wrong</h1>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: "10px 20px", borderRadius: 8, border: "1px solid #C9A961", background: "transparent", color: "#FAF8F3", cursor: "pointer" }}
          >
            Réessayer · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
