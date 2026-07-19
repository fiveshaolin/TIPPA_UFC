let supabaseClient = null;
let currentSession = null;
let currentGroup = null;
let currentEvent = null;
let currentFights = [];
let currentOwnPicks = [];
let currentRevealOpen = false;

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

const newPasswordInput = document.getElementById("new-password");
const changePasswordBtn = document.getElementById("change-password");
const passwordStatus = document.getElementById("password-status");

const sessionBox = document.getElementById("session-box");

const loadDataBtn = document.getElementById("load-data");
const submitAllBtn = document.getElementById("submit-all");
const dataStatus = document.getElementById("data-status");
const submissionStatus = document.getElementById("submission-status");
const revealStatus = document.getElementById("reveal-status");
const userBox = document.getElementById("user-box");
const groupBox = document.getElementById("group-box");
const eventBox = document.getElementById("event-box");
const fightsBox = document.getElementById("fights-box");

const othersStatus = document.getElementById("others-status");
const othersPicksBox = document.getElementById("others-picks-box");

function setStatus(el, message) {
  if (el) el.textContent = message;
  console.log(message);
}

function getStoredItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(e);
    return null;
  }
}

function setStoredItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error(e);
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
      currentSession = null;
      return null;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(error);
      setStatus(authStatus, "Kunde inte läsa session: " + error.message);
      sessionBox.textContent = "Ingen aktiv session.";
      currentSession = null;
      return null;
    }

    if (!data.session) {
      sessionBox.textContent = "Ingen aktiv session.";
      setStatus(authStatus, "Inte inloggad.");
      currentSession = null;
      return null;
    }

    currentSession = data.session;
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

function renderPickForm(fight, existingPick) {
  const selectedWinner = existingPick?.picked_winner || "";
  const selectedMethod = existingPick?.method || "";
  const selectedRound = existingPick?.round_number || "";
  const selectedDecision = existingPick?.decision_type || "";

  return `
    <div class="fight-item">
      <div class="fight-title"><strong>Match ${fight.bout_order}:</strong> ${fight.fighter_a} vs ${fight.fighter_b}</div>

      <label>
        Vinnare
        <select data-fight-id="${fight.id}" data-field="picked_winner">
          <option value="">Välj vinnare</option>
          <option value="${fight.fighter_a}" ${selectedWinner === fight.fighter_a ? "selected" : ""}>${fight.fighter_a}</option>
          <option value="${fight.fighter_b}" ${selectedWinner === fight.fighter_b ? "selected" : ""}>${fight.fighter_b}</option>
        </select>
      </label>

      <label>
        Metod
        <select data-fight-id="${fight.id}" data-field="method" class="method-select">
          <option value="">Välj metod</option>
          <option value="ko_tko" ${selectedMethod === "ko_tko" ? "selected" : ""}>KO/TKO</option>
          <option value="sub" ${selectedMethod === "sub" ? "selected" : ""}>Submission</option>
          <option value="decision" ${selectedMethod === "decision" ? "selected" : ""}>Decision</option>
        </select>
      </label>

      <label class="round-wrapper" data-fight-id="${fight.id}" style="${selectedMethod === "ko_tko" || selectedMethod === "sub" ? "" : "display:none;"}">
        Rond
        <select data-fight-id="${fight.id}" data-field="round_number">
          <option value="">Välj rond</option>
          <option value="1" ${String(selectedRound) === "1" ? "selected" : ""}>1</option>
          <option value="2" ${String(selectedRound) === "2" ? "selected" : ""}>2</option>
          <option value="3" ${String(selectedRound) === "3" ? "selected" : ""}>3</option>
          <option value="4" ${String(selectedRound) === "4" ? "selected" : ""}>4</option>
          <option value="5" ${String(selectedRound) === "5" ? "selected" : ""}>5</option>
        </select>
      </label>

      <label class="decision-wrapper" data-fight-id="${fight.id}" style="${selectedMethod === "decision" ? "" : "display:none;"}">
        Decision
        <select data-fight-id="${fight.id}" data-field="decision_type">
          <option value="">Välj decision</option>
          <option value="unanimous" ${selectedDecision === "unanimous" ? "selected" : ""}>Unanimous</option>
          <option value="split" ${selectedDecision === "split" ? "selected" : ""}>Split</option>
        </select>
      </label>

      <button class="save-pick-btn" data-fight-id="${fight.id}">Spara pick</button>
      <p class="pick-status" id="pick-status-${fight.id}"></p>
    </div>
  `;
}

function attachFightFormEvents() {
  document.querySelectorAll(".method-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      const fightId = event.target.dataset.fightId;
      const method = event.target.value;

      const roundWrapper = document.querySelector('.round-wrapper[data-fight-id="' + fightId + '"]');
      const decisionWrapper = document.querySelector('.decision-wrapper[data-fight-id="' + fightId + '"]');

      if (method === "ko_tko" || method === "sub") {
        roundWrapper.style.display = "block";
        decisionWrapper.style.display = "none";
      } else if (method === "decision") {
        roundWrapper.style.display = "none";
        decisionWrapper.style.display = "block";
      } else {
        roundWrapper.style.display = "none";
        decisionWrapper.style.display = "none";
      }
    });
  });

  document.querySelectorAll(".save-pick-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      await savePick(event.target.dataset.fightId);
    });
  });
}

async function hasSubmittedCurrentEvent() {
  const { data, error } = await supabaseClient
    .from("event_submissions")
    .select("*")
    .eq("user_id", currentSession.user.id)
    .eq("group_id", currentGroup.id)
    .eq("event_id", currentEvent.id)
    .limit(1);

  if (error) {
    console.error(error);
    return false;
  }

  return !!(data && data.length > 0);
}

async function savePick(fightId) {
  try {
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent) return;

    if (await hasSubmittedCurrentEvent()) {
      const statusEl = document.getElementById("pick-status-" + fightId);
      if (statusEl) statusEl.textContent = "Du har redan skickat in dina picks.";
      return;
    }

    const winnerEl = document.querySelector('[data-fight-id="' + fightId + '"][data-field="picked_winner"]');
    const methodEl = document.querySelector('[data-fight-id="' + fightId + '"][data-field="method"]');
    const roundEl = document.querySelector('[data-fight-id="' + fightId + '"][data-field="round_number"]');
    const decisionEl = document.querySelector('[data-fight-id="' + fightId + '"][data-field="decision_type"]');
    const statusEl = document.getElementById("pick-status-" + fightId);

    const winner = winnerEl ? winnerEl.value : "";
    const method = methodEl ? methodEl.value : "";
    const roundNumberValue = roundEl ? roundEl.value : "";
    const decisionType = decisionEl ? decisionEl.value : "";

    if (!winner || !method) {
      statusEl.textContent = "Välj vinnare och metod.";
      return;
    }

    if ((method === "ko_tko" || method === "sub") && !roundNumberValue) {
      statusEl.textContent = "Välj rond.";
      return;
    }

    if (method === "decision" && !decisionType) {
      statusEl.textContent = "Välj decision-typ.";
      return;
    }

    const payload = {
      user_id: currentSession.user.id,
      group_id: currentGroup.id,
      event_id: currentEvent.id,
      fight_id: fightId,
      picked_winner: winner,
      method: method,
      round_number: method === "decision" ? null : Number(roundNumberValue),
      decision_type: method === "decision" ? decisionType : null
    };

    const { error } = await supabaseClient
      .from("picks")
      .upsert(payload, { onConflict: "user_id,group_id,event_id,fight_id" });

    if (error) {
      console.error(error);
      statusEl.textContent = "Fel vid sparande: " + error.message;
      return;
    }

    statusEl.textContent = "Pick sparad.";
  } catch (err) {
    console.error(err);
  }
}

async function loadSubmissionState() {
  const { count: memberCount, error: memberError } = await supabaseClient
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", currentGroup.id);

  if (memberError) {
    console.error(memberError);
    setStatus(submissionStatus, "Fel vid hämtning av medlemmar: " + memberError.message);
    return;
  }

  const { count: submittedCount, error: submittedError } = await supabaseClient
    .from("event_submissions")
    .select("*", { count: "exact", head: true })
    .eq("group_id", currentGroup.id)
    .eq("event_id", currentEvent.id);

  if (submittedError) {
    console.error(submittedError);
    setStatus(submissionStatus, "Fel vid hämtning av submissions: " + submittedError.message);
    return;
  }

  const ownSubmitted = await hasSubmittedCurrentEvent();

  setStatus(
    submissionStatus,
    (submittedCount || 0) + " av " + (memberCount || 0) + " har skickat in. Du är " + (ownSubmitted ? "klar" : "inte klar") + "."
  );

  currentRevealOpen = (memberCount || 0) > 0 && submittedCount === memberCount;

  setStatus(
    revealStatus,
    currentRevealOpen ? "Alla har skickat in. Picks är nu synliga." : "Picks är dolda tills alla skickat in."
  );
}

async function loadOtherUsersPicks() {
  if (!currentRevealOpen) {
    othersStatus.textContent = "Dolda tills alla skickat in.";
    othersPicksBox.innerHTML = "Inget att visa ännu.";
    return;
  }

  const { data, error } = await supabaseClient
    .from("picks")
    .select("*")
    .eq("group_id", currentGroup.id)
    .eq("event_id", currentEvent.id)
    .order("fight_id", { ascending: true });

  if (error) {
    console.error(error);
    othersStatus.textContent = "Fel vid hämtning av andras picks: " + error.message;
    return;
  }

  const grouped = {};
  (data || []).forEach((pick) => {
    if (!grouped[pick.user_id]) grouped[pick.user_id] = [];
    grouped[pick.user_id].push(pick);
  });

  const userIds = Object.keys(grouped);

  if (!userIds.length) {
    othersStatus.textContent = "Inga picks hittades.";
    othersPicksBox.innerHTML = "Inget att visa ännu.";
    return;
  }

  let html = "";

  userIds.forEach((userId) => {
    let picksHtml = "";

    grouped[userId].forEach((pick) => {
      const fight = currentFights.find((f) => f.id === pick.fight_id);
      let details = "";

      if (pick.method === "decision") {
        details = "Decision (" + pick.decision_type + ")";
      } else if (pick.method === "ko_tko") {
        details = "KO/TKO rond " + pick.round_number;
      } else if (pick.method === "sub") {
        details = "Submission rond " + pick.round_number;
      } else {
        details = pick.method;
      }

      picksHtml += "<li>" +
        (fight ? (fight.fighter_a + " vs " + fight.fighter_b) : pick.fight_id) +
        ": " + pick.picked_winner + " via " + details +
        "</li>";
    });

    html += '<div class="fight-item"><strong>' + userId + '</strong><ul>' + picksHtml + '</ul></div>';
  });

  othersStatus.textContent = "Alla picks är nu visade.";
  othersPicksBox.innerHTML = html;
}

async function submitAllPicks() {
  try {
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent) {
      setStatus(dataStatus, "Ladda appdata först.");
      return;
    }

    const ownSubmitted = await hasSubmittedCurrentEvent();
    if (ownSubmitted) {
      setStatus(dataStatus, "Du har redan skickat in alla picks.");
      await loadSubmissionState();
      return;
    }

    const { data: ownPicks, error: ownPicksError } = await supabaseClient
      .from("picks")
      .select("*")
      .eq("user_id", currentSession.user.id)
      .eq("group_id", currentGroup.id)
      .eq("event_id", currentEvent.id);

    if (ownPicksError) {
      console.error(ownPicksError);
      setStatus(dataStatus, "Fel vid kontroll av picks: " + ownPicksError.message);
      return;
    }

    currentOwnPicks = ownPicks || [];

    if (currentOwnPicks.length !== currentFights.length) {
      setStatus(dataStatus, "Du måste spara picks för alla matcher först. Klart: " + currentOwnPicks.length + "/" + currentFights.length);
      return;
    }

    const { error } = await supabaseClient
      .from("event_submissions")
      .upsert(
        {
          user_id: currentSession.user.id,
          group_id: currentGroup.id,
          event_id: currentEvent.id
        },
        { onConflict: "user_id,group_id,event_id" }
      );

    if (error) {
      console.error(error);
      setStatus(dataStatus, "Fel vid submit: " + error.message);
      return;
    }

    setStatus(dataStatus, "Alla picks skickades in.");
    await loadSubmissionState();
    await loadOtherUsersPicks();
  } catch (err) {
    console.error(err);
    setStatus(dataStatus, "Oväntat submit-fel: " + err.message);
  }
}

async function changePassword() {
  try {
    if (!supabaseClient) {
      setStatus(passwordStatus, "Spara Supabase-anslutning först.");
      return;
    }

    const session = await refreshSession();
    if (!session) {
      setStatus(passwordStatus, "Du måste vara inloggad.");
      return;
    }

    const newPassword = newPasswordInput.value.trim();

    if (newPassword.length < 6) {
      setStatus(passwordStatus, "Lösenordet måste vara minst 6 tecken.");
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
      console.error(error);
      setStatus(passwordStatus, "Fel vid lösenordsbyte: " + error.message);
      return;
    }

    setStatus(passwordStatus, "Lösenordet är uppdaterat.");
    newPasswordInput.value = "";
  } catch (err) {
    console.error(err);
    setStatus(passwordStatus, "Oväntat fel: " + err.message);
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

    const groupsResult = await supabaseClient.from("groups").select("*").limit(1);
    if (groupsResult.error) {
      console.error(groupsResult.error);
      setStatus(dataStatus, "Fel vid hämtning av grupp: " + groupsResult.error.message);
      return;
    }

    currentGroup = groupsResult.data && groupsResult.data.length ? groupsResult.data[0] : null;
    groupBox.textContent = currentGroup ? JSON.stringify(currentGroup, null, 2) : "Ingen grupp hittad.";

    const eventsResult = await supabaseClient
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .limit(1);

    if (eventsResult.error) {
      console.error(eventsResult.error);
      setStatus(dataStatus, "Fel vid hämtning av event: " + eventsResult.error.message);
      return;
    }

    currentEvent = eventsResult.data && eventsResult.data.length ? eventsResult.data[0] : null;
    eventBox.textContent = currentEvent ? JSON.stringify(currentEvent, null, 2) : "Inget event hittat.";

    if (!currentGroup) {
      fightsBox.innerHTML = "Ingen grupp hittad.";
      return;
    }

    if (!currentEvent) {
      fightsBox.innerHTML = "Inga matcher hittades.";
      return;
    }

    const fightsResult = await supabaseClient
      .from("fights")
      .select("*")
      .eq("event_id", currentEvent.id)
      .eq("is_main_card", true)
      .order("bout_order", { ascending: true });

    if (fightsResult.error) {
      console.error(fightsResult.error);
      setStatus(dataStatus, "Fel vid hämtning av matcher: " + fightsResult.error.message);
      return;
    }

    currentFights = fightsResult.data || [];

    const picksResult = await supabaseClient
      .from("picks")
      .select("*")
      .eq("event_id", currentEvent.id)
      .eq("group_id", currentGroup.id)
      .eq("user_id", currentSession.user.id);

    if (picksResult.error) {
      console.error(picksResult.error);
      setStatus(dataStatus, "Fel vid hämtning av picks: " + picksResult.error.message);
      return;
    }

    currentOwnPicks = picksResult.data || [];

    const picksMap = {};
    currentOwnPicks.forEach((pick) => {
      picksMap[pick.fight_id] = pick;
    });

    fightsBox.innerHTML = currentFights.map((fight) => renderPickForm(fight, picksMap[fight.id])).join("");

    attachFightFormEvents();
    await loadSubmissionState();
    await loadOtherUsersPicks();
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

    const { error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      console.error(error);
      setStatus(authStatus, "Signup fel: " + error.message);
      return;
    }

    setStatus(authStatus, "Konto skapat.");
    await refreshSession();
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

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      console.error(error);
      setStatus(authStatus, "Login fel: " + error.message);
      return;
    }

    setStatus(authStatus, "Inloggning lyckades.");
    await refreshSession();
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
      console.error(error);
      setStatus(authStatus, "Logout fel: " + error.message);
      return;
    }

    currentSession = null;
    currentGroup = null;
    currentEvent = null;
    currentFights = [];
    currentOwnPicks = [];
    currentRevealOpen = false;

    sessionBox.textContent = "Ingen aktiv session.";
    userBox.textContent = "Ingen data ännu.";
    groupBox.textContent = "Ingen data ännu.";
    eventBox.textContent = "Ingen data ännu.";
    fightsBox.innerHTML = "Ingen data ännu.";
    othersPicksBox.innerHTML = "Inget att visa ännu.";
    othersStatus.textContent = "Dolda tills alla skickat in.";

    setStatus(authStatus, "Utloggad.");
    setStatus(passwordStatus, "");
    setStatus(dataStatus, "");
    setStatus(submissionStatus, "");
    setStatus(revealStatus, "");
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Logout exception: " + err.message);
  }
});

loadDataBtn.addEventListener("click", loadAppData);
submitAllBtn.addEventListener("click", submitAllPicks);
changePasswordBtn.addEventListener("click", changePassword);

initSupabase();
