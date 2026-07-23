const SUPABASE_URL = "https://ibputfpjuvcsjkveqkdp.supabase.co";
const SUPABASE_KEY = "sb_publishable_mKByW0FnQ0_0nc9NeDHGqA_N5mv7Ulu";

let supabaseClient = null;
let currentSession = null;
let currentGroup = null;
let currentEvent = null;
let currentFights = [];
let currentOwnPicks = [];
let currentRevealOpen = false;
let currentProfiles = [];
let currentLeaderboard = [];

let pickDrafts = {};
let saveTimers = {};
let saveStateByFight = {};
let isSubmittedForCurrentEvent = false;
let currentView = "event";
let countdownTimer = null;
let authMode = "login";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm-password");
const confirmPasswordWrap = document.getElementById("confirm-password-wrap");
const authTitle = document.getElementById("auth-title");
const authIntro = document.getElementById("auth-intro");
const authModeLoginBtn = document.getElementById("auth-mode-login");
const authModeCreateBtn = document.getElementById("auth-mode-create");
const signUpBtn = document.getElementById("sign-up");
const signInBtn = document.getElementById("sign-in");
const signOutBtn = document.getElementById("sign-out");
const authStatus = document.getElementById("auth-status");
const profileStatus = document.getElementById("profile-status");

const authCard = document.getElementById("auth-card");
const accountCard = document.getElementById("account-card");
const accountEmail = document.getElementById("account-email");
const signedInStatus = document.getElementById("signed-in-status");
const signedOutOnly = document.querySelectorAll("[data-signed-out-only]");
const signedInOnly = document.querySelectorAll("[data-signed-in-only]");

const newPasswordInput = document.getElementById("new-password");
const changePasswordBtn = document.getElementById("change-password");
const passwordStatus = document.getElementById("password-status");

const submitAllBtn = document.getElementById("submit-all");
const dataStatus = document.getElementById("data-status");
const submissionStatus = document.getElementById("submission-status");
const revealStatus = document.getElementById("reveal-status");
const eventBox = document.getElementById("event-box");
const countdownBox = document.getElementById("countdown-box");
const eventBadge = document.getElementById("event-badge");
const fightsBox = document.getElementById("fights-box");

const othersStatus = document.getElementById("others-status");
const othersPicksBox = document.getElementById("others-picks-box");

const eventTabBtn = document.getElementById("tab-event");
const leaderboardTabBtn = document.getElementById("tab-leaderboard");
const profileTabBtn = document.getElementById("tab-profile");
const eventView = document.getElementById("view-event");
const leaderboardView = document.getElementById("view-leaderboard");
const profileView = document.getElementById("view-profile");
const leaderboardBox = document.getElementById("leaderboard-box");
const stickyBar = document.getElementById("sticky-submit-bar");
const stickySaveState = document.getElementById("sticky-save-state");
const stickySubmitBtn = document.getElementById("sticky-submit-btn");

function setStatus(el, message) {
  if (el) el.textContent = message || "";
  if (message) console.log(message);
}

function getDisplayName(userId) {
  const profile = currentProfiles.find((p) => p.id === userId);
  if (profile && profile.display_name && profile.display_name.trim()) {
    return profile.display_name.trim();
  }
  if (currentSession && currentSession.user && currentSession.user.id === userId) {
    return currentSession.user.email;
  }
  return userId;
}

function switchView(viewName) {
  currentView = viewName;

  if (eventView) eventView.hidden = viewName !== "event";
  if (leaderboardView) leaderboardView.hidden = viewName !== "leaderboard";
  if (profileView) profileView.hidden = viewName !== "profile";

  if (eventTabBtn) eventTabBtn.classList.toggle("active", viewName === "event");
  if (leaderboardTabBtn) leaderboardTabBtn.classList.toggle("active", viewName === "leaderboard");
  if (profileTabBtn) profileTabBtn.classList.toggle("active", viewName === "profile");

  updateStickyBar();
}

function initTabs() {
  if (eventTabBtn) eventTabBtn.addEventListener("click", () => switchView("event"));
  if (leaderboardTabBtn) leaderboardTabBtn.addEventListener("click", () => switchView("leaderboard"));
  if (profileTabBtn) profileTabBtn.addEventListener("click", () => switchView("profile"));
}

function isCreateModeValid() {
  const password = passwordInput ? passwordInput.value.trim() : "";
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";
  return password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;
}

function getCreateModeMessage() {
  const password = passwordInput ? passwordInput.value.trim() : "";
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";

  if (!password && !confirmPassword) return "Enter your email and create a password.";
  if (password.length > 0 && password.length < 6) return "Password must be at least 6 characters.";
  if (!confirmPassword) return "Please re-enter your password.";
  if (password !== confirmPassword) return "Passwords must match.";
  return "Passwords match. Ready to create account.";
}

function setAuthMode(mode) {
  authMode = mode === "create" ? "create" : "login";

  if (authTitle) authTitle.textContent = authMode === "create" ? "Create account" : "Log in";
  if (authIntro) {
    authIntro.textContent =
      authMode === "create"
        ? "Enter your email and password twice before creating your account."
        : "Enter your email and password to sign in.";
  }

  if (confirmPasswordWrap) confirmPasswordWrap.hidden = authMode !== "create";
  if (signInBtn) signInBtn.hidden = authMode !== "login";
  if (signUpBtn) signUpBtn.hidden = authMode !== "create";

  if (authModeLoginBtn) authModeLoginBtn.classList.toggle("active", authMode === "login");
  if (authModeCreateBtn) authModeCreateBtn.classList.toggle("active", authMode === "create");

  updateCreateAccountButtonState();
}

function updateCreateAccountButtonState() {
  if (!signUpBtn) return;
  if (authMode !== "create") {
    signUpBtn.disabled = true;
    return;
  }
  signUpBtn.disabled = !isCreateModeValid();
  setStatus(profileStatus, getCreateModeMessage());
}

function clearAuthInputs() {
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (confirmPasswordInput) confirmPasswordInput.value = "";
}

function updateAuthPanels() {
  const loggedIn = !!(currentSession && currentSession.user);

  if (authCard) authCard.hidden = loggedIn;
  if (accountCard) accountCard.hidden = !loggedIn;

  signedOutOnly.forEach((el) => {
    el.hidden = loggedIn;
  });

  signedInOnly.forEach((el) => {
    el.hidden = !loggedIn;
  });

  if (accountEmail) accountEmail.textContent = loggedIn ? currentSession.user.email : "";
  if (signedInStatus) signedInStatus.textContent = loggedIn ? `Signed in as ${currentSession.user.email}` : "";

  setStatus(authStatus, loggedIn ? `Signed in as ${currentSession.user.email}` : "Not signed in.");
  setStatus(
    profileStatus,
    loggedIn ? "" : authMode === "create" ? getCreateModeMessage() : "Enter your email and password to continue."
  );
}

function initAuthModeControls() {
  if (authModeLoginBtn) authModeLoginBtn.addEventListener("click", () => setAuthMode("login"));
  if (authModeCreateBtn) authModeCreateBtn.addEventListener("click", () => setAuthMode("create"));
  if (passwordInput) passwordInput.addEventListener("input", updateCreateAccountButtonState);
  if (confirmPasswordInput) confirmPasswordInput.addEventListener("input", updateCreateAccountButtonState);
  if (emailInput) {
    emailInput.addEventListener("input", () => {
      if (!currentSession) updateCreateAccountButtonState();
    });
  }
  setAuthMode("login");
}

function getDraftFromInputs(fightId) {
  const winnerEl = document.querySelector(`[data-fight-id="${fightId}"][data-field="picked_winner"]`);
  const methodEl = document.querySelector(`[data-fight-id="${fightId}"][data-field="method"]`);
  const roundEl = document.querySelector(`[data-fight-id="${fightId}"][data-field="round_number"]`);
  const decisionEl = document.querySelector(`[data-fight-id="${fightId}"][data-field="decision_type"]`);
  const method = methodEl ? methodEl.value : "";

  return {
    picked_winner: winnerEl ? winnerEl.value : "",
    method,
    round_number: method === "ko_tko" || method === "sub" ? (roundEl ? roundEl.value : "") : "",
    decision_type: method === "decision" ? (decisionEl ? decisionEl.value : "") : ""
  };
}

function isFightDraftComplete(draft) {
  if (!draft || !draft.picked_winner || !draft.method) return false;
  if ((draft.method === "ko_tko" || draft.method === "sub") && !draft.round_number) return false;
  if (draft.method === "decision" && !draft.decision_type) return false;
  return true;
}

function areAllDraftsComplete() {
  return currentFights.length > 0 && currentFights.every((fight) => isFightDraftComplete(pickDrafts[fight.id]));
}

function isAnyDraftSaving() {
  return Object.values(saveStateByFight).some((value) => value === "Saving...");
}

function hasAnyDraftError() {
  return Object.values(saveStateByFight).some((value) => String(value || "").startsWith("Error"));
}

function getStickyStateMessage() {
  if (!currentSession || !currentGroup || !currentEvent) return "Sign in to start.";
  if (isSubmittedForCurrentEvent) return "Your picks are submitted and locked.";
  if (isAnyDraftSaving()) return "Saving picks...";
  if (hasAnyDraftError()) return "Some picks could not be saved.";
  if (!areAllDraftsComplete()) return "Complete all picks to submit.";
  return "All picks saved.";
}

function updateSubmitButtonState() {
  const lockReached = hasLockTimePassed();
  const disabled =
    isSubmittedForCurrentEvent ||
    lockReached ||
    isAnyDraftSaving() ||
    hasAnyDraftError() ||
    !areAllDraftsComplete();

  if (submitAllBtn) submitAllBtn.disabled = disabled;
  if (stickySubmitBtn) stickySubmitBtn.disabled = disabled;
  if (stickySaveState) stickySaveState.textContent = getStickyStateMessage();
}

function updateStickyBar() {
  if (!stickyBar) return;
  stickyBar.hidden = currentView !== "event" || !currentSession || !currentEvent;
  updateSubmitButtonState();
}

function formatEventName(event) {
  if (!event) return "No event found.";
  return event.name || "Unnamed event";
}

function hasLockTimePassed() {
  if (!currentEvent || !currentEvent.lock_time) return false;
  return Date.now() >= new Date(currentEvent.lock_time).getTime();
}

function updateEventBadge() {
  if (!eventBadge) return;
  if (!currentEvent || !currentSession) {
    eventBadge.hidden = true;
    eventBadge.textContent = "";
    return;
  }

  let message = "";
  if (isSubmittedForCurrentEvent) {
    message = "Submitted";
  } else if (hasLockTimePassed()) {
    message = "Locked";
  }

  eventBadge.hidden = !message;
  eventBadge.textContent = message;
}

function updateCountdown() {
  if (!countdownBox) return;
  if (!currentEvent || !currentEvent.lock_time) {
    countdownBox.textContent = "";
    return;
  }

  const now = Date.now();
  const target = new Date(currentEvent.lock_time).getTime();
  const diff = target - now;

  if (diff <= 0) {
    countdownBox.textContent = "Submissions closed.";
    updateEventBadge();
    updateSubmitButtonState();
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  countdownBox.textContent = `Locks in ${parts.join(" ")}`;
}

function startCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

function renderPickForm(fight, existingPick) {
  const draft = pickDrafts[fight.id] || existingPick || {};
  const selectedWinner = draft.picked_winner || "";
  const selectedMethod = draft.method || "";
  const selectedRound = draft.round_number || "";
  const selectedDecision = draft.decision_type || "";
  const isLocked = isSubmittedForCurrentEvent || hasLockTimePassed();
  const disabledAttr = isLocked ? "disabled" : "";
  const lockedClass = isLocked ? " locked" : "";

  return `
    <article class="fight-item${lockedClass}">
      <div class="fight-title">Fight ${fight.bout_order}: ${fight.fighter_a} vs ${fight.fighter_b}</div>

      <label>
        Winner
        <select data-fight-id="${fight.id}" data-field="picked_winner" ${disabledAttr}>
          <option value="">Select winner</option>
          <option value="${fight.fighter_a}" ${selectedWinner === fight.fighter_a ? "selected" : ""}>${fight.fighter_a}</option>
          <option value="${fight.fighter_b}" ${selectedWinner === fight.fighter_b ? "selected" : ""}>${fight.fighter_b}</option>
        </select>
      </label>

      <label>
        Method
        <select data-fight-id="${fight.id}" data-field="method" ${disabledAttr}>
          <option value="">Select method</option>
          <option value="ko_tko" ${selectedMethod === "ko_tko" ? "selected" : ""}>KO/TKO</option>
          <option value="sub" ${selectedMethod === "sub" ? "selected" : ""}>Submission</option>
          <option value="decision" ${selectedMethod === "decision" ? "selected" : ""}>Decision</option>
        </select>
      </label>

      <label class="round-wrapper" data-fight-id="${fight.id}" style="${selectedMethod === "ko_tko" || selectedMethod === "sub" ? "" : "display:none;"}">
        Round
        <select data-fight-id="${fight.id}" data-field="round_number" ${disabledAttr}>
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
        <select data-fight-id="${fight.id}" data-field="decision_type" ${disabledAttr}>
          <option value="">Select decision type</option>
          <option value="unanimous" ${selectedDecision === "unanimous" ? "selected" : ""}>Unanimous</option>
          <option value="split" ${selectedDecision === "split" ? "selected" : ""}>Split</option>
        </select>
      </label>

      <p class="pick-status" id="pick-status-${fight.id}">${saveStateByFight[fight.id] || ""}</p>
    </article>
  `;
}

function renderEventScreen() {
  const picksMap = {};
  currentOwnPicks.forEach((pick) => {
    picksMap[pick.fight_id] = pick;
  });

  if (!currentEvent) {
    fightsBox.innerHTML = '<div class="empty-state">No event found.</div>';
    if (countdownBox) countdownBox.textContent = "";
    updateStickyBar();
    return;
  }

  if (!currentFights.length) {
    fightsBox.innerHTML = '<div class="empty-state">No fights found.</div>';
    updateStickyBar();
    return;
  }

  fightsBox.innerHTML = currentFights.map((fight) => renderPickForm(fight, picksMap[fight.id])).join("");
  attachFightFormEvents();
  updateStickyBar();
}

function attachFightFormEvents() {
  document.querySelectorAll("#fights-box select").forEach((select) => {
    select.addEventListener("change", async (event) => {
      const fightId = event.target.dataset.fightId;
      const field = event.target.dataset.field;
      if (!fightId || !field || isSubmittedForCurrentEvent || hasLockTimePassed()) return;

      const methodEl = document.querySelector(`[data-fight-id="${fightId}"][data-field="method"]`);
      const method = methodEl ? methodEl.value : "";

      const roundWrapper = document.querySelector(`.round-wrapper[data-fight-id="${fightId}"]`);
      const decisionWrapper = document.querySelector(`.decision-wrapper[data-fight-id="${fightId}"]`);
      const roundEl = document.querySelector(`[data-fight-id="${fightId}"][data-field="round_number"]`);
      const decisionEl = document.querySelector(`[data-fight-id="${fightId}"][data-field="decision_type"]`);

      if (method === "ko_tko" || method === "sub") {
        if (roundWrapper) roundWrapper.style.display = "block";
        if (decisionWrapper) decisionWrapper.style.display = "none";
        if (decisionEl) decisionEl.value = "";
      } else if (method === "decision") {
        if (roundWrapper) roundWrapper.style.display = "none";
        if (decisionWrapper) decisionWrapper.style.display = "block";
        if (roundEl) roundEl.value = "";
      } else {
        if (roundWrapper) roundWrapper.style.display = "none";
        if (decisionWrapper) decisionWrapper.style.display = "none";
        if (roundEl) roundEl.value = "";
        if (decisionEl) decisionEl.value = "";
      }

      pickDrafts[fightId] = getDraftFromInputs(fightId);
      queueAutosave(fightId);
      updateSubmitButtonState();
    });
  });
}

function queueAutosave(fightId) {
  if (saveTimers[fightId]) clearTimeout(saveTimers[fightId]);

  saveStateByFight[fightId] = isFightDraftComplete(pickDrafts[fightId]) ? "Saving..." : "Incomplete pick";
  const statusEl = document.getElementById(`pick-status-${fightId}`);
  if (statusEl) statusEl.textContent = saveStateByFight[fightId];
  updateSubmitButtonState();

  if (!isFightDraftComplete(pickDrafts[fightId]) || hasLockTimePassed()) return;
  saveTimers[fightId] = setTimeout(() => autosavePick(fightId), 400);
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

async function autosavePick(fightId) {
  try {
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent || isSubmittedForCurrentEvent || hasLockTimePassed()) return;

    const draft = pickDrafts[fightId];
    const statusEl = document.getElementById(`pick-status-${fightId}`);

    if (!isFightDraftComplete(draft)) {
      saveStateByFight[fightId] = "Incomplete pick";
      if (statusEl) statusEl.textContent = saveStateByFight[fightId];
      updateSubmitButtonState();
      return;
    }

    saveStateByFight[fightId] = "Saving...";
    if (statusEl) statusEl.textContent = saveStateByFight[fightId];
    updateSubmitButtonState();

    const payload = {
      user_id: currentSession.user.id,
      group_id: currentGroup.id,
      event_id: currentEvent.id,
      fight_id: fightId,
      picked_winner: draft.picked_winner,
      method: draft.method,
      round_number: draft.method === "decision" ? null : Number(draft.round_number),
      decision_type: draft.method === "decision" ? draft.decision_type : null
    };

    const { error } = await supabaseClient
      .from("picks")
      .upsert(payload, { onConflict: "user_id,group_id,event_id,fight_id" });

    if (error) {
      console.error(error);
      saveStateByFight[fightId] = `Error saving: ${error.message}`;
      if (statusEl) statusEl.textContent = saveStateByFight[fightId];
      updateSubmitButtonState();
      return;
    }

    saveStateByFight[fightId] = "Saved";
    if (statusEl) statusEl.textContent = saveStateByFight[fightId];

    const existingIndex = currentOwnPicks.findIndex((p) => p.fight_id === fightId);
    if (existingIndex >= 0) {
      currentOwnPicks[existingIndex] = { ...currentOwnPicks[existingIndex], ...payload };
    } else {
      currentOwnPicks.push(payload);
    }

    updateSubmitButtonState();
  } catch (err) {
    console.error(err);
    saveStateByFight[fightId] = `Error saving: ${err.message}`;
    const statusEl = document.getElementById(`pick-status-${fightId}`);
    if (statusEl) statusEl.textContent = saveStateByFight[fightId];
    updateSubmitButtonState();
  }
}

async function loadSubmissionState() {
  const { count: memberCount, error: memberError } = await supabaseClient
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", currentGroup.id);

  if (memberError) {
    console.error(memberError);
    setStatus(submissionStatus, `Error loading members: ${memberError.message}`);
    return;
  }

  const { data: submissions, error: submissionsError } = await supabaseClient
    .from("event_submissions")
    .select("*")
    .eq("group_id", currentGroup.id)
    .eq("event_id", currentEvent.id);

  if (submissionsError) {
    console.error(submissionsError);
    setStatus(submissionStatus, `Error loading submissions: ${submissionsError.message}`);
    return;
  }

  const submittedCount = submissions ? submissions.length : 0;
  const ownSubmitted = submissions.some((row) => row.user_id === currentSession.user.id);

  isSubmittedForCurrentEvent = ownSubmitted;
  setStatus(
    submissionStatus,
    `${submittedCount} of ${memberCount || 0} have submitted. You are ${ownSubmitted ? "done" : "not done"}.`
  );

  currentRevealOpen = memberCount > 0 && submittedCount >= memberCount;
  setStatus(
    revealStatus,
    currentRevealOpen
      ? "Everyone has submitted. Picks are now visible."
      : "Picks stay hidden until everyone has submitted."
  );

  updateEventBadge();
  updateSubmitButtonState();
}

function describePick(pick) {
  if (pick.method === "decision") return `Decision (${pick.decision_type})`;
  if (pick.method === "ko_tko") return `KO/TKO round ${pick.round_number}`;
  if (pick.method === "sub") return `Submission round ${pick.round_number}`;
  return pick.method;
}

async function loadSubmittedPicks() {
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
    othersStatus.textContent = `Error loading submitted picks: ${error.message}`;
    return;
  }

  const grouped = {};
  data.forEach((pick) => {
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
      const fightLabel = fight ? `${fight.fighter_a} vs ${fight.fighter_b}` : pick.fight_id;
      picksHtml += `<li>${fightLabel}: <strong>${pick.picked_winner}</strong> via ${describePick(pick)}</li>`;
    });

    html += `
      <section class="card submitted-picks-card">
        <strong>${getDisplayName(userId)}</strong>
        <ul>${picksHtml}</ul>
      </section>
    `;
  });

  othersStatus.textContent = "All submitted picks are now visible.";
  othersPicksBox.innerHTML = html;
}

function renderLeaderboard() {
  if (!leaderboardBox) return;

  if (!currentLeaderboard.length) {
    leaderboardBox.innerHTML = '<div class="card empty-state">No leaderboard data yet.</div>';
    return;
  }

  leaderboardBox.innerHTML = currentLeaderboard
    .map((row, index) => {
      const name = row.display_name || getDisplayName(row.user_id);
      const rank = row.rank ?? index + 1;
      const currentPoints = row.current_points ?? 0;
      const beforeLast = row.points_before_last_event ?? 0;
      const lastEvent = row.last_event_points ?? 0;

      return `
        <details class="card leaderboard-card">
          <summary>
            <div>
              <div class="leaderboard-rank">${rank}. ${name}</div>
              <div class="leaderboard-subline">Before last: ${beforeLast} · Last event: ${lastEvent}</div>
            </div>
            <div class="leaderboard-total">${currentPoints}</div>
          </summary>
          <div class="leaderboard-breakdown">Current total: ${currentPoints}</div>
        </details>
      `;
    })
    .join("");
}

async function loadLeaderboard() {
  const scoresResult = await supabaseClient
    .from("leaderboard")
    .select("*")
    .eq("group_id", currentGroup.id)
    .order("rank", { ascending: true })
    .order("current_points", { ascending: false });

  if (scoresResult.error) {
    console.error(scoresResult.error);
    currentLeaderboard = [];
    renderLeaderboard();
    return;
  }

  currentLeaderboard = scoresResult.data || [];
  renderLeaderboard();
}

async function submitAllPicks() {
  try {
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent) {
      setStatus(dataStatus, "Sign in first.");
      return;
    }

    if (isSubmittedForCurrentEvent) {
      setStatus(dataStatus, "You have already submitted all picks.");
      await loadSubmissionState();
      return;
    }

    if (hasLockTimePassed()) {
      setStatus(dataStatus, "Submissions are closed.");
      return;
    }

    if (isAnyDraftSaving()) {
      setStatus(dataStatus, "Please wait until all picks are saved.");
      return;
    }

    if (hasAnyDraftError()) {
      setStatus(dataStatus, "Fix save errors before submitting.");
      return;
    }

    if (!areAllDraftsComplete()) {
      setStatus(dataStatus, "Complete all picks before submitting.");
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
      setStatus(dataStatus, `Error submitting picks: ${error.message}`);
      return;
    }

    isSubmittedForCurrentEvent = true;
    document.querySelectorAll("#fights-box select").forEach((el) => {
      el.disabled = true;
    });

    setStatus(dataStatus, "All picks submitted.");
    updateEventBadge();
    updateSubmitButtonState();
    renderEventScreen();
    await loadSubmissionState();
    await loadSubmittedPicks();
    await loadLeaderboard();
  } catch (err) {
    console.error(err);
    setStatus(dataStatus, `Unexpected submit error: ${err.message}`);
  }
}

async function changePassword() {
  try {
    if (!supabaseClient) {
      setStatus(passwordStatus, "Supabase is not initialized.");
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
      setStatus(passwordStatus, `Error changing password: ${error.message}`);
      return;
    }

    setStatus(passwordStatus, "Password updated.");
    newPasswordInput.value = "";
  } catch (err) {
    console.error(err);
    setStatus(passwordStatus, `Unexpected error: ${err.message}`);
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
    setStatus(dataStatus, `Error loading group membership: ${membershipResult.error.message}`);
    return null;
  }

  const groupResult = await supabaseClient
    .from("groups")
    .select("*")
    .eq("id", membershipResult.data.group_id)
    .single();

  if (groupResult.error) {
    console.error(groupResult.error);
    setStatus(dataStatus, `Error loading group: ${groupResult.error.message}`);
    return null;
  }

  return groupResult.data;
}

async function loadProfilesForCurrentGroup() {
  const memberIdsResult = await supabaseClient
    .from("group_members")
    .select("user_id")
    .eq("group_id", currentGroup.id);

  if (memberIdsResult.error) {
    console.error(memberIdsResult.error);
    currentProfiles = [];
    return;
  }

  const memberIds = memberIdsResult.data.map((row) => row.user_id);
  if (!memberIds.length) {
    currentProfiles = [];
    return;
  }

  const profilesResult = await supabaseClient
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds);

  if (profilesResult.error) {
    console.error(profilesResult.error);
    currentProfiles = [];
    return;
  }

  currentProfiles = profilesResult.data || [];
}

async function loadAppData() {
  try {
    if (!supabaseClient) {
      setStatus(dataStatus, "Supabase is not initialized.");
      return;
    }

    const session = await refreshSession();
    if (!session) {
      currentGroup = null;
      currentEvent = null;
      currentFights = [];
      currentOwnPicks = [];
      renderEventScreen();
      updateStickyBar();
      switchView("profile");
      return;
    }

    currentGroup = await loadCurrentGroup();

    if (!currentGroup) {
      fightsBox.innerHTML = "No group found.";
      if (countdownBox) countdownBox.textContent = "";
      updateStickyBar();
      return;
    }

    await loadProfilesForCurrentGroup();

    const eventsResult = await supabaseClient
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .limit(1);

    if (eventsResult.error) {
      console.error(eventsResult.error);
      setStatus(dataStatus, `Error loading event: ${eventsResult.error.message}`);
      return;
    }

    currentEvent = eventsResult.data && eventsResult.data.length ? eventsResult.data[0] : null;
    eventBox.textContent = formatEventName(currentEvent);
    startCountdownTimer();

    if (!currentEvent) {
      fightsBox.innerHTML = "No fights found.";
      updateStickyBar();
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
      setStatus(dataStatus, `Error loading fights: ${fightsResult.error.message}`);
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
      setStatus(dataStatus, `Error loading picks: ${picksResult.error.message}`);
      return;
    }

    currentOwnPicks = picksResult.data || [];
    pickDrafts = {};
    saveStateByFight = {};

    currentOwnPicks.forEach((pick) => {
      pickDrafts[pick.fight_id] = {
        picked_winner: pick.picked_winner || "",
        method: pick.method || "",
        round_number: pick.round_number ? String(pick.round_number) : "",
        decision_type: pick.decision_type || ""
      };
      saveStateByFight[pick.fight_id] = "Saved";
    });

    isSubmittedForCurrentEvent = await hasSubmittedCurrentEvent();
    updateEventBadge();
    renderEventScreen();
    await loadSubmissionState();
    await loadSubmittedPicks();
    await loadLeaderboard();
    updateSubmitButtonState();
    setStatus(dataStatus, "");
    switchView("event");
  } catch (err) {
    console.error(err);
    setStatus(dataStatus, `Unexpected error: ${err.message}`);
  }
}

function initSupabase() {
  try {
    if (!window.supabase) {
      setStatus(authStatus, "Supabase library failed to load.");
      return;
    }

    const { createClient } = window.supabase;
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    updateAuthPanels();

    refreshSession().then((session) => {
      if (session) {
        loadAppData();
      } else {
        switchView("profile");
      }
    });
  } catch (err) {
    console.error(err);
    setStatus(authStatus, `Initialization error: ${err.message}`);
  }
}

async function refreshSession() {
  try {
    if (!supabaseClient) {
      currentSession = null;
      updateAuthPanels();
      return null;
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error(error);
      currentSession = null;
      updateAuthPanels();
      return null;
    }

    if (!data.session) {
      currentSession = null;
      updateAuthPanels();
      return null;
    }

    currentSession = data.session;
    updateAuthPanels();
    return data.session;
  } catch (err) {
    console.error(err);
    return null;
  }
}

if (signUpBtn) {
  signUpBtn.addEventListener("click", async () => {
    try {
      if (!supabaseClient) {
        setStatus(profileStatus, "Supabase is not initialized.");
        return;
      }

      if (!isCreateModeValid()) {
        setStatus(profileStatus, getCreateModeMessage());
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      const { error } = await supabaseClient.auth.signUp({ email, password });
      if (error) {
        console.error(error);
        setStatus(profileStatus, `Signup error: ${error.message}`);
        return;
      }

      setStatus(profileStatus, "Account created.");
      clearAuthInputs();
      setAuthMode("login");
      await refreshSession();
      await loadAppData();
    } catch (err) {
      console.error(err);
      setStatus(profileStatus, `Signup exception: ${err.message}`);
    }
  });
}

if (signInBtn) {
  signInBtn.addEventListener("click", async () => {
    try {
      if (!supabaseClient) {
        setStatus(profileStatus, "Supabase is not initialized.");
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      const result = await supabaseClient.auth.signInWithPassword({ email, password });
      if (result.error) {
        console.error(result.error);
        setStatus(profileStatus, `Login error: ${result.error.message}`);
        return;
      }

      setStatus(profileStatus, "Login successful.");
      clearAuthInputs();
      await refreshSession();
      await loadAppData();
    } catch (err) {
      console.error(err);
      setStatus(profileStatus, `Login exception: ${err.message}`);
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    try {
      if (!supabaseClient) {
        setStatus(profileStatus, "No active Supabase client.");
        return;
      }

      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.error(error);
        setStatus(profileStatus, `Logout error: ${error.message}`);
        return;
      }

      currentSession = null;
      currentGroup = null;
      currentEvent = null;
      currentFights = [];
      currentOwnPicks = [];
      currentRevealOpen = false;
      currentProfiles = [];
      currentLeaderboard = [];
      pickDrafts = {};
      saveTimers = {};
      saveStateByFight = {};
      isSubmittedForCurrentEvent = false;

      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }

      if (eventBox) eventBox.textContent = "No event found.";
      if (countdownBox) countdownBox.textContent = "";
      if (eventBadge) {
        eventBadge.hidden = true;
        eventBadge.textContent = "";
      }
      if (fightsBox) fightsBox.innerHTML = "No data yet.";
      if (othersPicksBox) othersPicksBox.innerHTML = "Nothing to show yet.";
      if (othersStatus) othersStatus.textContent = "Hidden until everyone has submitted.";
      if (leaderboardBox) leaderboardBox.innerHTML = '<div class="card">No data yet.</div>';

      clearAuthInputs();
      setAuthMode("login");
      setStatus(profileStatus, "Logged out.");
      setStatus(authStatus, "");
      setStatus(passwordStatus, "");
      setStatus(dataStatus, "");
      setStatus(submissionStatus, "");
      setStatus(revealStatus, "");
      updateAuthPanels();
      updateStickyBar();
      switchView("profile");
    } catch (err) {
      console.error(err);
      setStatus(profileStatus, `Logout exception: ${err.message}`);
    }
  });
}

if (submitAllBtn) submitAllBtn.addEventListener("click", submitAllPicks);
if (stickySubmitBtn) stickySubmitBtn.addEventListener("click", submitAllPicks);
if (changePasswordBtn) changePasswordBtn.addEventListener("click", changePassword);

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initAuthModeControls();
  initSupabase();
  switchView("profile");
});
