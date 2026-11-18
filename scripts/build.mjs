import {build} from 'esbuild';
import {mkdir,copyFile,cp,readFile,writeFile,rm} from 'node:fs/promises';
// Publish only application assets; never personal scans, uploads, or credentials.
await rm('dist', {recursive:true,force:true});
await mkdir('dist/docs',{recursive:true});
for (const dir of ['css','js']) await cp(dir,`dist/${dir}`,{recursive:true});
await mkdir('dist/assets',{recursive:true});
for (const file of ['forest.png','heart.png']) await copyFile(`assets/${file}`,`dist/assets/${file}`);
await copyFile('docs/google-signin.md','dist/docs/google-signin.md');
let html=await readFile('index.html','utf8');
html=html.replace('<html ', '<html data-hosting="static" ');
const syncPanel = `<section class="card" id="sync-panel" dir="rtl" aria-labelledby="sync-title">
  <div class="card-head"><span data-icon="rotate-ccw"></span><h2 id="sync-title">סנכרון בין מכשירים</h2></div>
  <p class="card-sub">שמירה ומשיכה של מטלות וקובצי PDF מצורפים.</p>
  <form id="sync-auth">
    <label class="form-label" for="sync-email">דוא״ל</label>
    <input class="form-input" id="sync-email" type="email" autocomplete="email" required>
    <label class="form-label" for="sync-password">סיסמה</label>
    <input class="form-input" id="sync-password" type="password" autocomplete="current-password" minlength="6" required>
    <div class="file-actions">
      <button class="btn btn-primary" type="submit" value="login">התחברות</button>
      <button class="btn btn-ghost" type="submit" value="signup">יצירת חשבון</button>
    </div>
  </form>
  <div id="sync-actions" hidden>
    <p id="sync-user" dir="auto"></p>
    <div class="file-actions">
      <button class="btn btn-primary" type="button" id="sync-push">שמירה לענן</button>
      <button class="btn btn-ghost" type="button" id="sync-pull">משיכה מהענן</button>
    </div>
    <button class="btn btn-ghost" type="button" id="sync-logout">התנתקות</button>
  </div>
  <p role="status" id="sync-status" class="workspace-status"></p>
</section>`;
html = html.replace('<!-- SYNC_PANEL -->', syncPanel);
html = html.replace('</body>', '<script type="module" src="js/sync.js?v=1"></script></body>');
await build({entryPoints:['src/sync.mjs'], bundle:true, format:'esm', outfile:'dist/js/sync.js'});
await writeFile('dist/index.html',html);
