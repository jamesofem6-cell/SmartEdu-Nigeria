/* SmartEdu examination experience — API-ready client layer.
 * Demo questions are clearly labelled. Production question banks, attempts,
 * marking rules and mastery records are loaded from the SmartEdu API.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const STORAGE = {
    progress: "smartedu_exam_progress_v1",
    attempts: "smartedu_exam_attempts_v1"
  };
  const programmes = [
    {id:"jamb",name:"JAMB UTME",short:"JAMB",desc:"UTME subject practice, CBT simulations and admission preparation.",subjects:["Use of English","Mathematics","Biology","Chemistry","Physics","Government","Economics","Literature in English","Commerce","Accounting"],tiers:["Foundation","Developing","Exam Standard","Advanced","Expert"],icon:"🎯"},
    {id:"waec",name:"WAEC",short:"WAEC",desc:"WASSCE subject preparation, topic lessons and timed practice.",subjects:["English Language","Mathematics","Biology","Chemistry","Physics","Agricultural Science","Economics","Government","Literature in English","Geography"],tiers:["Foundation","Developing","WASSCE Standard","Advanced","Expert"],icon:"📘"},
    {id:"neco",name:"NECO",short:"NECO",desc:"NECO-aligned learning, practice and mock examinations.",subjects:["English Language","Mathematics","Biology","Chemistry","Physics","Agricultural Science","Economics","Government","Civic Education"],tiers:["Foundation","Developing","NECO Standard","Advanced","Expert"],icon:"📝"},
    {id:"ielts",name:"IELTS",short:"IELTS",desc:"Academic and General Training preparation across all four skills.",subjects:["Listening","Reading","Writing","Speaking","Vocabulary & Grammar"],tiers:["Foundation","Intermediate","IELTS Band 4–5","IELTS Band 6–7","IELTS Band 8–9"],icon:"🌍"},
    {id:"medical",name:"Medical School",short:"Medical",desc:"Foundational science, aptitude and medical-school entrance preparation.",subjects:["Biology","Chemistry","Physics","Use of English","Quantitative Reasoning","Logical Reasoning"],tiers:["Foundation","Developing","Admission Standard","Advanced","Expert"],icon:"🩺"},
    {id:"law",name:"Law School",short:"Law",desc:"Legal reasoning, reading comprehension, general knowledge and professional preparation.",subjects:["Legal Reasoning","English & Comprehension","General Knowledge","Logical Reasoning","Constitutional Foundations"],tiers:["Foundation","Developing","Admission Standard","Advanced","Professional"],icon:"⚖️"}
  ];
  const demoBank = {
    "jamb|Use of English":[
      {q:"Choose the word nearest in meaning to 'reluctant'.",o:["Unwilling","Excited","Careless","Certain"],a:0,why:"Reluctant means unwilling or hesitant to do something.",topic:"Vocabulary"},
      {q:"Choose the correctly punctuated sentence.",o:["Where are you going?","Where are you going.","Where are you going,","Where are you going!"],a:0,why:"A direct question ends with a question mark.",topic:"Punctuation"}
    ],
    "waec|Mathematics":[
      {q:"Simplify: 3x + 2x.",o:["5x","6x","5x²","x"],a:0,why:"Like terms are combined by adding coefficients: 3 + 2 = 5.",topic:"Algebra"},
      {q:"What is 25% of 80?",o:["15","20","25","30"],a:1,why:"25% is one quarter; 80 ÷ 4 = 20.",topic:"Percentages"}
    ],
    "neco|Mathematics":[
      {q:"Solve: x + 7 = 12.",o:["3","4","5","6"],a:2,why:"Subtract 7 from both sides: x = 12 − 7 = 5.",topic:"Simple equations"}
    ],
    "ielts|Vocabulary & Grammar":[
      {q:"Choose the grammatically correct sentence.",o:["She has lived here for five years.","She have lived here for five years.","She living here for five years.","She live here for five years."],a:0,why:"The present perfect 'has lived' describes a situation continuing to the present.",topic:"Grammar"}
    ],
    "medical|Biology":[
      {q:"Which cell structure contains most of the genetic material in a human cell?",o:["Nucleus","Ribosome","Cell membrane","Cytoplasm"],a:0,why:"The nucleus contains most of the cell's DNA.",topic:"Cell biology"}
    ],
    "law|Legal Reasoning":[
      {q:"Which principle generally requires a person to be given a fair opportunity to respond before an adverse decision is made?",o:["Fair hearing","Strict liability","Delegated legislation","Judicial notice"],a:0,why:"The fair-hearing principle requires a meaningful opportunity to be heard, subject to the applicable law and context.",topic:"Legal principles"}
    ]
  };
  let selected = null, questions = [], answers = {}, index = 0, timer = null, seconds = 0, startedAt = 0;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function showView(id) {
    ["loginView","studentHome","assistantView","examCentreView","examSetupView","examRunView","examResultView","resultCheckerView","masteryView"].forEach(v=>{const el=$(v);if(el)el.hidden=v!==id;});
    window.scrollTo(0,0);
  }
  function backHome(){ const user=JSON.parse(localStorage.getItem("smartedu_mobile_user")||"null"); if(typeof window.renderHome==="function" && user) window.renderHome(user); else showView("studentHome"); }
  function renderProgrammes(){
    const host=$("programmeGrid"); if(!host)return;
    host.innerHTML=programmes.map(p=>`<button class="programme-card" data-programme="${p.id}"><span class="programme-icon">${p.icon}</span><strong>${p.name}</strong><span>${p.desc}</span><small>${p.subjects.length} learning areas · 5 levels</small></button>`).join("");
    host.querySelectorAll("[data-programme]").forEach(b=>b.addEventListener("click",()=>chooseProgramme(b.dataset.programme)));
  }
  function chooseProgramme(id){
    selected=programmes.find(p=>p.id===id); if(!selected)return;
    $("setupTitle").textContent=selected.name+" Preparation";
    $("setupDescription").textContent=selected.desc;
    $("examSubject").innerHTML=selected.subjects.map(s=>`<option>${escapeHtml(s)}</option>`).join("");
    $("examTier").innerHTML=selected.tiers.map((s,i)=>`<option value="${i}">${escapeHtml(s)}</option>`).join("");
    $("examMode").value="diagnostic";
    $("examCount").value="10";
    showView("examSetupView");
  }
  function beginExam(){
    if(!selected)return;
    const subject=$("examSubject").value, key=selected.id+"|"+subject;
    questions=(demoBank[key]||[]).slice();
    const count=Math.max(5,Math.min(60,Number($("examCount").value)||10));
    if(!questions.length){
      alert("This subject's verified question bank will be supplied through the SmartEdu API. The examination interface is ready; this subject is awaiting its authorised content connection.");
      return;
    }
    while(questions.length<count){questions=questions.concat(questions.slice(0,Math.min(questions.length,count-questions.length)).map(q=>({...q,o:q.o.slice()})));}
    questions=questions.slice(0,count);
    answers={}; index=0; seconds=count*60; startedAt=Date.now();
    $("examRunTitle").textContent=selected.name+" · "+subject;
    $("examRunNotice").textContent="Demonstration questions — connect the verified SmartEdu question bank before live examinations.";
    renderQuestion(); startTimer(); showView("examRunView");
  }
  function startTimer(){
    clearInterval(timer); updateClock();
    timer=setInterval(()=>{seconds--;updateClock();if(seconds<=0){clearInterval(timer);finishExam(true);}},1000);
  }
  function updateClock(){const m=Math.floor(Math.max(0,seconds)/60),s=Math.max(0,seconds)%60;$("examClock").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");}
  function renderQuestion(){
    const q=questions[index]; $("questionCount").textContent="Question "+(index+1)+" of "+questions.length;
    $("questionText").textContent=q.q;
    $("questionTopic").textContent=q.topic||"Practice";
    $("answerOptions").innerHTML=q.o.map((o,i)=>`<button class="answer-option ${answers[index]===i?"chosen":""}" data-answer="${i}"><span>${String.fromCharCode(65+i)}</span>${escapeHtml(o)}</button>`).join("");
    $("answerOptions").querySelectorAll("[data-answer]").forEach(b=>b.addEventListener("click",()=>{answers[index]=Number(b.dataset.answer);renderQuestion();}));
    $("questionProgress").style.width=((index+1)/questions.length*100)+"%";
    $("prevQuestion").disabled=index===0; $("nextQuestion").textContent=index===questions.length-1?"Review & Submit":"Next question";
  }
  function finishExam(auto=false){
    clearInterval(timer);
    const correct=questions.reduce((n,q,i)=>n+(answers[i]===q.a?1:0),0);
    const percent=Math.round(correct/questions.length*100);
    const mistakes=questions.filter((q,i)=>answers[i]!==q.a).map(q=>q.topic||"General");
    const record={programme:selected.id,programmeName:selected.name,subject:$("examSubject").value,score:correct,total:questions.length,percent,weaknesses:mistakes,date:new Date().toISOString(),duration:Math.round((Date.now()-startedAt)/1000)};
    const attempts=read(STORAGE.attempts,[]);attempts.unshift(record);save(STORAGE.attempts,attempts.slice(0,100));
    const progress=read(STORAGE.progress,{});const k=selected.id+"|"+record.subject;progress[k]={...record,attempts:(progress[k]?.attempts||0)+1};save(STORAGE.progress,progress);
    $("resultScore").textContent=percent+"%"; $("resultHeadline").textContent=percent>=80?"Excellent progress":percent>=50?"Good effort — let's strengthen the gaps":"This is a starting point, not a final judgement";
    $("resultSummary").textContent=correct+" correct out of "+questions.length+(auto?" · Time expired":"");
    $("resultBreakdown").innerHTML=questions.map((q,i)=>`<article class="review-item"><strong>${i+1}. ${escapeHtml(q.q)}</strong><p class="${answers[i]===q.a?"good-text":"bad-text"}">${answers[i]===q.a?"Your answer is correct.":"Let's learn this one."} ${escapeHtml(q.o[q.a])}</p><p>${escapeHtml(q.why)}</p></article>`).join("");
    $("weaknessList").innerHTML=mistakes.length?Array.from(new Set(mistakes)).map(t=>`<li>${escapeHtml(t)}</li>`).join(""):"No missed topics in this short demonstration. Try a harder level.";
    $("teachWeakness").onclick=()=>teachTopic(mistakes[0]||record.subject,record.programmeName);
    showView("examResultView");
  }
  async function teachTopic(topic,programmeName){
    showView("assistantView");
    $("level").value="Beginner / explain simply";
    $("topic").value=topic;
    $("task").value="explanation";
    $("extra").value="Teach me from absolute beginner level. Assume I know nothing. Use very simple everyday language, short steps, Nigerian examples where useful, one worked example, common mistakes, then three practice questions that increase gradually. This lesson is part of "+programmeName+" preparation. First explain the idea, then check my understanding.";
    $("message").textContent="Your personal beginner lesson is ready to generate. Connect the AI API to receive the lesson.";
    $("generate").scrollIntoView({behavior:"smooth",block:"center"});
  }
  function renderMastery(){
    const attempts=read(STORAGE.attempts,[]),host=$("masteryContent");
    if(!host)return;
    if(!attempts.length){host.innerHTML="<p>No mock attempts yet. Complete a practice session to start your personal improvement record.</p>";return;}
    host.innerHTML=attempts.slice(0,20).map(a=>`<article class="mastery-row"><strong>${escapeHtml(a.programmeName)} · ${escapeHtml(a.subject)}</strong><b>${a.percent}%</b><small>${new Date(a.date).toLocaleString()} · ${a.score}/${a.total}</small><p>Topics to revisit: ${escapeHtml([...new Set(a.weaknesses)].join(", ")||"Continue to advanced practice")}</p></article>`).join("");
  }
  function openChecker(){showView("resultCheckerView");}
  function init(){
    renderProgrammes();
    $("openExamCentre")?.addEventListener("click",()=>showView("examCentreView"));
    $("openResultChecker")?.addEventListener("click",openChecker);
    $("openMastery")?.addEventListener("click",()=>{renderMastery();showView("masteryView");});
    document.querySelectorAll("[data-back-home]").forEach(b=>b.addEventListener("click",backHome));
    $("startExam")?.addEventListener("click",beginExam);
    $("prevQuestion")?.addEventListener("click",()=>{if(index>0){index--;renderQuestion();}});
    $("nextQuestion")?.addEventListener("click",()=>{if(index<questions.length-1){index++;renderQuestion();}else if(confirm("Submit your answers now?"))finishExam(false);});
    $("submitExam")?.addEventListener("click",()=>{if(confirm("Submit this examination?"))finishExam(false);});
    $("tryAgain")?.addEventListener("click",()=>chooseProgramme(selected.id));
    $("openWeaknesses")?.addEventListener("click",()=>{renderMastery();showView("masteryView");});
    $("checkJambResult")?.addEventListener("click",()=>window.open("https://efacility.jamb.gov.ng/","_blank","noopener"));
    $("checkWaecResult")?.addEventListener("click",()=>window.open("https://www.waecdirect.org/","_blank","noopener"));
  }
  document.addEventListener("DOMContentLoaded",init);
  window.SmartEduExamCentre={programmes,teachTopic,renderMastery};
})();