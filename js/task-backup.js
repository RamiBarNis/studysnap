(function(root){
  'use strict';
  function parse(data){
    if(!data || !Array.isArray(data.tasks) || data.tasks.length>2000) throw Error('קובץ גיבוי לא תקין.');
    return data.tasks.map(function(t){
      if(!t || typeof t.id!=='string' || !t.id || typeof t.title!=='string' || !t.title.trim()) throw Error('מטלה ללא שם או מזהה.');
      function str(v,fallback,max){return typeof v==='string'?v.slice(0,max):fallback;}
      var due='No deadline';
      if(typeof t.due==='string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due)){
        var d=new Date(t.due+'T12:00:00Z');
        if(!isNaN(d) && d.toISOString().slice(0,10)===t.due) due=t.due;
      }
      return {id:t.id.slice(0,160),title:t.title.slice(0,300),subject:str(t.subject,'כללי',200),due:due,dueDate:due,
        priority:['high','medium','low'].includes(t.priority)?t.priority:'medium',estMinutes:Math.max(5,Math.min(300,Number(t.estMinutes)||30)),
        completed:t.completed===true,source:str(t.source,'ייבוא גיבוי',1000),description:str(t.description,'',10000),
        subtasks:Array.isArray(t.subtasks)?t.subtasks.slice(0,100).map(function(s){return {label:str(s && s.label,'',500),done:!!s && s.done===true};}):[]};
    });
  }
  function merge(existing,incoming){
    var ids=new Set(existing.map(t=>t.id)), keys=new Set(existing.map(t=>JSON.stringify([t.title,t.subject,t.due]))),tasks=existing.slice(),added=0;
    incoming.forEach(function(t){var key=JSON.stringify([t.title,t.subject,t.due]);if(ids.has(t.id)||keys.has(key))return;tasks.push(t);ids.add(t.id);keys.add(key);added++;});
    return {tasks:tasks,added:added};
  }
  var api={parse:parse,merge:merge};if(typeof module!=='undefined')module.exports=api;else root.StudyBrainBackup=api;
})(typeof window!=='undefined'?window:this);
