import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '../src/ui';
import { ScreenHeader } from '../src/features/ScreenHeader';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title="Page introuvable" onBack={() => router.back()} />
      <EmptyState
        icon="search"
        title="Ce contenu n'existe pas"
        description="Le lien est peut-être périmé ou le dossier a été supprimé."
        actionLabel="Revenir à l'accueil"
        onAction={() => router.replace('/(app)')}
      />
    </Screen>
  );
}
