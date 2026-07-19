let supabase = null;

const urlInput = document.getElementById("supabase-url");
const keyInput = document.getElementById("supabase-key");
const saveConfigBtn = document.getElementById("save-config");
const configStatus = document.getElementById("config-status");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signUpBtn = document.getElementById("sign-up");
const signInBtn = document.getElementById("sign-in");
const signOutBtn = document.getElementById("sign-out");
const authStatus = document.getElementById("auth-status");
const sessionBox = document.getElementById("session-box");

function setStatus(el, message) {
  el.textContent = message;
}

function initSupabase() {
  const savedUrl = localStorage.getItem("supabase_url");
  const savedKey = localStorage.getItem("supabase_key");

  if (!savedUrl || !savedKey) {
    setStatus(configStatus, "Klistra in Project URL och Publishable key.");
    return;
  }

  urlInput.value = savedUrl;
  keyInput.value = savedKey;

  supabase = window.supabase.createClient(savedUrl, savedKey);
  setStatus(configStatus, "Supabase anslutning sparad.");
  refreshSession();
}

async function refreshSession() {
  if (!supabase) return;

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    setStatus(authStatus, "Kunde inte läsa session: " + error.message);
    sessionBox.textContent = "Ingen aktiv session.";
    return;
  }

  if (!data.session) {
    sessionBox.textContent = "Ingen aktiv session.";
    setStatus(authStatus, "Inte inloggad.");
    return;
  }

  sessionBox.textContent = JSON.stringify({
    user_id: data.session.user.id,
    email: data.session.user.email
  }, null, 2);

  setStatus(authStatus, "Inloggad som " + data.session.user.email);
}

saveConfigBtn.addEventListener("click", () => {
  localStorage.setItem("supabase_url", urlInput.value.trim());
  localStorage.setItem("supabase_key", keyInput.value.trim());
  initSupabase();
});

signUpBtn.addEventListener("click", async () => {
  if (!supabase) {
    setStatus(authStatus, "Spara Supabase-anslutning först.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    setStatus(authStatus, "Signup fel: " + error.message);
    return;
  }

  setStatus(authStatus, "Konto skapat. Kontrollera ev. verifieringsmail. " + (data.user?.email || ""));
  refreshSession();
});

signInBtn.addEventListener("click", async () => {
  if (!supabase) {
    setStatus(authStatus, "Spara Supabase-anslutning först.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setStatus(authStatus, "Login fel: " + error.message);
    return;
  }

  setStatus(authStatus, "Inloggning lyckades.");
  refreshSession();
});

signOutBtn.addEventListener("click", async () => {
  if (!supabase) {
    setStatus(authStatus, "Ingen Supabase-klient aktiv.");
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    setStatus(authStatus, "Logout fel: " + error.message);
    return;
  }

  setStatus(authStatus, "Utloggad.");
  refreshSession();
});

initSupabase();
