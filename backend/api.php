<?php
/**
 * SmartEdu Nigeria - authenticated AI endpoint.
 * Compatible with the existing mobile app request format and deployed router.
 * Do not add declare(strict_types=1): this file is included by other PHP files.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/cors.php';
require_once dirname(__DIR__) . '/db.php';
require_once __DIR__ . '/ai-router.php';

function smartedu_respond($status, $data)
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function smartedu_read_bearer_token()
{
    $authorization = '';

    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strtolower((string)$name) === 'authorization') {
                $authorization = (string)$value;
                break;
            }
        }
    }

    if ($authorization === '') {
        $authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    }

    if (preg_match('/^Bearer\\s+([a-f0-9]{64})$/iD', trim($authorization), $matches)) {
        return $matches[1];
    }

    return '';
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? '';

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if ($method !== 'POST') {
        smartedu_respond(405, [
            'success' => false,
            'message' => 'Only POST requests are allowed'
        ]);
    }

    $input = json_decode(file_get_contents('php://input') ?: '', true);

    if (!is_array($input)) {
        smartedu_respond(400, [
            'success' => false,
            'message' => 'A valid JSON request is required'
        ]);
    }

    // Accept the app's existing {action, topic, level, task, extra} format.
    // Also accept {prompt, task} for compatible future clients.
    if (isset($input['action']) && $input['action'] !== 'generate') {
        smartedu_respond(400, ['success' => false, 'message' => 'Invalid request action.']);
    }

    $task = preg_replace('/[^a-z_]/', '', strtolower((string)($input['task'] ?? 'explanation')));
    $topic = trim(substr((string)($input['topic'] ?? ''), 0, 255));
    $level = trim(substr((string)($input['level'] ?? ''), 0, 120));
    $extra = trim(substr((string)($input['extra'] ?? ''), 0, 10000));
    $promptInput = trim(substr((string)($input['prompt'] ?? ''), 0, 12000));
    $track = (($input['teacher_track'] ?? 'school') === 'university') ? 'university' : 'school';

    if ($topic === '' && $promptInput === '') {
        smartedu_respond(422, ['success' => false, 'message' => 'Topic or course is required.']);
    }

    if ($promptInput !== '') {
        $userRequest = $promptInput;
    } else {
        $userRequest = "Prepare material for: " . $topic
            . "\nLearner/class level: " . ($level !== '' ? $level : 'Not specified')
            . "\nAdditional instructions or source material:\n" . $extra;
    }

    $token = smartedu_read_bearer_token();

    if ($token === '') {
        smartedu_respond(401, ['success' => false, 'message' => 'Please sign in again to continue.']);
    }

    $pdo = smartedu_db();
    $stmt = $pdo->prepare("
        SELECT u.id, u.role, u.status
        FROM smartedu_api_tokens t
        INNER JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ?
          AND t.expires_at > NOW()
          AND u.status = 'active'
        LIMIT 1
    ");
    $stmt->execute([hash('sha256', $token)]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        smartedu_respond(401, ['success' => false, 'message' => 'Your session has expired. Please sign in again.']);
    }

    $role = (string)$user['role'];

    if (!in_array($role, ['student', 'teacher'], true)) {
        smartedu_respond(403, ['success' => false, 'message' => 'This account cannot use the learning assistant.']);
    }

    $studentTasks = ['explanation', 'lesson_note', 'quiz', 'revision', 'summary'];
    $schoolTasks = ['lesson_note', 'scheme', 'teaching_guide', 'class_activity', 'quiz', 'assessment', 'revision', 'summary'];
    $universityTasks = ['lecture_note', 'tutorial', 'assignment', 'quiz', 'course_outline', 'assessment_rubric', 'marking_guide', 'student_feedback', 'summary'];

    $allowed = $role === 'student'
        ? $studentTasks
        : ($track === 'university' ? $universityTasks : $schoolTasks);

    if (!in_array($task, $allowed, true)) {
        smartedu_respond(403, ['success' => false, 'message' => 'That activity is not available for this account type.']);
    }

    if ($role === 'student') {
        $guide = 'You are SmartEdu Nigeria, a patient student tutor. Explain from the learner’s stated level, use small steps, familiar examples, worked examples and supportive checks for understanding. Do not shame the learner.';
    } elseif ($track === 'university') {
        $guide = 'You are SmartEdu Nigeria supporting a university lecturer. Produce academically appropriate university teaching material with clear learning outcomes, conceptual depth and useful examples. Do not fabricate references or citations. Keep ordinary teaching support separate from student research-project literature reviews.';
    } else {
        $guide = 'You are SmartEdu Nigeria supporting a Nigerian school teacher. Use an appropriate school structure including learning objectives, previous knowledge, materials, introduction, lesson development, teacher and learner activities, evaluation and conclusion where suitable. Do not impose university research-project structures.';
    }

    $taskLabels = [
        'explanation' => 'beginner-friendly explanation',
        'lesson_note' => 'lesson or study note',
        'quiz' => 'practice quiz with answers and explanations',
        'revision' => 'revision material',
        'summary' => 'summary',
        'scheme' => 'scheme of work',
        'teaching_guide' => 'teacher teaching guide',
        'class_activity' => 'classroom activity plan',
        'assessment' => 'assessment with marking guidance',
        'lecture_note' => 'university lecture note',
        'tutorial' => 'university tutorial',
        'assignment' => 'university assignment',
        'course_outline' => 'university course outline',
        'assessment_rubric' => 'assessment rubric',
        'marking_guide' => 'marking guide',
        'student_feedback' => 'constructive student feedback'
    ];

    $fullPrompt = $guide
        . "\n\nPrepare a " . ($taskLabels[$task] ?? 'learning resource') . "."
        . "\n\n" . $userRequest
        . "\n\nUse clear, supportive language and Nigerian/British English where appropriate. Do not claim invented questions are verified past questions. Do not invent facts, data, references or citations.";

    // The deployed ai-router.php currently accepts prompt and task.
    $result = smartedu_generate_with_router($fullPrompt, $task, $role, $track, $topic, $extra);

    if (!is_array($result) || empty($result['success']) || empty($result['content'])) {
        // Some deployed router versions return content/provider/model without a success flag.
        if (is_array($result) && !empty($result['content'])) {
            $result['success'] = true;
        } else {
            throw new RuntimeException('The AI provider returned no usable content.');
        }
    }

    smartedu_respond(200, [
        'success' => true,
        'content' => $result['content'],
        'provider' => $result['provider'] ?? null,
        'model' => $result['model'] ?? null,
        'model_type' => $result['model_type'] ?? null
    ]);

} catch (Throwable $e) {
    error_log('SmartEdu API error: ' . $e->getMessage() . ' in ' . $e->getFile() . ' on line ' . $e->getLine());
    smartedu_respond(500, [
        'success' => false,
        'message' => 'SmartEdu could not complete this request. Please try again.'
    ]);
}
