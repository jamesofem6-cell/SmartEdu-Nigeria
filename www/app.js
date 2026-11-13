const $ = id => document.getElementById(id);
const AUTH_URL = "https://smartedu.yutendala.ng/api/login.php";
const USER_KEY = "smartedu_mobile_user";
const TOKEN_KEY = "smartedu_mobile_token";

function show(view) {
  ["loginView", "studentHome", "assistantView"].forEach(id => {
    $(id).hidden = id !== view;
  });
  window.scrollTo(0, 0);
}

function readUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
  catch (e) { return null; }
}

function renderHome(user) {
  const name = user && user.full_name ? user.full_name : "Student";
  $("welcomeName").textContent = "Welcome, " + name + "!";
  $("accountName").textContent = name;
  $("accountEmail").textContent = user && user.email ? user.email : "";
  show("studentHome");
}

function signOut() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  $("password").value = "";
  $("loginMessage").textContent = "";
  show("loginView");
}

function network() {
  $("net").textContent = navigator.onLine ? "Online" : "Offline mode";
  $("net").style.color = navigator.onLine ? "#16834f" : "#b36b17";
}
window.addEventListener("online", network);
window.addEventListener("offline", network);
network();

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  const button = $("loginButton");
  const message = $("loginMessage");

  if (!navigator.onLine) {
    message.textContent = "Connect to the internet to sign in.";
    return;
  }

  button.disabled = true;
  button.textContent = "Signing in…";
  message.textContent = "Checking your account…";

  try {
    const response = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role: "student" })
    });

    const data = await response.json();
    if (!response.ok || !data.success || !data.user || !data.token) {
      throw new Error(data.message || "Unable to sign in. Please try again.");
    }

    // Keep the API bearer token and profile on this device.
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    $("password").value = "";
    renderHome(data.user);
  } catch (error) {
    message.textContent = error.message || "Connection error. Please try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Sign In as Student";
  }
});

$("openAssistant").addEventListener("click", () => show("assistantView"));
$("backHome").addEventListener("click", () => renderHome(readUser()));
$("logoutButton").addEventListener("click", signOut);

// AI learning assistant and offline library.
function getLibrary() {
  try { return JSON.parse(localStorage.getItem("smartedu_library") || "[]"); }
  catch (e) { return []; }
}
function saveLibrary(item) {
  const items = getLibrary();
  items.unshift(item);
  localStorage.setItem("smartedu_library", JSON.stringify(items.slice(0, 100)));
  renderLibrary();
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function renderLibrary() {
  const target = $("library");
  if (!target) return;
  const items = getLibrary();
  target.innerHTML = "";
  if (!items.length) {
    target.innerHTML = '<p class="muted">No saved materials yet.</p>';
    return;
  }
  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "library-item";
    const heading = document.createElement("strong");
    heading.textContent = item.topic + " · " + item.role;
    const body = document.createElement("p");
    body.textContent = item.content;
    const open = document.createElement("button");
    open.textContent = "Open";
    open.addEventListener("click", () => {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write("<meta name='viewport' content='width=device-width'><title>" +
          escapeHtml(item.topic) + "</title><h2>" + escapeHtml(item.topic) +
          "</h2><pre style='white-space:pre-wrap;font:16px system-ui'>" +
          escapeHtml(item.content) + "</pre>");
        win.document.close();
      }
    });
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      const latest = getLibrary();
      latest.splice(index, 1);
      localStorage.setItem("smartedu_library", JSON.stringify(latest));
      renderLibrary();
    });
    card.append(heading, body, open, remove);
    target.append(card);
  });
}

$("generate").addEventListener("click", async () => {
  if (!navigator.onLine) {
    $("message").textContent = "You are offline. Reconnect to generate new AI content.";
    return;
  }
  const topic = $("topic").value.trim();
  if (!topic) {
    $("message").textContent = "Please enter a topic or course.";
    return;
  }

  const button = $("generate");
  button.disabled = true;
  button.textContent = "Generating…";
  $("message").textContent = "Connecting securely to SmartEdu AI…";

  try {
    const response = await fetch(window.SMARTEDU_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generate",
        role: "student",
        level: $("level").value,
        topic,
        task: $("task").value,
        extra: $("extra").value
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Generation failed.");
    }

    saveLibrary({
      topic,
      role: "student",
      level: $("level").value,
      task: $("task").value,
      content: data.content,
      created: new Date().toISOString()
    });
    $("message").textContent = "Generated and saved on this device. You can read it offline.";
    const win = window.open("", "_blank");
    if (win) {
      win.document.write("<meta name='viewport' content='width=device-width'><title>" +
        escapeHtml(topic) + "</title><h2>" + escapeHtml(topic) +
        "</h2><pre style='white-space:pre-wrap;font:16px system-ui'>" +
        escapeHtml(data.content) + "</pre>");
      win.document.close();
    }
  } catch (error) {
    $("message").textContent = "Could not generate: " + error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Generate with AI (online)";
  }
});

$("refresh").addEventListener("click", renderLibrary);
renderLibrary();

// A saved session returns the student directly to Student Home.
const savedUser = readUser();
const savedToken = localStorage.getItem(TOKEN_KEY);
if (savedUser && savedToken && savedUser.role === "student") {
  renderHome(savedUser);
} else {
  show("loginView");
}
