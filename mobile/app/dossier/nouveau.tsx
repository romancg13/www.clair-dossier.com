/**
 * Création de dossier — même tunnel en 5 étapes que le site, adapté au mobile
 * (une question par écran, progression visible, brouillon conservé).
 *
 * Les profils, typologies et champs viennent de packages/core : le dossier
 * créé depuis le téléphone est rigoureusement identique à celui créé depuis
 * le site (mêmes clés dans `answers`, même typologie, même statut initial).
 */
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CATEGORIES,
  PROFILS,
  answerLabel,
  fieldsFor,
  isDateKey,
  typologyLabel,
  userMessage,
  type Category,
  type Profil,
} from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { ChoiceGroup } from '../../src/features/ChoiceGroup';
import { Banner, Button, Card, Input, ProgressBar, Screen, SectionHeader, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { createDossier } from '../../src/data/dossiers';
import { qk } from '../../src/lib/query';
import { formatDate } from '../../src/lib/format';
import { spacing } from '../../src/theme/tokens';

type Step = 1 | 2 | 3 | 4 | 5;

export default function NouveauDossier() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [profil, setProfil] = useState<Profil | undefined>();
  const [typology, setTypology] = useState<Category | undefined>();
  const [title, setTitle] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => (typology ? fieldsFor(typology) : []), [typology]);

  const next = useCallback(() => {
    setError(null);
    if (step === 1 && !profil) return setError('Choisissez votre profil.');
    if (step === 2 && !typology) return setError('Choisissez la nature du dossier.');
    if (step === 4 && !title.trim()) return setError('Donnez un nom à ce dossier.');
    setStep((s) => Math.min(5, s + 1) as Step);
  }, [step, profil, typology, title]);

  const back = () => {
    setError(null);
    if (step === 1) return router.back();
    setStep((s) => Math.max(1, s - 1) as Step);
  };

  const submit = async () => {
    if (!user || !typology) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createDossier({
        userId: user.id,
        typology,
        title: title.trim(),
        answers: { ...answers, ...(profil ? { profil } : {}) },
      });
      await qc.invalidateQueries({ queryKey: qk.dossiers });
      setBusy(false);
      router.replace(`/dossier/${id}`);
    } catch (e) {
      setBusy(false);
      setError(userMessage(e, "Le dossier n'a pas pu être créé."));
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {step < 5 ? (
            <Button label="Continuer" onPress={next} iconRight="chevron-right" />
          ) : (
            <Button label="Créer le dossier" onPress={submit} loading={busy} icon="check" />
          )}
          <Button label={step === 1 ? 'Annuler' : 'Retour'} variant="ghost" onPress={back} />
        </View>
      }
    >
      <ScreenHeader title="Nouveau dossier" subtitle={`Étape ${step} sur 5`} onBack={back} />
      <ProgressBar value={step / 5} label={`Étape ${step} sur 5`} />

      {error ? (
        <View style={styles.block}>
          <Banner tone="danger" message={error} />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.block}>
          <SectionHeader title="Votre profil" caption="Pour adapter les questions à votre activité." />
          <ChoiceGroup options={PROFILS} value={profil} onChange={(id) => setProfil(id as Profil)} columns={1} />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.block}>
          <SectionHeader title="Nature du dossier" caption="Ce que vous voulez suivre." />
          <ChoiceGroup options={CATEGORIES} value={typology} onChange={(id) => setTypology(id as Category)} columns={1} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.block}>
          <SectionHeader title="Informations" caption="Tout est facultatif : vous pourrez compléter plus tard." />
          {fields.map((field) => (
            <Input
              key={field.id}
              label={field.label}
              help={field.help}
              value={answers[field.id] ?? ''}
              onChangeText={(value) => setAnswers((prev) => ({ ...prev, [field.id]: value }))}
              multiline={field.type === 'textarea'}
              placeholder={field.type === 'date' ? 'AAAA-MM-JJ' : undefined}
              keyboardType={field.type === 'date' ? 'numbers-and-punctuation' : 'default'}
            />
          ))}
        </View>
      ) : null}

      {step === 4 ? (
        <View style={styles.block}>
          <SectionHeader title="Nom du dossier" caption="Un nom parlant vous fera gagner du temps." />
          <Input
            label="Nom"
            value={title}
            onChangeText={setTitle}
            required
            autoFocus
            placeholder={typology ? `${typologyLabel(typology)} — Dupont` : 'Nom du dossier'}
            help="Exemple : « Facture 2026-014 — SARL Dupont »."
          />
        </View>
      ) : null}

      {step === 5 ? (
        <View style={styles.block}>
          <SectionHeader title="Récapitulatif" caption="Relisez avant de créer le dossier." />
          <Card>
            <Row label="Profil" value={PROFILS.find((p) => p.id === profil)?.label ?? '—'} />
            <Row label="Nature" value={typology ? typologyLabel(typology) : '—'} />
            <Row label="Nom" value={title || '—'} />
            {Object.entries(answers)
              .filter(([, value]) => value.trim())
              .map(([key, value]) => (
                <Row key={key} label={answerLabel(key)} value={isDateKey(key) ? formatDate(value) : value} />
              ))}
          </Card>
          <Text variant="caption" tone="muted">
            Le dossier est créé dans votre espace privé, au statut « Brouillon ». Vous pourrez y déposer vos
            pièces, ajouter des échéances, puis décider vous-même de le transmettre.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="small">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.xl, gap: spacing.md },
  footer: { gap: spacing.sm },
  row: { gap: 2, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
});
