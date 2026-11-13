# SmartEdu Examination API Contract

This contract is the remaining server-side integration work for the examination and mastery experience.

## Existing app configuration

- App origin: Capacitor Android (https://localhost)
- Website: https://smartedu.yutendala.ng
- Existing AI endpoint: POST /api.php with action=generate
- Existing login endpoint: POST /api/login.php
- The app stores the bearer token as smartedu_mobile_token in local storage.

## Required authenticated endpoints

All endpoints must validate the bearer token against the existing token table, check that the token belongs to an active user, and enforce role/ownership checks. Return JSON with success and a safe message field.

### 1. Programme catalogue

GET /api/exams/catalog

Returns active programmes, subjects, tiers, skill areas and syllabus versions for JAMB UTME, WAEC, NECO, IELTS Academic and General Training, medical school entrance preparation, and law school entrance/professional preparation.

### 2. Question bank

GET /api/exams/questions?programme=jamb&subject=use-of-english&tier=standard&count=40&mode=diagnostic

Return only active, approved questions. Randomise questions and option order server-side. Do not send answer keys or explanations before the attempt is submitted. Include question IDs, topic tags, question type, safe option IDs/text, hints where allowed, and time allocation.

### 3. Start, save and submit attempts

- POST /api/exams/attempts — create a server-owned attempt and return attempt ID, question IDs and server start time.
- POST /api/exams/attempts/{id}/answers — save answers progressively.
- POST /api/exams/attempts/{id}/submit — mark server-side, calculate score, persist answer review and return explanations after submission.
- GET /api/exams/attempts — list only the authenticated student's attempts.
- GET /api/exams/attempts/{id} — return one owned attempt and its report.

The server is authoritative for timers, scoring, correct answers and attempt ownership. Never trust client-submitted scores or correctness flags.

### 4. Weakness diagnosis and mastery

GET /api/learning/mastery returns topic mastery and improvement history.

POST /api/learning/diagnose analyses recent attempts and returns strengths and weak topics, recurring misconception patterns, suggested teaching sequence, next practice difficulty, and a measurable reassessment target.

A wrong answer is a teaching opportunity. A low score must never shame or label a learner.

### 5. AI beginner teaching

POST /api/ai/tutor accepts programme, subject, topic, learner level, mistake context and learning goal.

AI response structure:
1. Explain the idea in plain language from zero assumed knowledge.
2. Break it into small steps.
3. Use a familiar everyday example (Nigerian context where helpful).
4. Work through one example.
5. Identify common misconceptions.
6. Ask a simple understanding check.
7. Give guided practice, then independent practice.
8. Increase difficulty only when understanding is demonstrated.

For IELTS, support Academic and General Training and all four skills. Speaking/listening require suitable audio workflows; do not pretend text-only tasks assess pronunciation or listening.

### 6. Result checker

The current app links to official JAMB e-Facility and WAEC Direct portals. Direct in-app checking is blocked until a legitimate authorised provider contract/API is available.

If an authorised provider is integrated:
- keep provider credentials exclusively on the server;
- validate transactions and PINs with the provider;
- never log or persist PINs, passwords or full result-checking credentials;
- show provider identity, fees (if any), terms, and transaction status before submission;
- do not scrape or imitate official portals.

### 7. Teacher/admin content management

Provide role-protected endpoints for authorised staff to manage programme/subject/syllabus configuration, question creation/review/verification/publishing/retirement, topic tags/difficulty/explanations, mock exam templates/time limits, and learner reports/intervention recommendations.

Teacher and student permissions must remain separate. University Project Support and teacher lesson-note workflows remain separate from this examination engine.

## Database migration

backend/examination-schema.sql is an additive draft migration for the examination tables. Review it against the live database and take a backup before applying it. It is not run by the Android build and must not be imported blindly.

## Release gates

Before public launch:
- connect API and token authentication;
- populate verified, licensed question banks for each programme and syllabus;
- implement server-side marking and anti-tamper attempt handling;
- connect AI provider with usage limits and abuse controls;
- add privacy/retention rules and audit logging;
- integrate only authorised result-checking providers;
- test accessibility, mobile performance, offline behaviour and Android release signing.
