/* Google Identity Services returns a credential; the server verifies it before signing in. */
(function () {
  "use strict";
  if (document.documentElement.dataset.hosting === "static") {
    document.getElementById("auth-open").hidden = true;
    return;
  }
  var dialog = document.getElementById("auth-dialog"), status = document.getElementById("auth-status"), config, loaded = false;
  async function request(path, body) {
    var options = {credentials:"same-origin", cache:"no-store"};
    if (body) { options.method="POST"; options.headers={"Content-Type":"application/json","X-CSRF-Token":config.csrf}; options.body=JSON.stringify(body); }
    var response = await fetch(path, options);
    if (!response.ok) throw Error("Request failed");
    return response.json();
  }
  function showUser(user) {
    document.getElementById("auth-open").hidden = !!user;
    document.getElementById("auth-name").hidden = !user;
    document.getElementById("auth-logout").hidden = !user;
    document.getElementById("auth-name").textContent = user ? (user.name || user.email) : "";
  }
  function setupMessage() {
    status.textContent = "הכניסה עם גוגל מוכנה בקוד. להפעלה ראשונה צריך להגדיר Google Client ID. ";
    var link = document.createElement("a"); link.href="/docs/google-signin.md"; link.target="_blank"; link.rel="noopener"; link.textContent="הוראות הגדרה"; status.append(link);
  }
  async function credentialReceived(response) {
    status.textContent = "מאמתים את החשבון…";
    try { var result=await request('/api/auth/google',{credential:response.credential}); showUser(result.user); dialog.close(); }
    catch (_) { status.textContent="לא הצלחנו לאמת את ההתחברות. נסה שוב; אם הבעיה חוזרת, בדוק את הגדרת Google Client ID."; }
  }
  function loadGoogle() {
    if (loaded) return;
    loaded=true;
    var script=document.createElement("script"); script.src="https://accounts.google.com/gsi/client"; script.async=true;
    script.onload=function () {
      google.accounts.id.initialize({client_id:config.clientId,callback:credentialReceived,nonce:config.csrf,auto_select:false});
      google.accounts.id.renderButton(document.getElementById("google-signin-button"),{type:"standard",theme:"outline",size:"large",text:"signin_with",locale:"he",width:280});
      status.textContent="";
    };
    script.onerror=function () {loaded=false;status.textContent="לא ניתן לטעון את Google כרגע. בדוק את החיבור ופתח שוב את חלון ההתחברות.";};
    document.head.append(script);
  }
  document.getElementById("auth-close").addEventListener("click",function () {dialog.close();});
  document.getElementById("auth-open").addEventListener("click",async function () {
    dialog.showModal(); status.textContent="טוענים התחברות…";
    try {config=await request('/api/auth/config'); if (!config.configured) return setupMessage(); if(loaded)status.textContent=""; loadGoogle();}
    catch (_) {status.textContent="יש להפעיל את StudyBrain דרך start.command כדי להשתמש בהתחברות.";}
  });
  document.getElementById("auth-logout").addEventListener("click",async function () {
    try {config=await request('/api/auth/config');await request('/api/auth/logout',{});if(window.google)google.accounts.id.disableAutoSelect();showUser(null);}
    catch (_) {dialog.showModal();status.textContent="ההתנתקות לא הושלמה. נסה שוב.";}
  });
  request('/api/auth/session').then(function(result){showUser(result.user);}).catch(function(){/* Static preview remains usable. */});
})();
