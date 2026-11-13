/* StudyBrain: task-scoped 50-minute focus sessions, resilient to tab throttling. */
(function (root) {
  "use strict";
  var DURATION = 50 * 60 * 1000;
  function createClock(storage, now) {
    now = now || Date.now;
    var key = "studybrain-focus-v1", records = Object.create(null);
    try {
      var saved = JSON.parse(storage.getItem(key) || "{}");
      Object.keys(saved).forEach(function (id) {
        var r = saved[id];
        if (r && Number.isFinite(r.remaining) && r.remaining >= 0 && r.remaining <= DURATION &&
            (r.endAt === null || (Number.isFinite(r.endAt) && r.endAt > 0 && r.endAt <= now() + DURATION))) {
          records[id] = {remaining: r.remaining, endAt: r.endAt};
        }
      });
    } catch (_) { /* A damaged timer must not prevent opening tasks. */ }
    function save() {
      try { storage.setItem(key, JSON.stringify(records)); return true; }
      catch (_) { return false; }
    }
    function get(id) {
      if (!records[id]) records[id] = {remaining: DURATION, endAt: null};
      var r = records[id];
      if (r.endAt !== null && r.endAt <= now()) { r.remaining = 0; r.endAt = null; save(); }
      return {remaining: r.endAt === null ? r.remaining : Math.max(0, r.endAt - now()), running: r.endAt !== null};
    }
    return {
      get: get,
      start: function (id) {
        Object.keys(records).forEach(function (other) {
          var current = get(other);
          if (other !== id && current.running) records[other] = {remaining: current.remaining, endAt: null};
        });
        var current = get(id);
        if (current.running) return true;
        if (current.remaining === 0) records[id].remaining = DURATION;
        records[id].endAt = now() + records[id].remaining;
        return save();
      },
      pause: function (id) { records[id] = {remaining: get(id).remaining, endAt: null}; return save(); },
      reset: function (id) { records[id] = {remaining: DURATION, endAt: null}; return save(); },
      runningId: function () { return Object.keys(records).find(function (id) { return get(id).running; }); }
    };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = {createClock: createClock, duration: DURATION}; return; }
  var storage;
  try { storage = root.localStorage; } catch (_) { storage = {getItem: function () {}, setItem: function () {throw Error("Storage unavailable");}}; }
  var clock = createClock(storage), mounted = null, baseTitle = document.title;
  function format(ms) { var seconds = Math.ceil(ms / 1000); return String(Math.floor(seconds / 60)).padStart(2,"0") + ":" + String(seconds % 60).padStart(2,"0"); }
  function render() {
    var running = clock.runningId();
    document.title = running ? format(clock.get(running).remaining) + " · מיקוד — StudyBrain" : baseTitle;
    if (!mounted || !document.contains(mounted.el)) return;
    var value = clock.get(mounted.id), el = mounted.el;
    el.querySelector(".task-timer-time").textContent = format(value.remaining);
    el.querySelector(".task-timer-status").textContent = value.running ? "זמן להתרכז. סגירת החלון לא עוצרת את הטיימר." : value.remaining === 0 ? "50 דקות הושלמו. זמן להפסקה!" : value.remaining < DURATION ? "הטיימר מושהה" : "50 דקות למטלה הזאת, בקצב שלך";
    el.querySelector(".task-timer-toggle").textContent = value.running ? "השהיה" : value.remaining === 0 ? "התחל מחדש · 50 דקות" : value.remaining < DURATION ? "המשך" : "התחל · 50 דקות";
  }
  root.StudyBrainTimer = {
    pause: function(id) { var ok=clock.pause(id); render(); return ok; },
    mount: function (el, task) {
      mounted = {el: el, id: task.id};
      el.innerHTML = '<div class="task-timer-heading">זמן מיקוד למטלה</div><div class="task-timer-time" role="timer" aria-live="off" dir="ltr">50:00</div><p class="task-timer-status" aria-live="polite"></p><div class="task-timer-controls"><button type="button" class="btn btn-primary task-timer-toggle">התחל · 50 דקות</button><button type="button" class="btn btn-ghost task-timer-reset">איפוס ל־50 דקות</button></div><p class="task-timer-storage" role="status"></p>';
      function update(ok) { el.querySelector(".task-timer-storage").textContent = ok ? "" : "לא ניתן לשמור את הטיימר בדפדפן. רענון עלול לאבד את ההתקדמות."; render(); }
      el.querySelector(".task-timer-toggle").addEventListener("click", function () { update(clock.get(task.id).running ? clock.pause(task.id) : clock.start(task.id)); });
      el.querySelector(".task-timer-reset").addEventListener("click", function () { update(clock.reset(task.id)); });
      render();
    }
  };
  setInterval(render, 250);
  document.addEventListener("visibilitychange", render);
})(typeof window !== "undefined" ? window : this);
