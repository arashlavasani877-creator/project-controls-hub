# Project Controls Hub (PCH)

A Persian RTL, mobile-friendly project-controls workspace. The existing GitHub Pages app now uses Firebase Authentication and Cloud Firestore for online sign-in and synchronization.

## Firebase project

- Project ID: `project-controls-hub-8bb30`
- Plan: Spark (no billing account configured)
- Firebase Web App ID: `1:867802858246:web:5715422679339e5934d487`
- App configuration is public client configuration only; no passwords or service-account keys are stored here.

## Admin bootstrap

The two designated administrator addresses are recognized only after Firebase confirms the account email. On the first verified sign-in, the app creates `adminAccess/{uid}` with the matching role. Firestore rules permit this one-time self-creation only when the verified token email exactly matches one of the two configured addresses; the UID, email, role, active flag, and allowed fields are checked server-side. No administrator password or service-account key is stored in the repository.

All other verified accounts create a pending membership request and receive no project or evaluation data until an administrator approves them and assigns a staff role and allowed project IDs.

## Collections

`users`, `membershipRequests`, `projects`, `tasks`, `recurrences`, `recurrenceInstances`, `activityHistory`, `evaluations`, `settings`, and the console-managed `adminAccess` collection. Repeated occurrences use deterministic IDs to avoid duplicate occurrences. Spark has no always-running scheduler, so due occurrences are generated when an authorized user opens the app.

## Security

`firestore.rules` restricts task reads to an administrator or the task creator/assignee. `manager_private` records can only be read by the Project Controls Manager whose UID is the assignee; the system owner is excluded from that path. Evaluation records are admin-only. Staff cannot write profiles, roles, weights, settings, or admin grants. Keep Firestore Rules deployed from this file whenever the app is updated.

The project owner can still inspect or modify the database through Firebase Console or Google Cloud project-level permissions. Firestore client rules cannot restrict a trusted project owner or a service-account administrator.

## Hosting

GitHub Pages continues serving the static app for free. Authentication and Firestore traffic run directly from the browser using the Firebase Web SDK; Firebase Hosting and Blaze are not required. Add `arashlavasani877-creator.github.io` under Firebase Authentication → Settings → Authorized domains.

## Local development

Serve the repository over HTTP(S) so the browser can load ES modules. The app intentionally does not import previous browser-local demo data into Firestore.
