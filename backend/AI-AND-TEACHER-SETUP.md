# SmartEdu AI and Teacher Workspace Setup

## What this update adds

- Teacher sign-in selection in the mobile app.
- A teacher workspace for school teachers.
- A separate university lecturer workflow with lecture notes, tutorials, assignments, course outlines, quizzes, assessment rubrics, marking guides and constructive student feedback.
- AI provider/model routing on the PHP server.
- Gemini and OpenAI-compatible providers, with optional automatic fallback.
- API credentials remain on the server. No key is included in the app or repository.

The teacher workspace saves generated materials in that teacher's device browser storage. It does not yet provide a shared cloud repository, class roster, attendance, grading records, assignment submissions or student messaging. Those require separate database tables and teacher/student management endpoints.

## Server files to upload

Upload both files to the same protected API directory as your existing `api.php` and `db.php`:
- `backend/api.php`
- `backend/ai-router.php`

Do not replace `db.php`, `api/login.php`, or other live authentication files as part of this update.

## Required environment variables

Set these privately in the hosting environment or a PHP configuration file outside the public web root:

```ini
SMARTEDU_AI_PROVIDER=gemini
SMARTEDU_AI_FALLBACK_ENABLED=true

SMARTEDU_GEMINI_API_KEY=YOUR_NEW_GEMINI_KEY
SMARTEDU_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
SMARTEDU_GEMINI_MODEL=gemini-2.5-flash
SMARTEDU_GEMINI_MODEL_FAST=gemini-2.5-flash
SMARTEDU_GEMINI_MODEL_QUALITY=gemini-2.5-pro
SMARTEDU_GEMINI_MODEL_LONG=gemini-2.5-flash

SMARTEDU_OPENAI_API_KEY=
SMARTEDU_OPENAI_BASE_URL=https://api.openai.com/v1
SMARTEDU_OPENAI_MODEL=gpt-4o-mini
SMARTEDU_OPENAI_MODEL_FAST=gpt-4o-mini
SMARTEDU_OPENAI_MODEL_QUALITY=gpt-4o
SMARTEDU_OPENAI_MODEL_LONG=gpt-4o
```

Model identifiers above are examples and must be checked against the models enabled for your provider account before use. You can change them on the server without rebuilding the Android app. Keep the OpenAI key empty until you purchase/enable that API. Never paste API keys into GitHub, the Android app, or a chat.

If your hosting plan does not expose environment variables, use a PHP config file stored outside `public_html` and load it from the API bootstrap. Do not create a publicly downloadable config file.

## Model routing

The router selects FAST, QUALITY or LONG model slots using the activity and query complexity signals. It tries the selected provider first. If that provider fails and fallback is enabled, it tries the other provider only when that provider has a key configured.

- Gemini is the initial provider by default.
- OpenAI can be enabled later by adding its server-side key.
- `SMARTEDU_AI_PROVIDER=openai` changes the preferred provider.
- Set `SMARTEDU_AI_FALLBACK_ENABLED=false` to disable cross-provider fallback.

The AI provider choice does not change SmartEdu's student payment model. Student packages and access remain governed by the Paystack-based payment system.

## Teacher login requirement

The existing `/api/login.php` must accept `role=teacher` and issue the same token format for active teacher accounts as it does for students. The AI endpoint verifies the token against `smartedu_api_tokens` and obtains the teacher role from the database. Do not rely on the role sent by the browser as proof of permission.

## Deployment order

1. Back up the current live API files.
2. Upload `ai-router.php` beside `api.php`.
3. Upload the new `api.php`.
4. Set the server-side environment variables and ensure PHP cURL is enabled.
5. Upload the updated `www/index.html`, `www/app.js` and `www/style.css` to the app's web root / APK source folder as appropriate.
6. Test student login and generation.
7. Test teacher login using an active teacher account.
8. Test school-teacher tasks and university-lecturer tasks.
9. Only after the web/app source is verified, run a new Android APK build.

Do not import a new SQL schema for this update; these changes do not add database tables.
