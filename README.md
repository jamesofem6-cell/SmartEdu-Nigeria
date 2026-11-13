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
