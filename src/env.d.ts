/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_PAYMENTS_API_URL?: string;
  readonly VITE_STRIPE_PUBLIC_KEY?: string;
  readonly VITE_SUPABASE_FUNCTIONS_URL?: string;
  readonly VITE_STRIPE_CLIENT_ESSENTIEL_MONTHLY_PRICE_ID?: string;
  readonly VITE_STRIPE_CLIENT_ESSENTIEL_YEARLY_PRICE_ID?: string;
  readonly VITE_STRIPE_BUSINESS_MONTHLY_PRICE_ID?: string;
  readonly VITE_STRIPE_BUSINESS_YEARLY_PRICE_ID?: string;
  readonly VITE_STRIPE_CABINET_SOLO_MONTHLY_PRICE_ID?: string;
  readonly VITE_STRIPE_CABINET_SOLO_YEARLY_PRICE_ID?: string;
  readonly VITE_STRIPE_CABINET_PRO_MONTHLY_PRICE_ID?: string;
  readonly VITE_STRIPE_CABINET_PRO_YEARLY_PRICE_ID?: string;
  readonly VITE_STRIPE_CABINET_PREMIUM_MONTHLY_PRICE_ID?: string;
  readonly VITE_STRIPE_CABINET_PREMIUM_YEARLY_PRICE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
