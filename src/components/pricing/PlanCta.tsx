import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useCheckoutEmail } from "../../lib/profile";
import { trackEvent } from "../../lib/analytics";

/**
 * CTA d'abonnement : le paiement Stripe n'est proposé qu'à un utilisateur
 * authentifié. Un visiteur passe d'abord par la connexion / création de
 * compte, puis revient sur les tarifs (?next). Les liens internes (devis,
 * contact) restent inchangés.
 */
export function PlanCta({
  href,
  planId,
  monthly,
  className,
  children,
}: {
  href: string;
  planId: string;
  monthly: boolean;
  className: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const isCheckout = href.startsWith("https://buy.stripe.com/");
  const checkoutEmail = useCheckoutEmail(isCheckout ? user?.id : undefined, user?.email ?? null);
  const back = new URLSearchParams({ formule: planId });
  const next = encodeURIComponent(`/tarifs?${back.toString()}`);
  if (isCheckout && !user) {
    return (
      <Link to={`/connexion?next=${next}`} className={className}>
        {children}
      </Link>
    );
  }
  if (isCheckout && user && !user.email_confirmed_at) {
    return (
      <Link to={`/inscription?next=${next}`} state={{ verifier: user.email }} className={className}>
        {children}
      </Link>
    );
  }
  if (isCheckout && user) {
    // Rattachement serveur du paiement au compte (webhook Stripe) : identifiant
    // du compte + e-mail de facturation (facultatif, repli sur le compte).
    const url = new URL(href);
    url.searchParams.set("client_reference_id", user.id);
    if (checkoutEmail) url.searchParams.set("prefilled_email", checkoutEmail);
    return (
      <a
        href={url.toString()}
        className={className}
        onClick={() =>
          trackEvent("debut_checkout", {
            formule: planId,
            facturation: monthly ? "mensuelle" : "annuelle",
          })
        }
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}
