# Project Controls Hub (PCH)

A Persian RTL, mobile-friendly project-controls workspace. The existing GitHub Pages app now uses Firebase Authentication and Cloud Firestore for online sign-in and synchronization.

## Firebase project

- Project ID: `project-controls-hub-8bb30`
- Plan: Spark (no billing account configured)
- Firebase Web App ID: `1:867802858246:web:5715422679339e5934d487`
- App configuration is public client configuration only; no passwords or service-account keys are stored here.

## Admin bootstrap

Google sign-in is enabled so users do not receive a separate email-verification message. Google confirms the identity; the two designated administrator addresses receive the matching role only on a verified Google sign-in, with `adminAccess/{uid}` bound to that UID. Firestore rules allow this one-time self-creation only when the verified token email exactly matches one of the two configured addresses. Email/password sign-up also sends no verification email and creates a pending membership request immediately. Staff requests receive no project or evaluation data until an administrator approves the UID and assigns a staff role and allowed project IDs. No administrator password or service-account key is stored in the repository.

## Collections

`users`, `membershipRequests`, `projects`, `tasks`, `recurrences`, `recurrenceInstances`, `activityHistory`, `evaluations`, `settings`, and the console-managed `adminAccess` collection. Repeated occurrences use deterministic IDs to avoid duplicate occurrences. Spark has no always-running scheduler, so due occurrences are generated when an authorized user opens the app.

## Security

`firestore.rules` restricts task reads to an administrator or the task creator/assignee. `manager_private` records can only be read by the Project Controls Manager whose UID is the assignee; the system owner is excluded from that path. Evaluation records are admin-only. Staff cannot write profiles, roles, weights, settings, or admin grants. Keep Firestore Rules deployed from this file whenever the app is updated.

The project owner can still inspect or modify the database through Firebase Console or Google Cloud project-level permissions. Firestore client rules cannot restrict a trusted project owner or a service-account administrator.

## Hosting

GitHub Pages continues serving the static app for free. Authentication and Firestore traffic run directly from the browser using the Firebase Web SDK; Firebase Hosting and Blaze are not required. `arashlavasani877-creator.github.io` is authorized under Firebase Authentication → Settings → Authorized domains for OAuth redirects.

## Local development

Serve the repository over HTTP(S) so the browser can load ES modules. The app intentionally does not import previous browser-local demo data into Firestore.
