<?php
declare(strict_types=1);

/**
 * SmartEdu multi-provider, multi-model router.
 * Supports OpenAI Chat Completions and Google's OpenAI-compatible Gemini endpoint.
 * All credentials and model choices are read from server environment variables.
 */
function smartedu_env(string $name, string $default=''): string {
    $value=getenv($name);
    return $value===false ? $default : trim((string)$value);
}
function smartedu_provider_config(string $provider, string $task, string $track): ?array {
    $prefix=$provider==='gemini'?'SMARTEDU_GEMINI':'SMARTEDU_OPENAI';
    $key=smartedu_env($prefix.'_API_KEY');
    if ($key==='') return null;
    $base=smartedu_env($prefix.'_BASE_URL',$provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/openai':'https://api.openai.com/v1');
    $defaultModel=smartedu_env($prefix.'_MODEL',$provider==='gemini'?'gemini-2.5-flash':'gpt-4o-mini');
    $kind='FAST';
    if (in_array($task,['lecture_note','tutorial','assignment','assessment_rubric','marking_guide','student_feedback','teaching_guide','assessment'],true)) $kind='QUALITY';
    if (in_array($task,['summary','course_outline'],true)) $kind='LONG';
    if ($task==='assignment' && $track==='university') $kind='QUALITY';
    $model=smartedu_env($prefix.'_MODEL_'.$kind,$defaultModel);
    return ['provider'=>$provider,'key'=>$key,'base'=>rtrim($base,'/'),'model'=>$model];
}
function smartedu_call_provider(array $cfg,string $prompt): array {
    $payload=json_encode([
        'model'=>$cfg['model'],
        'messages'=>[
            ['role'=>'system','content'=>'You are SmartEdu Nigeria, an accurate, supportive education assistant. Follow the task instructions and never invent citations or claim unverified facts.'],
            ['role'=>'user','content'=>$prompt]
        ],
        'temperature'=>0.4
    ],JSON_UNESCAPED_UNICODE);
    if ($payload===false) throw new RuntimeException('Could not encode provider request.');
    $ch=curl_init($cfg['base'].'/chat/completions');
    curl_setopt_array($ch,[
        CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$cfg['key']],
        CURLOPT_POSTFIELDS=>$payload,CURLOPT_CONNECTTIMEOUT=>15,CURLOPT_TIMEOUT=>100
    ]);
    $body=curl_exec($ch); $error=curl_error($ch); $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    if ($body===false) throw new RuntimeException('Provider connection failed: '.$error);
    $data=json_decode($body,true);
    $content=$data['choices'][0]['message']['content']??'';
    if ($status<200 || $status>=300 || !is_string($content) || trim($content)==='') {
        error_log('SmartEdu '.$cfg['provider'].' returned HTTP '.$status.': '.substr((string)$body,0,1200));
        throw new RuntimeException('Provider rejected the request.');
    }
    return ['content'=>trim($content),'provider'=>$cfg['provider'],'model'=>$cfg['model']];
}
function smartedu_generate_with_router(string $prompt,string $task,string $role,string $track,string $topic,string $extra): array {
    $primary=smartedu_env('SMARTEDU_AI_PROVIDER','gemini');
    if (!in_array($primary,['gemini','openai'],true)) $primary='gemini';
    $secondary=$primary==='gemini'?'openai':'gemini';
    // Route by both the selected activity and the actual question/topic wording.
    $queryText=strtolower($prompt.' '.$topic.' '.$extra);
    if (preg_match('/\\b(analy[sz]e|evaluate|compare|derive|prove|case study|clinical|diagnos|legal argument|jurisprud|advanced|complex|critical appraisal|ielts writing)\\b/',$queryText)) $task='assignment';
    if (strlen($prompt)>9000 || strlen($extra)>6000) $task='summary';
    $configs=[];
    $first=smartedu_provider_config($primary,$task,$track);
    if ($first) $configs[]=$first;
    $fallback=filter_var(smartedu_env('SMARTEDU_AI_FALLBACK_ENABLED','true'),FILTER_VALIDATE_BOOLEAN);
    if ($fallback) {
        $second=smartedu_provider_config($secondary,$task,$track);
        if ($second) $configs[]=$second;
    }
    if (!$configs) throw new RuntimeException('No AI provider is configured.');
    $last=null;
    foreach ($configs as $cfg) {
        try { return smartedu_call_provider($cfg,$prompt); }
        catch (Throwable $e) { $last=$e; error_log('SmartEdu provider '.$cfg['provider'].' failed; checking configured fallback.'); }
    }
    throw new RuntimeException($last ? $last->getMessage() : 'No provider could complete the request.');
}
