/*  Richa Care — Google Apps Script backend
    ----------------------------------------
    Stores Richa's daily marks in a Google Sheet, saves finished-plate
    photos to Google Drive, and serves both to the partner (admin) view.

    SETUP (one time):
    1. Create a new Google Sheet (name it e.g. "Richa Care Data").
    2. Extensions ▸ Apps Script. Delete the sample code, paste THIS file.
    3. Click Deploy ▸ New deployment ▸ type "Web app".
         - Execute as:  Me
         - Who has access:  Anyone
       Deploy, authorise, and copy the Web app URL (ends with /exec).
    4. Paste that URL into CONFIG.BACKEND_URL in index.html.
    The sheet tabs (State / Log / Meds) and the Drive photo folder are
    created automatically on first use.
*/

const PHOTO_FOLDER = "Richa Care Photos";

function ss_(){ return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name, headers){
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if(!sh){
    sh = ss.insertSheet(name);
    if(headers && headers.length) sh.appendRow(headers);
  }
  return sh;
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- READ ---------------- */
function doGet(e){
  const action = (e.parameter.action || "get");
  if(action === "get"){
    const date = e.parameter.date;
    return json_({ ok:true, state: readState_(date), logs: readLogs_(date), meds: readMeds_() });
  }
  return json_({ ok:false, error:"unknown action" });
}

/* ---------------- WRITE ---------------- */
function doPost(e){
  let body = {};
  try { body = JSON.parse(e.postData.contents || "{}"); }
  catch(err){ return json_({ ok:false, error:"bad json" }); }

  const action = body.action;
  const lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch(err){}

  try{
    if(action === "save"){
      writeState_(body.date, body.state);
      return json_({ ok:true });
    }
    if(action === "log"){
      appendLog_(body);
      return json_({ ok:true });
    }
    if(action === "meds"){
      writeMeds_(body.meds);
      return json_({ ok:true });
    }
    if(action === "photo"){
      const url = savePhoto_(body.date, body.meal, body.dataUrl);
      return json_({ ok:true, url: url });
    }
    return json_({ ok:false, error:"unknown action" });
  } finally {
    try { lock.releaseLock(); } catch(err){}
  }
}

/* ---------------- STATE ---------------- */
function readState_(date){
  const sh = sheet_("State", ["date","json","updatedAt"]);
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(String(data[i][0]) === String(date)){
      try { return JSON.parse(data[i][1]); } catch(e){ return null; }
    }
  }
  return null;
}
function writeState_(date, state){
  const sh = sheet_("State", ["date","json","updatedAt"]);
  const data = sh.getDataRange().getValues();
  const payload = JSON.stringify(state || {});
  const now = new Date();
  for(let i=1;i<data.length;i++){
    if(String(data[i][0]) === String(date)){
      sh.getRange(i+1,2).setValue(payload);
      sh.getRange(i+1,3).setValue(now);
      return;
    }
  }
  sh.appendRow([date, payload, now]);
}

/* ---------------- LOG (event feed for admin) ---------------- */
function appendLog_(ev){
  const sh = sheet_("Log", ["ts","date","type","detail","photoUrl"]);
  sh.appendRow([ ev.ts || Date.now(), ev.date || "", ev.type || "", ev.detail || "", ev.photoUrl || "" ]);
}
function readLogs_(date){
  const sh = sheet_("Log", ["ts","date","type","detail","photoUrl"]);
  const data = sh.getDataRange().getValues();
  const out = [];
  for(let i=1;i<data.length;i++){
    if(String(data[i][1]) === String(date)){
      out.push({ ts:Number(data[i][0]), date:data[i][1], type:data[i][2], detail:data[i][3], photoUrl:data[i][4] });
    }
  }
  return out;
}

/* ---------------- MEDS (custom medicines added in admin) ---------------- */
function readMeds_(){
  const sh = sheet_("Meds", ["json"]);
  const data = sh.getDataRange().getValues();
  if(data.length >= 2 && data[1][0]){
    try { return JSON.parse(data[1][0]); } catch(e){ return null; }
  }
  return null;
}
function writeMeds_(meds){
  const sh = sheet_("Meds", ["json"]);
  const payload = JSON.stringify(meds || []);
  if(sh.getLastRow() >= 2) sh.getRange(2,1).setValue(payload);
  else sh.appendRow([payload]);
}

/* ---------------- PHOTOS (Drive) ---------------- */
function photoFolder_(){
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  if(it.hasNext()) return it.next();
  return DriveApp.createFolder(PHOTO_FOLDER);
}
function savePhoto_(date, meal, dataUrl){
  // dataUrl: "data:image/jpeg;base64,...."
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl || "");
  if(!m) return "";
  const contentType = m[1];
  const bytes = Utilities.base64Decode(m[2]);
  const ext = contentType.split("/")[1] || "jpg";
  const name = (date || "photo") + "_" + (meal || "meal").replace(/\s+/g,"-") + "_" + Date.now() + "." + ext;
  const blob = Utilities.newBlob(bytes, contentType, name);
  const file = photoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // direct-view link that works inside <img src>
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}
