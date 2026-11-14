import { createClient } from '@supabase/supabase-js';

const client = createClient('https://wdhunahyjtlkizhnkqpv.supabase.co', 'sb_publishable_eZx9c9SkaCwqWcbPBUsQNg_5tcPsxWg');
const table = client.from('studybrain_workspace');
const bucket = client.storage.from('studybrain-pdfs');
const $ = id => document.getElementById(id);
const status = $('sync-status');
let user = null;
let busy = false;
const revisionKey = () => 'studybrain-cloud-revision:' + user.id;

function check(result) {
  if (result.error) throw result.error;
  return result.data;
}

async function run(action) {
  if (busy) return;
  busy = true;
  $('sync-panel').inert = true;
  status.textContent = 'מתבצע…';
  try { await action(); }
  catch (error) { status.textContent = error.message || 'הפעולה נכשלה. נסה שוב.'; }
  finally { busy = false; $('sync-panel').inert = false; }
}

client.auth.onAuthStateChange((_event, session) => {
  user = session?.user || null;
  $('sync-auth').hidden = !!user;
  $('sync-actions').hidden = !user;
  $('sync-user').textContent = user?.email || '';
});

$('sync-auth').addEventListener('submit', event => {
  event.preventDefault();
  const email = $('sync-email').value.trim();
  const password = $('sync-password').value;
  const signup = event.submitter?.value === 'signup';
  run(async () => {
    const data = check(await (signup ? client.auth.signUp({email, password}) :
      client.auth.signInWithPassword({email, password})));
    $('sync-password').value = '';
    status.textContent = data.session ? 'מחובר. אפשר לשמור או למשוך עותק.' :
      'פתח את הודעת האימות בדוא״ל ולאחר מכן התחבר כאן.';
  });
});
$('sync-logout').onclick = () => run(async () => {
  check(await client.auth.signOut());
  status.textContent = 'התנתקת מהסנכרון.';
});

async function remote() {
  return check(await table.select('revision,payload').eq('user_id', user.id).maybeSingle());
}

$('sync-push').onclick = () => run(async () => {
  const account = user.id;
  const key = revisionKey();
  const existing = await remote();
  if (existing && existing.revision !== localStorage.getItem(key)) {
    throw Error('יש בענן גרסה ממכשיר אחר. משוך אותה לפני שמירה לענן.');
  }
  const tasks = window.StudyBrainTasks.snapshot();
  const files = [];
  for (const task of tasks) {
    for (const pdf of await window.StudyBrainAttachments.list(task.id)) {
      const hash = await crypto.subtle.digest('SHA-256', await pdf.blob.arrayBuffer());
      const name = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
      const path = account + '/' + name + '.pdf';
      check(await bucket.upload(path, pdf.blob, {contentType:'application/pdf', upsert:true}));
      files.push({taskId: task.id, name: pdf.name, path});
    }
  }
  const revision = crypto.randomUUID();
  const payload = {tasks, files};
  const result = existing
    ? check(await table.update({revision,payload}).eq('user_id',account).eq('revision',existing.revision).select('revision'))
    : check(await table.insert({user_id:account,revision,payload}).select('revision'));
  if (!result.length) throw Error('העותק בענן השתנה. משוך את הגרסה האחרונה ונסה שוב.');
  localStorage.setItem(key, revision);
  status.textContent = 'נשמרו בענן ' + tasks.length + ' מטלות ו־' + files.length + ' קובצי PDF.';
});

$('sync-pull').onclick = () => run(async () => {
  const key = revisionKey();
  const account = user.id;
  const record = await remote();
  if (!record) throw Error('אין עדיין עותק בענן. שמור אותו מהמחשב שבו נמצאות המטלות.');
  const tasks = window.StudyBrainBackup.parse(record.payload);
  const current = window.StudyBrainTasks.snapshot();
  if (current.length && JSON.stringify(current) !== JSON.stringify(tasks) &&
      !window.confirm('להחליף את רשימת המטלות במכשיר הזה בעותק מהענן? עותק של הרשימה הנוכחית יישמר במכשיר.')) {
    status.textContent = 'המשיכה בוטלה.';
    return;
  }
  if (current.length) localStorage.setItem('studybrain-before-cloud-pull', JSON.stringify({tasks:current}));
  const taskIds = new Set(tasks.map(task => task.id));
  const files = record.payload.files || [];
  for (const file of files) {
    if (!taskIds.has(file.taskId) || typeof file.path !== 'string' ||
        !file.path.startsWith(account + '/') || typeof file.name !== 'string') {
      throw Error('פרטי הקובץ בענן אינם תקינים.');
    }
    const blob = check(await bucket.download(file.path));
    await window.StudyBrainAttachments.add(file.taskId, new File([blob],file.name,{type:'application/pdf'}));
  }
  window.StudyBrainTasks.replaceFromCloud(tasks);
  localStorage.setItem(key, record.revision);
  status.textContent = 'הועברו למכשיר ' + tasks.length + ' מטלות ו־' + files.length + ' קובצי PDF.';
});
