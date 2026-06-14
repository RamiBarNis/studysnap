/* StudySnap — app logic (no framework, no build step).
   State lives in memory; theme, last view, and tasks persist in localStorage. */
(function () {
  "use strict";

  var MOCK = window.MOCK;
  var icon = window.icon;
  var TASKS_KEY = "studysnap-tasks";

  var state = {
    tasks: MOCK.tasks.slice(),
    filter: "all",
    resourceFilter: "All",
    detectedAdded: false,
    activeTaskId: null,
    lastFocusedEl: null
  };

  function saveTasks() {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify({
        tasks: state.tasks,
        detectedAdded: state.detectedAdded
      }));
    } catch (e) { /* private mode or storage quota */ }
  }

  function loadSavedTasks() {
    try {
      var raw = localStorage.getItem(TASKS_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (Array.isArray(saved.tasks) && saved.tasks.length) {
        state.tasks = saved.tasks;
        state.detectedAdded = !!saved.detectedAdded;
      }
    } catch (e) { /* corrupt data — fall back to mock */ }
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Static icon placeholders ---------- */
  function hydrateIcons(root) {
    $all("[data-icon]", root).forEach(function (el) {
      el.innerHTML = icon(el.getAttribute("data-icon"));
    });
  }

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("studysnap-theme", theme); } catch (e) { /* private mode */ }
    $all(".theme-toggle").forEach(function (btn) {
      btn.innerHTML = icon(theme === "dark" ? "sun" : "moon");
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("studysnap-theme"); } catch (e) { /* ignore */ }
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
    $all(".theme-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(next);
      });
    });
  }

  /* ---------- View switching ---------- */
  function showView(name) {
    var landing = $("#view-landing");
    var app = $("#view-app");
    landing.hidden = name !== "landing";
    app.hidden = name !== "app";
    try { localStorage.setItem("studysnap-view", name); } catch (e) { /* ignore */ }
    window.scrollTo(0, 0);
  }

  function initViews() {
    $all("[data-action='go-app']").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); showView("app"); });
    });
    $all("[data-action='go-landing']").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); showView("landing"); });
    });
    var saved = null;
    try { saved = localStorage.getItem("studysnap-view"); } catch (e) { /* ignore */ }
    showView(saved === "app" ? "app" : "landing");
  }

  /* ---------- Toast ---------- */
  function toast(message, iconName) {
    var root = $("#toast-root");
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = icon(iconName || "check-circle") + escapeHtml(message);
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity 250ms ease";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 260);
    }, 3200);
  }

  /* ---------- Subject chip ---------- */
  function subjectChip(name) {
    var s = MOCK.subjects[name];
    if (!s) return "";
    return '<span class="chip" style="color:' + s.color + ';background:' + s.bg + '">' + escapeHtml(name) + "</span>";
  }

  function prioBadge(p) {
    var labels = { high: "High", medium: "Medium", low: "Low" };
    return '<span class="prio prio-' + p + '">' + icon("flag") + labels[p] + "</span>";
  }

  /* ---------- Checklist ---------- */
  function visibleTasks() {
    return state.tasks.filter(function (t) {
      if (state.filter === "todo") return !t.completed;
      if (state.filter === "done") return t.completed;
      return true;
    });
  }

  function renderProgress() {
    var done = state.tasks.filter(function (t) { return t.completed; }).length;
    var total = state.tasks.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    $("#progress-fill").style.width = pct + "%";
    $("#progress-bar").setAttribute("aria-valuenow", String(pct));
    $("#progress-label").textContent = done + " of " + total + " done";
    var left = total - done;
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var now = new Date();
    var dateStr = days[now.getDay()] + ", " + months[now.getMonth()] + " " + now.getDate();
    var todayTask = state.tasks.find(function (t) { return t.due === "Today" && !t.completed; });
    var urgentNote = todayTask ? " · " + todayTask.title + " is due today" : "";
    $("#greeting-sub").textContent =
      dateStr + " · " + (left === 0 ? "All caught up 🎉" : left + " task" + (left === 1 ? "" : "s") + " left" + urgentNote);
  }

  function renderTasks() {
    var list = $("#task-list");
    var tasks = visibleTasks();
    if (!tasks.length) {
      list.innerHTML =
        '<li class="empty-state">' + icon("check-circle") +
        "<p>Nothing here — " + (state.filter === "done" ? "no finished tasks yet." : "you're all caught up!") + "</p></li>";
      renderProgress();
      return;
    }
    list.innerHTML = tasks.map(function (t) {
      var doneSub = t.subtasks.filter(function (s) { return s.done; }).length;
      return (
        '<li class="task-item' + (t.completed ? " done" : "") + '" data-id="' + t.id + '">' +
          '<button class="task-check" type="button" data-toggle="' + t.id + '" role="checkbox" aria-checked="' + t.completed + '" aria-label="Mark “' + escapeHtml(t.title) + '” as ' + (t.completed ? "not done" : "done") + '">' +
            icon("check") +
          "</button>" +
          '<div class="task-body">' +
            '<button class="task-title-btn" type="button" data-open="' + t.id + '">' + escapeHtml(t.title) + "</button>" +
            '<div class="task-meta">' +
              subjectChip(t.subject) +
              '<span class="meta-bit' + (t.due === "Today" ? " due-today" : "") + '">' + icon("calendar") + "Due " + escapeHtml(t.due) + "</span>" +
              '<span class="meta-bit">' + icon("clock") + t.estMinutes + " min</span>" +
              prioBadge(t.priority) +
              '<span class="meta-bit">' + icon("list-checks") + doneSub + "/" + t.subtasks.length + "</span>" +
            "</div>" +
          "</div>" +
          '<button class="icon-btn task-open" type="button" data-open="' + t.id + '" aria-label="Open details for ' + escapeHtml(t.title) + '">' +
            icon("chevron-right") +
          "</button>" +
        "</li>"
      );
    }).join("");
    renderProgress();
  }

  function toggleTask(id) {
    var t = state.tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    t.completed = !t.completed;
    if (t.completed) {
      t.due = "Done";
      t.subtasks.forEach(function (s) { s.done = true; });
      toast("Nice! \u201c" + t.title + "\u201d checked off", "check-circle");
    }
    saveTasks();
    renderTasks();
    renderPlan();
  }

  function initChecklist() {
    $("#task-list").addEventListener("click", function (e) {
      var toggle = e.target.closest("[data-toggle]");
      if (toggle) { toggleTask(toggle.getAttribute("data-toggle")); return; }
      var open = e.target.closest("[data-open]");
      if (open) openTaskModal(open.getAttribute("data-open"));
    });
    $all(".filter-btn[data-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter");
        $all(".filter-btn[data-filter]").forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        renderTasks();
      });
    });
    $("#add-task-btn").addEventListener("click", openAddTaskModal);
    renderTasks();
  }

  /* ---------- Add task modal ---------- */
  function resolveDueDate(due) {
    var now = new Date();
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var d = new Date(now);
    if (due === "Today") return months[now.getMonth()] + " " + now.getDate();
    if (due === "Tomorrow") { d.setDate(d.getDate() + 1); return months[d.getMonth()] + " " + d.getDate(); }
    if (due === "This Friday") {
      var fri = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + fri);
      return months[d.getMonth()] + " " + d.getDate();
    }
    if (due === "Next Monday") {
      var mon = (1 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + mon);
      return months[d.getMonth()] + " " + d.getDate();
    }
    return due;
  }

  function openAddTaskModal() {
    state.lastFocusedEl = document.activeElement;
    var subjects = Object.keys(MOCK.subjects);
    var dueOpts = ["Today", "Tomorrow", "This Friday", "Next Monday", "Next week"];

    $("#modal-root").innerHTML =
      '<div class="modal-overlay" id="modal-overlay">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="add-modal-title">' +
          '<div class="modal-header">' +
            '<h2 id="add-modal-title">Add a task</h2>' +
            '<button class="icon-btn" type="button" id="modal-close" aria-label="Close">' + icon("x") + "</button>" +
          "</div>" +
          '<div class="modal-body">' +
            '<div class="form-group">' +
              '<label class="form-label" for="at-title">Task title</label>' +
              '<input class="form-input" type="text" id="at-title" placeholder="e.g. Chapter 3 reading" autocomplete="off" />' +
            "</div>" +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label class="form-label" for="at-subject">Subject</label>' +
                '<select class="form-select" id="at-subject">' +
                  subjects.map(function (s) { return '<option>' + escapeHtml(s) + "</option>"; }).join("") +
                "</select>" +
              "</div>" +
              '<div class="form-group">' +
                '<label class="form-label" for="at-priority">Priority</label>' +
                '<select class="form-select" id="at-priority">' +
                  '<option value="high">High</option>' +
                  '<option value="medium" selected>Medium</option>' +
                  '<option value="low">Low</option>' +
                "</select>" +
              "</div>" +
            "</div>" +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label class="form-label" for="at-due">Due</label>' +
                '<select class="form-select" id="at-due">' +
                  dueOpts.map(function (d) { return '<option>' + escapeHtml(d) + "</option>"; }).join("") +
                "</select>" +
              "</div>" +
              '<div class="form-group">' +
                '<label class="form-label" for="at-mins">Est. minutes</label>' +
                '<input class="form-input" type="number" id="at-mins" min="5" max="300" step="5" value="30" />' +
              "</div>" +
            "</div>" +
          "</div>" +
          '<div class="modal-footer">' +
            '<button class="btn btn-ghost" type="button" id="modal-cancel">Cancel</button>' +
            '<button class="btn btn-primary" type="button" id="modal-save">' + icon("plus") + " Add task</button>" +
          "</div>" +
        "</div>" +
      "</div>";

    var overlay = $("#modal-overlay");
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-cancel").addEventListener("click", closeModal);
    document.addEventListener("keydown", onModalKeydown);

    $("#modal-save").addEventListener("click", function () {
      var titleEl = $("#at-title");
      var title = titleEl.value.trim();
      if (!title) {
        titleEl.classList.add("invalid");
        titleEl.focus();
        return;
      }
      titleEl.classList.remove("invalid");
      var due = $("#at-due").value;
      var newTask = {
        id: "m" + Date.now(),
        title: title,
        subject: $("#at-subject").value,
        due: due,
        dueDate: resolveDueDate(due),
        priority: $("#at-priority").value,
        estMinutes: Math.max(5, parseInt($("#at-mins").value, 10) || 30),
        completed: false,
        source: "Added manually",
        description: "",
        subtasks: []
      };
      state.tasks.push(newTask);
      saveTasks();
      renderTasks();
      renderPlan();
      closeModal();
      toast("Task added: " + title, "list-checks");
    });

    $("#at-title").focus();
  }

  /* ---------- Task details modal ---------- */
  function openTaskModal(id) {
    var t = state.tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    state.activeTaskId = id;
    state.lastFocusedEl = document.activeElement;

    var subtasksHtml = t.subtasks.map(function (s, i) {
      return (
        '<button class="subtask' + (s.done ? " done" : "") + '" type="button" data-subtask="' + i + '" role="checkbox" aria-checked="' + s.done + '">' +
          '<span class="task-check" style="' + (s.done ? "background:var(--success);border-color:var(--success);color:#fff" : "") + '">' + icon("check") + "</span>" +
          "<span>" + escapeHtml(s.label) + "</span>" +
        "</button>"
      );
    }).join("");

    $("#modal-root").innerHTML =
      '<div class="modal-overlay" id="modal-overlay">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
          '<div class="modal-header">' +
            '<h2 id="modal-title">' + escapeHtml(t.title) + "</h2>" +
            '<button class="icon-btn" type="button" id="modal-close" aria-label="Close task details">' + icon("x") + "</button>" +
          "</div>" +
          '<div class="modal-body">' +
            '<div class="modal-tags">' + subjectChip(t.subject) + prioBadge(t.priority) + "</div>" +
            '<p class="modal-desc">' + escapeHtml(t.description) + "</p>" +
            '<div class="modal-facts">' +
              '<div class="fact">Due<strong>' + escapeHtml(t.due) + " · " + escapeHtml(t.dueDate) + "</strong></div>" +
              '<div class="fact">Estimated<strong>' + t.estMinutes + " min</strong></div>" +
              '<div class="fact">Source<strong>' + escapeHtml(t.source) + "</strong></div>" +
            "</div>" +
            '<h3 class="subtasks-title">Subtasks</h3>' +
            subtasksHtml +
          "</div>" +
          '<div class="modal-footer">' +
            (MOCK.aiExplanations[id] ? '<button class="btn btn-ghost" type="button" id="modal-ai">' + icon("sparkles") + " AI explanation</button>" : "") +
            '<button class="btn btn-accent" type="button" id="modal-focus">' + icon("timer") + " Start focus session</button>" +
            '<button class="btn ' + (t.completed ? "btn-ghost" : "btn-primary") + '" type="button" id="modal-complete">' +
              icon("check") + (t.completed ? " Mark as not done" : " Mark complete") +
            "</button>" +
          "</div>" +
        "</div>" +
      "</div>";

    var overlay = $("#modal-overlay");
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-complete").addEventListener("click", function () {
      toggleTask(id);
      closeModal();
    });
    $("#modal-focus").addEventListener("click", function () {
      closeModal();
      startFocusSession();
      toast("Focus session started for \u201c" + t.title + "\u201d", "timer");
    });
    var aiBtn = $("#modal-ai");
    if (aiBtn) {
      aiBtn.addEventListener("click", function () {
        closeModal();
        renderAI(id);
        var section = $(".ai-section");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        toast("AI explanation loaded for \u201c" + t.title + "\u201d", "sparkles");
      });
    }
    $all("[data-subtask]", overlay).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = Number(btn.getAttribute("data-subtask"));
        t.subtasks[idx].done = !t.subtasks[idx].done;
        saveTasks();
        openTaskModal(id); // re-render modal in place
        renderTasks();
      });
    });
    document.addEventListener("keydown", onModalKeydown);
    $("#modal-close").focus();
  }

  function onModalKeydown(e) {
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") {
      // simple focus trap
      var focusables = $all(".modal button", $("#modal-root"));
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function closeModal() {
    $("#modal-root").innerHTML = "";
    document.removeEventListener("keydown", onModalKeydown);
    state.activeTaskId = null;
    if (state.lastFocusedEl && document.contains(state.lastFocusedEl)) state.lastFocusedEl.focus();
  }

  /* ---------- Upload / scan ---------- */
  function initUpload() {
    var dz = $("#dropzone");
    var input = $("#file-input");

    $("#browse-btn").addEventListener("click", function () { input.click(); });
    $("#sample-btn").addEventListener("click", function () { startScan(null, "sample-worksheet.jpg"); });

    input.addEventListener("change", function () {
      if (input.files && input.files[0]) startScan(input.files[0], input.files[0].name);
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragover"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("dragover"); });
    });
    dz.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && f.type.indexOf("image/") === 0) startScan(f, f.name);
      else toast("Please drop an image file", "image");
    });
  }

  function startScan(file, fileName) {
    var area = $("#scan-area");
    var thumbInner = icon("image");
    area.innerHTML =
      '<div class="scan-preview">' +
        '<div class="scan-thumb" id="scan-thumb">' + thumbInner + "</div>" +
        '<div class="scan-meta">' +
          "<strong>" + escapeHtml(fileName) + "</strong>" +
          '<span id="scan-status">Scanning for assignments…</span>' +
          '<div class="scan-progress"><div class="scan-progress-fill" id="scan-fill"></div></div>' +
        "</div>" +
      "</div>" +
      '<div class="scan-results" id="scan-results"></div>';

    if (file) {
      var reader = new FileReader();
      reader.onload = function () {
        $("#scan-thumb").innerHTML = '<img src="' + reader.result + '" alt="Preview of uploaded homework photo" />';
      };
      reader.readAsDataURL(file);
    }

    // Mock scan: progress bar over ~1.8s, then show detected tasks.
    var fill = $("#scan-fill");
    var stages = [18, 42, 67, 88, 100];
    stages.forEach(function (pct, i) {
      setTimeout(function () {
        fill.style.width = pct + "%";
        if (pct === 100) finishScan();
      }, 350 * (i + 1));
    });
  }

  function finishScan() {
    $("#scan-status").textContent = "Scan complete";
    var results = $("#scan-results");
    var alreadyAdded = state.detectedAdded;
    results.innerHTML =
      '<div class="scan-result-banner">' + icon("check-circle") + "Found " + MOCK.detectedTasks.length + " assignments in your photo</div>" +
      MOCK.detectedTasks.map(function (t) {
        return (
          '<div class="detected-item">' +
            icon("file-text") +
            '<div class="detected-info"><strong>' + escapeHtml(t.title) + "</strong><span>Due " + escapeHtml(t.due) + " · ~" + t.estMinutes + " min</span></div>" +
            subjectChip(t.subject) +
          "</div>"
        );
      }).join("") +
      '<button class="btn btn-primary" type="button" id="add-detected"' + (alreadyAdded ? " disabled" : "") + ">" +
        icon("plus") + (alreadyAdded ? " Already added to checklist" : " Add all to checklist") +
      "</button>";

    var addBtn = $("#add-detected");
    if (!alreadyAdded) {
      addBtn.addEventListener("click", function () {
        MOCK.detectedTasks.forEach(function (t) {
          state.tasks.push(JSON.parse(JSON.stringify(t)));
        });
        state.detectedAdded = true;
        saveTasks();
        addBtn.disabled = true;
        addBtn.innerHTML = icon("check") + " Added to checklist";
        renderTasks();
        renderPlan();
        toast(MOCK.detectedTasks.length + " tasks added to your checklist", "list-checks");
      });
    }
  }

  /* ---------- Study plan ---------- */
  function buildPlan() {
    var POMO = 25;
    var BRK = 5;
    var RANK = { high: 0, medium: 1, low: 2 };

    var pending = state.tasks.filter(function (t) { return !t.completed; });
    if (!pending.length) {
      return {
        headline: "All done!",
        summary: "Every task is checked off. You've earned the free time.",
        blocks: [],
        reasons: ["All tasks completed — nothing left to plan."]
      };
    }

    var ordered = pending.slice().sort(function (a, b) {
      var aT = a.due === "Today" ? 0 : 1, bT = b.due === "Today" ? 0 : 1;
      if (aT !== bT) return aT - bT;
      var ap = RANK[a.priority] !== undefined ? RANK[a.priority] : 1;
      var bp = RANK[b.priority] !== undefined ? RANK[b.priority] : 1;
      if (ap !== bp) return ap - bp;
      return a.estMinutes - b.estMinutes;
    });

    var now = new Date();
    var cursor = now.getHours() * 60 + now.getMinutes();
    cursor = Math.ceil(cursor / 5) * 5;

    function fmt(min) {
      var hh = Math.floor(min / 60) % 24;
      var mm = min % 60;
      var h = hh % 12 || 12;
      return h + ":" + (mm < 10 ? "0" + mm : mm) + " " + (hh >= 12 ? "PM" : "AM");
    }

    var blocks = [];
    ordered.forEach(function (task, ti) {
      var rem = task.estMinutes;
      var parts = Math.ceil(rem / POMO);
      var part = 0;
      while (rem > 0) {
        part++;
        var mins = Math.min(POMO, rem);
        var label = parts > 1 ? task.title + " (" + part + "/" + parts + ")" : task.title;
        blocks.push({ time: fmt(cursor), title: label, subject: task.subject, minutes: mins, kind: "focus" });
        cursor += mins;
        rem -= mins;
        var isLast = rem <= 0 && ti === ordered.length - 1;
        if (!isLast) {
          blocks.push({ time: fmt(cursor), title: "Short break", subject: null, minutes: BRK, kind: "break" });
          cursor += BRK;
        }
      }
    });

    var focusCount = blocks.filter(function (b) { return b.kind === "focus"; }).length;
    var totalMin = blocks.reduce(function (s, b) { return s + b.minutes; }, 0);
    var h = Math.floor(totalMin / 60), m = totalMin % 60;
    var dur = h > 0 ? h + " hr" + (m ? " " + m + " min" : "") : m + " min";

    var reasons = [];
    var todayTasks = ordered.filter(function (t) { return t.due === "Today"; });
    if (todayTasks.length) reasons.push(todayTasks[0].title + " is due today — it leads the plan");
    var highPri = ordered.filter(function (t) { return t.priority === "high" && t.due !== "Today"; });
    if (highPri.length) reasons.push("High-priority tasks come next for your freshest focus");
    if (focusCount > 1) reasons.push("25-minute blocks with 5-minute breaks keep your energy up");

    var tod = now.getHours() >= 18 ? "tonight" : now.getHours() >= 12 ? "this afternoon" : "this morning";
    return {
      headline: "Your plan for " + tod,
      summary: dur + " across " + focusCount + " focus block" + (focusCount !== 1 ? "s" : "") + ". " + ordered[0].title + " goes first.",
      blocks: blocks,
      reasons: reasons
    };
  }

  function renderPlan() {
    var plan = buildPlan();
    var kindIcon = { focus: "pencil", break: "coffee" };
    var kindColor = { focus: "var(--primary)", break: "var(--success)" };
    var area = $("#plan-area");

    if (!plan.blocks.length) {
      area.innerHTML =
        '<div class="plan-summary"><strong>' + escapeHtml(plan.headline) + "</strong><br />" + escapeHtml(plan.summary) + "</div>" +
        '<ul class="plan-reasons"><li>' + icon("check-circle") + escapeHtml(plan.reasons[0]) + "</li></ul>";
      if (window.StudySnapTimer && window.StudySnapTimer.reload) window.StudySnapTimer.reload([]);
      return;
    }

    area.innerHTML =
      '<div class="plan-summary"><strong>' + escapeHtml(plan.headline) + "</strong><br />" + escapeHtml(plan.summary) + "</div>" +
      '<ul class="plan-list">' +
        plan.blocks.map(function (b) {
          return (
            '<li class="plan-block kind-' + b.kind + '">' +
              '<span class="plan-time">' + escapeHtml(b.time) + "</span>" +
              '<div class="plan-pill">' +
                '<span style="color:' + (kindColor[b.kind] || "var(--primary)") + ';display:inline-flex">' + icon(kindIcon[b.kind] || "pencil") + "</span>" +
                '<span class="plan-pill-label">' + escapeHtml(b.title) + "</span>" +
                (b.subject ? subjectChip(b.subject) : "") +
                '<span class="plan-pill-mins">' + b.minutes + "m</span>" +
              "</div>" +
            "</li>"
          );
        }).join("") +
      "</ul>" +
      '<ul class="plan-reasons">' +
        plan.reasons.map(function (r) { return "<li>" + icon("lightbulb") + escapeHtml(r) + "</li>"; }).join("") +
      "</ul>" +
      '<button class="btn btn-accent" type="button" id="plan-start">' + icon("play") + " Start first block</button>";

    if (window.StudySnapTimer && window.StudySnapTimer.reload) window.StudySnapTimer.reload(plan.blocks);

    $("#plan-start").addEventListener("click", function () {
      startFocusSession();
      toast("First block started: " + plan.blocks[0].title, "timer");
    });
  }

  /* ---------- Pomodoro timer ----------
     The timer itself lives in js/pomodoro.js (plan-driven session queue);
     it exposes window.StudySnapTimer for the modal and plan card. */
  function startFocusSession() {
    if (window.StudySnapTimer) window.StudySnapTimer.start();
    var section = $("#pomodoro");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------- AI explanation ---------- */
  function renderAI(taskId) {
    var ai = MOCK.aiExplanations[taskId || "t1"] || MOCK.aiExplanations.t1;
    var task = taskId && state.tasks.find(function (t) { return t.id === taskId; });
    var subtitle = task ? "For: " + task.title : "From your scanned Math worksheet";

    var subEl = document.querySelector(".ai-section .card-sub");
    if (subEl) subEl.textContent = subtitle;

    $("#ai-area").innerHTML =
      '<div class="ai-problem">' +
        subjectChip(ai.subject) +
        '<span class="ai-problem-math">' + escapeHtml(ai.problem) + "</span>" +
        '<span class="chip" style="color:var(--muted);background:var(--surface)">' + escapeHtml(ai.topic) + "</span>" +
      "</div>" +
      '<div class="ai-confidence">' + icon("check-circle") + escapeHtml(ai.confidence) + "</div>" +
      '<div id="ai-steps-area"><button class="btn btn-accent" type="button" id="ai-explain">' + icon("sparkles") + " Explain it step by step</button></div>";

    $("#ai-explain").addEventListener("click", function () {
      $("#ai-steps-area").innerHTML =
        '<div class="ai-steps">' +
          ai.steps.map(function (s, i) {
            return (
              '<div class="ai-step">' +
                '<span class="ai-step-num" aria-hidden="true">' + (i + 1) + "</span>" +
                "<div><h4>" + escapeHtml(s.title) + "</h4><p>" + escapeHtml(s.body) + "</p>" +
                '<code class="ai-math">' + escapeHtml(s.math) + "</code></div>" +
              "</div>"
            );
          }).join("") +
        "</div>" +
        '<div class="ai-answer">' + icon("check-circle") + "Answer: " + escapeHtml(ai.answer) + "</div>" +
        '<div class="concept-row">' +
          ai.concepts.map(function (c) { return '<span class="concept-chip">' + escapeHtml(c) + "</span>"; }).join("") +
        "</div>";
    });
  }

  /* ---------- Resources ---------- */
  function renderResourceFilters() {
    var subjects = ["All"].concat(Object.keys(
      MOCK.resources.reduce(function (acc, r) { acc[r.subject] = true; return acc; }, {})
    ));
    $("#resource-filters").innerHTML = subjects.map(function (s) {
      return '<button class="filter-btn" type="button" data-rfilter="' + escapeHtml(s) + '" aria-pressed="' + (s === state.resourceFilter) + '">' + escapeHtml(s) + "</button>";
    }).join("");
    $all("[data-rfilter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.resourceFilter = btn.getAttribute("data-rfilter");
        renderResourceFilters();
        renderResources();
      });
    });
  }

  function renderResources() {
    var typeIcon = { video: "video", article: "file-text", practice: "pencil", flashcards: "layers" };
    var items = MOCK.resources.filter(function (r) {
      return state.resourceFilter === "All" || r.subject === state.resourceFilter;
    });
    $("#resource-grid").innerHTML = items.map(function (r) {
      return (
        '<article class="resource-card" tabindex="0" role="link" aria-label="' + escapeHtml(r.title) + " on " + escapeHtml(r.source) + '">' +
          '<div class="resource-top">' +
            '<span class="resource-type rt-' + r.type + '">' + icon(typeIcon[r.type]) + "</span>" +
            subjectChip(r.subject) +
          "</div>" +
          "<h3>" + escapeHtml(r.title) + "</h3>" +
          '<div class="resource-meta">' +
            "<span>" + escapeHtml(r.source) + "</span>" +
            "<span>·</span><span>" + escapeHtml(r.meta) + "</span>" +
            '<span class="resource-rating">' + icon("star") + r.rating.toFixed(1) + "</span>" +
          "</div>" +
        "</article>"
      );
    }).join("");
    $all(".resource-card").forEach(function (card) {
      function openMock() { toast("Opening “" + card.querySelector("h3").textContent + "” (demo)", "external-link"); }
      card.addEventListener("click", openMock);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMock(); }
      });
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    loadSavedTasks();
    hydrateIcons(document);
    initTheme();
    initViews();
    initChecklist();
    initUpload();
    renderPlan();
    renderAI();
    renderResourceFilters();
    renderResources();
  });
})();
