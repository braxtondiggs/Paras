import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Dev-only settings (a live-reload server over cleartext HTTP, mixed-content
 * and remote web-contents debugging) must NEVER ship in a production build —
 * they expose the app to MITM and mixed-content attacks.
 *
 * They are gated behind an explicit opt-in (`NODE_ENV=development`) so they are
 * secure by default: any build that does not explicitly request development
 * mode (including CI/production where NODE_ENV is often unset) omits them. The
 * `start:android` livereload script sets `NODE_ENV=development`.
 */
const isDevelopment = process.env['NODE_ENV'] === 'development';

const config: CapacitorConfig = {
  appId: 'com.cymbit.paras',
  appName: 'ASP NYC',
  webDir: 'www',
  includePlugins: [
    '@capacitor/app',
    '@capacitor/haptics',
    '@capacitor/network',
    '@capacitor/preferences',
    '@capacitor/push-notifications',
    '@capacitor/splash-screen',
    'capacitor-email-composer',
  ],
  plugins: {
    App: {
      appUrlScheme: 'aspnyc',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Network: {
      alias: 'network',
    },
    Preferences: {
      alias: 'preferences',
    },
    Haptics: {
      alias: 'haptics',
    },
    SplashScreen: {
      // Stays up until AppComponent calls SplashScreen.hide() after the first route renders, so
      // Angular's boot never shows as a blank frame. Drawables come from `npx @capacitor/assets generate`.
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      backgroundColor: '#A77EB0',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  android: {
    captureInput: true,
    appendUserAgent: 'ASP-NYC-App',
    backgroundColor: '#A77EB0',
    useLegacyBridge: false,
    minWebViewVersion: 60,
  },
};

if (isDevelopment) {
  // Live-reload dev server + relaxed security flags. Stripped from prod builds.
  config.server = {
    url: 'http://localhost:8100',
    cleartext: true,
    allowNavigation: ['http://localhost:*', 'https://localhost:*', 'ionic://localhost/*'],
  };
  config.android = {
    ...config.android,
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    loggingBehavior: 'debug',
  };
}

export default config;
