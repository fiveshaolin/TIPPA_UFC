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
      currentSession = null;
      return null;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
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
    currentSession = null;
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

      const roundWrapper = document.querySelector(`.round-wrapper[data-fight-id="${fightId}"]`);
      const decisionWrapper = document.querySelector(`.decision-wrapper[data-fight-id="${fightId}"]`);

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
      const fightId = event.target.dataset.fightId;
      await savePick(fightId);
    });
  });
}

async function savePick(fightId) {
  try {
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent) return;

    if (await hasSubmittedCurrentEvent()) {
      const statusEl = document.getElementById(`pick-status-${fightId}`);
      if (statusEl) statusEl.textContent = "Du har redan skickat in dina picks.";
      return;
    }

    const winner = document.querySelector(`[data-fight-id="${fightId}"][data-field="picked_winner"]`)?.value || "";
    const method = document.querySelector(`[data-fight-id="${fightId}"][data-field="method"]`)?.value || "";
    const roundNumberValue = document.querySelector(`[data-fight-id="${fightId}"][data-field="round_number"]`)?.value || "";
    const decisionType = document.querySelector(`[data-fight-id="${fightId}"][data-field="decision_type"]`)?.value || "";
    const statusEl = document.getElementById(`pick-status-${fightId}`);

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
      method,
      round_number: method === "decision" ? null : Number(roundNumberValue),
      decision_type: method === "decision" ? decisionType : null
    };

    const { error } = await supabaseClient
      .from("picks")
      .upsert(payload, { onConflict: "user_id,group_id,event_id,fight_id" });

    if (error) {
      statusEl.textContent = "Fel vid sparande: " + error.message;
      return;
    }

    statusEl.textContent = "Pick sparad.";
  } catch (err) {
    console.error(err);
    const 
