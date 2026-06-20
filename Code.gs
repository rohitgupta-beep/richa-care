/*  Richa Care — Google Apps Script backend  (v2: JSONP reads + Drive photo fix)
    ----------------------------------------------------------------------------
    Stores Richa's daily marks in a Google Sheet, saves finished-plate photos to
    Google Drive, and serves both to the partner (admin) view.

    Reads use JSONP (callback param) so a GitHub Pages site can read the data
    without being blocked by the browser's cross-origin (CORS) rule.

    AFTER PASTING THIS, RE-DEPLOY THE SAME URL:
      Deploy ▸ Manage deployments ▸ (pencil/Edit) ▸ Version: "New version" ▸ Deploy
    That keeps your existing /exec URL, so nothing else needs changing.
*/

const PHOTO_FOLDER = "Richa Care Photos";

function ss_(){ return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name, headers){
  const ss=ss_(); let sh=ss.getSheetByName(name);
  if(!sh){ sh=ss.insertSheet(name); if(headers&&headers.length) sh.appendRow(headers); }
  return sh;
}
function out_(obj, callback){
  if(callback){
    return ContentService.createTextOutput(callback+"("+JSON.stringify(obj)+")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- READ (GET, supports JSONP) ---------------- */
function doGet(e){
  const p=e.parameter||{};
  const callback=p.callback;
  const action=p.action||"get";
  if(action==="get"){
    return out_({ ok:true, state:readState_(p.date), logs:readLogs_(p.date), meds:readMeds_() }, callback);
  }
  return out_({ ok:false, error:"unknown action" }, callback);
}

/* ---------------- WRITE (POST) ---------------- */
function doPost(e){
  let body={};
  try{ body=JSON.parse(e.postData.contents||"{}"); }catch(err){ return out_({ok:false,error:"bad json"}); }
  const action=body.action;
  const lock=LockService.getScriptLock();
  try{ lock.waitLock(8000); }catch(err){}
  try{
    if(action==="save"){ writeState_(body.date, body.state); return out_({ok:true}); }
    if(action==="log"){ appendLog_(body); return out_({ok:true}); }
    if(action==="meds"){ writeMeds_(body.meds); return out_({ok:true}); }
    if(action==="photo"){
      const url=savePhoto_(body.date, body.meal, body.dataUrl);
      // log it server-side so the partner view sees the photo via the activity feed
      if(url) appendLog_({ ts:Date.now(), date:body.date, type:"photo", detail:body.meal||"", photoUrl:url });
      return out_({ ok:true, url:url });
    }
    return out_({ ok:false, error:"unknown action" });
  } finally { try{ lock.releaseLock(); }catch(err){} }
}

/* ---------------- STATE ---------------- */
function readState_(date){
  const sh=sheet_("State",["date","json","updatedAt"]);
  const d=sh.getDataRange().getValues();
  for(let i=1;i<d.length;i++){ if(String(d[i][0])===String(date)){ try{return JSON.parse(d[i][1]);}catch(e){return null;} } }
  return null;
}
function writeState_(date, state){
  const sh=sheet_("State",["date","json","updatedAt"]);
  const d=sh.getDataRange().getValues();
  const payload=JSON.stringify(state||{}); const now=new Date();
  for(let i=1;i<d.length;i++){ if(String(d[i][0])===String(date)){ sh.getRange(i+1,2).setValue(payload); sh.getRange(i+1,3).setValue(now); return; } }
  sh.appendRow([date,payload,now]);
}

/* ---------------- LOG (event feed) ---------------- */
function appendLog_(ev){
  const sh=sheet_("Log",["ts","date","type","detail","photoUrl"]);
  sh.appendRow([ ev.ts||Date.now(), ev.date||"", ev.type||"", ev.detail||"", ev.photoUrl||"" ]);
}
function readLogs_(date){
  const sh=sheet_("Log",["ts","date","type","detail","photoUrl"]);
  const d=sh.getDataRange().getValues(); const out=[];
  for(let i=1;i<d.length;i++){ if(String(d[i][1])===String(date)){ out.push({ ts:Number(d[i][0]), date:d[i][1], type:d[i][2], detail:d[i][3], photoUrl:d[i][4] }); } }
  return out;
}

/* ---------------- MEDS ---------------- */
function readMeds_(){
  const sh=sheet_("Meds",["json"]); const d=sh.getDataRange().getValues();
  if(d.length>=2&&d[1][0]){ try{return JSON.parse(d[1][0]);}catch(e){return null;} } return null;
}
function writeMeds_(meds){
  const sh=sheet_("Meds",["json"]); const payload=JSON.stringify(meds||[]);
  if(sh.getLastRow()>=2) sh.getRange(2,1).setValue(payload); else sh.appendRow([payload]);
}

/* ---------------- PHOTOS (Drive) ---------------- */
function photoFolder_(){
  const it=DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext()?it.next():DriveApp.createFolder(PHOTO_FOLDER);
}
function savePhoto_(date, meal, dataUrl){
  const m=/^data:(image\/\w+);base64,(.+)$/.exec(dataUrl||""); if(!m) return "";
  const bytes=Utilities.base64Decode(m[2]);
  const ext=(m[1].split("/")[1])||"jpg";
  const name=(date||"photo")+"_"+String(meal||"meal").replace(/\s+/g,"-")+"_"+Date.now()+"."+ext;
  const file=photoFolder_().createFile(Utilities.newBlob(bytes,m[1],name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // thumbnail endpoint renders reliably inside <img> for anyone-with-link files
  return "https://drive.google.com/thumbnail?id="+file.getId()+"&sz=w1000";
}
