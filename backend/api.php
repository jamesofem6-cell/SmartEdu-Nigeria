<?php
declare(strict_types=1);

/*
 * SmartEdu authenticated AI endpoint.
 * Provider/model choice is server-side; the mobile app never receives API keys.
 */
$allowedOrigins = ['https://localhost','http://localhost','capacitor://localhost','https://smartedu.yutendala.ng','https://www.smartedu.yutendala.ng'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: '.$origin); header('Vary: Origin');
} elseif ($origin !== '') {
    http_response_code(403); header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success'=>false,'message'=>'This app origin is not allowed.']); exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

function smartedu_respond(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') smartedu_respond(405,['success'=>false,'message'=>'POST required.']);

$input = json_decode(file_get_contents('php://input') ?: '', true);
if (!is_array($input) || ($input['action'] ?? '') !== 'generate') smartedu_respond(400,['success'=>false,'message'=>'Invalid request.']);

$authorization = '';
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name=>$value) if (strtolower((string)$name)==='authorization') { $authorization=(string)$value; break; }
}
if ($authorization==='') $authorization=(string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!preg_match('/^Bearer\\s+([a-f0-9]{64})$/D',trim($authorization),$matches)) smartedu_respond(401,['success'=>false,'message'=>'Please sign in again to continue.']);

try {
    require_once __DIR__.'/db.php';
    $pdo=smartedu_db();
    $stmt=$pdo->prepare("SELECT u.id,u.role,u.status FROM smartedu_api_tokens t INNER JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>NOW() AND u.status='active' LIMIT 1");
    $stmt->execute([hash('sha256',$matches[1])]);
    $user=$stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) smartedu_respond(401,['success'=>false,'message'=>'Your session has expired. Please sign in again.']);
} catch (Throwable $e) {
    error_log('SmartEdu AI authentication error: '.$e->getMessage());
    smartedu_respond(503,['success'=>false,'message'=>'Authentication is temporarily unavailable. Please try again.']);
}

$role = (string)$user['role'];
if (!in_array($role,['student','teacher'],true)) smartedu_respond(403,['success'=>false,'message'=>'This account cannot use the learning assistant.']);
$topic=trim(substr((string)($input['topic']??''),0,255));
$level=trim(substr((string)($input['level']??''),0,120));
$task=preg_replace('/[^a-z_]/','',(string)($input['task']??'explanation'));
$extra=trim(substr((string)($input['extra']??''),0,10000));
$track=($input['teacher_track']??'')==='university'?'university':'school';
if ($topic==='') smartedu_respond(422,['success'=>false,'message'=>'Topic or course is required.']);

$studentTasks=['explanation','lesson_note','quiz','revision','summary'];
$schoolTasks=['lesson_note','scheme','teaching_guide','class_activity','quiz','assessment','revision','summary'];
$universityTasks=['lecture_note','tutorial','assignment','quiz','course_outline','assessment_rubric','marking_guide','student_feedback','summary'];
$allowed=$role==='student'?$studentTasks:($track==='university'?$universityTasks:$schoolTasks);
if (!in_array($task,$allowed,true)) smartedu_respond(422,['success'=>false,'message'=>'That activity is not available for this account type.']);

$taskNames=[
'explanation'=>'beginner-friendly explanation','lesson_note'=>'student study note','quiz'=>'practice quiz with answers and explanations',
'revision'=>'revision pack','summary'=>'summary of supplied material','scheme'=>'scheme of work',
'teaching_guide'=>'teacher teaching guide','class_activity'=>'classroom activity plan','assessment'=>'class assessment with marking guide',
'lecture_note'=>'university lecture note','tutorial'=>'university tutorial guide','assignment'=>'university course assignment',
'course_outline'=>'course outline and weekly teaching plan','assessment_rubric'=>'university assessment rubric',
'marking_guide'=>'marking guide and model answer','student_feedback'=>'constructive feedback on student work'
];
if ($role==='student') {
    $guide='You are SmartEdu Nigeria, a patient student tutor. Explain from the learner’s stated level, use small steps, familiar examples, worked examples and supportive checks for understanding. Do not shame the learner.';
} elseif ($track==='university') {
    $guide='You are SmartEdu Nigeria supporting a university lecturer. Produce academically appropriate, teachable university course material with clear learning outcomes, conceptual depth, discipline-appropriate terminology, examples, tutorial or assessment alignment, and Nigerian/British English where appropriate. Do not fabricate references, data, institutional rules or citations. This is ordinary university teaching support: do not turn it into a student research-project literature review or dissertation workflow.';
} else {
    $guide='You are SmartEdu Nigeria supporting a Nigerian school teacher. Follow a practical school-teaching structure appropriate to the stated class: learning objectives, previous knowledge, instructional materials, introduction, lesson development, teacher and learner activities, evaluation and conclusion where suitable. Keep teacher lesson-note and teaching-guide structure distinct from university research-project workflows.';
}
$prompt=$guide."\nPrepare a ".$taskNames[$task]." for ".$level." on: ".$topic.
"\nMake the result clear, usable and appropriately detailed. Do not claim invented questions are verified past questions. Additional instructions or supplied material:\n".$extra;

try {
    require_once __DIR__.'/ai-router.php';
    $result=smartedu_generate_with_router($prompt,$task,$role,$track,$topic,$extra);
    smartedu_respond(200,['success'=>true,'content'=>$result['content'],'provider'=>$result['provider'],'model'=>$result['model']]);
} catch (Throwable $e) {
    error_log('SmartEdu AI generation error: '.$e->getMessage());
    smartedu_respond(502,['success'=>false,'message'=>'SmartEdu could not generate this material right now. Please try again.']);
}
