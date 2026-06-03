Build the Angular app and sync web assets to the iOS and Android Capacitor projects.

Steps:
1. Run `npm run build` to produce the production web bundle in `www/`
2. If the build fails, show the errors and stop
3. Run `npx cap sync` to copy assets to both `ios/` and `android/` and update native dependencies
4. Report any plugin version mismatches or missing permissions warnings from the sync output
5. Remind the user to open Xcode (`npx cap open ios`) or Android Studio (`npx cap open android`) to run on a real device
