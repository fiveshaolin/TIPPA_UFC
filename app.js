let supabaseClient = null;

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

const loadDataBtn = document.getElementById("load-data");
const dataStatus = document.getElementById("data-status");
const userBox = document.getElementById("user-box");
const groupBox = document.getElementById("group-box");
const eventBox = document.getElementById("event-box");
const fightsBox = document.getElementById("fights-box");

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
    supabaseClient = createClient(savedUrl, savedKey);

    setStatus(configStatus, "Supabase anslutning sparad.");
    refreshSession();
  } catch (err) {
    console.error(err);
    setStatus(configStatus, "Fel vid initiering: " + err.message);
  }
}

async function refreshSession() {
  try {
    if (!supabaseClient) {
      sessionBox.textContent = "Ingen aktiv session.";
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      setStatus(authStatus, "Kunde inte läsa session: " + error.message);
      sessionBox.textContent = "Ingen aktiv session.";
      return null;
    }

    if (!data.session) {
      sessionBox.textContent = "Ingen aktiv session.";
      setStatus(authStatus, "Inte inloggad.");
      return null;
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
    return data.session;
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Sessionsfel: " + err.message);
    return null;
  }
}

async function loadAppData() {
  try {
    if (!supabaseClient) {
      setStatus(dataStatus, "Spara Supabase-anslutning först.");
      return;
    }

    const session = await refreshSession();
    if (!session) {
      setStatus(dataStatus, "Du måste vara inloggad.");
      return;
    }

    userBox.textContent = JSON.stringify(
      {
        id: session.user.id,
        email: session.user.email
      },
      null,
      2
    );

    const { data: groups, error: groupsError } = await supabaseClient
      .from("groups")
      .select("*")
      .limit(1);

    if (groupsError) {
      setStatus(dataStatus, "Fel vid hämtning av grupp: " + groupsError.message);
      return;
    }

    const group = groups?.[0] || null;
    groupBox.textContent = group ? JSON.stringify(group, null, 2) : "Ingen grupp hittad.";

    const { data: events, error: eventsError } = await supabaseClient
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .limit(1);

    if (eventsError) {
      setStatus(dataStatus, "Fel vid hämtning av event: " + eventsError.message);
      return;
    }

    const event = events?.[0] || null;
    eventBox.textContent = event ? JSON.stringify(event, null, 2) : "Inget event hittat.";

    if (!event) {
      fightsBox.innerHTML = "Inga matcher hittades.";
      setStatus(dataStatus, "Ingen eventdata att ladda matcher från.");
      return;
    }

    const { data: fights, error: fightsError } = await supabaseClient
      .from("fights")
      .select("*")
      .eq("event_id", event.id)
      .eq("is_main_card", true)
      .order("bout_order", { ascending: true });

    if (fightsError) {
      setStatus(dataStatus, "Fel vid hämtning av matcher: " + fightsError.message);
      return;
    }

    if (!fights || fights.length === 0) {
      fightsBox.innerHTML = "Inga main-card matcher hittades.";
      setStatus(dataStatus, "Data laddad, men inga matcher hittades.");
      return;
    }

    fightsBox.innerHTML = fights
      .map(
        (fight) => `
          <div class="fight-item">
            <strong>Match ${fight.bout_order}:</strong><br>
            ${fight.fighter_a} vs ${fight.fighter_b}
          </div>
        `
      )
      .join("");

    setStatus(dataStatus, "Appdata laddad.");
  } catch (err) {
    console.error(err);
    setStatus(dataStatus, "Oväntat fel: " + err.message);
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
    if (!supabaseClient) {
      setStatus(authStatus, "Spara Supabase-anslutning först.");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    const { data, error } = await supabaseClient.auth.signUp({
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
    if (!supabaseClient) {
      setStatus(authStatus, "Spara Supabase-anslutning först.");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    const { error } = await supabaseClient.auth.signInWithPassword({
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
    if (!supabaseClient) {
      setStatus(authStatus, "Ingen Supabase-klient aktiv.");
      return;
    }

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      setStatus(authStatus, "Logout fel: " + error.message);
      return;
    }

    sessionBox.textContent = "Ingen aktiv session.";
    userBox.textContent = "Ingen data ännu.";
    groupBox.textContent = "Ingen data ännu.";
    eventBox.textContent = "Ingen data ännu.";
    fightsBox.innerHTML = "Ingen data ännu.";
    setStatus(authStatus, "Utloggad.");
    setStatus(dataStatus, "");
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Logout exception: " + err.message);
  }
});

loadDataBtn.addEventListener("click", loadAppData);

initSupabase();
