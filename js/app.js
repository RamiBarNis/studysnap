/* StudyBrain — app logic (no framework, no build step).
   State lives in memory; theme, last view, and tasks persist in localStorage. */
(function () {
  "use strict";

  var MOCK = window.MOCK;
  var icon = window.icon;
  var TASKS_KEY = "studysnap-tasks";

  var state = {
    tasks: [],
    filter: "all",
    resourceFilter: "All",
    detectedAdded: false,
    activeTaskId: null,
    lastFocusedEl: null
  };

  var damagedStorage = false;
  function saveTasks() {
    if (damagedStorage) { toast("הנתונים השמורים פגומים. השמירה נעצרה כדי לא לדרוס אותם.", "flag"); return false; }
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify({
        tasks: state.tasks,
        detectedAdded: state.detectedAdded
      }));
      return true;
    } catch (e) { toast("לא ניתן לשמור את השינוי בדפדפן. בדוק מקום פנוי ונסה שוב.", "flag"); return false; }
  }

  function loadSavedTasks() {
    try {
      var raw = localStorage.getItem(TASKS_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.tasks)) throw Error("Invalid saved tasks");
      if (Array.isArray(saved.tasks)) {
        state.tasks = window.StudyBrainBackup.parse(saved);
        state.detectedAdded = !!saved.detectedAdded;
      }
    } catch (e) { damagedStorage = true; toast("לא ניתן לטעון את המטלות השמורות. הנתונים המקוריים נשמרו ללא שינוי.", "flag"); }
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

  function initViews() {
    $all("[data-action='go-app']").forEach(function (el) {
      el.addEventListener("click", function (e) { e.preventDefault(); if (window.StudyBrainWorkspace) window.StudyBrainWorkspace.show("home"); window.scrollTo(0, 0); });
    });
    $("#quick-add-task").addEventListener("click", openAddTaskModal);
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
    if (!s) return '<span class="chip">' + escapeHtml(name) + "</span>";
    return '<span class="chip" style="color:' + s.color + ';background:' + s.bg + '">' + escapeHtml(name) + "</span>";
  }

  function prioBadge(p) {
    var labels = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };
    return '<span class="prio prio-' + p + '">' + icon("flag") + labels[p] + "</span>";
  }

  /* ---------- Checklist ---------- */
  function visibleTasks() {
    return state.tasks.filter(function (t) {
      if (state.filter === "archived") return !!t.archived;
      if (t.archived) return false;
      if (state.filter === "todo") return !t.completed;
      if (state.filter === "done") return t.completed;
      return true;
    });
  }

  function dueKey(task) {
    return /^\d{4}-\d{2}-\d{2}$/.test(task.due) ? task.due : "9999";
  }

  function byDue(a, b) {
    return dueKey(a).localeCompare(dueKey(b)) || a.title.localeCompare(b.title, "he");
  }

  function renderUpcoming(tasks) {
    var list = $("#home-deadline-list");
    var today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Jerusalem"}).format(new Date());
    var upcoming = tasks.filter(function (task) {
      return !task.completed && dueKey(task) !== "9999" && task.due >= today;
    }).sort(byDue).slice(0, 4);
    var colors = ["mint", "blue", "violet", "cyan"];
    list.innerHTML = upcoming.map(function (task, index) {
      var days = Math.round((Date.parse(task.due) - Date.parse(today)) / 86400000);
      var relative = days === 0 ? "היום" : days === 1 ? "מחר" : "בעוד " + days + " ימים";
      return '<li><button type="button" class="deadline-card deadline-' + colors[index] +
        '" data-open="' + escapeHtml(task.id) + '"><strong>' + escapeHtml(task.title) +
        '</strong><span>' + escapeHtml(task.subject) + '</span><span class="deadline-meta">' +
        '<time datetime="' + task.due + '" dir="ltr">' + task.due.split("-").reverse().join(".") +
        '</time><span>' + relative + '</span></span></button></li>';
    }).join("") || '<li class="card-sub">אין הגשות קרובות כרגע.</li>';
  }

  function renderProgress() {
    var included = state.tasks.filter(function (t) { return !t.archived; });
    renderUpcoming(included);
    var done = included.filter(function (t) { return t.completed; }).length;
    var total = included.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    $("#progress-fill").style.width = pct + "%";
    $("#progress-bar").setAttribute("aria-valuenow", String(pct));
    $("#progress-label").textContent = done + " מתוך " + total + " הושלמו";
    window.dispatchEvent(new Event("studybrain-tasks-changed"));
    var left = total - done;
    var heart = $("#heart-stage");
    if (heart) {
      heart.style.setProperty("--heart-fill", pct + "%");
      heart.setAttribute("aria-valuenow", String(pct));
      heart.setAttribute("aria-valuetext", done + " מתוך " + total + " מטלות הושלמו");
      heart.classList.toggle("is-complete", total > 0 && done === total);
      $("#heart-percent").textContent = pct;
      $("#heart-done").textContent = done;
      $("#heart-left").textContent = left;
      $("#heart-caption").textContent = !total ? "אין מטלות" : done + " מתוך " + total + " מטלות";
      var next = included.filter(function (t) { return !t.completed; }).sort(byDue)[0];
      $("#heart-next").textContent = next ? next.title : "אין מטלות פתוחות";
      $("#open-next-task").disabled = !next;
      $("#open-next-task").onclick = next ? function () { openTaskModal(next.id); } : null;
      $("#heart-next-meta").textContent = next ? next.subject : "";
    }
    var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var now = new Date();
    var dateStr = now.toLocaleDateString("he-IL", {weekday: "long", day: "numeric", month: "long"});
    var todayTask = state.tasks.find(function (t) { return t.due === "Today" && !t.completed; });
    var urgentNote = todayTask ? " · " + todayTask.title + " is due today" : "";
    $("#greeting-sub").textContent =
      dateStr + " · " + (left === 0 ? "אין מטלות פתוחות" : left + " מטלות בדרך");
  }

  function renderTasks() {
    var list = $("#task-list");
    var bySubject = $("#task-sort").value === "subject";
    var tasks = visibleTasks().sort(function (a, b) {
      return (bySubject ? a.subject.localeCompare(b.subject, "he") : 0) || byDue(a, b);
    });
    if (!tasks.length) {
      list.innerHTML =
        '<li class="empty-state">' + icon("check-circle") +
        "<p>" + (state.filter === "archived" ? "אין מטלות בארכיון." : state.filter === "done" ? "המטלות שהשלמת יופיעו כאן." : "הכול פנוי. אפשר להוסיף את המטלה הבאה.") + "</p></li>";
      renderProgress();
      return;
    }
    list.innerHTML = tasks.map(function (t, i) {
      var doneSub = t.subtasks.filter(function (s) { return s.done; }).length;
      return (
        (bySubject && (!i || tasks[i - 1].subject !== t.subject)
          ? '<li class="task-course-heading"><h3>' + escapeHtml(t.subject) + '</h3></li>' : "") +
        '<li class="task-item' + (t.completed ? " done" : "") + '" data-id="' + escapeHtml(t.id) + '">' +
          '<button class="task-check" type="button" data-toggle="' + escapeHtml(t.id) + '" role="checkbox" aria-checked="' + t.completed + '" aria-label="Mark “' + escapeHtml(t.title) + '” as ' + (t.completed ? "not done" : "done") + '">' +
            icon("check") +
          "</button>" +
          '<div class="task-body">' +
            '<button class="task-title-btn" type="button" data-open="' + escapeHtml(t.id) + '">' + escapeHtml(t.title) + "</button>" +
            '<div class="task-meta">' +
              subjectChip(t.subject) +
              '<span class="meta-bit' + (t.due === "Today" ? " due-today" : "") + '">' + icon("calendar") + (t.due === "No deadline" ? "ללא מועד הגשה" : "להגשה: " + escapeHtml(t.due)) + "</span>" +
              prioBadge(t.priority) +
              '<span class="meta-bit">' + icon("list-checks") + doneSub + "/" + t.subtasks.length + "</span>" +
            "</div>" +
          "</div>" +
          '<button class="icon-btn task-open" type="button" data-open="' + escapeHtml(t.id) + '" aria-label="Open details for ' + escapeHtml(t.title) + '">' +
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
    var previous = JSON.parse(JSON.stringify(t));
    t.completed = !t.completed;
    if (t.completed) {
      t.subtasks.forEach(function (s) { s.done = true; });

    }
    if (!saveTasks()) { Object.assign(t, previous); return false; }
    if (t.completed) window.StudyBrainTimer.pause(t.id);
    renderTasks();
    renderPlan();
    return true;
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
    var sort = $("#task-sort");
    try { if (localStorage.getItem("studybrain-task-sort") === "subject") sort.value = "subject"; } catch (_) {}
    sort.addEventListener("change", function () {
      try { localStorage.setItem("studybrain-task-sort", sort.value); } catch (_) {}
      renderTasks();
    });
    $("#home-deadline-list").addEventListener("click", function (event) {
      var card = event.target.closest("[data-open]");
      if (card) openTaskModal(card.dataset.open);
    });
    $("#show-all-tasks").addEventListener("click", function () {
      $("#tab-tasks").click();
      $("#panel-tasks").scrollIntoView({block: "start"});
    });
    renderTasks();
  }

  /* ---------- הוספת מטלה modal ---------- */
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

  function openAddTaskModal(event, task) {
    if (!$("#modal-overlay")) state.lastFocusedEl = document.activeElement;
    var subjects = Object.keys(MOCK.subjects);
    var dueOpts = ["Today", "Tomorrow", "This Friday", "Next Monday", "Next week"];

    $("#modal-root").innerHTML =
      '<div class="modal-overlay" id="modal-overlay">' +
        '<div class="modal" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="add-modal-title">' +
          '<div class="modal-header">' +
            '<h2 id="add-modal-title">' + (task ? "עריכת מטלה" : "מטלה חדשה") + '</h2>' +
            '<button class="icon-btn" type="button" id="modal-close" aria-label="Close">' + icon("x") + "</button>" +
          "</div>" +
          '<div class="modal-body">' +
            '<div class="form-group">' +
              '<label class="form-label" for="at-title">שם המטלה</label>' +
              '<input class="form-input" type="text" id="at-title" placeholder="למשל: תרגיל 2 באלגברה" autocomplete="off" />' +
            "</div>" +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label class="form-label" for="at-subject">קורס</label>' +
                '<input class="form-input" id="at-subject" dir="auto" placeholder="שם הקורס" />' +
              "</div>" +
              '<div class="form-group">' +
                '<label class="form-label" for="at-priority">עדיפות</label>' +
                '<select class="form-select" id="at-priority">' +
                  '<option value="high">גבוהה</option>' +
                  '<option value="medium" selected>בינונית</option>' +
                  '<option value="low">נמוכה</option>' +
                "</select>" +
              "</div>" +
            "</div>" +
            '<div class="form-row">' +
              '<div class="form-group">' +
                '<label class="form-label" for="at-due">להגשה עד</label>' +
                '<input class="form-input" type="date" id="at-due" />' +
              "</div>" +
            "</div>" +
          "</div>" +
          '<div class="modal-footer">' +
            '<button class="btn btn-ghost" type="button" id="modal-cancel">ביטול</button>' +
            '<button class="btn btn-primary" type="button" id="modal-save">' + (task ? "שמירת שינויים" : icon("plus") + " הוספת מטלה") + "</button>" +
          "</div>" +
        "</div>" +
      "</div>";

    var overlay = $("#modal-overlay");
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-cancel").addEventListener("click", closeModal);
    document.addEventListener("keydown", onModalKeydown);

    if (task) {
      $("#at-title").value = task.title;
      $("#at-subject").value = task.subject;
      $("#at-due").value = task.due;
      $("#at-priority").value = task.priority;
    }

    $("#modal-save").addEventListener("click", function () {
      var titleEl = $("#at-title");
      var title = titleEl.value.trim();
      if (!title) {
        titleEl.classList.add("invalid");
        titleEl.focus();
        return;
      }
      titleEl.classList.remove("invalid");
      if (!$("#at-due").reportValidity()) return;
      var due = $("#at-due").value || "No deadline";
      var newTask = {
        id: task ? task.id : crypto.randomUUID(),
        title: title,
        subject: $("#at-subject").value.trim() || "General",
        due: due,
        dueDate: resolveDueDate(due),
        priority: $("#at-priority").value,
        estMinutes: task ? task.estMinutes : 30,
        completed: task ? task.completed : false,
        source: (task && task.source) || $("#modal-save").dataset.source || "Added manually",
        description: task ? task.description : "",
        subtasks: task ? task.subtasks : []
      };
      var previous = state.tasks;
      state.tasks = task ? previous.map(function (item) {
        return item.id === task.id ? Object.assign({}, item, newTask) : item;
      }) : previous.concat(newTask);
      if (!saveTasks()) { state.tasks = previous; return; }
      renderTasks();
      renderPlan();
      closeModal();
      toast((task ? "המטלה עודכנה: " : "נוספה מטלה: ") + title, "list-checks");
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
        '<div class="modal" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
          '<div class="modal-header">' +
            '<h2 id="modal-title">' + escapeHtml(t.title) + "</h2>" +
            '<button class="icon-btn" type="button" id="modal-close" aria-label="Close task details">' + icon("x") + "</button>" +
          "</div>" +
          '<div class="modal-body">' +
            '<div class="modal-tags">' + subjectChip(t.subject) + prioBadge(t.priority) + "</div>" +
            '<p class="modal-desc">' + escapeHtml(t.description) + "</p>" +
            '<div class="modal-facts">' +
              '<div class="fact">להגשה עד<strong>' + (t.due === "No deadline" ? "לא נקבע" : escapeHtml(t.due)) + "</strong></div>" +
              '<div class="fact">מקור<strong>' + escapeHtml(t.source === "Added manually" ? "הוספה ידנית" : t.source) + "</strong></div>" +
            "</div>" +
            (t.subtasks.length ? '<h3 class="subtasks-title">שלבים במטלה</h3>' : '') +
            subtasksHtml +
            '<section id="task-attachments" class="task-documents" aria-label="קובצי המטלה"></section>' +
            '<section id="task-focus" class="task-focus" aria-label="טיימר למטלה"></section>' +
            '<div class="task-actions" role="group" aria-label="פעולות מטלה">' +
            '<button class="btn btn-ghost" type="button" id="modal-edit">עריכה</button>' +
            '<button class="btn btn-ghost" type="button" id="modal-archive">' + (t.archived ? "שחזור מהארכיון" : "העברה לארכיון") + '</button>' +
            '<button class="btn btn-ghost" type="button" id="modal-delete">מחיקה</button>' +
            '<button class="btn btn-ghost" type="button" id="modal-delete-confirm" hidden>אישור מחיקה</button>' +
            '<button class="btn ' + (t.completed ? "btn-ghost" : "btn-primary") + '" type="button" id="modal-complete">' +
              icon("check") + (t.completed ? " החזרה לביצוע" : " סימון כהושלם") +
            "</button>" +
          "</div>" +
          "</div>" +
        "</div>" +
      "</div>";

    var overlay = $("#modal-overlay");
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeModal(); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-complete").addEventListener("click", function () {
      if (toggleTask(id)) closeModal();
    });
    $("#modal-edit").addEventListener("click", function () { openAddTaskModal(null, t); });
    $("#modal-archive").addEventListener("click", function () {
      var previous = t.archived;
      t.archived = !previous;
      if (!saveTasks()) { t.archived = previous; return; }
      if (t.archived) window.StudyBrainTimer.pause(id);
      closeModal();
      renderTasks();
      renderPlan();
    });
    $("#modal-delete").addEventListener("click", function () {
      $("#modal-delete").hidden = true;
      $("#modal-delete-confirm").hidden = false;
      $("#modal-delete-confirm").focus();
    });
    $("#modal-delete-confirm").addEventListener("click", function () {
      var previous = state.tasks;
      state.tasks = previous.filter(function (item) { return item.id !== id; });
      if (!saveTasks()) { state.tasks = previous; return; }
      window.StudyBrainTimer.pause(id);
      closeModal();
      renderTasks();
      renderPlan();
      toast("המטלה נמחקה", "check-circle");
    });
    mountTaskAttachments($("#task-attachments"), id);
    window.StudyBrainTimer.mount($("#task-focus"), t);
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
        if (!saveTasks()) { t.subtasks[idx].done = !t.subtasks[idx].done; return; }
        openTaskModal(id); // re-render modal in place
        renderTasks();
      });
    });
    document.addEventListener("keydown", onModalKeydown);
    $("#modal-close").focus();
  }

  function mountTaskAttachments(area, id) {
    area.innerHTML = '<div class="task-documents-head"><h3>' + icon("file-text") + ' קובצי המטלה</h3>' +
      '<label class="btn btn-ghost btn-sm task-pdf-picker">' + icon("upload") + ' צירוף PDF' +
      '<input id="task-pdf" type="file" aria-label="צירוף PDF למטלה" accept=".pdf,application/pdf"></label></div>' +
      '<p role="status" class="card-sub"></p><ul></ul>';
    var input = area.querySelector("input");
    var list = area.querySelector("ul");
    var status = area.querySelector('[role="status"]');
    var attachments = window.StudyBrainAttachments;
    async function render() {
      var files = await attachments.list(id);
      list.replaceChildren();
      if (!files.length) {
        var empty = document.createElement("li");
        empty.className = "card-sub";
        empty.textContent = "אין קובץ מצורף";
        list.append(empty);
      }
      files.forEach(function (file) {
        var row = document.createElement("li");
        var download = document.createElement("button");
        download.type = "button";
        download.className = "btn btn-ghost btn-sm task-pdf-download";
        download.textContent = file.name;
        download.setAttribute("aria-label", "הורדה: " + file.name);
        download.onclick = function () {
          var url = URL.createObjectURL(file.blob);
          var link = document.createElement("a");
          link.href = url;
          link.download = file.name;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        };
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-ghost btn-sm";
        remove.textContent = "הסרה";
        remove.setAttribute("aria-label", "הסרת " + file.name);
        remove.onclick = async function () {
          try { await attachments.remove(file.id); await render(); }
          catch (_) { status.textContent = "לא ניתן להסיר את הקובץ."; }
        };
        row.append(download, remove);
        list.append(row);
      });
    }
    input.onchange = async function () {
      var file = input.files[0];
      if (!file) return;
      input.disabled = true;
      try {
        await attachments.add(id, file);
        await render();
        status.textContent = "ה־PDF נשמר במכשיר הזה.";
      } catch (error) {
        status.textContent = error.message || "לא ניתן לשמור את הקובץ.";
      } finally {
        input.value = "";
        input.disabled = false;
      }
    };
    render().catch(function () { status.textContent = "לא ניתן לטעון את קובצי המטלה."; });
  }

  function onModalKeydown(e) {
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") {
      // simple focus trap
      var focusables = $all(".modal button:not(:disabled):not([hidden]), .modal input:not(:disabled), .modal select:not(:disabled), .modal textarea:not(:disabled)", $("#modal-root"));
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
  function renderPlan() {
    var active = state.tasks.find(function (task) {
      return !task.archived && task.id === window.StudyBrainTimer.runningId();
    });
    var area = $("#plan-area");
    if (!active) {
      area.textContent = "פתח מטלה ולחץ על ״התחל״ כדי להתחיל סשן מיקוד של 50 דקות.";
      return;
    }
    area.innerHTML = '<div class="plan-summary"><strong>' + escapeHtml(active.title) +
      '</strong><p id="active-focus-time" dir="ltr"></p>' +
      '<button type="button" class="btn btn-ghost" id="plan-start">פתיחת המטלה</button></div>';
    $("#plan-start").onclick = function () { openTaskModal(active.id); };
    updateFocusTime();
  }

  function updateFocusTime() {
    var remaining = $("#active-focus-time");
    if (remaining) remaining.textContent = window.StudyBrainTimer.remainingLabel();
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

  window.StudyBrainTasks = {
    snapshot: function () {
      if (damagedStorage) throw Error("לא ניתן לסנכרן כי המטלות המקומיות לא נטענו.");
      return JSON.parse(JSON.stringify(state.tasks));
    },
    replaceFromCloud: function (tasks) {
      var previous = state.tasks;
      state.tasks = tasks;
      if (!saveTasks()) { state.tasks = previous; throw Error("לא ניתן לשמור את המטלות במכשיר."); }
      renderTasks();
      renderPlan();
    },
    list: function () { return state.tasks.filter(function (t) { return !t.archived; }).map(function (t) { return {id:t.id, title:t.title, subject:t.subject, due:t.due, completed:t.completed}; }); },
    open: openTaskModal
  };
  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    window.addEventListener("studybrain-focus-changed", renderPlan);
    window.addEventListener("studybrain-focus-tick", updateFocusTime);
    loadSavedTasks();
    hydrateIcons(document);
    initTheme();
    initViews();
    initChecklist();
    window.addEventListener("studysnap-file-task", function (event) {
      openAddTaskModal();
      $("#at-title").value = event.detail.name;
      $("#at-subject").value = event.detail.course;
      $("#modal-save").dataset.source = event.detail.name;
    });
    document.getElementById("export-tasks").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify({exportedAt: new Date().toISOString(), tasks: state.tasks}, null, 2)], {type: "application/json"});
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a"); link.href = url; link.download = "studybrain-tasks.json"; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    });
    document.getElementById("import-tasks").addEventListener("change", async function (event) {
      var input=event.target, file=input.files[0], status=document.getElementById("import-status");
      if (!file) return;
      try {
        if(file.size>2*1024*1024) throw Error("הגיבוי גדול מדי (עד 2MB).");
        if (damagedStorage) throw Error("הנתונים הקיימים פגומים; יש לשחזרם לפני ייבוא.");
        var incoming=window.StudyBrainBackup.parse(JSON.parse(await file.text()));
        var merged=window.StudyBrainBackup.merge(state.tasks,incoming);
        localStorage.setItem(TASKS_KEY,JSON.stringify({tasks:merged.tasks,detectedAdded:state.detectedAdded}));
        state.tasks=merged.tasks;renderTasks();renderPlan();
        status.textContent="נוספו "+merged.added+" מטלות. מטלות קיימות נשמרו ללא שינוי.";
      } catch(e) { status.textContent="הייבוא נכשל. "+e.message; }
      input.value="";
    });
    renderPlan();

  });
})();
