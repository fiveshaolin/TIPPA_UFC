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
  if (el) el.textContent = message;
  console.log(message);
}

function getStoredItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error("localStorage get error:", e);
    return null;
  }
}

function setStoredItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error("localStorage set error:", e);
    return false;
  }
}

function initSupabase() {
  try {
    const savedUrl = getStoredItem("supabase_url");
    const savedKey = getStoredItem("supabase_key");

    if (savedUrl) urlInput.value = savedUrl;
    if (savedKey) keyInput.value = savedKey;

    if (!savedUrl || !savedKey) {
      setStatus(configStatus, "Klistra in Project URL och Publishable key.");
      return;
    }

    if (!window.supabase) {
      setStatus(configStatus, "Supabase-biblioteket laddades inte.");
      return;
    }

    const { createClient } = window.supabase;
    supabase = createClient(savedUrl, savedKey);

    setStatus(configStatus, "Supabase anslutning sparad.");
    refreshSession();
  } catch (err) {
    console.error(err);
    setStatus(configStatus, "Fel vid initiering: " + err.message);
  }
}

async function refreshSession() {
  try {
    if (!supabase) {
      sessionBox.textContent = "Ingen aktiv session.";
      return;
    }

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

    sessionBox.textContent = JSON.stringify(
      {
        user_id: data.session.user.id,
        email: data.session.user.email
      },
      null,
      2
    );

    setStatus(authStatus, "Inloggad som " + data.session.user.email);
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Sessionsfel: " + err.message);
  }
}

saveConfigBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();
  const key = keyInput.value.trim();

  if (!url || !key) {
    setStatus(configStatus, "Fyll i både Project URL och Publishable key.");
    return;
  }

  const ok1 = setStoredItem("supabase_url", url);
  const ok2 = setStoredItem("supabase_key", key);

  if (!ok1 || !ok2) {
    setStatus(configStatus, "Kunde inte spara lokalt i webbläsaren.");
    return;
  }

  initSupabase();
});

signUpBtn.addEventListener("click", async () => {
  try {
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

    setStatus(authStatus, "Konto skapat: " + (data.user?.email || ""));
    refreshSession();
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Signup exception: " + err.message);
  }
});

signInBtn.addEventListener("click", async () => {
  try {
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
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Login exception: " + err.message);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    if (!supabase) {
      setStatus(authStatus, "Ingen Supabase-klient aktiv.");
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      setStatus(authStatus, "Logout fel: " + error.message);
      return;
    }

    sessionBox.textContent = "Ingen aktiv session.";
    setStatus(authStatus, "Utloggad.");
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Logout exception: " + err.message);
  }
});

initSupabase();
