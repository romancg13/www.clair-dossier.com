-- Notifications de lead : à chaque nouveau profil (inscription) ou nouveau dossier,
-- appelle l'Edge Function notify-lead via pg_net → e-mail à l'équipe (Resend).
-- La clé utilisée dans l'en-tête est la clé ANON (publique, protégée par RLS) — pas un secret.

create extension if not exists pg_net;

create or replace function public.notify_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/notify-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U'
    ),
    body := jsonb_build_object('table', tg_table_name, 'record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists on_new_profile_notify on public.profiles;
create trigger on_new_profile_notify
  after insert on public.profiles
  for each row execute function public.notify_lead();

drop trigger if exists on_new_dossier_notify on public.dossiers;
create trigger on_new_dossier_notify
  after insert on public.dossiers
  for each row execute function public.notify_lead();
