<?php
declare(strict_types=1);

/*
 * SmartEdu AI API
 * Requires a valid mobile API Bearer token issued by /api/login.php.
 * Keep AI credentials on the server only.
 */

$allowedOrigins = [
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'https://smartedu.yutendala.ng',
    'https://www.smartedu.yutendala.ng'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} elseif ($origin !== '') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'This app origin is not allowed.']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $code, array $data): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['success' => false, 'message' => 'POST required.']);
}

$input = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($input) || ($input['action'] ?? '') !== 'generate') {
    respond(400, ['success' => false, 'message' => 'Invalid request.']);
}

/*
 * Authenticate the app token using the same token table as /api/login.php.
 * The raw token is never stored; only its SHA-256 hash is looked up.
 */
$authorization = '';
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        if (strtolower((string) $name) === 'authorization') {
            $authorization = (string) $value;
            break;
        }
    }
}
if ($authorization === '') {
    $authorization = (string) (
        $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? ''
    );
}

if (!preg_match('/^Bearer\\s+([a-f0-9]{64})$/D', trim($authorization), $matches)) {
    respond(401, ['success' => false, 'message' => 'Please sign in again to continue.']);
}

$rawToken = $matches[1];
$tokenHash = hash('sha256', $rawToken);
unset($rawToken);

try {
    require_once __DIR__ . '/db.php';
    $pdo = smartedu_db();

    $authStmt = $pdo->prepare(
        "SELECT u.id, u.role, u.status
         FROM smartedu_api_tokens AS t
         INNER JOIN users AS u ON u.id = t.user_id
         WHERE t.token_hash = ?
           AND t.expires_at > NOW()
           AND u.status = 'active'
         LIMIT 1"
    );
    $authStmt->execute([$tokenHash]);
    $authenticatedUser = $authStmt->fetch(PDO::FETCH_ASSOC);

    if (!$authenticatedUser) {
        respond(401, ['success' => false, 'message' => 'Your session has expired. Please sign in again.']);
    }
} catch (Throwable $e) {
    error_log('SmartEdu AI authentication error: ' . $e->getMessage());
    respond(503, ['success' => false, 'message' => 'Authentication is temporarily unavailable. Please try again.']);
}

$apiKey = getenv('SMARTEDU_AI_API_KEY') ?: '';
if ($apiKey === '') {
    respond(503, ['success' => false, 'message' => 'AI service is not configured on the server.']);
}

$role = $authenticatedUser['role'] === 'student' ? 'student' : 'teacher';
$topic = trim(substr((string) ($input['topic'] ?? ''), 0, 255));
$level = trim(substr((string) ($input['level'] ?? ''), 0, 100));
$task = preg_replace('/[^a-z_]/', '', (string) ($input['task'] ?? 'lesson_note'));
$extra = trim(substr((string) ($input['extra'] ?? ''), 0, 8000));

if ($topic === '') {
    respond(422, ['success' => false, 'message' => 'Topic is required.']);
}

$roleGuide = $role === 'teacher'
    ? 'Create practical teaching material for a Nigerian teacher. Include clear objectives, introduction, lesson development, examples, assessment and conclusion where suitable.'
    : 'Act as a patient study tutor. Explain concepts step by step, use clear examples, check understanding and encourage academic integrity.';

$taskNames = [
    'lesson_note' => 'lesson note or study guide',
    'scheme' => 'scheme of work',
    'quiz' => 'practice quiz with answers',
    'explanation' => 'step-by-step explanation',
    'revision' => 'revision pack',
    'summary' => 'summary of supplied notes'
];
$taskName = $taskNames[$task] ?? 'learning material';
$prompt = $roleGuide . ' Prepare a ' . $taskName . ' for level ' . $level .
    ' on: ' . $topic .
    '. Use Nigerian/British English and age-appropriate language. Do not invent citations or claim questions are verified past questions. Additional instructions/material: ' . $extra;

$base = rtrim(getenv('SMARTEDU_AI_BASE_URL') ?: 'https://api.openai.com/v1', '/');
$model = getenv('SMARTEDU_AI_MODEL') ?: 'gpt-4o-mini';
$payload = json_encode([
    'model' => $model,
    'messages' => [
        ['role' => 'system', 'content' => 'You are SmartEdu Nigeria, a careful Nigerian education assistant. Be accurate, structured and supportive.'],
        ['role' => 'user', 'content' => $prompt]
    ],
    'temperature' => 0.5
]);

if ($payload === false) {
    respond(500, ['success' => false, 'message' => 'Unable to prepare the AI request.']);
}

$ch = curl_init($base . '/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT => 90
]);

$response = curl_exec($ch);
$error = curl_error($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    error_log('SmartEdu AI connection error: ' . $error);
    respond(502, ['success' => false, 'message' => 'The AI provider could not be reached. Please try again.']);
}

$data = json_decode($response, true);
$content = $data['choices'][0]['message']['content'] ?? '';

if ($status < 200 || $status >= 300 || !is_string($content) || trim($content) === '') {
    error_log('SmartEdu AI provider returned HTTP ' . $status . ': ' . substr((string) $response, 0, 1500));
    respond(502, ['success' => false, 'message' => 'The AI provider returned an error. Check the server AI configuration.']);
}

respond(200, ['success' => true, 'content' => $content]);
