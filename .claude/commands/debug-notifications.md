Diagnose push notification issues in the Paras app.

Investigate the following, in order:

1. **FCM token registration** — Read `src/app/app.component.ts` and trace where `PushNotifications.register()` is called and how the token is saved to Firestore
2. **Notification scheduling logic** — Read `functions/src/fcm.ts` and `functions/src/index.ts` to find the scheduled function triggers and payload construction
3. **User notification preferences** — If the firebase MCP is available, query the `notifications` Firestore collection for a sample of documents and check that `token`, `today`, and `tomorrow` fields are populated and the time values are valid
4. **Common failure modes to check:**
   - Token not saved (user denied permission or Capacitor plugin not initialized before auth)
   - Notification time stored as wrong type (string vs number)
   - FCM topic vs individual token mismatch
   - Cloud Function cold-start timeout before notification window closes
5. Report findings with the specific file and line number for any suspicious code
