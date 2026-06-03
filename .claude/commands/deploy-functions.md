Build and safely deploy Firebase Cloud Functions for the Paras project.

Steps:
1. Run `cd functions && npm run lint` — stop if lint fails and show errors
2. Run `cd functions && npm run build` — stop if TypeScript compilation fails
3. Show a summary of what functions will be deployed (read `functions/src/index.ts` to list exported function names and their triggers/schedules)
4. Ask the user to confirm before running `firebase deploy --only functions`
5. After successful deploy, run `cd functions && npm run logs` for 10 seconds to confirm no startup errors
