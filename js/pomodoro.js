/* StudySnap — Pomodoro focus timer component.
   Walks through the study planner sessions (MOCK.studyPlan.blocks):
   work session → break → next task. Plain script, works over file://. */
(function () {
  "use strict";

  var WORK_MINUTES = 25;  // default work session
  var BREAK_MINUTES = 5;  // default break
  var RING_RADIUS = 98;
  var CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  var TICK_MS = 250;

  var root = document.getElementById("pomodoro");
  if (!root) return;

  var els = {
    time: document.getElementById("pomo-time"),
    label: document.getElementById("pomo-label"),
    kind: document.getElementById("pomo-kind"),
    task: document.getElementById("pomo-task"),
    ringWrap: document.getElementById("pomo-ring-wrap"),
    ringFill: document.getElementById("pomo-fill"),
    start: document.getElementById("pomo-start"),
    reset: document.getElementById("pomo-reset"),
    skip: document.getElementById("pomo-skip"),
    sessions: document.getElementById("pomo-sessions")
  };

  var baseTitle = document.title;

  /* Turn planner blocks into an alternating work/break queue. Breaks the
     planner didn't schedule fall back to the 5-minute default; a break can
     only follow a work session, and the queue never ends on one. */
  function buildQueue(blocks) {
    var queue = [];
    (blocks || []).forEach(function (block) {
      var prevIsWork = queue.length > 0 && queue[queue.length - 1].type === "work";
      if (block.kind === "break") {
        if (prevIsWork) {
          queue.push({ type: "break", label: block.title || "Break", minutes: block.minutes || BREAK_MINUTES });
        }
      } else {
        if (prevIsWork) {
          queue.push({ type: "break", label: "Break", minutes: BREAK_MINUTES });
        }
        queue.push({ type: "work", label: block.title || "Focus session", minutes: block.minutes || WORK_MINUTES });
      }
    });
    while (queue.length && queue[queue.length - 1].type === "break") queue.pop();
    if (!queue.length) {
      queue.push({ type: "work", label: "Focus session", minutes: WORK_MINUTES });
    }
    return queue;
  }

  var state = {
    queue: buildQueue(window.MOCK && MOCK.studyPlan && MOCK.studyPlan.blocks),
    index: 0,
    total: 0,      // seconds in the current session
    remaining: 0,  // seconds left in the current session
    endAt: 0,      // wall-clock end time while running (survives tab throttling)
    running: false,
    finished: false,
    tickId: null
  };

  function current() {
    return state.queue[state.index];
  }

  function loadPhase(index) {
    state.index = index;
    state.finished = false;
    state.total = current().minutes * 60;
    state.remaining = state.total;
  }

  function run() {
    state.running = true;
    state.endAt = Date.now() + state.remaining * 1000;
    clearInterval(state.tickId);
    state.tickId = setInterval(tick, TICK_MS);
    render();
  }

  function pause() {
    state.running = false;
    clearInterval(state.tickId);
    render();
  }

  function toggle() {
    if (state.finished) {
      loadPhase(0);
      run();
    } else if (state.running) {
      pause();
    } else {
      run();
    }
  }

  function tick() {
    var remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    if (remaining === state.remaining) return;
    state.remaining = remaining;
    if (remaining === 0) {
      phaseEnded();
    } else {
      render();
    }
  }

  function phaseEnded() {
    beep(current().type === "work");
    if (state.index + 1 >= state.queue.length) {
      finish();
    } else {
      loadPhase(state.index + 1);
      state.endAt = Date.now() + state.remaining * 1000;
      render();
    }
  }

  function finish() {
    clearInterval(state.tickId);
    state.running = false;
    state.finished = true;
    state.remaining = 0;
    render();
  }

  function skip() {
    if (state.finished) return;
    if (state.index + 1 >= state.queue.length) {
      finish();
      return;
    }
    loadPhase(state.index + 1);
    if (state.running) {
      state.endAt = Date.now() + state.remaining * 1000;
    }
    render();
  }

  function resetSession() {
    if (state.finished) {
      loadPhase(0);
    } else {
      clearInterval(state.tickId);
      state.running = false;
      state.remaining = state.total;
    }
    render();
  }

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function beep(endedWork) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = beep.ctx || (beep.ctx = new Ctx());
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = endedWork ? 660 : 523;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (err) {
      /* sound is a nice-to-have; never let it break the timer */
    }
  }

  function render() {
    var phase = current();
    var isBreak = !state.finished && phase.type === "break";

    els.time.textContent = formatTime(state.remaining);
    els.ringWrap.classList.toggle("mode-break", isBreak);

    var frac = state.total > 0 ? state.remaining / state.total : 0;
    els.ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - frac);

    if (state.finished) {
      els.kind.textContent = "Done";
      els.kind.classList.remove("is-break");
      els.task.textContent = "All sessions complete — nice work!";
      els.label.textContent = "Plan finished";
    } else {
      els.kind.textContent = isBreak ? "Break" : "Focus";
      els.kind.classList.toggle("is-break", isBreak);
      els.task.textContent = phase.label;
      if (state.running) {
        els.label.textContent = isBreak ? "Recharge — back soon" : "Stay on task";
      } else {
        els.label.textContent = state.remaining === state.total ? "Ready when you are" : "Paused";
      }
    }

    els.start.innerHTML = state.running
      ? window.icon("pause") + " Pause"
      : window.icon("play") + (state.finished ? " Start over" : " Start");
    els.skip.disabled = state.finished;

    renderSessions();

    document.title = state.running
      ? formatTime(state.remaining) + " · " + (isBreak ? "Break" : phase.label) + " — StudySnap"
      : baseTitle;
  }

  function renderSessions() {
    var total = 0;
    var done = 0;
    state.queue.forEach(function (phase, i) {
      if (phase.type !== "work") return;
      total++;
      if (state.finished || i < state.index) done++;
    });
    var html = "";
    for (var i = 0; i < total; i++) {
      html += '<span class="pomo-dot' + (i < done ? " done" : "") + '"></span>';
    }
    els.sessions.innerHTML = html + "<span>" + done + " of " + total + " sessions done</span>";
    els.sessions.setAttribute("aria-label", done + " of " + total + " focus sessions completed");
  }

  // Hydrate the section's data-icon placeholders (the component owns its card).
  root.querySelectorAll("[data-icon]").forEach(function (el) {
    el.innerHTML = window.icon(el.getAttribute("data-icon"));
  });

  els.ringFill.style.strokeDasharray = CIRCUMFERENCE;
  els.start.addEventListener("click", toggle);
  els.reset.addEventListener("click", resetSession);
  els.skip.addEventListener("click", skip);

  // Small public API so other components (task modal, study plan card)
  // can kick off a session.
  window.StudySnapTimer = {
    start: function () {
      if (state.finished) loadPhase(0);
      if (!state.running) run();
    },
    pause: pause,
    reload: function (blocks) {
      if (state.running) return; // don't interrupt an active session
      state.queue = buildQueue(blocks);
      loadPhase(0);
      render();
    }
  };

  loadPhase(0);
  render();
})();
