import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const colors = {
  night: "#0B1B3A",
  gold: "#C9A961",
  paper: "#FAF8F3",
  ink: "#1A1F2E",
  muted: "#5B6275",
};

export function EmailLayout({
  preview,
  heading,
  children,
  locale,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
  locale: "fr" | "en";
}) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.paper, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px" }}>
          <Section style={{ textAlign: "center", paddingBottom: 24 }}>
            <Text style={{ color: colors.night, fontSize: 20, letterSpacing: 2, margin: 0 }}>
              GLOBESPEAK <span style={{ color: colors.gold }}>ACADEMY</span>
            </Text>
          </Section>
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              padding: "32px 32px 24px",
              borderTop: `4px solid ${colors.gold}`,
            }}
          >
            <Heading as="h1" style={{ color: colors.night, fontSize: 24, fontWeight: 600, margin: "0 0 16px" }}>
              {heading}
            </Heading>
            {children}
          </Section>
          <Hr style={{ borderColor: "#E7E2D6", margin: "32px 0 16px" }} />
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", fontFamily: "Arial, sans-serif" }}>
            {locale === "fr"
              ? "Vous recevez cet email car un compte GlobeSpeak Academy est associé à cette adresse."
              : "You are receiving this email because a GlobeSpeak Academy account is linked to this address."}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: colors.ink, fontSize: 15, lineHeight: "24px", fontFamily: "Arial, sans-serif" }}>
      {children}
    </Text>
  );
}

export function CTA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ textAlign: "center", margin: "24px 0" }}>
      <Button
        href={href}
        style={{
          backgroundColor: colors.night,
          color: "#ffffff",
          borderRadius: 8,
          padding: "12px 24px",
          fontSize: 15,
          fontFamily: "Arial, sans-serif",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}
