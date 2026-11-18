import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { validateProspect, SEGMENTS, type Segment } from '../../supabase/functions/submit-prospect/validate';
import { qualifyProspect } from '../../supabase/functions/submit-prospect/scoring';
import { Button } from '../components/ui/Button';
import { Seo } from '../lib/seo';

const topics = {
  demo: 'Demande de démonstration',
  partenariat: 'Proposition de partenariat',
  'rendez-vous': 'Demande de rendez-vous',
};

function ContactFixture({ booking }: { booking: boolean }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const [topic, setTopic] = useState<keyof typeof topics>(booking ? 'rendez-vous' : params.get('topic') === 'partenariat' ? 'partenariat' : 'demo');
  const [result, setResult] = useState('');
  const segment = params.get('segment') as Segment;
  const title = booking ? 'Préparer un rendez-vous fictif' : 'Essayer une demande de contact';

  function qualify() {
    const source = location.pathname + location.search;
    const checked = validateProspect({
      full_name: 'Camille Exemple', email: 'camille@example.invalid',
      organization: 'Atelier Exemple', topic, segment: SEGMENTS.includes(segment) ? segment : 'artisan',
      message: 'Notre atelier souhaite une démonstration pour organiser ses dossiers.',
      source_page: source, elapsed_ms: 5000, website: '',
      ...(topic === 'partenariat' ? { partner_type: 'prescripteur' } : {}),
      ...(topic === 'rendez-vous' ? { creneaux: 'Les mardis matin' } : {}),
    });
    if (!checked.ok) { setResult('Cette demande fictive ne respecte pas les champs attendus.'); return; }
    const { routage } = qualifyProspect(checked.value);
    setResult('Demande validée. Orientation : ' + routage + '. Source : ' + checked.value.source_page);
  }

  return <section className="mx-auto max-w-3xl px-6 py-16 md:py-24">
    <Seo title={title} description={booking ? 'Essayez la qualification d’une demande de rendez-vous avec le profil fictif de l’Atelier Exemple.' : 'Testez la qualification d’une demande de contact ou de partenariat fictive dans la démonstration ClairDossier.'} path={booking ? '/rendez-vous' : '/contact'} />
    <h1 className="font-display text-5xl text-navy-900">{title}</h1>
    <p className="mt-5 text-lg">Camille représente l’Atelier Exemple. Choisissez sa demande pour voir comment ClairDossier l’oriente. Ce test reste dans votre navigateur.</p>
    <form className="mt-8 grid max-w-lg gap-5" onSubmit={event => { event.preventDefault(); qualify(); }}>
      <label className="grid gap-2 font-semibold">Demande de Camille
        <select className="rounded-lg border border-slate-400 bg-white p-3" value={topic}
          onChange={event => { setTopic(event.target.value as keyof typeof topics); setResult(''); }}>
          {Object.entries(topics).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <Button type="submit">Qualifier la demande fictive</Button>
    </form>
    <p role="status" className="mt-5 break-words text-navy-900">{result}</p>
  </section>;
}

export const Contact = () => <ContactFixture booking={false} />;
export const RendezVous = () => <ContactFixture booking />;
