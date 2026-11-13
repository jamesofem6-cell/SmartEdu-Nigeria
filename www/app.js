const $ = id => document.getElementById(id);
const AUTH_URL = "https://smartedu.yutendala.ng/api/login.php";
const USER_KEY = "smartedu_mobile_user";
const TOKEN_KEY = "smartedu_mobile_token";
const VIEWS = ["loginView","studentHome","teacherHome","assistantView","examCentreView","examSetupView","examRunView","examResultView","resultCheckerView","masteryView"];

function show(view) {
  VIEWS.forEach(id => { const el=$(id); if(el) el.hidden=id!==view; });
  window.scrollTo(0,0);
}
function readUser(){try{return JSON.parse(localStorage.getItem(USER_KEY)||"null");}catch(e){return null;}}
function renderHome(user){
  const name=user&&user.full_name?user.full_name:"Student";
  if(user&&user.role==="teacher"){renderTeacherHome(user);return;}
  $("welcomeName").textContent="Welcome, "+name+"!";
  $("accountName").textContent=name;$("accountEmail").textContent=user&&user.email?user.email:"";
  show("studentHome");
}
window.renderHome=renderHome;
function renderTeacherHome(user){
  const name=user&&user.full_name?user.full_name:"Teacher";
  $("teacherWelcome").textContent="Welcome, "+name+"!";
  $("teacherAccountName").textContent=name;
  $("teacherAccountEmail").textContent=user&&user.email?user.email:"";
  populateTeacherTasks();
  renderTeacherLibrary();
  show("teacherHome");
}
function signOut(){
  localStorage.removeItem(USER_KEY);localStorage.removeItem(TOKEN_KEY);
  $("password").value="";$("loginMessage").textContent="";show("loginView");
}
function network(){
  $("net").textContent=navigator.onLine?"Online":"Offline mode";
  $("net").style.color=navigator.onLine?"#16834f":"#b36b17";
}
window.addEventListener("online",network);window.addEventListener("offline",network);network();

$("accountType").addEventListener("change",()=>{
  $("loginButton").textContent="Sign In";
});
$("loginForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const email=$("email").value.trim(),password=$("password").value;
  const role=$("accountType").value,button=$("loginButton"),message=$("loginMessage");
  if(!navigator.onLine){message.textContent="Connect to the internet to sign in.";return;}
  button.disabled=true;button.textContent="Signing in…";message.textContent="Checking your account…";
  try{
    const response=await fetch(AUTH_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,role})});
    const data=await response.json();
    if(!response.ok||!data.success||!data.user||!data.token)throw new Error(data.message||"Unable to sign in. Please try again.");
    if(data.user.role!==role)throw new Error("This account does not have the selected access type. Please choose the correct account type.");
    localStorage.setItem(TOKEN_KEY,data.token);localStorage.setItem(USER_KEY,JSON.stringify(data.user));
    $("password").value="";renderHome(data.user);
  }catch(error){message.textContent=error.message||"Connection error. Please try again.";}
  finally{button.disabled=false;button.textContent="Sign In";}
});
$("openAssistant").addEventListener("click",()=>show("assistantView"));
$("backHome").addEventListener("click",()=>renderHome(readUser()));
$("logoutButton").addEventListener("click",signOut);
$("teacherLogout").addEventListener("click",signOut);

function getLibrary(){try{return JSON.parse(localStorage.getItem("smartedu_library")||"[]");}catch(e){return [];}}
function saveLibrary(item){const items=getLibrary();items.unshift(item);localStorage.setItem("smartedu_library",JSON.stringify(items.slice(0,100)));renderLibrary();}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
function renderSavedItems(targetId,items,key){
  const target=$(targetId);if(!target)return;target.innerHTML="";
  if(!items.length){target.innerHTML='<p class="muted">No saved materials yet.</p>';return;}
  items.forEach((item,index)=>{
    const card=document.createElement("article");card.className="library-item";
    const heading=document.createElement("strong");heading.textContent=item.topic+" · "+item.task;
    const body=document.createElement("p");body.textContent=item.content;
    const open=document.createElement("button");open.textContent="Open";
    open.addEventListener("click",()=>{const win=window.open("","_blank");if(win){win.document.write("<meta name='viewport' content='width=device-width'><title>"+escapeHtml(item.topic)+"</title><h2>"+escapeHtml(item.topic)+"</h2><pre style='white-space:pre-wrap;font:16px system-ui'>"+escapeHtml(item.content)+"</pre>");win.document.close();}});
    const remove=document.createElement("button");remove.textContent="Delete";
    remove.addEventListener("click",()=>{const latest=JSON.parse(localStorage.getItem(key)||"[]");latest.splice(index,1);localStorage.setItem(key,JSON.stringify(latest));key==="smartedu_teacher_library"?renderTeacherLibrary():renderLibrary();});
    card.append(heading,body,open,remove);target.append(card);
  });
}
function renderLibrary(){renderSavedItems("library",getLibrary(),"smartedu_library");}
const TEACHER_TASKS={
  school:[
    ["lesson_note","Lesson note"],["scheme","Scheme of work"],["teaching_guide","Teaching guide"],["class_activity","Classroom activity"],["quiz","Quiz and answers"],["assessment","Class assessment and marking guide"],["revision","Revision material"],["summary","Summarise teaching material"]
  ],
  university:[
    ["lecture_note","University lecture note"],["tutorial","Tutorial guide"],["assignment","Course assignment"],["quiz","Quiz and answers"],["course_outline","Course outline and weekly teaching plan"],["assessment_rubric","Assessment rubric"],["marking_guide","Marking guide and model answer"],["student_feedback","Constructive feedback on student work"],["summary","Summarise course material"]
  ]
};
function populateTeacherTasks(){
  const track=$("teacherTrack").value,select=$("teacherTask");
  select.innerHTML=TEACHER_TASKS[track].map(t=>'<option value="'+t[0]+'">'+t[1]+'</option>').join("");
  $("teacherLevel").placeholder=track==="university"?"e.g. 200 Level, GST 101, EDU 305":"e.g. Primary 4, JSS 2, SS 3";
  $("teacherTopic").placeholder=track==="university"?"e.g. EDU 305, Cell Biology, GST 101":"e.g. Basic Science, Mathematics, Photosynthesis";
}
$("teacherTrack").addEventListener("change",populateTeacherTasks);
function getTeacherLibrary(){try{return JSON.parse(localStorage.getItem("smartedu_teacher_library")||"[]");}catch(e){return [];}}
function renderTeacherLibrary(){renderSavedItems("teacherLibrary",getTeacherLibrary(),"smartedu_teacher_library");}
$("teacherRefresh").addEventListener("click",renderTeacherLibrary);

async function requestAI(payload,messageEl,button,defaultText){
  if(!navigator.onLine){messageEl.textContent="You are offline. Reconnect to generate new AI content.";return;}
  if(!localStorage.getItem(TOKEN_KEY)){messageEl.textContent="Your session has expired. Please sign in again.";return;}
  button.disabled=true;button.textContent="Generating…";messageEl.textContent="Connecting securely to SmartEdu AI…";
  try{
    const response=await fetch(window.SMARTEDU_API_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+(localStorage.getItem(TOKEN_KEY)||"")},body:JSON.stringify(payload)});
    const data=await response.json();if(!response.ok||!data.success)throw new Error(data.message||"Generation failed.");
    return data;
  }catch(error){messageEl.textContent="Could not generate: "+(error.message||"Please try again.");return null;}
  finally{button.disabled=false;button.textContent=defaultText;}
}
$("generate").addEventListener("click",async()=>{
  const topic=$("topic").value.trim(),message=$("message"),button=$("generate");
  if(!topic){message.textContent="Please enter a topic or course.";return;}
  const data=await requestAI({action:"generate",role:"student",level:$("level").value,topic,task:$("task").value,extra:$("extra").value},message,button,"Generate with AI (online)");
  if(!data)return;
  saveLibrary({topic,role:"student",level:$("level").value,task:$("task").value,content:data.content,created:new Date().toISOString()});
  message.textContent="Generated and saved on this device. You can read it offline.";
  const win=window.open("","_blank");if(win){win.document.write("<meta name='viewport' content='width=device-width'><title>"+escapeHtml(topic)+"</title><h2>"+escapeHtml(topic)+"</h2><pre style='white-space:pre-wrap;font:16px system-ui'>"+escapeHtml(data.content)+"</pre>");win.document.close();}
});
$("teacherGenerate").addEventListener("click",async()=>{
  const topic=$("teacherTopic").value.trim(),message=$("teacherMessage"),button=$("teacherGenerate");
  if(!topic){message.textContent="Please enter a subject, course or topic.";return;}
  const track=$("teacherTrack").value,task=$("teacherTask").value;
  const data=await requestAI({action:"generate",level:$("teacherLevel").value.trim()|| (track==="university"?"University level":"School level"),topic,task,teacher_track:track,extra:$("teacherExtra").value},message,button,"Generate teaching material");
  if(!data)return;
  const items=getTeacherLibrary();items.unshift({topic,track,task,content:data.content,provider:data.provider||"",model:data.model||"",created:new Date().toISOString()});
  localStorage.setItem("smartedu_teacher_library",JSON.stringify(items.slice(0,100)));renderTeacherLibrary();
  message.textContent="Teaching material generated and saved on this device.";
  const win=window.open("","_blank");if(win){win.document.write("<meta name='viewport' content='width=device-width'><title>"+escapeHtml(topic)+"</title><h2>"+escapeHtml(topic)+"</h2><pre style='white-space:pre-wrap;font:16px system-ui'>"+escapeHtml(data.content)+"</pre>");win.document.close();}
});
$("refresh").addEventListener("click",renderLibrary);renderLibrary();populateTeacherTasks();
const savedUser=readUser(),savedToken=localStorage.getItem(TOKEN_KEY);
if(savedUser&&savedToken&&(savedUser.role==="student"||savedUser.role==="teacher"))renderHome(savedUser);else show("loginView");
