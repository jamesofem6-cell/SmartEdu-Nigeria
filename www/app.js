const $ = id => document.getElementById(id);
const API = window.SMARTEDU_API_BASE;
let currentProjectId = null;
let currentChapters = [];

function message(id, text, type = "") {
  const el = $(id);
  el.textContent = text || "";
  el.className = "message " + type;
}

function setNetwork() {
  $("network").textContent = navigator.onLine ? "Online" : "Offline";
  $("network").classList.toggle("offline", !navigator.onLine);
}
window.addEventListener("online", setNetwork);
window.addEventListener("offline", setNetwork);
setNetwork();

function token() {
  return localStorage.getItem("smartedu_token") || "";
}

async function api(endpoint, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (token()) headers.Authorization = "Bearer " + token();
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const response = await fetch(API + "/" + endpoint, {
    cache: "no-store",
    ...options,
    headers
  });

  let data;
  try { data = await response.json(); }
  catch (_) { throw new Error("The server returned an unreadable response."); }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "The request could not be completed.");
  }
  return data;
}

function showLogin() {
  $("login-screen").hidden = false;
  $("app-screen").hidden = true;
}

function showApp() {
  $("login-screen").hidden = true;
  $("app-screen").hidden = false;
}

function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.hidden = true);
  $(name + "-view").hidden = false;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === name));
}

async function loadDashboard() {
  const data = await api("dashboard.php");
  const profile = data.profile || {};
  const summary = data.summary || {};

  $("welcome-name").textContent = "Welcome, " + (profile.full_name || "SmartEdu user");
  $("profile-line").textContent = (profile.email || "") + " • " + (profile.role || "");

  if (profile.role === "student") {
    $("student-nav").hidden = false;
    $("teacher-nav").hidden = true;
    $("stat-one-label").textContent = "Total projects";
    $("stat-one").textContent = summary.total_projects ?? 0;
    $("stat-two-label").textContent = "Completed projects";
    $("stat-two").textContent = summary.completed_projects ?? 0;
    $("stat-three-label").textContent = "Completed chapters";
    $("stat-three").textContent = summary.completed_chapters ?? 0;
    $("overview-title").textContent = "Your university project support";
    $("overview-message").textContent = "Open My projects to continue your registered research project, prepare your proposal and work on your chapters.";
  } else {
    $("student-nav").hidden = true;
    $("teacher-nav").hidden = false;
    $("stat-one-label").textContent = "Teaching resources";
    $("stat-one").textContent = summary.total_resources ?? 0;
    $("stat-two-label").textContent = "Account";
    $("stat-two").textContent = "Active";
    $("stat-three-label").textContent = "Workspace";
    $("stat-three").textContent = "Teacher";
    $("overview-title").textContent = "Teacher workspace";
    $("overview-message").textContent = "Teacher note formulation and teaching guides remain separate from university research and project support.";
  }
}

async function loadProjects() {
  message("projects-message", "Loading your projects...");
  $("projects-list").replaceChildren();
  try {
    const data = await api("student-projects.php");
    const projects = Array.isArray(data.projects) ? data.projects : [];
    if (!projects.length) {
      message("projects-message", "No registered projects were found on this account.");
      return;
    }
    projects.forEach(project => {
      const card = document.createElement("article");
      card.className = "project-card";
      const title = document.createElement("h3");
      title.textContent = project.project_title || "Untitled project";
      const details = document.createElement("p");
      details.textContent = [project.institution, project.department, project.status].filter(Boolean).join(" • ");
      const open = document.createElement("button");
      open.className = "primary";
      open.type = "button";
      open.textContent = "Open project workspace";
      open.addEventListener("click", () => openWorkspace(project.id, project));
      card.append(title, details, open);
      $("projects-list").append(card);
    });
    message("projects-message", projects.length + " project(s) loaded.", "success");
  } catch (error) {
    message("projects-message", error.message, "error");
  }
}

async function openWorkspace(projectId, project) {
  currentProjectId = Number(projectId);
  showView("workspace");
  $("workspace-title").textContent = project.project_title || "Project workspace";
  $("workspace-meta").textContent = [project.institution, project.department, project.project_type].filter(Boolean).join(" • ");
  $("chapter-select").replaceChildren();
  $("chapter-content").value = "";
  message("chapter-message", "Loading project workspace...");
  try {
    const data = await api("project-workspace.php?project_id=" + encodeURIComponent(currentProjectId));
    currentChapters = Array.isArray(data.chapters) ? data.chapters : [];
    currentChapters.sort((a,b) => Number(a.chapter_number) - Number(b.chapter_number));
    currentChapters.forEach(chapter => {
      const option = document.createElement("option");
      option.value = String(chapter.chapter_number);
      option.textContent = "Chapter " + chapter.chapter_number + ": " + (chapter.chapter_title || "");
      $("chapter-select").append(option);
    });
    $("preparation-status").textContent = data.preparation
      ? "Research preparation record loaded. Detailed editing tools are being added."
      : "Research preparation has not yet been started.";
    loadSelectedChapter();
    message("chapter-message", "Workspace loaded.", "success");
  } catch (error) {
    message("chapter-message", error.message, "error");
  }
}

function loadSelectedChapter() {
  const number = Number($("chapter-select").value);
  const chapter = currentChapters.find(c => Number(c.chapter_number) === number);
  $("chapter-content").value = chapter?.draft_content || "";
  $("chapter-status").value = chapter?.chapter_status || "not_started";
}

$("chapter-select").addEventListener("change", loadSelectedChapter);

$("save-chapter").addEventListener("click", async () => {
  if (!currentProjectId) return;
  const button = $("save-chapter");
  button.disabled = true;
  message("chapter-message", "Saving chapter...");
  try {
    await api("save-chapter.php", {
      method: "POST",
      body: JSON.stringify({
        project_id: currentProjectId,
        chapter_number: Number($("chapter-select").value),
        draft_content: $("chapter-content").value,
        chapter_status: $("chapter-status").value
      })
    });
    const chapter = currentChapters.find(c => Number(c.chapter_number) === Number($("chapter-select").value));
    if (chapter) {
      chapter.draft_content = $("chapter-content").value;
      chapter.chapter_status = $("chapter-status").value;
    }
    message("chapter-message", "Chapter draft saved successfully.", "success");
  } catch (error) {
    message("chapter-message", error.message, "error");
  } finally {
    button.disabled = false;
  }
});

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("login-button");
  button.disabled = true;
  button.textContent = "Signing in...";
  message("login-message", "Connecting securely to SmartEdu...");
  try {
    const data = await api("login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: $("email").value.trim(),
        password: $("password").value,
        role: $("role").value
      })
    });
    if (!data.token) throw new Error("Login succeeded but no session token was returned.");
    localStorage.setItem("smartedu_token", data.token);
    $("password").value = "";
    showApp();
    await loadDashboard();
    showView("overview");
  } catch (error) {
    message("login-message", error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});

$("logout-button").addEventListener("click", async () => {
  try { if (token()) await api("logout.php", { method: "POST" }); }
  catch (_) { /* Clear this device's session even if the network is unavailable. */ }
  localStorage.removeItem("smartedu_token");
  showLogin();
  message("login-message", "You have signed out.", "success");
});

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
    if (button.dataset.view === "projects") loadProjects();
  });
});

$("reload-projects").addEventListener("click", loadProjects);
$("back-projects").addEventListener("click", () => {
  showView("projects");
  loadProjects();
});

async function start() {
  if (!token()) { showLogin(); return; }
  showApp();
  try {
    await loadDashboard();
    showView("overview");
  } catch (error) {
    localStorage.removeItem("smartedu_token");
    showLogin();
    message("login-message", "Please sign in again. " + error.message, "error");
  }
}
start();
