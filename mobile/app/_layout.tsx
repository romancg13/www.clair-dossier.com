/**
 * Racine de l'application — fournisseurs, polices, verrou local, liens profonds.
 *
 * Ordre volontaire : SafeArea → gestes → cache réseau → authentification →
 * verrou. Le verrou est le plus interne : il doit pouvoir masquer l'écran quel
 * que soit l'état de navigation.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { fontMap } from '../src/theme/fonts';
import { colors } from '../src/theme/tokens';
import { queryClient } from '../src/lib/query';
import { AuthProvider, useAuth } from '../src/lib/auth';
import { AppLockProvider, useAppLock } from '../src/lib/app-lock';
import { useDeepLinks } from '../src/lib/useDeepLinks';
import { LockScreen } from '../src/features/LockScreen';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontMap);

  // Une police manquante ne doit jamais empêcher l'application de démarrer.
  const ready = fontsLoaded || !!fontError;

  const onLayout = useCallback(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayout}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppLockProvider>
              <StatusBar style="dark" />
              <Navigation />
            </AppLockProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { loading, session } = useAuth();
  const { locked } = useAppLock();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useDeepLinks(mounted && !loading, !!session);

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        <Stack.Screen name="dossier/[id]" />
        <Stack.Screen name="dossier/nouveau" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
      {locked ? <LockScreen /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
