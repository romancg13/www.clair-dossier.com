/**
 * Navigation principale — 5 onglets.
 *
 * Le choix des onglets suit ce que le produit fait réellement : Accueil,
 * Dossiers, Importer (caméra/fichiers), Échéances, Compte. Il n'y a pas
 * d'onglet « IA » : ClairDossier s'engage à ne procéder à aucune lecture ni
 * exploitation automatique des pièces (CGV, /etat-du-produit). Inventer un tel
 * onglet serait une promesse fausse.
 */
import { Redirect, Tabs } from 'expo-router';
import { Platform, type ColorValue } from 'react-native';
import { Icon, type IconName } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { colors, fonts } from '../../src/theme/tokens';

function tabIcon(name: IconName) {
  return ({ color }: { color: ColorValue }) => <Icon name={name} size={23} color={String(color)} />;
}

export default function AppTabs() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Redirect href="/connexion" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.surfaceInverse,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="dossiers" options={{ title: 'Dossiers', tabBarIcon: tabIcon('folder') }} />
      <Tabs.Screen name="importer" options={{ title: 'Importer', tabBarIcon: tabIcon('scan') }} />
      <Tabs.Screen name="echeances" options={{ title: 'Échéances', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="compte" options={{ title: 'Compte', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}
