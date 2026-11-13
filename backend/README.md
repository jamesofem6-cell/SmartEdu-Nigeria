# SmartEdu PHP API

Deploy this folder on HTTPS hosting (for example, as https://smartedu.yutendala.ng/api.php). Import schema.sql into a MySQL database.

Set these environment variables in your hosting environment or private server configuration:
- SMARTEDU_DB_HOST
- SMARTEDU_DB_NAME
- SMARTEDU_DB_USER
- SMARTEDU_DB_PASS
- SMARTEDU_AI_API_KEY
- SMARTEDU_AI_BASE_URL (optional; defaults to OpenAI chat completions endpoint)
- SMARTEDU_AI_MODEL (optional)

Do not put secrets in this repository or in the Android app. The API currently provides a minimal generation endpoint; production authentication, account-based five-free-use tracking, Paystack verification, abuse prevention, privacy policy and admin controls still need implementation before launch. Configure CORS to allow only your app/site origins before production.
