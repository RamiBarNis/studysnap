/* Local course files. Blobs stay in IndexedDB; no credentials or remote uploads. */
(function () {
  "use strict";
  var status = document.getElementById("library-status");
  var input = document.getElementById("library-files");
  var list = document.getElementById("library-list");
  var db;
  input.disabled = true;
  function report(message) { status.textContent = message; }
  function transaction(mode, action) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("files", mode);
      var request = action(tx.objectStore("files"));
      tx.oncomplete = function () { resolve(request.result); };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error("Storage failed")); };
    });
  }
  window.StudyBrainAttachments = {
    async add(taskId, file) {
      if (!/\.pdf$/i.test(file.name) || file.size > 25 * 1024 * 1024 ||
          await file.slice(0, 5).text() !== "%PDF-") throw Error("יש לבחור PDF תקין עד 25MB.");
      await transaction("readwrite", function (store) {
        return store.put({id: JSON.stringify(["task-pdf", taskId, file.name]), taskId: taskId,
          name: file.name, blob: file, created: Date.now()});
      });
    },
    async list(taskId) {
      return (await transaction("readonly", function (store) { return store.getAll(); }))
        .filter(function (file) { return file.taskId === taskId; });
    },
    remove(id) {
      return transaction("readwrite", function (store) { return store.delete(id); });
    }
  };
  function button(label, action) {
    var el = document.createElement("button");
    el.type = "button"; el.className = "btn btn-ghost btn-sm"; el.textContent = label;
    el.addEventListener("click", action); return el;
  }
  async function render() {
    var files = await transaction("readonly", function (store) { return store.getAll(); });
    files = files.filter(function (file) { return !file.taskId; });
    list.replaceChildren();
    files.sort(function (a, b) { return b.created - a.created; }).forEach(function (file) {
      var row = document.createElement("li"); row.className = "library-item";
      var title = document.createElement("strong"); title.dir = "auto"; title.textContent = file.name;
      var meta = document.createElement("p"); meta.textContent = file.course + " · " + Math.ceil(file.blob.size / 1024) + " KB";
      row.append(title, meta);
      row.append(button("הורדה לצירוף לצ׳אט", function () {
        var url = URL.createObjectURL(file.blob);
        var link = document.createElement("a"); link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      }));
      row.append(button("יצירת מטלה", function () {
        window.dispatchEvent(new CustomEvent("studysnap-file-task", {detail: {name: file.name, course: file.course}}));
      }));
      row.append(button("הסרה", async function () {
        if (!window.confirm("להסיר את הקובץ מהספרייה המקומית? " + file.name)) return;
        try {
          await transaction("readwrite", function (store) { return store.delete(file.id); }); await render();
        } catch (error) { report("לא ניתן להסיר את הקובץ. נסה שוב."); }
      }));
      list.append(row);
    });
    if (!files.length) list.textContent = "אין עדיין קבצים. אפשר להתחיל מקובץ תרגיל או סילבוס.";
  }
  input.addEventListener("change", async function () {
    input.disabled = true;
    var files = Array.from(input.files); var saved = 0; var rejected = [];
    var course = document.getElementById("library-course").value.trim() || "ללא קורס";
    for (var file of files) {
      if (file.size > 25 * 1024 * 1024 || !/\.(pdf|docx?|pptx?|txt|csv|zip|jpe?g|png|webp)$/i.test(file.name)) {
        rejected.push(file.name); continue;
      }
      try {
        await transaction("readwrite", function (store) {
          return store.put({id: JSON.stringify([course, file.name, file.size, file.lastModified]), name: file.name, course: course, blob: file, created: Date.now()});
        });
        saved++;
      } catch (error) { rejected.push(file.name); }
    }
    input.value = ""; input.disabled = false;
    report("נשמרו " + saved + " קבצים." + (rejected.length ? " לא נשמרו (סוג, גודל או אחסון): " + rejected.join(", ") : ""));
    try { await render(); } catch (error) { report("לא ניתן לקרוא את הספרייה המקומית."); }
  });
  try {
    var request = indexedDB.open("studysnap-library", 1);
    request.onupgradeneeded = function () { request.result.createObjectStore("files", {keyPath: "id"}); };
    request.onerror = function () { report("האחסון המקומי אינו זמין. נסה דפדפן רגיל ולא גלישה פרטית."); };
    request.onsuccess = async function () {
      db = request.result;
      try { await render(); input.disabled = false; } catch (error) { report("לא ניתן לטעון את הספרייה."); }
    };
  } catch (error) { report("האחסון המקומי אינו זמין בדפדפן הזה."); }
})();
