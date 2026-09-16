/**
 * Onboarding — 4 écrans, passables à tout moment.
 *
 * Contenu strictement aligné sur ce que le produit fait RÉELLEMENT
 * (voir /etat-du-produit) : centraliser, structurer, suivre les échéances,
 * transmettre sur décision. Aucune promesse d'analyse automatique des pièces :
 * ClairDossier s'engage contractuellement à ne pas lire vos documents.
 */
import { useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Text, type IconName } from '../src/ui';
import { savePrefs } from '../src/lib/storage';
import { colors, radius, spacing } from '../src/theme/tokens';

const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'folder',
    title: 'Vos documents au même endroit',
    body: "Contrats, devis, factures, courriers : chaque dossier réunit ses pièces dans un espace privé, isolé de tous les autres comptes.",
  },
  {
    icon: 'scan',
    title: 'Scanner et importer en quelques secondes',
    body: "Photographiez un document, importez un PDF ou une photo : la pièce rejoint le dossier, classée par type d'après son nom.",
  },
  {
    icon: 'calendar',
    title: 'Vos échéances sous les yeux',
    body: "Notez les dates qui comptent : elles s'affichent par dossier et dans un agenda unique, avec ce qui est en retard en premier.",
  },
  {
    icon: 'share',
    title: 'Vous seul décidez de transmettre',
    body: "Rien ne part automatiquement. Vous relisez la synthèse, puis vous choisissez d'envoyer votre dossier, par e-mail ou WhatsApp.",
  },
];

const { width } = Dimensions.get('window');

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const finish = async () => {
    await savePrefs({ onboardingDone: true });
    router.replace('/connexion');
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (index >= SLIDES.length - 1) return void finish();
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.topBar}>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Passer l'introduction">
          <Text variant="smallStrong" tone="secondary">
            Passer
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={styles.flex}
      >
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <View style={styles.glyph}>
              <Icon name={slide.icon} size={34} color={colors.accentStrong} />
            </View>
            <Text variant="title" center>
              {slide.title}
            </Text>
            <Text variant="body" tone="secondary" center style={styles.body}>
              {slide.body}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessibilityElementsHidden>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          label={index >= SLIDES.length - 1 ? 'Commencer' : 'Suivant'}
          onPress={next}
          iconRight={index >= SLIDES.length - 1 ? undefined : 'chevron-right'}
        />
        <Button label="J'ai déjà un compte" variant="ghost" onPress={finish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topBar: { alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  slide: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xxl },
  glyph: {
    width: 92,
    height: 92,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { maxWidth: 330 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  dot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 20 },
  actions: { paddingHorizontal: spacing.xxl, gap: spacing.sm },
});
