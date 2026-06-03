Check today's and tomorrow's NYC Alternate Side Parking schedule data in Firestore.

Use the firebase MCP server to:
1. Query the `feed` Firestore collection for documents where the date field covers today and tomorrow (use the current date)
2. Display each result showing: date, isASP (whether rules are in effect), reason (if suspended), and any relevant notes
3. Flag if no documents exist for today or tomorrow — this means the Cloud Function may not have run recently
4. Check the `notifications` collection for a sample of user documents to confirm token fields are populated

If the firebase MCP is not available, fall back to reading `functions/src/index.ts` to explain where data comes from and suggest running `firebase emulators:start` to test locally.
