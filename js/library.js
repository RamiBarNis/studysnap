/* Local course files. Blobs stay in IndexedDB; no credentials or remote uploads. */
(function () {
  "use strict";
  var status = document.getElementById("library-status");
  var input = document.getElementById("library-files");
  var list = document.getElementById("library-list");
  var courseGrid = document.getElementById("course-grid");
  var courseInput = document.getElementById("course-files");
  var courseStatus = document.getElementById("course-status");
  var courseDialog = document.getElementById("course-dialog");
  var courseDialogTitle = document.getElementById("course-dialog-title");
  var courseDialogFiles = document.getElementById("course-dialog-files");
  var courseDialogStatus = document.getElementById("course-dialog-status");
  var courseDialogUpload = document.getElementById("course-dialog-upload");
  var filePreview = document.getElementById("course-file-preview");
  var previewTitle = document.getElementById("course-preview-title");
  var previewContent = document.getElementById("course-preview-content");
  var previewOpen = document.getElementById("course-preview-open");
  var previewDownload = document.getElementById("course-preview-download");
  var addCourseDialog = document.getElementById("add-course-dialog");
  var courseName = document.getElementById("course-name");
  var courseError = document.getElementById("course-form-error");
  var coursesKey = "studybrain-courses";
  var uncategorized = "ללא קורס";
  var libraryFiles = [];
  var renderVersion = 0;
  var photoTypes = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    heic: "image/heic", heif: "image/heif", avif: "image/avif"
  };
  input.disabled = true;
  function report(message) { status.textContent = message; }
  function openDatabase() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open("studysnap-library", 1);
      var timedOut = false;
      var timeout = setTimeout(function () {
        timedOut = true;
        reject(new Error("אחסון הקבצים לא הגיב. רענן את האתר ונסה שוב."));
      }, 8000);
      request.onupgradeneeded = function () {
        request.result.createObjectStore("files", {keyPath: "id"});
      };
      request.onerror = function () {
        clearTimeout(timeout);
        reject(request.error);
      };
      request.onsuccess = function () {
        clearTimeout(timeout);
        var connection = request.result;
        connection.onversionchange = function () { connection.close(); };
        if (timedOut) connection.close();
        else resolve(connection);
      };
    });
  }

  async function transaction(mode, action) {
    // iOS can close IndexedDB while the browser is in the background.
    // Open on demand and close after each operation instead of keeping a stale handle.
    for (var attempt = 0; attempt < 2; attempt++) {
      var db = await openDatabase();
      try {
        var tx;
        try {
          tx = db.transaction("files", mode);
        } catch (error) {
          if (error.name === "InvalidStateError" && attempt === 0) continue;
          throw error;
        }
        return await new Promise(function (resolve, reject) {
          var request = action(tx.objectStore("files"));
          tx.oncomplete = function () { resolve(request.result); };
          tx.onabort = function () { reject(tx.error || new Error("שמירת הקובץ נקטעה. נסה שוב.")); };
        });
      } finally {
        db.close();
      }
    }
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
  function button(label, action, className) {
    var el = document.createElement("button");
    el.type = "button"; el.className = className || "btn btn-ghost btn-sm"; el.textContent = label;
    el.addEventListener("click", action); return el;
  }
  function node(tag, className, text) {
    var element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function fileExtension(name) {
    var dot = name.lastIndexOf(".");
    return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
  }
  function downloadFile(file) {
    var url = URL.createObjectURL(file.blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function showFile(file, previewType) {
    if (!previewType) {
      downloadFile(file);
      return;
    }
    var pdf = previewType === "application/pdf";
    var url = URL.createObjectURL(file.blob.slice(0, file.blob.size, previewType));
    previewTitle.textContent = file.name;
    previewDownload.href = url;
    previewDownload.download = file.name;
    previewOpen.hidden = !pdf;
    if (pdf) {
      previewOpen.href = url;
      previewContent.replaceChildren(node("p", "course-empty", "אפשר לפתוח את ה־PDF בכרטיסייה חדשה או להוריד אותו."));
      filePreview.showModal();
      return;
    }
    var preview = document.createElement("img");
    preview.alt = file.name;
    preview.addEventListener("error", function () {
      if (preview.isConnected) {
        preview.replaceWith(node("p", "course-empty", "לא ניתן להציג את הקובץ בדפדפן הזה. אפשר להוריד אותו."));
      }
    });
    preview.src = url;
    previewContent.replaceChildren(preview);
    filePreview.showModal();
  }
  function savedCourses() {
    var names = JSON.parse(localStorage.getItem(coursesKey) || "[]");
    if (!Array.isArray(names) || names.some(function (name) { return typeof name !== "string"; })) {
      throw Error("Invalid saved courses");
    }
    return names;
  }
  function courseFileRows(files) {
    if (!files.length) return [node("li", "course-empty", "אין עדיין קבצים בקורס הזה.")];
    return files.map(function (file) {
      var extension = fileExtension(file.name);
      var pdf = extension === "pdf";
      var photoType = Object.hasOwn(photoTypes, extension) ? photoTypes[extension] : "";
      var row = node("li", "course-file");
      var previewType = pdf ? "application/pdf" : photoType;
      var open = button("", function () { showFile(file, previewType); }, "course-file-open");
      if (previewType) open.setAttribute("aria-haspopup", "dialog");
      open.setAttribute("aria-label", file.name);
      open.title = file.name;
      var icon = node("span", "course-file-icon" + (pdf ? " course-file-pdf" : ""));
      icon.innerHTML = window.icon(photoType ? "image" : "file-text");
      var name = node("bdi", "course-file-name", previewType ? file.name.slice(0, -extension.length - 1) || file.name : file.name);
      open.append(icon, name);
      if (previewType) open.append(node("bdi", "course-file-type", extension.toUpperCase()));
      row.append(open);
      return row;
    });
  }
  function selectCourseFiles(course) {
    courseInput.dataset.course = course;
    courseInput.click();
  }
  function renderCourses() {
    var courses = new Map();
    function add(name) {
      name = name.trim();
      if (name && !courses.has(name)) courses.set(name, []);
    }
    try { savedCourses().forEach(add); } catch (_) { /* Inferred courses remain available. */ }
    window.StudyBrainTasks.list().forEach(function (task) {
      if (task.subject !== "General") add(task.subject);
    });
    if (window.StudyBrainWorkspace) window.StudyBrainWorkspace.examCourses().forEach(add);
    libraryFiles.forEach(function (file) {
      var course = (file.course || "").trim() || uncategorized;
      add(course);
      courses.get(course).push(file);
    });

    var focused = document.activeElement;
    var action = focused.dataset.courseAction;
    var focusedCourse = focused.closest(".course-card");
    var cards = Array.from(courses.keys()).sort(function (a, b) { return a.localeCompare(b, "he"); }).map(function (course) {
      var files = courses.get(course);
      var card = node("article", "course-card");
      card.dataset.course = course;
      var title = node("h3", "course-card-heading");
      var open = button("", function () {
        courseDialogTitle.textContent = course;
        courseDialogFiles.replaceChildren(...courseFileRows(files));
        courseDialogStatus.textContent = "";
        courseDialog.showModal();
      }, "course-card-open");
      open.dataset.courseAction = "open";
      open.setAttribute("aria-haspopup", "dialog");
      open.append(node("bdi", "course-name", course));
      var chevron = node("span", "course-chevron");
      chevron.innerHTML = window.icon("chevron-right");
      open.append(chevron);
      title.append(open);
      var preview = node("ul", "course-file-list");
      preview.append(...courseFileRows(files.slice(0, 2)));
      var upload = button("הוספת קבצים", function () { selectCourseFiles(course); }, "btn btn-primary course-upload");
      upload.insertAdjacentHTML("afterbegin", window.icon("plus"));
      upload.dataset.courseAction = "upload";
      upload.setAttribute("aria-label", "הוספת קבצים לקורס " + course);
      upload.disabled = courseInput.disabled;
      card.append(title, preview, upload);
      return card;
    });
    courseGrid.replaceChildren(...(cards.length ? cards : [node("p", "course-empty-state", "הוסף קורס כדי לשמור בו קובצי PDF ותמונות.")]));
    if (focusedCourse && action) {
      var replacement = cards.find(function (card) { return card.dataset.course === focusedCourse.dataset.course; });
      if (replacement) replacement.querySelector('[data-course-action="' + action + '"]').focus({preventScroll: true});
    }
    courseDialogUpload.disabled = courseInput.disabled;
    if (courseDialog.open) {
      courseDialogFiles.replaceChildren(...courseFileRows(courses.get(courseDialogTitle.textContent) || []));
    }
  }
  async function render() {
    var version = ++renderVersion;
    var files = await transaction("readonly", function (store) { return store.getAll(); });
    if (version !== renderVersion) return;
    libraryFiles = files.filter(function (file) { return !file.taskId; })
      .sort(function (a, b) { return b.created - a.created; });
    list.replaceChildren();
    libraryFiles.forEach(function (file) {
      var row = document.createElement("li"); row.className = "library-item";
      var title = document.createElement("strong"); title.dir = "auto"; title.textContent = file.name;
      var meta = document.createElement("p"); meta.textContent = file.course + " · " + Math.ceil(file.blob.size / 1024) + " KB";
      row.append(title, meta);
      var actions = document.createElement("div"); actions.className = "file-actions";
      actions.append(button("הורדה", function () { downloadFile(file); }));
      actions.append(button("יצירת מטלה", function () {
        window.dispatchEvent(new CustomEvent("studysnap-file-task", {detail: {name: file.name, course: file.course}}));
      }));
      actions.append(button("הסרה", async function () {
        if (!window.confirm("להסיר את הקובץ מהספרייה המקומית? " + file.name)) return;
        try {
          await transaction("readwrite", function (store) { return store.delete(file.id); }); await render();
        } catch (error) { report("לא ניתן להסיר את הקובץ. נסה שוב."); }
      }));
      row.append(actions);
      list.append(row);
    });
    if (!libraryFiles.length) {
      var empty = document.createElement("li"); empty.className = "library-empty";
      empty.innerHTML = window.icon("file-text") + "<span>אין קבצים בספרייה</span>";
      list.append(empty);
    }
    renderCourses();
  }
  async function saveFiles(picker, course, statusElement) {
    var files = Array.from(picker.files);
    if (!files.length) return;
    picker.disabled = true;
    if (picker === courseInput) {
      courseGrid.querySelectorAll(".course-upload").forEach(function (button) { button.disabled = true; });
      courseDialogUpload.disabled = true;
    }
    var saved = 0;
    var rejected = [];
    for (var file of files) {
      var extension = fileExtension(file.name);
      var isCourseFile = extension === "pdf" || Object.hasOwn(photoTypes, extension);
      var isLibraryFile = /\.(docx?|pptx?|txt|csv|zip)$/i.test(file.name);
      if (file.size > 25 * 1024 * 1024 || !(isCourseFile || (picker === input && isLibraryFile))) {
        rejected.push(file.name); continue;
      }
      try {
        await transaction("readwrite", function (store) {
          return store.put({id: JSON.stringify([course, file.name, file.size, file.lastModified]), name: file.name, course: course, blob: file, created: Date.now()});
        });
        saved++;
      } catch (error) { rejected.push(file.name); }
    }
    picker.value = "";
    picker.disabled = false;
    statusElement.textContent = "נשמרו " + saved + " קבצים." +
      (rejected.length ? " לא נשמרו (סוג, גודל או אחסון): " + rejected.join(", ") : "");
    try { await render(); } catch (error) {
      statusElement.textContent += " לא ניתן לטעון את הספרייה מחדש.";
      renderCourses();
    }
  }
  input.addEventListener("change", function () {
    saveFiles(input, document.getElementById("library-course").value.trim() || uncategorized, status);
  });
  courseInput.addEventListener("change", function () {
    saveFiles(courseInput, courseInput.dataset.course, courseDialog.open ? courseDialogStatus : courseStatus);
  });
  courseDialogUpload.addEventListener("click", function () {
    selectCourseFiles(courseDialogTitle.textContent);
  });
  filePreview.addEventListener("close", function () {
    var url = previewDownload.href;
    previewContent.replaceChildren();
    previewOpen.removeAttribute("href");
    previewDownload.removeAttribute("href");
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  });
  courseDialog.addEventListener("close", function () {
    var card = Array.from(courseGrid.children).find(function (card) {
      return card.dataset.course === courseDialogTitle.textContent;
    });
    if (card) card.querySelector(".course-card-open").focus({preventScroll: true});
  });
  document.getElementById("add-course").addEventListener("click", function () {
    courseName.value = "";
    courseError.textContent = "";
    addCourseDialog.showModal();
  });
  document.getElementById("add-course-cancel").addEventListener("click", function () {
    addCourseDialog.close();
  });
  document.getElementById("add-course-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var course = courseName.value.trim();
    if (!course) {
      courseError.textContent = "יש להזין שם קורס.";
      return;
    }
    try {
      var names = savedCourses();
      if (!names.includes(course)) localStorage.setItem(coursesKey, JSON.stringify(names.concat(course)));
    } catch (_) {
      courseError.textContent = "לא ניתן לשמור את הקורס בדפדפן.";
      return;
    }
    addCourseDialog.close();
    courseStatus.textContent = "הקורס נשמר.";
    renderCourses();
  });
  window.addEventListener("studybrain-tasks-changed", renderCourses);
  window.addEventListener("studybrain-exams-changed", renderCourses);
  window.addEventListener("storage", function (event) {
    if (event.key === coursesKey) renderCourses();
  });
  render().catch(function () {
    report("לא ניתן לטעון את הספרייה כרגע. אפשר לנסות שוב.");
    courseStatus.textContent = "לא ניתן לטעון את קובצי הקורסים כרגע.";
  }).finally(function () { input.disabled = false; });
})();
