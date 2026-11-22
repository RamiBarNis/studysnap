/* StudyBrain: configurable focus sessions and local completion history. */
(function (root) {
  "use strict";
  var DURATION = 50 * 60 * 1000;
  var STANDALONE_ID = "studybrain:standalone-pomodoro";
  function createClock(storage, now) {
    now = now || Date.now;
    var key = "studybrain-focus-v1", records = Object.create(null), sessions = [];
    try {
      var saved = JSON.parse(storage.getItem(key) || "{}");
      sessions = Array.isArray(saved.__sessions) ? saved.__sessions.filter(function(s){return s && typeof s.id === "string" && Number.isFinite(s.completedAt) && Number.isFinite(s.duration);}) : [];
      Object.keys(saved).forEach(function (id) {
        var r = saved[id], duration = r && r.duration || DURATION;
        if (r && Number.isFinite(duration) && duration >= 60000 && duration <= 180*60000 && Number.isFinite(r.remaining) && r.remaining >= 0 && r.remaining <= duration &&
            (r.endAt === null || (Number.isFinite(r.endAt) && r.endAt > 0 && r.endAt <= now() + duration))) {
          records[id] = {remaining: r.remaining, endAt: r.endAt, duration: duration};
        }
      });
    } catch (_) { /* A damaged timer must not prevent opening tasks. */ }
    function save() {
      try { storage.setItem(key, JSON.stringify(Object.assign({}, records, {__sessions:sessions}))); return true; }
      catch (_) { return false; }
    }
    function get(id) {
      if (!records[id]) records[id] = {remaining: DURATION, endAt: null, duration:DURATION};
      var r = records[id];
      if (r.endAt !== null && r.endAt <= now()) {
        var sessionId = id + ":" + r.endAt;
        if (!sessions.some(function(s){return s.id === sessionId;})) sessions.push({id:sessionId, completedAt:r.endAt, duration:r.duration});
        r.remaining = 0; r.endAt = null; save();
      }
      return {remaining: r.endAt === null ? r.remaining : Math.max(0, r.endAt - now()), running: r.endAt !== null};
    }
    return {
      get: get,
      duration: function(id){get(id);return records[id].duration;},
      setDuration: function(id,minutes){
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180 || get(id).running) return false;
        records[id]={remaining:minutes*60000,endAt:null,duration:minutes*60000};return save();
      },
      sessions: function(){Object.keys(records).forEach(get);return sessions.map(function(s){return Object.assign({},s);});},
      start: function (id) {
        Object.keys(records).forEach(function (other) {
          var current = get(other);
          if (other !== id && current.running) {records[other].remaining=current.remaining; records[other].endAt=null;}
        });
        var current = get(id);
        if (current.running) return true;
        if (current.remaining === 0) records[id].remaining = records[id].duration;
        records[id].endAt = now() + records[id].remaining;
        return save();
      },
      pause: function (id) { var current=get(id);records[id].remaining=current.remaining;records[id].endAt=null;return save(); },
      reset: function (id) { get(id);records[id].remaining=records[id].duration;records[id].endAt=null;return save(); },
      runningId: function () { return Object.keys(records).find(function (id) { return get(id).running; }); }
    };
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = {createClock: createClock, duration: DURATION}; return; }
  var storage;
  try { storage = root.localStorage; } catch (_) { storage = {getItem: function () {}, setItem: function () {throw Error("Storage unavailable");}}; }
  var clock = createClock(storage), mounted = null, baseTitle = document.title;
  function format(ms) { var seconds = Math.ceil(ms / 1000); return String(Math.floor(seconds / 60)).padStart(2,"0") + ":" + String(seconds % 60).padStart(2,"0"); }
  var lastRunning;
  function render() {
    var running = clock.runningId();
    document.title = running ? format(clock.get(running).remaining) + " · מיקוד — StudyBrain" : baseTitle;
    if (lastRunning !== running) {
      lastRunning = running;
      root.dispatchEvent(new Event("studybrain-focus-changed"));
    }
    if (running) root.dispatchEvent(new Event("studybrain-focus-tick"));
    renderStats();
    if (!mounted || !document.contains(mounted.el)) return;
    var value = clock.get(mounted.id), el = mounted.el, duration = clock.duration(mounted.id), minutes = duration / 60000;
    el.querySelector(".focus-minutes").disabled = value.running;
    el.classList.toggle("focus-running", value.running);
    el.style.setProperty("--sand", (value.remaining / duration * 100) + "%");
    el.style.setProperty("--sand-fallen", (100 - value.remaining / duration * 100) + "%");
    el.querySelector(".task-timer-time").textContent = format(value.remaining);
    var status = el.querySelector(".task-timer-status");
    var message = value.running ? "זמן להתרכז. סגירת החלון לא עוצרת את הטיימר." :
      value.remaining === 0 ? minutes + " דקות הושלמו. זמן להפסקה!" :
      value.remaining < duration ? "הטיימר מושהה" :
      mounted.id === STANDALONE_ID ? "" : minutes + " דקות למטלה הזאת, בקצב שלך";
    if (status.textContent !== message) status.textContent = message;
    el.querySelector(".task-timer-toggle").textContent = mounted.id === STANDALONE_ID ? (value.running ? "השהיה" : value.remaining === 0 ? "התחל מחדש" : value.remaining < duration ? "המשך" : "התחל") : value.running ? "השהיה" : value.remaining === 0 ? "התחל מחדש · " + minutes + " דקות" : value.remaining < duration ? "המשך" : "התחל · " + minutes + " דקות";
  }
  function dateKey(date) {return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
  var statsSignature = "";
  function renderStats() {
    var weekInput=document.getElementById("focus-week"), monthInput=document.getElementById("focus-month");
    if (!weekInput.value) weekInput.value=dateKey(new Date());
    if (!monthInput.value) monthInput.value=dateKey(new Date()).slice(0,7);
    var sessions=clock.sessions(), signature=JSON.stringify([sessions,weekInput.value,monthInput.value]);
    if (signature===statsSignature) return;
    statsSignature=signature;
    var start=new Date(weekInput.value+"T12:00:00");start.setDate(start.getDate()-start.getDay());
    var days=Array.from({length:7},function(_,i){var d=new Date(start);d.setDate(d.getDate()+i);return {date:d,count:sessions.filter(function(s){return dateKey(new Date(s.completedAt))===dateKey(d);}).length};});
    var max=Math.max(1,...days.map(function(d){return d.count;}));
    var chart=document.getElementById("focus-chart");chart.replaceChildren();
    days.forEach(function(day){
      var column=document.createElement("div");column.className="focus-day";
      var count=document.createElement("strong");count.textContent=day.count;
      var track=document.createElement("div");track.className="focus-bar-track";track.setAttribute("aria-hidden","true");
      var bar=document.createElement("div");bar.className="focus-bar";bar.style.height=(day.count/max*100)+"%";track.append(bar);
      var label=document.createElement("span");label.textContent=day.date.toLocaleDateString("he-IL",{weekday:"short"});
      var date=document.createElement("span");date.textContent=day.date.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"});
      column.append(count,track,label,date);chart.append(column);
    });
    var ns="http://www.w3.org/2000/svg";
    function svgNode(tag, attrs, text) {
      var el=document.createElementNS(ns,tag);
      Object.keys(attrs).forEach(function(key){el.setAttribute(key,attrs[key]);});
      if(text!==undefined)el.textContent=text;
      return el;
    }
    var svg=svgNode("svg",{viewBox:"0 0 560 260",role:"img","aria-labelledby":"focus-line-title focus-line-description"});
    svg.append(svgNode("title",{id:"focus-line-title"},"גרף קווי של הסשנים השבועיים"),svgNode("desc",{id:"focus-line-description"},days.map(function(day){return day.date.toLocaleDateString("he-IL")+": "+day.count+" סשנים";}).join(", ")));
    var ceiling=Math.max(2,max), points=days.map(function(day,i){return {x:510-i*75,y:194-day.count/ceiling*150,day:day};});
    [0,Math.ceil(ceiling/2),ceiling].filter(function(value,i,all){return all.indexOf(value)===i;}).forEach(function(value){
      var y=194-value/ceiling*150;
      svg.append(svgNode("line",{x1:50,x2:520,y1:y,y2:y,class:"line-grid"}),svgNode("text",{x:30,y:y+5,"text-anchor":"middle"},String(value)));
    });
    svg.append(svgNode("polyline",{points:points.map(function(p){return p.x+","+p.y;}).join(" "),class:"session-line"}));
    points.forEach(function(p){
      var dot=svgNode("circle",{cx:p.x,cy:p.y,r:5,class:"session-point"});
      dot.append(svgNode("title",{},p.day.date.toLocaleDateString("he-IL")+": "+p.day.count+" סשנים"));
      svg.append(dot,svgNode("text",{x:p.x,y:p.y-13,"text-anchor":"middle"},String(p.day.count)),svgNode("text",{x:p.x,y:226,"text-anchor":"middle"},p.day.date.toLocaleDateString("he-IL",{weekday:"short"})),svgNode("text",{x:p.x,y:249,"text-anchor":"middle"},p.day.date.toLocaleDateString("he-IL",{day:"numeric",month:"numeric"})));
    });
    document.getElementById("focus-line-chart").replaceChildren(svg);
    document.getElementById("focus-week-title").textContent=days[0].date.toLocaleDateString("he-IL")+" – "+days[6].date.toLocaleDateString("he-IL");
    document.getElementById("focus-week-total").textContent=days.reduce(function(total,d){return total+d.count;},0)+" סשנים בשבוע הזה";
    document.getElementById("focus-month-total").textContent=sessions.filter(function(s){return dateKey(new Date(s.completedAt)).slice(0,7)===monthInput.value;}).length+" סשנים בחודש הזה";
  }
  function openStandalone() {
    timer.mount(document.getElementById("standalone-focus"), STANDALONE_ID);
    root.StudyBrainWorkspace.show("pomodoro");
    document.getElementById("pomodoro-title").focus();
    renderStats();
  }

  var timer = root.StudyBrainTimer = {
    standaloneId: STANDALONE_ID,
    openStandalone: openStandalone,
    runningId: function(){return clock.runningId();},
    remainingLabel: function () {
      var id = clock.runningId();
      return id ? format(clock.get(id).remaining) : "";
    },
    pause: function(id) { var ok=clock.pause(id); render(); return ok; },
    mount: function (el, id) {
      mounted = {el: el, id: id};
      el.innerHTML = '<label class="timer-duration">משך הסשן בדקות <input class="form-input focus-minutes" type="number" required min="1" max="180" step="1" value="' + clock.duration(id)/60000 + '"></label>' + (id === STANDALONE_ID ? "" : '<div class="task-timer-heading">זמן מיקוד למטלה</div>') +
        '<div class="hourglass-stage" aria-hidden="true"><div class="hourglass"><div class="hourglass-turn"><i class="glass-cap"></i><div class="glass-bulbs"><i class="glass-top"></i><i class="glass-bottom"></i><i class="sand-stream"></i></div><i class="glass-cap"></i></div></div></div><div class="task-timer-time" role="timer" aria-live="off" dir="ltr">50:00</div><p class="task-timer-status" aria-live="polite"></p><div class="task-timer-controls"><button type="button" class="btn btn-primary task-timer-toggle">התחל · 50 דקות</button><button type="button" class="btn btn-ghost task-timer-reset">איפוס</button></div><p class="task-timer-storage" role="status"></p>';
      if (id === STANDALONE_ID) {
        el.querySelector(".hourglass-stage").remove();
        var time = el.querySelector(".task-timer-time");
        var row = document.createElement("div"); row.className = "focus-time-row";
        time.before(row); row.append(time);
        var settings = document.createElement("details"); settings.className = "focus-settings";
        var summary = document.createElement("summary"); summary.textContent = "⋯"; summary.setAttribute("aria-label", "הגדרות משך הסשן");
        var popover = document.createElement("div"); popover.className = "focus-settings-panel";
        popover.append(el.querySelector(".timer-duration"));
        var apply = document.createElement("button"); apply.type = "button"; apply.className = "btn btn-ghost btn-sm"; apply.textContent = "שמירה";
        var note = document.createElement("p"); note.textContent = "1–180 דקות. לשינוי בזמן סשן, יש להשהות אותו קודם.";
        popover.append(note, apply); settings.append(summary, popover); row.append(settings);
        var label = document.createElement("div"); label.className = "focus-label"; label.textContent = "מיקוד"; row.after(label);
        apply.addEventListener("click", function(){
          var input = el.querySelector(".focus-minutes");
          if (!input.checkValidity()) {input.reportValidity();return;}
          var ok = Number(input.value)*60000 === clock.duration(id) || clock.setDuration(id, Number(input.value));
          update(ok); if(ok) settings.open = false;
        });
        settings.addEventListener("keydown",function(event){if(event.key === "Escape"){settings.open = false;summary.focus();}});
      }
      function update(ok) { el.querySelector(".task-timer-storage").textContent = ok ? "" : "לא ניתן לשמור את הטיימר בדפדפן. רענון עלול לאבד את ההתקדמות."; render(); }
      el.querySelector(".focus-minutes").addEventListener("change",function(event){
        if (!event.target.checkValidity()) {event.target.reportValidity();event.target.value=clock.duration(id)/60000;return;}
        update(clock.setDuration(id,Number(event.target.value)));
      });
      var turn = el.querySelector(".hourglass-turn");
      if (turn) turn.addEventListener("animationend", function () { turn.classList.remove("turning"); });
      el.querySelector(".task-timer-toggle").addEventListener("click", function () {
        var input = el.querySelector(".focus-minutes");
        if (!input.checkValidity()) {input.reportValidity();return;}
        if (!clock.get(id).running && Number(input.value)*60000 !== clock.duration(id)) clock.setDuration(id,Number(input.value));
        if (clock.get(id).running) {
          update(clock.pause(id));
          return;
        }
        if (turn && !root.matchMedia("(prefers-reduced-motion: reduce)").matches) turn.classList.add("turning");
        update(clock.start(id));
      });
      el.querySelector(".task-timer-reset").addEventListener("click", function () { update(clock.reset(id)); });
      render();
    }
  };
  document.getElementById("open-pomodoro").addEventListener("click", openStandalone);
  ["focus-week","focus-month"].forEach(function(id){document.getElementById(id).addEventListener("change",renderStats);});
  root.addEventListener("storage",function(event){if(event.key==="studybrain-focus-v1") {clock=createClock(storage);render();}});
  setInterval(render, 250);
  document.addEventListener("visibilitychange", render);
})(typeof window !== "undefined" ? window : this);
