# SmartEdu Nigeria

Android-first teaching and learning assistant. The Android APK is built with Capacitor; the PHP/MySQL API is deployed separately on Yutendala hosting.

## Current starter
- Teacher and student entry points
- Responsive app shell
- Local offline library using browser storage
- Online AI generation through a PHP API endpoint
- Capacitor Android project generated during GitHub Actions build
- APK artifact uploaded by the workflow

## Build an APK
1. Open Actions and enable workflows if GitHub asks.
2. Run Build Android APK from the Actions tab (or push a change).
3. Download smartedu-debug-apk from the successful workflow run's Artifacts section.

This produces a debug APK for testing, not a signed Play Store release.

## Backend deployment
Upload the backend/ directory to a protected location on your hosting account, configure the environment variables described in backend/README.md, import backend/schema.sql, and set the API URL in www/config.js. Never commit API keys, database passwords, or Paystack secret keys.

## Important
The starter is not production-ready. Configure and test the backend, payment verification, privacy/security controls, and Android build before public launch. AI generation requires internet; saved materials and downloaded practice content are available offline.


## Teacher workspace and multi-model AI
The mobile app includes separate student and teacher sign-in. Teacher accounts can use the school-teacher workflow or university-lecturer workflow. Generated teacher materials are saved locally on the device in this starter release. Shared cloud storage, class management, attendance, grading records and assignment submission workflows are future backend work.

The AI endpoint uses a server-side provider/model router. Configure Gemini first and optionally add an OpenAI API key later. See [backend/AI-AND-TEACHER-SETUP.md](backend/AI-AND-TEACHER-SETUP.md) for exact deployment files and private server configuration. Never commit provider keys.
