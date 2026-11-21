/* StudyBrain workspace tabs, local exams and a calendar of actual deadlines. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var tabs = Array.from(document.querySelectorAll('[data-panel]'));
  var exams = [], editing = null, month = new Date();
  month.setDate(1); month.setHours(12,0,0,0);
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var d = new Date(value + 'T12:00:00');
    return !isNaN(d) && dateKey(d) === value;
  }
  function dateKey(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function tasks() { return window.StudyBrainTasks ? window.StudyBrainTasks.list() : []; }
  function show(name) {
    if (!tabs.some(function (t) {return t.dataset.panel===name;})) name='home';
    tabs.forEach(function (t) { var selected=t.dataset.panel===name; t.setAttribute('aria-selected',String(selected));t.tabIndex=selected?0:-1; $('panel-'+t.dataset.panel).hidden=!selected; });
    if(name==='calendar') renderCalendar();
    if(name==='exams') renderExams();
  }
  tabs.forEach(function (tab,index) {
    tab.addEventListener('click',function(){show(tab.dataset.panel);});
    tab.addEventListener('keydown',function(e){
      var next=index;
      if(e.key==='ArrowLeft')next=(index+1)%tabs.length;
      else if(e.key==='ArrowRight')next=(index+tabs.length-1)%tabs.length;
      else if(e.key==='Home')next=0;
      else if(e.key==='End')next=tabs.length-1;
      else return;
      e.preventDefault();show(tabs[next].dataset.panel);tabs[next].focus();
    });
  });
  window.StudyBrainWorkspace={
    show:show,
    examCourses:function(){return exams.map(function(exam){return exam.course;});}
  };
  function node(tag,text,cls) {var el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
  function button(text,action,cls) {var el=node('button',text,cls||'btn btn-ghost btn-sm');el.type='button';el.addEventListener('click',action);return el;}
  function persist(next) {
    try {localStorage.setItem('studybrain-exams',JSON.stringify(next));exams=next;}
    catch(_){return false;}
    window.dispatchEvent(new Event('studybrain-exams-changed'));
    return true;
  }
  function openExam(exam) {
    editing=exam?exam.id:null;
    $('exam-form').reset();$('exam-form-error').textContent='';
    $('exam-dialog-title').textContent=exam?'עריכת מבחן':'הוספת מבחן';
    ['title','course','date','time','location'].forEach(function(key){$('exam-'+key).value=exam?exam[key]||'':'';});
    $('exam-dialog').showModal();$('exam-title').focus();
  }
  function renderExams() {
    var list=$('exam-list');list.replaceChildren();
    if(!exams.length){list.append(node('p','אין עדיין מבחנים. הוסף מבחן כדי שיופיע גם בלוח השנה.','empty-state'));return;}
    exams.slice().sort(function(a,b){return (a.date+a.time).localeCompare(b.date+b.time);}).forEach(function(exam){
      var card=node('article',undefined,'exam-card');card.append(node('span',exam.course,'eyebrow'),node('h2',exam.title),node('p',new Date(exam.date+'T12:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'})+(exam.time?' · '+exam.time:'')));
      if(exam.location)card.append(node('p',exam.location,'card-sub'));
      var actions=node('div',undefined,'exam-actions');actions.append(button('עריכה',function(){openExam(exam);}),button('מחיקה',function(){
        if(!confirm('למחוק את המבחן ״'+exam.title+'״?'))return;
        if(!persist(exams.filter(function(e){return e.id!==exam.id;}))){$('exam-status').textContent='לא ניתן לשמור את השינוי.';return;}
        $('exam-status').textContent='המבחן הוסר.';renderExams();renderCalendar();
      }));card.append(actions);list.append(card);
    });
  }
  function taskCalendarLabel(task) {
    var match = task.title.match(/^(מטלת|מטלה|תרגיל|בוחן)(?: בית| הגשה)?\s+(\d+)/);
    var label = match ? (match[1] === 'בוחן' ? 'בוחן ' : 'מטלה ') + match[2] : task.title;
    return task.subject ? task.subject + ' - ' + label : label;
  }
  function renderCalendar() {
    var grid=$('calendar-grid');grid.replaceChildren();
    $('calendar-title').textContent=month.toLocaleDateString('he-IL',{month:'long',year:'numeric'});
    ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'].forEach(function(day){grid.append(node('div',day,'calendar-weekday'));});
    var items=tasks().filter(function(t){return validDate(t.due);}).map(function(t){return {date:t.due,title:taskCalendarLabel(t),detail:t.title,kind:'task',completed:t.completed,open:function(){window.StudyBrainTasks.open(t.id);}};});
    exams.forEach(function(e){items.push({date:e.date,title:e.title,kind:'exam',open:function(){openExam(e);}});});
    var first=new Date(month.getFullYear(),month.getMonth(),1,12);
    var days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    var today=dateKey(new Date());
    for(var i=0;i<first.getDay();i++)grid.append(node('div',undefined,'calendar-blank'));
    for(var day=1;day<=days;day++){
      var date=dateKey(new Date(month.getFullYear(),month.getMonth(),day,12));
      var cell=node('div',undefined,'calendar-day'+(date===today?' is-today':''));cell.append(node('span',String(day),'day-number'));
      items.filter(function(item){return item.date===date;}).forEach(function(item){var el=button(item.title,item.open,'calendar-event '+item.kind+(item.completed?' completed':''));el.title=item.detail||item.title;cell.append(el);});grid.append(cell);
    }
    var undated=tasks().filter(function(t){return !validDate(t.due)&&!t.completed;}).length;
    $('calendar-note').textContent=undated?undated+' מטלות ללא תאריך הגשה מדויק אינן מוצגות בלוח.':'';
  }
  document.addEventListener('DOMContentLoaded',function(){
    try {var saved=JSON.parse(localStorage.getItem('studybrain-exams')||'[]');if(Array.isArray(saved))exams=saved.filter(function(e){return e&&typeof e.id==='string'&&typeof e.title==='string'&&typeof e.course==='string'&&validDate(e.date);}).map(function(e){return {id:e.id,title:e.title,course:e.course,date:e.date,time:typeof e.time==='string'?e.time:'',location:typeof e.location==='string'?e.location:''};});}
    catch(_){$('exam-status').textContent='לא ניתן לטעון את המבחנים השמורים.';}
    $('add-exam').addEventListener('click',function(){openExam();});
    $('exam-cancel').addEventListener('click',function(){$('exam-dialog').close();});
    $('exam-form').addEventListener('submit',function(e){
      e.preventDefault();var title=$('exam-title').value.trim(),course=$('exam-course').value.trim(),date=$('exam-date').value;
      if(!title||!course||!validDate(date)){$('exam-form-error').textContent='מלא שם, קורס ותאריך תקין.';return;}
      var exam={id:editing||crypto.randomUUID(),title:title,course:course,date:date,time:$('exam-time').value,location:$('exam-location').value.trim()};
      var next=exams.filter(function(item){return item.id!==exam.id;}).concat(exam);
      if(!persist(next)){$('exam-form-error').textContent='האחסון המקומי אינו זמין. המבחן לא נשמר.';return;}
      $('exam-dialog').close();renderExams();renderCalendar();
    });
    $('calendar-prev').addEventListener('click',function(){month.setMonth(month.getMonth()-1);renderCalendar();});
    $('calendar-next').addEventListener('click',function(){month.setMonth(month.getMonth()+1);renderCalendar();});
    $('calendar-today').addEventListener('click',function(){month=new Date();month.setDate(1);month.setHours(12,0,0,0);renderCalendar();});
    window.addEventListener('studybrain-tasks-changed',renderCalendar);
    renderExams();renderCalendar();show('home');
    window.dispatchEvent(new Event('studybrain-exams-changed'));
  });
})();
