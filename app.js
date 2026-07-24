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
let authStateSubscription = null;
let authChangeInFlight = false;

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm-password");
const confirmPasswordWrap = document.getElementById("confirm-password-wrap");
const displayNameInput = document.getElementById("display-name");
const displayNameWrap = document.getElementById("display-name-wrap");

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
const signedInStatus = document.getElementById("signed-in-status");
const signedOutOnly = document.querySelectorAll("[data-signed-out-only]");
const signedInOnly = document.querySelectorAll("[data-signed-in-only]");

const newPasswordInput = document.getElementById("new-password");
const changePasswordBtn = document.getElementById("change-password");
const passwordStatus = document.getElementById("password-status");

const profileDisplayNameInput = document.getElementById("profile-display-name");
const saveDisplayNameBtn = document.getElementById("save-display-name");

const submitAllBtn = document.getElementById("submit-all");

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

function clearCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function resetAppState() {
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
  clearCountdownTimer();
}

function resetSignedOutUI() {
  if (eventBox) eventBox.textContent = "No event found.";
  if (countdownBox) countdownBox.textContent = "";
  if (eventBadge) {
    eventBadge.hidden = true;
    eventBadge.textContent = "";
  }
  if (fightsBox) fightsBox.innerHTML = '<div class="empty-state">No data yet.</div>';
  if (othersPicksBox) othersPicksBox.innerHTML = "Nothing to show yet.";
  if (othersStatus) othersStatus.textContent = "Hidden until everyone has submitted.";
  if (leaderboardBox) leaderboardBox.innerHTML = '<div class="card empty-state">No data yet.</div>';

  clearAuthInputs();
  if (profileDisplayNameInput) profileDisplayNameInput.value = "";
  if (newPasswordInput) newPasswordInput.value = "";

  setAuthMode("login");
  setStatus(authStatus, "Not signed in.");
  setStatus(profileStatus, "Enter your email and password to continue.");
  setStatus(passwordStatus, "");
  updateAuthPanels();
  updateStickyBar();
  switchView("profile");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getDisplayName(userId) {
  const profile = currentProfiles.find((p) => p.id === userId);
  if (profile && profile.display_name && profile.display_name.trim()) {
    return profile.display_name.trim();
  }
  if (currentSession && currentSession.user && currentSession.user.id === userId) {
    const ownProfileName = profileDisplayNameInput ? profileDisplayNameInput.value.trim() : "";
    if (ownProfileName) return ownProfileName;
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
  const displayName = displayNameInput ? displayNameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";
  return !!displayName && !!email && password.length >= 6 && confirmPassword.length >= 6 && password === confirmPassword;
}

function getCreateModeMessage() {
  const displayName = displayNameInput ? displayNameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value.trim() : "";
  const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";

  if (!displayName) return "Enter the name to show on the leaderboard.";
  if (!email) return "Enter your email address.";
  if (!password && !confirmPassword) return "Create a password and enter it twice.";
  if (password.length > 0 && password.length < 6) return "Password must be at least 6 characters.";
  if (!confirmPassword) return "Please re-enter your password.";
  if (password !== confirmPassword) return "Passwords must match.";
  return "Ready to create account.";
}

function setAuthMode(mode) {
  authMode = mode === "create" ? "create" : "login";

  if (authTitle) authTitle.textContent = authMode === "create" ? "Create account" : "Log in";
  if (authIntro) {
    authIntro.textContent =
      authMode === "create"
        ? "Enter your name, email, and password twice to create your account."
        : "Enter your email and password to sign in.";
  }

  if (displayNameWrap) displayNameWrap.hidden = authMode !== "create";
  if (confirmPasswordWrap) confirmPasswordWrap.hidden = authMode !== "create";
  if (signInBtn) signInBtn.hidden = authMode !== "login";
  if (signUpBtn) signUpBtn.hidden = authMode !== "create";

  if (authModeLoginBtn) {
    authModeLoginBtn.classList.toggle("active", authMode === "login");
    authModeLoginBtn.setAttribute("aria-selected", authMode === "login" ? "true" : "false");
  }

  if (authModeCreateBtn) {
    authModeCreateBtn.classList.toggle("active", authMode === "create");
    authModeCreateBtn.setAttribute("aria-selected", authMode === "create" ? "true" : "false");
  }

  if (passwordInput) {
    passwordInput.setAttribute("autocomplete", authMode === "create" ? "new-password" : "current-password");
  }

  if (confirmPasswordInput) {
    confirmPasswordInput.setAttribute("autocomplete", "new-password");
  }

  updateCreateAccountButtonState();
}

function updateCreateAccountButtonState() {
  if (!signUpBtn) return;
  if (authMode !== "create") {
    signUpBtn.disabled = true;
    return;
  }
  signUpBtn.disabled = !isCreateModeValid();
  if (!currentSession) {
    setStatus(profileStatus, getCreateModeMessage());
  }
}

function clearAuthInputs() {
  if (displayNameInput) displayNameInput.value = "";
  if (emailInput) emailInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (confirmPasswordInput) confirmPasswordInput.value = "";
}

function updateProfileEditor() {
  const loggedIn = !!(currentSession && currentSession.user);
  if (!loggedIn) {
    if (profileDisplayNameInput) profileDisplayNameInput.value = "";
    if (saveDisplayNameBtn) saveDisplayNameBtn.disabled = true;
    return;
  }

  const ownProfile = currentProfiles.find((p) => p.id === currentSession.user.id);
  const displayName = ownProfile?.display_name || "";
  if (profileDisplayNameInput) profileDisplayNameInput.value = displayName;
  if (saveDisplayNameBtn) saveDisplayNameBtn.disabled = false;
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

  if (signedInStatus) {
    const ownProfile = currentProfiles.find((p) => p.id === currentSession?.user?.id);
    const namePart = ownProfile?.display_name ? ` (${ownProfile.display_name})` : "";
    signedInStatus.textContent = loggedIn ? `Signed in as ${currentSession.user.email}${namePart}` : "";
  }

  setStatus(authStatus, loggedIn ? `Signed in as ${currentSession.user.email}` : "Not signed in.");
  updateProfileEditor();
}

function initAuthModeControls() {
  if (authModeLoginBtn) authModeLoginBtn.addEventListener("click", () => setAuthMode("login"));
  if (authModeCreateBtn) authModeCreateBtn.addEventListener("click", () => setAuthMode("create"));
  if (displayNameInput) displayNameInput.addEventListener("input", updateCreateAccountButtonState);
  if (passwordInput) passwordInput.addEventListener("input", updateCreateAccountButtonState);
  if (confirmPasswordInput) confirmPasswordInput.addEventListener("input", updateCreateAccountButtonState);
  if (emailInput) emailInput.addEventListener("input", updateCreateAccountButtonState);
  setAuthMode("login");
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
  clearCountdownTimer();
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

function getStickyStateMessage() {
  if (!currentSession || !currentGroup || !currentEvent) return "Sign in to start.";
  if (isSubmittedForCurrentEvent) return "Your picks are submitted and locked.";
  if (hasLockTimePassed()) return "This event is locked.";
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
    if (fightsBox) fightsBox.innerHTML = '<div class="empty-state">No event found.</div>';
    if (countdownBox) countdownBox.textContent = "";
    updateStickyBar();
    return;
  }

  if (!currentFights.length) {
    if (fightsBox) fightsBox.innerHTML = '<div class="empty-state">No fights found.</div>';
    updateStickyBar();
    return;
  }

  if (fightsBox) {
    fightsBox.innerHTML = currentFights.map((fight) => renderPickForm(fight, picksMap[fight.id])).join("");
  }
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
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent || isSubmittedForCurrentEvent || hasLockTimePassed()) {
      return;
    }

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
    return;
  }

  const { data: submissions, error: submissionsError } = await supabaseClient
    .from("event_submissions")
    .select("*")
    .eq("group_id", currentGroup.id)
    .eq("event_id", currentEvent.id);

  if (submissionsError) {
    console.error(submissionsError);
    return;
  }

  const submittedCount = submissions ? submissions.length : 0;
  const ownSubmitted = submissions.some((row) => row.user_id === currentSession.user.id);

  isSubmittedForCurrentEvent = ownSubmitted;
  currentRevealOpen = memberCount > 0 && submittedCount >= memberCount;

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
  if (!othersStatus || !othersPicksBox) return;

  if (!currentSession || !currentGroup || !currentEvent) {
    othersStatus.textContent = "Hidden until everyone has submitted.";
    othersPicksBox.innerHTML = "Nothing to show yet.";
    return;
  }

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
      picksHtml += `<li>${escapeHtml(fightLabel)}: <strong>${escapeHtml(pick.picked_winner)}</strong> via ${escapeHtml(describePick(pick))}</li>`;
    });

    html += `
      <section class="card submitted-picks-card">
        <strong>${escapeHtml(getDisplayName(userId))}</strong>
        <ul>${picksHtml}</ul>
      </section>
    `;
  });

  othersStatus.textContent = "All submitted picks are now visible.";
  othersPicksBox.innerHTML = html;
}

function getLatestEventScoreParts(row) {
  const possibleArrays = [
    row.last_event_base_parts,
    row.latest_event_base_parts,
    row.base_parts,
    row.breakdown_parts
  ];
  for (const arr of possibleArrays) {
    if (Array.isArray(arr) && arr.length) {
      return arr.map((v) => toNumber(v));
    }
  }

  const rawParts = [
    row.last_event_correct_points,
    row.last_event_method_points,
    row.last_event_round_points,
    row.last_event_prop_points,
    row.last_event_bonus_base_points
  ];
  return rawParts
    .filter((v) => v !== undefined && v !== null)
    .map((v) => toNumber(v));
}

function getLatestEventBonusParts(row) {
  const highestScoreBonus = toNumber(
    row.last_event_highest_score_bonus ??
      row.highest_score_bonus ??
      row.latest_event_highest_score_bonus ??
      0
  );
  const flushBonus = toNumber(
    row.last_event_flush_bonus ??
      row.flush_bonus ??
      row.latest_event_flush_bonus ??
      0
  );
  const royalFlushBonus = toNumber(
    row.last_event_royal_flush_bonus ??
      row.royal_flush_bonus ??
      row.latest_event_royal_flush_bonus ??
      0
  );

  return [highestScoreBonus, flushBonus, royalFlushBonus].filter((v) => v > 0);
}

function getLatestEventTotal(row) {
  const explicitTotal =
    row.last_event_total ??
    row.latest_event_total ??
    row.event_points_last ??
    row.last_event_points;

  if (explicitTotal !== undefined && explicitTotal !== null && explicitTotal !== "") {
    return toNumber(explicitTotal);
  }

  const baseSum = getLatestEventScoreParts(row).reduce((sum, v) => sum + v, 0);
  const bonusSum = getLatestEventBonusParts(row).reduce((sum, v) => sum + v, 0);
  return baseSum + bonusSum;
}

function formatBaseBreakdown(row) {
  const parts = getLatestEventScoreParts(row);
  if (!parts.length) return "";
  return `(${parts.join("+")})`;
}

function formatBonusBreakdown(row) {
  const bonusParts = getLatestEventBonusParts(row);
  if (!bonusParts.length) return "";
  return `+(${bonusParts.join("+")})`;
}

function formatLatestEventBreakdown(row) {
  const total = getLatestEventTotal(row);
  const base = formatBaseBreakdown(row);
  const bonus = formatBonusBreakdown(row);

  if (!base && !bonus) return "No latest event breakdown yet.";
  return `${total} ${[base, bonus].filter(Boolean).join(" ")}`.trim();
}

function getLatestEventBonusLabels(row) {
  const labels = [];

  const highestScoreBonus = toNumber(
    row.last_event_highest_score_bonus ??
      row.highest_score_bonus ??
      row.latest_event_highest_score_bonus ??
      0
  );
  const flushBonus = toNumber(
    row.last_event_flush_bonus ??
      row.flush_bonus ??
      row.latest_event_flush_bonus ??
      0
  );
  const royalFlushBonus = toNumber(
    row.last_event_royal_flush_bonus ??
      row.royal_flush_bonus ??
      row.latest_event_royal_flush_bonus ??
      0
  );

  if (highestScoreBonus > 0) labels.push(`Highest score bonus +${highestScoreBonus}`);
  if (flushBonus > 0) labels.push(`Flush bonus +${flushBonus}`);
  if (royalFlushBonus > 0) labels.push(`Royal flush bonus +${royalFlushBonus}`);
  return labels;
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
      const currentPoints = row.current_points ?? row.total_points ?? row.totalpoints ?? 0;

      const lastEventTotal = getLatestEventTotal(row);
      const latestEventBreakdown = formatLatestEventBreakdown(row);
      const bonusLabels = getLatestEventBonusLabels(row);
      const eventLabel = row.last_event_name || (currentEvent && currentEvent.name) || "Latest event";

      return `
        <details class="card leaderboard-card">
          <summary>
            <div class="leaderboard-main">
              <div class="leaderboard-rank">${escapeHtml(rank)}. ${escapeHtml(name)}</div>
              <div class="leaderboard-subline">Last event: ${escapeHtml(lastEventTotal)}</div>
            </div>
            <div class="leaderboard-total">${escapeHtml(currentPoints)}</div>
          </summary>
          <div class="leaderboard-breakdown">
            <div class="leaderboard-detail-row">
              <span class="leaderboard-detail-label">Total points</span>
              <strong>${escapeHtml(currentPoints)}</strong>
            </div>
            <div class="leaderboard-detail-row">
              <span class="leaderboard-detail-label">${escapeHtml(eventLabel)}</span>
              <strong>${escapeHtml(latestEventBreakdown)}</strong>
            </div>
            ${
              bonusLabels.length
                ? `<div class="leaderboard-bonuses">${bonusLabels
                    .map((label) => `<span class="leaderboard-bonus-pill">${escapeHtml(label)}</span>`)
                    .join("")}</div>`
                : ""
            }
          </div>
        </details>
      `;
    })
    .join("");
}

async function loadLeaderboard() {
  if (!supabaseClient || !currentGroup) {
    currentLeaderboard = [];
    renderLeaderboard();
    return;
  }

  let query = supabaseClient
    .from("leaderboard")
    .select("*")
    .eq("group_id", currentGroup.id);

  if (currentEvent && currentEvent.event_date) {
    const seasonYear = new Date(currentEvent.event_date).getUTCFullYear();
    if (!Number.isNaN(seasonYear)) {
      query = query.eq("season_year", seasonYear);
    }
  }

  let scoresResult = await query.order("rank", { ascending: true });

  if (scoresResult.error) {
    scoresResult = await supabaseClient
      .from("leaderboard")
      .select("*")
      .eq("group_id", currentGroup.id)
      .order("current_points", { ascending: false });
  }

  if (scoresResult.error) {
    console.error(scoresResult.error);
    currentLeaderboard = [];
    leaderboardBox.innerHTML = `<div class="card empty-state">Error loading leaderboard: ${escapeHtml(scoresResult.error.message)}</div>`;
    return;
  }

  currentLeaderboard = scoresResult.data || [];
  renderLeaderboard();
}

async function submitAllPicks() {
  try {
    if (!supabaseClient || !currentSession || !currentGroup || !currentEvent) return;
    if (isSubmittedForCurrentEvent) {
      await loadSubmissionState();
      return;
    }
    if (hasLockTimePassed()) return;
    if (isAnyDraftSaving() || hasAnyDraftError() || !areAllDraftsComplete()) return;

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
      return;
    }

    isSubmittedForCurrentEvent = true;
    document.querySelectorAll("#fights-box select").forEach((el) => {
      el.disabled = true;
    });

    updateEventBadge();
    updateSubmitButtonState();
    renderEventScreen();
    await loadSubmissionState();
    await loadSubmittedPicks();
    await loadLeaderboard();
  } catch (err) {
    console.error(err);
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

async function saveDisplayName() {
  try {
    if (!supabaseClient) {
      setStatus(profileStatus, "Supabase is not initialized.");
      return;
    }

    const session = await refreshSession();
    if (!session) {
      setStatus(profileStatus, "You must be signed in.");
      return;
    }

    const displayName = profileDisplayNameInput ? profileDisplayNameInput.value.trim() : "";
    if (!displayName) {
      setStatus(profileStatus, "Enter a display name.");
      return;
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error(userError);
      setStatus(profileStatus, `Error loading user: ${userError.message}`);
      return;
    }

    const user = userData.user;
    if (!user) {
      setStatus(profileStatus, "You must be signed in.");
      return;
    }

    const { error } = await supabaseClient
      .from("profiles")
      .upsert({
        id: user.id,
        display_name: displayName
      });

    if (error) {
      console.error(error);
      setStatus(profileStatus, `Error saving name: ${error.message}`);
      return;
    }

    const profileIndex = currentProfiles.findIndex((p) => p.id === user.id);
    if (profileIndex >= 0) {
      currentProfiles[profileIndex] = { ...currentProfiles[profileIndex], display_name: displayName };
    } else {
      currentProfiles.push({ id: user.id, display_name: displayName });
    }

    updateAuthPanels();
    renderLeaderboard();
    await loadSubmittedPicks();
    setStatus(profileStatus, "Display name updated.");
  } catch (err) {
    console.error(err);
    setStatus(profileStatus, `Unexpected error: ${err.message}`);
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
    return null;
  }

  const groupResult = await supabaseClient
    .from("groups")
    .select("*")
    .eq("id", membershipResult.data.group_id)
    .single();

  if (groupResult.error) {
    console.error(groupResult.error);
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
  if (currentSession?.user?.id && !memberIds.includes(currentSession.user.id)) {
    memberIds.push(currentSession.user.id);
  }

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

async function ensureOwnProfileExists() {
  if (!supabaseClient || !currentSession?.user?.id) return;

  const user = currentSession.user;
  const fallbackName =
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Player";

  const alreadyExists = currentProfiles.some((p) => p.id === user.id);
  if (alreadyExists) return;

  const { error } = await supabaseClient
    .from("profiles")
    .upsert({
      id: user.id,
      display_name: fallbackName
    });

  if (error) {
    console.error(error);
    return;
  }

  currentProfiles.push({
    id: user.id,
    display_name: fallbackName
  });
}

async function loadAppData(preferredView = null) {
  try {
    if (!supabaseClient) return;

    const session = await refreshSession();
    if (!session) {
      resetAppState();
      resetSignedOutUI();
      return;
    }

    currentGroup = await loadCurrentGroup();

    if (!currentGroup) {
      if (fightsBox) fightsBox.innerHTML = "No group found.";
      if (countdownBox) countdownBox.textContent = "";
      currentLeaderboard = [];
      renderLeaderboard();
      updateAuthPanels();
      updateStickyBar();
      if (preferredView) switchView(preferredView);
      return;
    }

    await loadProfilesForCurrentGroup();
    await ensureOwnProfileExists();
    updateAuthPanels();

    const eventsResult = await supabaseClient
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .limit(1);

    if (eventsResult.error) {
      console.error(eventsResult.error);
      return;
    }

    currentEvent = eventsResult.data && eventsResult.data.length ? eventsResult.data[0] : null;
    if (eventBox) eventBox.textContent = formatEventName(currentEvent);
    startCountdownTimer();

    if (!currentEvent) {
      if (fightsBox) fightsBox.innerHTML = "No fights found.";
      currentLeaderboard = [];
      renderLeaderboard();
      updateStickyBar();
      if (preferredView) {
        switchView(preferredView);
      } else if (currentView !== "leaderboard" && currentView !== "profile") {
        switchView("event");
      }
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
      return;
    }

    currentOwnPicks = picksResult.data || [];
    pickDrafts = {};
    saveTimers = {};
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

    if (preferredView) {
      switchView(preferredView);
    } else if (currentView !== "leaderboard" && currentView !== "profile") {
      switchView("event");
    }
  } catch (err) {
    console.error(err);
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

async function handleAuthStateChange(event) {
  if (authChangeInFlight) return;
  authChangeInFlight = true;

  try {
    await refreshSession();

    if (event === "SIGNED_OUT" || !currentSession) {
      resetAppState();
      resetSignedOutUI();
      return;
    }

    if (event === "SIGNED_IN") {
      await loadAppData("event");
      return;
    }

    await loadAppData();
  } finally {
    authChangeInFlight = false;
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
        resetSignedOutUI();
      }
    });

    const { data } = supabaseClient.auth.onAuthStateChange((event) => {
      setTimeout(() => {
        handleAuthStateChange(event);
      }, 0);
    });

    authStateSubscription = data?.subscription || null;
  } catch (err) {
    console.error(err);
    setStatus(authStatus, `Initialization error: ${err.message}`);
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

      const displayName = displayNameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) {
        console.error(error);
        setStatus(profileStatus, `Signup error: ${error.message}`);
        return;
      }

      const user = data?.user;
      if (user) {
        const { error: profileError } = await supabaseClient
          .from("profiles")
          .upsert({
            id: user.id,
            display_name: displayName
          });

        if (profileError) {
          console.error(profileError);
          setStatus(profileStatus, `Profile setup error: ${profileError.message}`);
          return;
        }
      }

      setStatus(profileStatus, "Account created.");
      clearAuthInputs();
      await refreshSession();
      if (currentSession) {
        await loadAppData("event");
      } else {
        setAuthMode("login");
      }
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
      await loadAppData("event");
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

      const { error } = await supabaseClient.auth.signOut({ scope: "local" });
      if (error) {
        console.error(error);
        setStatus(profileStatus, `Logout error: ${error.message}`);
        return;
      }

      setStatus(profileStatus, "Logged out.");
    } catch (err) {
      console.error(err);
      setStatus(profileStatus, `Logout exception: ${err.message}`);
    }
  });
}

if (saveDisplayNameBtn) {
  saveDisplayNameBtn.addEventListener("click", saveDisplayName);
}

if (stickySubmitBtn) stickySubmitBtn.addEventListener("click", submitAllPicks);
if (submitAllBtn) submitAllBtn.addEventListener("click", submitAllPicks);
if (changePasswordBtn) changePasswordBtn.addEventListener("click", changePassword);

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initAuthModeControls();
  initSupabase();
  switchView("profile");
});
