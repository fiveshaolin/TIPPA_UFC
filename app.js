let supabaseClient = null;
let currentSession = null;
let currentGroup = null;
let currentEvent = null;
let currentFights = [];
let currentOwnPicks = [];
let currentRevealOpen = false;
let currentGroupMembers = [];

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
  if (message) console.log(message);
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

function setStaticEnglishLabels() {
  const submittedHeading = document.querySelector("#others-picks-box")?.closest("section, div")?.querySelector("h2");
  if (submittedHeading && submittedHeading.textContent.trim().toLowerCase().includes("picks")) {
    submittedHeading.textContent = "Submitted picks";
  }
}

function getMemberLabel(userId) {
  const member = currentGroupMembers.find((m) => m.user_id === userId);
  if (member && member.email) return member.email;
  if (currentSession && currentSession.user && currentSession.user.id === userId) {
    return currentSession.user.email;
  }
  return userId;
}

function initSupabase() {
  try {
    const savedUrl = getStoredItem("supabase_url");
    const savedKey = getStoredItem("supabase_key");

    if (savedUrl) urlInput.value = savedUrl;
    if (savedKey) keyInput.value = savedKey;

    if (!savedUrl || !savedKey) {
      setStatus(configStatus, "Paste your Supabase Project URL and Publishable Key.");
      return;
    }

    if (!window.supabase) {
      setStatus(configStatus, "Supabase library failed to load.");
      return;
    }

    const { createClient } = window.supabase;
    supabaseClient = createClient(savedUrl, savedKey);
    setStatus(configStatus, "Supabase connection saved.");
    refreshSession();
  } catch (err) {
    console.error(err);
    setStatus(configStatus, "Initialization error: " + err.message);
  }
}

async function refreshSession() {
  try {
    if (!supabaseClient) {
      sessionBox.textContent = "No active session.";
      currentSession = null;
      return null;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(error);
      setStatus(authStatus, "Could not read session: " + error.message);
      sessionBox.textContent = "No active session.";
      currentSession = null;
      return null;
    }

    if (!data.session) {
      sessionBox.textContent = "No active session.";
      setStatus(authStatus, "Not signed in.");
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

    setStatus(authStatus, "Signed in as " + data.session.user.email);
    return data.session;
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Session error: " + err.message);
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
      <div class="fight-title"><strong>Fight ${fight.bout_order}:</strong> ${fight.fighter_a} vs ${fight.fighter_b}</div>

      <label>
        Winner
        <select data-fight-id="${fight.id}" data-field="picked_winner">
          <option value="">Select winner</option>
          <option value="${fight.fighter_a}" ${selectedWinner === fight.fighter_a ? "selected" : ""}>${fight.fighter_a}</option>
          <option value="${fight.fighter_b}" ${selectedWinner === fight.fighter_b ? "selected" : ""}>${fight.fighter_b}</option>
        </select>
      </label>

      <label>
        Method
        <select data-fight-id="${fight.id}" data-field="method" class="method-select">
          <option value="">Select method</option>
          <option value="ko_tko" ${selectedMethod === "ko_tko" ? "selected" : ""}>KO/TKO</option>
          <option value="sub" ${selectedMethod === "sub" ? "selected" : ""}>Submission</option>
          <option value="decision" ${selectedMethod === "decision" ? "selected" : ""}>Decision</option>
        </select>
      </label>

      <label class="round-wrapper" data-fight-id="${fight.id}" style="${selectedMethod === "ko_tko" || selectedMethod === "sub" ? "" : "display:none;"}">
        Round
        <select data-fight-id="${fight.id}" data-field="round_number">
          <option value="">Select round</option>
          <option value="1" ${String(selectedRound) === "1" ? "selected" : ""}>1</option>
          <option value="2" ${String(selectedRound) === "2" ? "selected" : ""}>2</option>
          <option value="3" ${String(selectedRound) === "3" ? "selected" : ""}>3</option>
          <option value="4" ${String(selectedRound) === "4" ? "selected" : ""}>4</option>
          <option value="5" ${String(selectedRound) === "5" ? "selected" : ""}>5</option>
        </select>
      </label>

      <label class="decision-wrapper" data-fight-id="${fight.id}" style="${selectedMethod === "decision" ? "" : "display:none;"}">
        Decision type
        <select data-fight-id="${fight.id}" data-field="decision_type">
          <option value="">Select decision type</option>
          <option value="unanimous" ${selectedDecision === "unanimous" ? "selected" : ""}>Unanimous</option>
          <option value="split" ${selectedDecision === "split" ? "selected" : ""}>Split</option>
        </select>
      </label>

      <button class="save-pick-btn" data-fight-id="${fight.id}">Save pick</button>
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
    .eq("event_id", currentEvent.id);

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
      if (statusEl) statusEl.textContent = "You have already submitted your picks.";
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
      statusEl.textContent = "Select both winner and method.";
      return;
    }

    if ((method === "ko_tko" || method === "sub") && !roundNumberValue) {
      statusEl.textContent = "Select a round.";
      return;
    }

    if (method === "decision" && !decisionType) {
      statusEl.textContent = "Select a decision type.";
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
      statusEl.textContent = "Error saving pick: " + error.message;
      return;
    }

    statusEl.textContent = "Pick saved.";
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
    setStatus(submissionStatus, "Error loading members: " + memberError.message);
    return;
  }

  const { data: submissions, error: submissionsError } = await supabaseClient
    .from("event_submissions")
    .select("*")
    .eq("group_id", currentGroup.id)
    .eq("event_id", currentEvent.id);

  if (submissionsError) {
    console.error(submissionsError);
    setStatus(submissionStatus, "Error loading submissions: " + submissionsError.message);
    return;
  }

  const submittedCount = submissions ? submissions.length : 0;
  const ownSubmitted = submissions.some((row) => row.user_id === currentSession.user.id);

  setStatus(
    submissionStatus,
    submittedCount + " of " + (memberCount || 0) + " have submitted. You are " + (ownSubmitted ? "done" : "not done") + "."
  );

  currentRevealOpen = (memberCount || 0) > 0 && submittedCount === memberCount;

  setStatus(
    revealStatus,
    currentRevealOpen ? "Everyone has submitted. Picks are now visible." : "Picks stay hidden until everyone has submitted."
  );
}

async function loadOtherUsersPicks() {
  if (!currentRevealOpen) {
    othersStatus.textContent = "Hidden until everyone has submitted.";
    othersPicksBox.innerHTML = "Nothing to show yet.";
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
    othersStatus.textContent = "Error loading submitted picks: " + error.message;
    return;
  }

  const grouped = {};
  (data || []).forEach((pick) => {
    if (!grouped[pick.user_id]) grouped[pick.user_id] = [];
    grouped[pick.user_id].push(pick);
  });

  const userIds = Object.keys(grouped);

  if (!userIds.length) {
    othersStatus.textContent = "No picks found.";
    othersPicksBox.innerHTML = "Nothing to show yet.";
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
        details = "KO/TKO round " + pick.round_number;
      } else if (pick.method === "sub") {
        details = "Submission round " + pick.round_number;
      } else {
        details = pick.method;
      }

      picksHtml += "<li>" +
        (fight ? (fight.fighter_a + " vs " + fight.fighter_b) : pick.fight_id) +
        ": " + pick.picked_winner + " via " + details +
        "</li>";
    });

    html += '<div class="fight-item"><strong>' + getMemberLabel(userId) + '</strong><ul>' + picksHtml + '</ul></div>';
  });

  othersStatus.textContent = "All submitted picks are now visible.";
  othersPicksBox.innerHTML = html;
}

async function submitAllPicks() {
  try {
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent) {
      setStatus(dataStatus, "Load app data first.");
      return;
    }

    const ownSubmitted = await hasSubmittedCurrentEvent();
    if (ownSubmitted) {
      setStatus(dataStatus, "You have already submitted all picks.");
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
      setStatus(dataStatus, "Error checking picks: " + ownPicksError.message);
      return;
    }

    currentOwnPicks = ownPicks || [];

    if (currentOwnPicks.length !== currentFights.length) {
      setStatus(dataStatus, "You must save picks for all fights first. Done: " + currentOwnPicks.length + "/" + currentFights.length);
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
      setStatus(dataStatus, "Error submitting picks: " + error.message);
      return;
    }

    setStatus(dataStatus, "All picks submitted.");
    await loadSubmissionState();
    await loadOtherUsersPicks();
  } catch (err) {
    console.error(err);
    setStatus(dataStatus, "Unexpected submit error: " + err.message);
  }
}

async function changePassword() {
  try {
    if (!supabaseClient) {
      setStatus(passwordStatus, "Save your Supabase connection first.");
      return;
    }

    const session = await refreshSession();
    if (!session) {
      setStatus(passwordStatus, "You must be signed in.");
      return;
    }

    const newPassword = newPasswordInput.value.trim();

    if (newPassword.length < 6) {
      setStatus(passwordStatus, "Password must be at least 6 characters.");
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
      console.error(error);
      setStatus(passwordStatus, "Error changing password: " + error.message);
      return;
    }

    setStatus(passwordStatus, "Password updated.");
    newPasswordInput.value = "";
  } catch (err) {
    console.error(err);
    setStatus(passwordStatus, "Unexpected error: " + err.message);
  }
}

async function loadCurrentGroup() {
  const membershipResult = await supabaseClient
    .from("group_members")
    .select("group_id")
    .eq("user_id", currentSession.user.id)
    .limit(1)
    .single();

  if (membershipResult.error) {
    console.error(membershipResult.error);
    setStatus(dataStatus, "Error loading group membership: " + membershipResult.error.message);
    return null;
  }

  const groupResult = await supabaseClient
    .from("groups")
    .select("*")
    .eq("id", membershipResult.data.group_id)
    .single();

  if (groupResult.error) {
    console.error(groupResult.error);
    setStatus(dataStatus, "Error loading group: " + groupResult.error.message);
    return null;
  }

  return groupResult.data;
}

async function loadGroupMembers() {
  const { data, error } = await supabaseClient
    .from("group_members")
    .select("user_id, email")
    .eq("group_id", currentGroup.id);

  if (error) {
    console.error(error);
    currentGroupMembers = [];
    return;
  }

  currentGroupMembers = data || [];
}

async function loadAppData() {
  try {
    if (!supabaseClient) {
      setStatus(dataStatus, "Save your Supabase connection first.");
      return;
    }

    const session = await refreshSession();
    if (!session) {
      setStatus(dataStatus, "You must be signed in.");
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

    currentGroup = await loadCurrentGroup();
    groupBox.textContent = currentGroup ? JSON.stringify(currentGroup, null, 2) : "No group found.";

    if (!currentGroup) {
      fightsBox.innerHTML = "No group found.";
      return;
    }

    await loadGroupMembers();

    const eventsResult = await supabaseClient
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .limit(1);

    if (eventsResult.error) {
      console.error(eventsResult.error);
      setStatus(dataStatus, "Error loading event: " + eventsResult.error.message);
      return;
    }

    currentEvent = eventsResult.data && eventsResult.data.length ? eventsResult.data[0] : null;
    eventBox.textContent = currentEvent ? JSON.stringify(currentEvent, null, 2) : "No event found.";

    if (!currentEvent) {
      fightsBox.innerHTML = "No fights found.";
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
      setStatus(dataStatus, "Error loading fights: " + fightsResult.error.message);
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
      setStatus(dataStatus, "Error loading picks: " + picksResult.error.message);
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
    setStatus(dataStatus, "App data loaded.");
  } catch (err) {
    console.error(err);
    setStatus(dataStatus, "Unexpected error: " + err.message);
  }
}

saveConfigBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();
  const key = keyInput.value.trim();

  if (!url || !key) {
    setStatus(configStatus, "Fill in both Project URL and Publishable Key.");
    return;
  }

  const ok1 = setStoredItem("supabase_url", url);
  const ok2 = setStoredItem("supabase_key", key);

  if (!ok1 || !ok2) {
    setStatus(configStatus, "Could not save locally in the browser.");
    return;
  }

  initSupabase();
});

signUpBtn.addEventListener("click", async () => {
  try {
    if (!supabaseClient) {
      setStatus(authStatus, "Save your Supabase connection first.");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    const { error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      console.error(error);
      setStatus(authStatus, "Signup error: " + error.message);
      return;
    }

    setStatus(authStatus, "Account created.");
    await refreshSession();
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Signup exception: " + err.message);
  }
});

signInBtn.addEventListener("click", async () => {
  try {
    if (!supabaseClient) {
      setStatus(authStatus, "Save your Supabase connection first.");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    const result = await supabaseClient.auth.signInWithPassword({ email, password });

    if (result.error) {
      console.error(result.error);
      setStatus(authStatus, "Login error: " + result.error.message);
      return;
    }

    setStatus(authStatus, "Login successful.");
    await refreshSession();
  } catch (err) {
    console.error(err);
    setStatus(authStatus, "Login exception: " + err.message);
  }
});

signOutBtn.addEventListener("click", async () => {
  try {
    if (!supabaseClient) {
      setStatus(authStatus, "No active Supabase client.");
      return;
    }

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error(error);
      setStatus(authStatus, "Logout error: " + error.message);
      return;
    }

    currentSession = null;
    currentGroup = null;
    currentEvent = null;
    currentFights = [];
    currentOwnPicks = [];
    currentRevealOpen = false;
    currentGroupMembers = [];

    sessionBox.textContent = "No active session.";
    userBox.textContent = "No data yet.";
    groupBox.textContent = "No data yet.";
    eventBox.textContent = "No data yet.";
    fightsBox.innerHTML = "No data yet.";
    othersPicksBox.innerHTML = "Nothing to show yet.";
    othersStatus.textContent = "Hidden until everyone has submitted.";

    setStatus(authStatus, "Logged out.");
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

setStaticEnglishLabels();
initSupabase();
