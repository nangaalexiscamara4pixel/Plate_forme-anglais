import { CTA, EmailLayout, P } from "./layout";

export type EmailLocale = "fr" | "en";

export type EmailMessage = { subject: string; react: React.ReactElement };

export function verifyEmail({ name, url, locale }: { name: string; url: string; locale: EmailLocale }): EmailMessage {
  const fr = locale === "fr";
  const subject = fr ? "Confirmez votre adresse email" : "Confirm your email address";
  return {
    subject,
    react: (
      <EmailLayout locale={locale} preview={subject} heading={fr ? `Bienvenue, ${name}` : `Welcome, ${name}`}>
        <P>
          {fr
            ? "Merci pour votre demande d'inscription à GlobeSpeak Academy. Pour continuer, confirmez votre adresse email."
            : "Thank you for applying to GlobeSpeak Academy. To continue, please confirm your email address."}
        </P>
        <CTA href={url}>{fr ? "Confirmer mon email" : "Confirm my email"}</CTA>
        <P>
          {fr
            ? "Ce lien expire dans 24 heures. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
            : "This link expires in 24 hours. If you did not request this, you can ignore this message."}
        </P>
      </EmailLayout>
    ),
  };
}

export function resetPassword({ name, url, locale }: { name: string; url: string; locale: EmailLocale }): EmailMessage {
  const fr = locale === "fr";
  const subject = fr ? "Réinitialisation de votre mot de passe" : "Reset your password";
  return {
    subject,
    react: (
      <EmailLayout locale={locale} preview={subject} heading={subject}>
        <P>{fr ? `Bonjour ${name},` : `Hello ${name},`}</P>
        <P>
          {fr
            ? "Une réinitialisation de mot de passe a été demandée pour votre compte. Ce lien est valable 30 minutes."
            : "A password reset was requested for your account. This link is valid for 30 minutes."}
        </P>
        <CTA href={url}>{fr ? "Choisir un nouveau mot de passe" : "Choose a new password"}</CTA>
        <P>
          {fr
            ? "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé."
            : "If you did not request this, ignore this message: your password remains unchanged."}
        </P>
      </EmailLayout>
    ),
  };
}

export function newRegistration({
  name,
  email,
  url,
}: {
  name: string;
  email: string;
  url: string;
}): EmailMessage {
  const subject = `Nouvelle demande d'accès : ${name}`;
  return {
    subject,
    react: (
      <EmailLayout locale="fr" preview={subject} heading="Nouvelle demande d'accès">
        <P>
          <strong>{name}</strong> ({email}) vient de confirmer son adresse email et attend votre approbation.
        </P>
        <CTA href={url}>Examiner la demande</CTA>
      </EmailLayout>
    ),
  };
}

export type StatusEmailKind = "APPROVED" | "REJECTED" | "SUSPENDED" | "REACTIVATED";

export function statusChanged({
  name,
  kind,
  levelName,
  email,
  reason,
  url,
  locale,
}: {
  name: string;
  kind: StatusEmailKind;
  levelName?: string;
  /** Identifiant de connexion rappelé dans l'email d'approbation. */
  email?: string;
  reason?: string | null;
  url: string;
  locale: EmailLocale;
}): EmailMessage {
  const fr = locale === "fr";
  const copy = {
    APPROVED: {
      subject: fr ? "Votre demande d'accès est acceptée 🎉" : "Your access request is approved 🎉",
      heading: fr ? `Bienvenue à l'Académie, ${name}` : `Welcome to the Academy, ${name}`,
      body: fr
        ? `Bonne nouvelle : votre demande d'accès a été acceptée et vous rejoignez le niveau ${levelName ?? ""}. Vous pouvez dès maintenant vous connecter à la plateforme avec votre adresse email${email ? ` (${email})` : ""} et le mot de passe choisi lors de votre demande.`
        : `Good news: your access request has been approved and you are joining level ${levelName ?? ""}. You can now sign in to the platform with your email address${email ? ` (${email})` : ""} and the password you chose when applying.`,
      cta: fr ? "Me connecter" : "Sign in",
    },
    REJECTED: {
      subject: fr ? "Votre demande d'accès" : "Your access request",
      heading: fr ? `Bonjour ${name}` : `Hello ${name}`,
      body: fr
        ? "Après examen, nous ne pouvons pas donner suite à votre demande d'accès pour le moment. Pour toute question, contactez-nous depuis le site."
        : "After review, we are unable to accept your access request at this time. If you have any questions, contact us through the website.",
      cta: fr ? "Visiter le site" : "Visit the website",
    },
    SUSPENDED: {
      subject: fr ? "Votre compte a été suspendu" : "Your account has been suspended",
      heading: fr ? `Bonjour ${name}` : `Hello ${name}`,
      body: fr
        ? "L'accès à votre compte a été temporairement suspendu. Vous avez été déconnecté de tous vos appareils."
        : "Access to your account has been temporarily suspended. You have been signed out of all devices.",
      cta: fr ? "En savoir plus" : "Learn more",
    },
    REACTIVATED: {
      subject: fr ? "Votre compte est de nouveau actif" : "Your account is active again",
      heading: fr ? `Bon retour, ${name}` : `Welcome back, ${name}`,
      body: fr ? "Votre accès à la plateforme a été rétabli." : "Your access to the platform has been restored.",
      cta: fr ? "Accéder à mon espace" : "Go to my dashboard",
    },
  }[kind];

  return {
    subject: copy.subject,
    react: (
      <EmailLayout locale={locale} preview={copy.subject} heading={copy.heading}>
        <P>{copy.body}</P>
        {reason ? <P>{fr ? `Motif : ${reason}` : `Reason: ${reason}`}</P> : null}
        <CTA href={url}>{copy.cta}</CTA>
      </EmailLayout>
    ),
  };
}

export function levelPromoted({
  name,
  levelName,
  url,
  locale,
}: {
  name: string;
  levelName: string;
  url: string;
  locale: EmailLocale;
}): EmailMessage {
  const fr = locale === "fr";
  const subject = fr ? `Félicitations : vous passez au niveau ${levelName}` : `Congratulations: you are moving up to ${levelName}`;
  return {
    subject,
    react: (
      <EmailLayout locale={locale} preview={subject} heading={fr ? `Bravo, ${name} !` : `Well done, ${name}!`}>
        <P>
          {fr
            ? `Votre progression a été validée par l'équipe pédagogique. Votre nouvel espace ${levelName} vous attend.`
            : `Your progress has been validated by the teaching team. Your new ${levelName} space is waiting for you.`}
        </P>
        <CTA href={url}>{fr ? "Découvrir mon nouveau niveau" : "Discover my new level"}</CTA>
      </EmailLayout>
    ),
  };
}

export function newsletterConfirm({ url, unsubscribeUrl, locale }: { url: string; unsubscribeUrl: string; locale: EmailLocale }): EmailMessage {
  const fr = locale === "fr";
  const subject = fr ? "Confirmez votre inscription à la newsletter" : "Confirm your newsletter subscription";
  return {
    subject,
    react: (
      <EmailLayout locale={locale} preview={subject} heading={subject}>
        <P>
          {fr
            ? "Vous avez demandé à recevoir les nouvelles de GlobeSpeak Academy. Confirmez votre adresse pour finaliser l'inscription (lien valable 48 heures)."
            : "You asked to receive news from GlobeSpeak Academy. Confirm your address to complete your subscription (link valid for 48 hours)."}
        </P>
        <CTA href={url}>{fr ? "Confirmer mon inscription" : "Confirm my subscription"}</CTA>
        <P>
          {fr ? "Ce n'était pas vous ? Ignorez cet email, ou " : "Wasn't you? Ignore this email, or "}
          <a href={unsubscribeUrl}>{fr ? "supprimez votre adresse" : "remove your address"}</a>.
        </P>
      </EmailLayout>
    ),
  };
}

export function accountLocked({
  name,
  minutes,
  locale,
}: {
  name: string;
  minutes: number;
  locale: EmailLocale;
}): EmailMessage {
  const fr = locale === "fr";
  const subject = fr ? "Alerte de sécurité : connexion bloquée" : "Security alert: sign-in blocked";
  return {
    subject,
    react: (
      <EmailLayout locale={locale} preview={subject} heading={subject}>
        <P>{fr ? `Bonjour ${name},` : `Hello ${name},`}</P>
        <P>
          {fr
            ? `Plusieurs tentatives de connexion ont échoué sur votre compte. Par sécurité, la connexion est bloquée pendant ${minutes} minutes.`
            : `Several failed sign-in attempts were detected on your account. For your security, sign-in is blocked for ${minutes} minutes.`}
        </P>
        <P>
          {fr
            ? "Si ce n'était pas vous, nous vous conseillons de réinitialiser votre mot de passe et d'activer la double authentification."
            : "If this wasn't you, we recommend resetting your password and enabling two-factor authentication."}
        </P>
      </EmailLayout>
    ),
  };
}
