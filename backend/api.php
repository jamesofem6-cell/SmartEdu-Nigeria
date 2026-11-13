<?php
declare(strict_types=1);

/*
 * SmartEdu API
 * Allowed browser origins: Android Capacitor, local development, and the
 * SmartEdu website. Keep AI credentials on the server only.
 */
$allowedOrigins = [
    'https://localhost',                 // Capacitor Android (default)
    'http://localhost',                  // Older Capacitor Android builds
    'capacitor://localhost',              // Capacitor iOS
    'https://smartedu.yutendala.ng',      // SmartEdu website
    'https://www.smartedu.yutendala.ng'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} elseif ($origin !== '') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success'=>false,'message'=>'This app origin is not allowed.']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['success'=>false,'message'=>'POST required.']);
}

$apiKey = getenv('SMARTEDU_AI_API_KEY') ?: '';
if ($apiKey === '') {
    respond(503, ['success'=>false,'message'=>'AI service is not configured on the server.']);
}

$input = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($input) || ($input['action'] ?? '') !== 'generate') {
    respond(400, ['success'=>false,'message'=>'Invalid request.']);
}

$role = ($input['role'] ?? '') === 'student' ? 'student' : 'teacher';
$topic = trim(substr((string)($input['topic'] ?? ''), 0, 255));
$level = trim(substr((string)($input['level'] ?? ''), 0, 100));
$task = preg_replace('/[^a-z_]/', '', (string)($input['task'] ?? 'lesson_note'));
$extra = trim(substr((string)($input['extra'] ?? ''), 0, 8000));

if ($topic === '') respond(422, ['success'=>false,'message'=>'Topic is required.']);

$roleGuide = $role === 'teacher'
    ? 'Create practical teaching material for a Nigerian teacher. Include clear objectives, introduction, lesson development, examples, assessment and conclusion where suitable.'
    : 'Act as a patient study tutor. Explain concepts step by step, use clear examples, check understanding and encourage academic integrity.';

$taskNames = [
    'lesson_note'=>'lesson note or study guide',
    'scheme'=>'scheme of work',
    'quiz'=>'practice quiz with answers',
    'explanation'=>'step-by-step explanation',
    'revision'=>'revision pack',
    'summary'=>'summary of supplied notes'
];
$taskName = $taskNames[$task] ?? 'learning material';
$prompt = $roleGuide . ' Prepare a ' . $taskName . ' for level ' . $level .
    ' on: ' . $topic .
    '. Use Nigerian/British English and age-appropriate language. Do not invent citations or claim questions are verified past questions. Additional instructions/material: ' . $extra;

$base = rtrim(getenv('SMARTEDU_AI_BASE_URL') ?: 'https://api.openai.com/v1', '/');
$model = getenv('SMARTEDU_AI_MODEL') ?: 'gpt-4o-mini';
$payload = json_encode([
    'model'=>$model,
    'messages'=>[
        ['role'=>'system','content'=>'You are SmartEdu Nigeria, a careful Nigerian education assistant. Be accurate, structured and supportive.'],
        ['role'=>'user','content'=>$prompt]
    ],
    'temperature'=>0.5
]);

$ch = curl_init($base . '/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_POST=>true,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_HTTPHEADER=>[
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_POSTFIELDS=>$payload,
    CURLOPT_TIMEOUT=>90
]);

$response = curl_exec($ch);
$error = curl_error($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    error_log('SmartEdu AI connection error: ' . $error);
    respond(502, ['success'=>false,'message'=>'The AI provider could not be reached. Please try again.']);
}

$data = json_decode($response, true);
$content = $data['choices'][0]['message']['content'] ?? '';

if ($status < 200 || $status >= 300 || !is_string($content) || $content === '') {
    error_log('SmartEdu AI provider returned HTTP ' . $status . ': ' . substr((string)$response, 0, 1500));
    respond(502, ['success'=>false,'message'=>'The AI provider returned an error. Check the server AI configuration.']);
}

respond(200, ['success'=>true,'content'=>$content]);
