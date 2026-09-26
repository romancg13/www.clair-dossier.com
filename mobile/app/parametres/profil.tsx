/** Profil professionnel — mêmes champs que le site (table `profiles`). */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { userMessage } from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { ChoiceGroup } from '../../src/features/ChoiceGroup';
import { Banner, Button, Input, Screen } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { COMPANY_TYPES, useProfile, useSaveProfile } from '../../src/data/profile';
import { spacing } from '../../src/theme/tokens';

export default function Profil() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, isPending } = useProfile(user?.id);
  const save = useSaveProfile(user?.id ?? '');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<string>('artisan');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFullName(data.full_name ?? '');
    setCompanyName(data.company_name ?? '');
    setCompanyType(data.company_type ?? 'artisan');
    setPhone(data.phone ?? '');
  }, [data]);

  const submit = () => {
    setSaved(false);
    save.mutate(
      {
        full_name: fullName.trim() || null,
        company_name: companyName.trim() || null,
        company_type: companyType,
        phone: phone.trim() || null,
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Profil" subtitle="Ces informations vous aident à retrouver vos dossiers." onBack={() => router.back()} />
      <View style={{ gap: spacing.lg }}>
        {save.isError ? <Banner tone="danger" message={userMessage(save.error, "L'enregistrement a échoué.")} /> : null}
        {saved ? <Banner tone="success" message="Profil enregistré." /> : null}
        <Input label="Nom et prénom" value={fullName} onChangeText={setFullName} autoComplete="name" editable={!isPending} />
        <Input label="Structure" value={companyName} onChangeText={setCompanyName} editable={!isPending} />
        <ChoiceGroup label="Type d'activité" options={COMPANY_TYPES} value={companyType} onChange={setCompanyType} />
        <Input
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          help="Facultatif — utilisé uniquement pour vous joindre au sujet de vos dossiers."
        />
        <Button label="Enregistrer" onPress={submit} loading={save.isPending} />
      </View>
    </Screen>
  );
}
