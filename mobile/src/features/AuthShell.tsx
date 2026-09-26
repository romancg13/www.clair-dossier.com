/** Cadre commun des écrans d'authentification : logo, titre, contenu, mentions. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Text, Icon } from '../ui';
import { colors, radius, spacing, HIT_SLOP } from '../theme/tokens';

export function AuthShell({
  title,
  subtitle,
  children,
  onBack,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Screen contentStyle={{ paddingTop: insets.top + spacing.lg, gap: spacing.xl }}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Retour">
            <Icon name="chevron-left" size={22} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Image source={require('../../assets/splash-icon.png')} style={styles.logo} contentFit="contain" />
        )}
      </View>

      <View style={styles.titles}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="small" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.form}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  logo: { width: 46, height: 46, borderRadius: radius.sm },
  titles: { gap: spacing.xs },
  form: { gap: spacing.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
});
