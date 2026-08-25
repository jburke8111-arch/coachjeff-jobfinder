
function currentSearchState(){
  return {
    kw:document.getElementById('kw').value,
    loc:document.getElementById('loc').value,
    lvl:document.getElementById('lvl').value,
    work:document.getElementById('work').value,
    sector:document.getElementById('sector').value,
    company:document.getElementById('company').value,
    sort:document.getElementById('sort').value,
    usonly:document.getElementById('usonly').checked,
    degreeonly:document.getElementById('degreeonly').checked,
    nointern:document.getElementById('nointern') ? document.getElementById('nointern').checked : true,
    showexperienced:document.getElementById('showexperienced') ? document.getElementById('showexperienced').checked : false,
    noclear:document.getElementById('noclear').checked,
    showsuggest:document.getElementById('showsuggest').checked,
    roles: selectedRoles.slice()
  };
}
function applySearchState(st){
  if(!st) return;
  for(const [k,v] of Object.entries(st)){
    if(k === 'roles') continue; // handled explicitly below (no matching element)
    const el = document.getElementById(k);
    if(!el) continue;
    if(el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  }
  // Restore picked roles (cap at MAX_ROLES defensively) and redraw chips.
  selectedRoles = Array.isArray(st.roles) ? st.roles.slice(0, MAX_ROLES) : [];
  if(typeof window.renderRoleChips === 'function') window.renderRoleChips();
  // A restored search may carry one or several " ; "-joined locations in #loc —
  // rebuild the location chips from whatever landed there.
  if(typeof window.rebuildLocChipsFromField === 'function') window.rebuildLocChipsFromField();
  syncExperienceControls();
  syncSponsorFilter();   // a restored search may carry noclear:true — mirror it up top
}
function savedSearches(){
  try { return JSON.parse(localStorage.getItem('coachJeffSavedSearches') || '[]'); }
  catch(e){ return []; }
}
function renderSavedSearches(){
  const box = document.getElementById('savedSearches');
  const bar = document.getElementById('savedBar');
  if(!box) return;
  const saves = savedSearches();
  if(!saves.length){
    box.innerHTML = '';
    if(bar) bar.style.display = 'none';
    return;
  }
  if(bar) bar.style.display = '';
  box.innerHTML = saves.map((s,i)=>{
    const on = (typeof isAlertOn === 'function') && isAlertOn(s.name);
    const bellTitle = on ? 'Alerts on — you\u2019ll be notified of new roles when you re-run this search. Click to turn off.' : 'Turn on alerts — get a notification when new roles appear the next time you run this search.';
    return `<span class="chip saved" data-i="${i}"><span class="chip-run" data-i="${i}">${esc(s.name)}</span>` +
      `<button class="chip-bell${on?' on':''}" data-i="${i}" title="${bellTitle}" aria-label="${bellTitle}" aria-pressed="${on?'true':'false'}">${on?'\u{1F514}':'\u{1F515}'}</button>` +
      `<button class="chip-del" data-i="${i}" title="Delete this saved search" aria-label="Delete saved search">×</button></span>`;
  }).join('') + (saves.length > 1 ? `<button class="chip clear-all" id="clearAllSaved" title="Delete all saved searches">Clear all</button>` : '');

  // Run a saved search (then check its alert, if one is set)
  box.querySelectorAll('.chip-run').forEach(el=>el.addEventListener('click',async ()=>{
    const s = savedSearches()[Number(el.dataset.i)];
    if(!s) return;
    applySearchState(s.state);
    try { await search(); } catch(e){}
    if(typeof window._checkAlertAfterRun === 'function') window._checkAlertAfterRun(s.name);
  }));

  // Toggle the alert bell for a saved search
  box.querySelectorAll('.chip-bell').forEach(btn=>btn.addEventListener('click',async (e)=>{
    e.stopPropagation();
    const s = savedSearches()[Number(btn.dataset.i)];
    if(!s) return;
    if(isAlertOn(s.name)){
      disableAlert(s.name);
      showSavedBarNote(`Alerts off for "${s.name}".`);
    } else {
      const ok = await enableAlert(s.name);
      if(ok) showSavedBarNote(`Alerts on for "${s.name}". You'll get a notification when new roles appear the next time you run this search.`);
    }
    renderSavedSearches();
  }));
  // Delete one saved search
  box.querySelectorAll('.chip-del').forEach(btn=>btn.addEventListener('click',(e)=>{
    e.stopPropagation();
    const i = Number(btn.dataset.i);
    const saves = savedSearches();
    saves.splice(i,1);
    localStorage.setItem('coachJeffSavedSearches', JSON.stringify(saves));
    renderSavedSearches();
  }));
  // Clear all
  const clearBtn = document.getElementById('clearAllSaved');
  if(clearBtn) clearBtn.addEventListener('click',()=>{
    localStorage.removeItem('coachJeffSavedSearches');
    renderSavedSearches();
  });
}

/* ============================================================
   SAVED JOBS + APPLIED STATUS
   Stored in localStorage under coachJeffSavedJobs as an array of
   { id, title, company, location, url, sector, source, sponsor,
     applied (bool), savedAt (ISO) }.
   A stable id is derived from url (or title+company) so the same
   role saved twice never duplicates.
   ============================================================ */

// Live lookup of the most recent result set, keyed by job id, so a
// Save click can persist the full record without re-deriving it.
let _jobsById = {};
function registerJobsForSaving(jobs){
  _jobsById = {};
  (jobs || []).forEach(j => { _jobsById[jobId(j)] = j; });
}

// Stable, collision-resistant id. Prefer the apply URL; fall back to
// title+company. Hash to keep it short and localStorage-key friendly.
function jobId(j){
  const basis = (j && (j.url || '') ) || ((j && j.title || '') + '|' + (j && j.company || ''));
  let h = 0;
  const s = basis.toLowerCase().trim();
  for(let i=0;i<s.length;i++){ h = ((h<<5)-h + s.charCodeAt(i))|0; }
  return 'j' + (h>>>0).toString(36);
}

/* ============================================================
   (6) SAVED-JOBS BACKUP LINK
   localStorage is per-browser, so a student saving 15 roles on a
   library machine can lose all of them. CSV export already helped,
   but a spreadsheet of URLs doesn't restore the saved state.

   This encodes the saved list INTO a URL. Note it cannot encode ids
   alone: jobId() is a local hash of the URL, meaningless on another
   device with an empty store. The payload therefore carries the
   actual fields, compacted to single-letter keys, base64url encoded.

   Round-trip: Copy backup link → email to self → open anywhere →
   jobs are restored (merged, never clobbering what's already there).
   ============================================================ */

// Compact one saved record to short keys. Only the fields needed to
// restore a usable saved job are carried: title, company, url, location,
// and applied status. Sector/source/sponsor are display-only garnish that
// cost ~40 chars each and are re-derivable on the next search — dropping
// them is what keeps a 15-job link inside email-client limits.
//
// Common URL prefixes are folded to a one-character token (see URL_PREFIXES),
// which reclaims another ~30 chars per Greenhouse/Lever/Ashby role.
const URL_PREFIXES = [
  ['1','https://boards.greenhouse.io/'],
  ['2','https://jobs.lever.co/'],
  ['3','https://jobs.ashbyhq.com/'],
  ['4','https://careers.smartrecruiters.com/'],
  ['5','https://www.usajobs.gov/job/'],
  ['6','https://www.adzuna.com/'],
  ['7','https://'],
];
function foldUrl(u){
  const s = String(u || '');
  for(const [tok, pre] of URL_PREFIXES){ if(s.startsWith(pre)) return tok + '|' + s.slice(pre.length); }
  return '0|' + s;
}
function unfoldUrl(v){
  const s = String(v || '');
  const i = s.indexOf('|');
  if(i < 0) return s;
  const tok = s.slice(0,i), rest = s.slice(i+1);
  if(tok === '0') return rest;
  const hit = URL_PREFIXES.find(p => p[0] === tok);
  return hit ? hit[1] + rest : rest;
}

function packSavedJob(j){
  const o = {t:j.title, c:j.company, u:foldUrl(j.url)};
  if(j.location) o.l = j.location;
  if(j.applied)  o.a = 1;
  return o;
}
function unpackSavedJob(o){
  const rec = {
    title: o.t || 'Saved role',
    company: o.c || '',
    location: o.l || '',
    url: unfoldUrl(o.u),
    sector: '',
    source: '',
    sponsor: '',
    applied: !!o.a,
    savedAt: new Date().toISOString()
  };
  // Recompute the id locally so it matches what jobId() would produce
  // here — ids from the sending device are not portable.
  rec.id = jobId(rec);
  return rec;
}

// base64url so the payload survives email clients and query parsing.
function b64urlEncode(str){
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlDecode(str){
  const s = str.replace(/-/g,'+').replace(/_/g,'/');
  return decodeURIComponent(escape(atob(s)));
}

function buildSavedJobsLink(){
  const jobs = savedJobs();
  if(!jobs.length) return null;
  const payload = b64urlEncode(JSON.stringify(jobs.map(packSavedJob)));
  return location.origin + location.pathname + '?saved=' + payload;
}

// Restore on load. Merges rather than replaces: opening a backup link on a
// device that already has saves adds the missing ones instead of wiping the
// existing list. The param is stripped afterward so a refresh doesn't re-import
// (and so the long URL doesn't sit in the address bar).
function importSavedJobsFromURL(){
  let param;
  try { param = new URLSearchParams(location.search).get('saved'); }
  catch(e){ return; }
  if(!param) return;

  let incoming;
  try {
    incoming = JSON.parse(b64urlDecode(param));
    if(!Array.isArray(incoming)) throw new Error('not a list');
  } catch(e){
    // A truncated link (email clients wrap long URLs) is the likely cause.
    try {
      const s = document.getElementById('status');
      if(s) s.innerHTML = '<span class="src-fail">That backup link could not be read — it may have been cut short by your email client. Try copying the whole link, or use the CSV.</span>';
    } catch(_){}
    return;
  }

  const existing = savedJobs();
  const have = new Set(existing.map(x => x.id));
  let added = 0;
  for(const o of incoming){
    if(!o || typeof o !== 'object') continue;
    const rec = unpackSavedJob(o);
    if(!rec.url && !rec.title) continue;
    if(have.has(rec.id)) continue;
    existing.push(rec);
    have.add(rec.id);
    added++;
  }
  if(added) writeSavedJobs(existing);
  renderSavedJobs();

  try {
    const s = document.getElementById('status');
    if(s) s.innerHTML = added
      ? `<span class="src-ok">Restored ${added} saved job${added===1?'':'s'} from your backup link.</span>`
      : `<span class="hint">Those saved jobs were already on this device.</span>`;
  } catch(_){}

  // Strip ?saved= from the address bar without reloading.
  try {
    const u = new URL(location.href);
    u.searchParams.delete('saved');
    history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
  } catch(_){}
}

function savedJobs(){
  try { return JSON.parse(localStorage.getItem('coachJeffSavedJobs') || '[]'); }
  catch(e){ return []; }
}
function writeSavedJobs(list){
  localStorage.setItem('coachJeffSavedJobs', JSON.stringify(list));
}
function isJobSaved(id){ return savedJobs().some(x => x.id === id); }
function isJobApplied(id){ const r = savedJobs().find(x => x.id === id); return !!(r && r.applied); }

// Toggle save. When saving, snapshot the full job record from the
// current result set. When un-saving, drop it entirely.
function toggleSaveJob(id){
  const list = savedJobs();
  const idx = list.findIndex(x => x.id === id);
  if(idx >= 0){
    list.splice(idx,1);
  } else {
    const j = _jobsById[id] || {};
    const sp = sponsorshipLabel(j);
    list.unshift({
      id,
      title: j.title || 'Saved role',
      company: j.company || '',
      location: j.location || '',
      url: j.url || '',
      sector: j.sector || '',
      source: j.source || '',
      sponsor: (sp && sp.text) || '',
      applied: false,
      savedAt: new Date().toISOString()
    });
  }
  writeSavedJobs(list);
  renderSavedJobs();
}

// Toggle applied. If the job isn't saved yet, saving+applying in one
// click is the natural behavior, so we save it first.
function toggleAppliedJob(id){
  let list = savedJobs();
  let rec = list.find(x => x.id === id);
  if(!rec){
    toggleSaveJob(id);           // saves it
    list = savedJobs();
    rec = list.find(x => x.id === id);
    if(rec){ rec.applied = true; }
  } else {
    rec.applied = !rec.applied;
  }
  writeSavedJobs(list);
  renderSavedJobs();
}

// Repaint the Save/Applied buttons on any visible result card for this id.
function refreshCardButtons(id){
  const saved = isJobSaved(id);
  const applied = isJobApplied(id);
  document.querySelectorAll(`.job[data-jobid="${cssEscId(id)}"]`).forEach(card=>{
    const sBtn = card.querySelector('.jbtn.save');
    const aBtn = card.querySelector('.jbtn.applied');
    if(sBtn){
      sBtn.classList.toggle('on', saved);
      sBtn.setAttribute('aria-pressed', saved);
      sBtn.querySelector('.ic').textContent = saved ? '★' : '☆';
      sBtn.querySelector('.lbl').textContent = saved ? 'Saved' : 'Save';
    }
    if(aBtn){
      aBtn.classList.toggle('on', applied);
      aBtn.setAttribute('aria-pressed', applied);
      aBtn.querySelector('.ic').textContent = applied ? '✓' : '○';
      aBtn.querySelector('.lbl').textContent = applied ? 'Applied' : 'Mark applied';
    }
  });
}
// Ids are [a-z0-9] only, so this is just a safety guard for the selector.
function cssEscId(id){ return (id||'').replace(/[^a-z0-9]/gi,''); }

function renderSavedJobs(){
  const bar  = document.getElementById('savedJobsBar');
  const list = document.getElementById('savedJobsList');
  const cnt  = document.getElementById('savedJobsCount');
  if(!bar || !list) return;
  const jobs = savedJobs();

  // Keep the always-visible top cue in sync (shows even at 0).
  const cue = document.getElementById('savedJobsCue');
  const cueCnt = document.getElementById('savedJobsCueCount');
  if(cueCnt) cueCnt.textContent = `(${jobs.length})`;
  if(cue) cue.classList.toggle('has-saved', jobs.length > 0);

  if(!jobs.length){
    bar.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  bar.style.display = '';
  const appliedCount = jobs.filter(j => j.applied).length;
  if(cnt) cnt.textContent = `(${jobs.length} saved · ${appliedCount} applied)`;

  list.innerHTML = jobs.map(j => `
    <div class="sj-row" data-jobid="${esc(j.id)}">
      <div class="sj-main">
        ${j.url
          ? `<a class="sj-title" href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a>`
          : `<span class="sj-title">${esc(j.title)}</span>`}
        <div class="sj-meta">${esc(j.company)}${j.location ? ' · ' + esc(j.location) : ''}${j.source ? ' · ' + esc(j.source) : ''}</div>
        <div class="sj-tags">
          ${j.applied ? '<span class="tag strong">✓ applied</span>' : '<span class="tag warn">not yet applied</span>'}
          ${j.sponsor ? `<span class="tag gray">${esc(j.sponsor)}</span>` : ''}
        </div>
      </div>
      <div class="sj-controls">
        <button class="jbtn applied${j.applied?' on':''}" data-sjact="applied" data-jobid="${esc(j.id)}">
          <span class="ic">${j.applied?'✓':'○'}</span>${j.applied?'Applied':'Mark applied'}
        </button>
        <button class="sj-del" data-sjact="del" data-jobid="${esc(j.id)}" title="Remove from saved jobs" aria-label="Remove saved job">×</button>
      </div>
    </div>`).join('');
}

// CSV export of the saved list — the tracker international students want.
function exportSavedJobsCsv(){
  const jobs = savedJobs();
  if(!jobs.length) return;
  const cols = ['Title','Company','Location','Sector','Sponsorship','Applied','Source','Saved','URL'];
  const cell = v => {
    const s = (v==null?'':String(v)).replace(/"/g,'""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = jobs.map(j => [
    j.title, j.company, j.location, j.sector, j.sponsor,
    j.applied ? 'Yes' : 'No', j.source,
    (j.savedAt || '').slice(0,10), j.url
  ].map(cell).join(','));
  const csv = cols.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'coach-jeff-saved-jobs.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

// Delegated clicks on result cards (Save / Mark applied buttons).
document.getElementById('results').addEventListener('click', (e)=>{
  const btn = e.target.closest('.jbtn[data-act]');
  if(!btn) return;
  const id = btn.dataset.jobid;
  if(!id) return;
  if(btn.dataset.act === 'save') toggleSaveJob(id);
  else if(btn.dataset.act === 'applied') toggleAppliedJob(id);
  refreshCardButtons(id);
});

// Delegated clicks inside the My Saved Jobs panel (applied toggle / delete).
document.getElementById('savedJobsList').addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-sjact]');
  if(!btn) return;
  const id = btn.dataset.jobid;
  if(!id) return;
  if(btn.dataset.sjact === 'applied'){
    toggleAppliedJob(id);
  } else if(btn.dataset.sjact === 'del'){
    writeSavedJobs(savedJobs().filter(x => x.id !== id));
    renderSavedJobs();
  }
  refreshCardButtons(id);
});

// Copy backup link. Warns above ~1900 chars, where email clients start
// wrapping URLs and the link arrives broken — at that point CSV is the
// honest recommendation rather than a link that silently fails.
document.getElementById('copySavedLink').addEventListener('click', function(){
  const btn = this;
  const link = buildSavedJobsLink();
  if(!link){ return; }

  const restore = (msg) => {
    const prev = btn.innerHTML;
    btn.innerHTML = msg;
    setTimeout(()=>{ btn.innerHTML = prev; }, 2600);
  };

  if(link.length > 1900){
    const n = savedJobs().length;
    alert('Your ' + n + ' saved jobs make a link that\'s too long for most email clients to send in one piece '
      + '(' + link.length.toLocaleString() + ' characters).\n\n'
      + 'Use Export CSV instead — it holds any number of jobs.\n\n'
      + 'Or un-save a few roles and try the link again.');
    return;
  }

  const ok = () => restore('✓ Link copied');
  const fail = () => {
    // Clipboard API needs a secure context and can be blocked; fall back to a
    // prompt so the student can still copy manually rather than hitting a
    // dead button.
    window.prompt('Copy this link and email it to yourself:', link);
    restore('Link ready');
  };

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(link).then(ok, fail);
  } else { fail(); }
});
document.getElementById('exportSavedJobs').addEventListener('click', exportSavedJobsCsv);
document.getElementById('clearSavedJobs').addEventListener('click', ()=>{
  if(!savedJobs().length) return;
  if(confirm('Remove all saved jobs? This cannot be undone.')){
    localStorage.removeItem('coachJeffSavedJobs');
    renderSavedJobs();
    // Reset any Save buttons currently on screen.
    document.querySelectorAll('.job[data-jobid]').forEach(card=>{
      refreshCardButtons(card.dataset.jobid);
    });
  }
});

// Top cue: scroll to the saved-jobs panel; nudge if nothing saved yet.
document.getElementById('savedJobsCue').addEventListener('click', ()=>{
  const bar = document.getElementById('savedJobsBar');
  if(savedJobs().length && bar){
    bar.scrollIntoView({behavior:'smooth', block:'start'});
  } else {
    const cue = document.getElementById('savedJobsCue');
    if(cue){
      const cc = cue.querySelector('.sjc-count');
      const prev = cc.textContent;
      cc.textContent = '— none yet';
      setTimeout(()=>{ cc.textContent = prev; }, 1600);
    }
  }
});

renderSavedJobs();
// If the page was opened from a backup link, restore those jobs now.
importSavedJobsFromURL();

function titleCaseMajorSearch(term){
  return (term || '').toString().trim();
}
function fillKeywordFromSuggestion(term){
  const clean = titleCaseMajorSearch(term);
  if(!clean) return;
  document.getElementById('kw').value = clean;
  document.getElementById('lvl').value = 'early';
  syncExperienceControls();
}
function runKeywordSearch(term){
  fillKeywordFromSuggestion(term);
  search();
}
// Debounced search for the role picker: rapid consecutive picks/removals
// collapse into a single search fired ~600ms after the last change, so adding
// three roles triggers one search instead of three (and one set of API calls).
// Results on screen belong to the query that was last RUN, not the query
// currently in the form. When a student changes their roles after searching,
// the old cards are still sitting there looking authoritative. Rather than
// wiping them (destroys work) or auto-searching (the bug this replaced —
// searching before they'd reached Location), flag them and point at Search.
function markResultsStale(){
  if(!results || !results.innerHTML.trim()) return;   // nothing to go stale
  results.classList.add('stale');
  if(statusEl && !document.getElementById('staleNote')){
    const note = document.createElement('div');
    note.id = 'staleNote';
    note.className = 'stale-note';
    note.textContent = 'Your roles changed — press Search to update these results.';
    statusEl.parentNode.insertBefore(note, statusEl.nextSibling);
  }
}
function clearResultsStale(){
  if(results) results.classList.remove('stale');
  const note = document.getElementById('staleNote');
  if(note) note.remove();
}

function initMajorSearch(){
  const majorSelect = document.getElementById('majorSelect');
  const titleSelect = document.getElementById('majorTitleSelect');
  if(!majorSelect || !titleSelect || typeof MAJOR_TITLE_MAP === 'undefined') return;

  // A blank first option rather than defaulting to the alphabetically-first
  // major. Defaulting made "I picked Accounting" and "I never touched this"
  // indistinguishable, and made the field look required — it isn't. Major only
  // populates the role list; it never filters results.
  const majors = Object.keys(MAJOR_TITLE_MAP).sort((a,b)=>a.localeCompare(b));
  majorSelect.innerHTML = '<option value="" selected>Select a major…</option>' +
    majors.map(major => `<option value="${esc(major)}">${esc(major)}</option>`).join('');

  const atCap = () => selectedRoles.length >= MAX_ROLES;

  function renderTitleOptions(){
    // No major chosen yet -> there is no role list to offer. Say why rather
    // than showing an empty "Add a role…" dropdown that appears broken.
    if(!majorSelect.value){
      titleSelect.innerHTML = '<option value="">Select a major first…</option>';
      titleSelect.value = '';
      titleSelect.disabled = true;
      return;
    }
    const groups = MAJOR_TITLE_MAP[majorSelect.value] || {popular:[]};
    const popular = groups.popular || [];
    const emerging = groups.emerging || [];
    const popularOptions = popular.map(title=>`<option value="${esc(title)}">${esc(title)}</option>`).join('');
    const emergingOptions = emerging.map(title=>`<option value="${esc(title)}">${esc(title)}</option>`).join('');
    const lead = atCap()
      ? '3 of 3 selected'
      : (selectedRoles.length ? 'Add another role…' : 'Add a role…');
    titleSelect.innerHTML = `<option value="">${esc(lead)}</option>` +
      (popular.length ? `<optgroup label="Popular Entry-Level Roles">${popularOptions}</optgroup>` : '') +
      (emerging.length ? `<optgroup label="Emerging AI & Data Roles">${emergingOptions}</optgroup>` : '');
    titleSelect.value = '';
    titleSelect.disabled = atCap();
  }

  // Draw the selected-role chips, plus the OR-logic note once it means anything.
  //
  // The note used to show ONLY at zero chips — "Results match any role you add"
  // before any role existed, which is exactly when the reader can't act on it.
  // It's the opposite condition: "any" is meaningless with one role and only
  // describes real behavior once two are competing. So: silent at 0 and 1,
  // stated plainly at 2+.
  window.renderRoleChips = function renderRoleChips(){
    const box = document.getElementById('roleChips');
    if(!box) return;
    if(selectedRoles.length === 0){
      box.innerHTML = '';
    } else {
      const chips = selectedRoles.map((r,i)=>
        `<span class="role-chip"><span class="role-chip-label">${esc(r)}</span>`+
        `<button type="button" class="role-chip-del" data-i="${i}" aria-label="Remove ${esc(r)}">×</button></span>`
      ).join('');
      // "either" is only correct for exactly two; MAX_ROLES is 3.
      const orNote = selectedRoles.length >= 2
        ? `<span class="role-chips-hint">Showing jobs matching ${selectedRoles.length === 2 ? 'either' : 'any'} role.</span>`
        : '';
      box.innerHTML = chips + orNote;
    }
    box.querySelectorAll('.role-chip-del').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const i = parseInt(btn.dataset.i, 10);
        if(!isNaN(i)){
          selectedRoles.splice(i,1);
          renderRoleChips();
          renderTitleOptions();
          // No auto-search on removal either — but results already on screen
          // now match a query the student has changed, so say so rather than
          // leaving stale cards looking current.
          markResultsStale();
        }
      });
    });
  };

  function addRole(title){
    const t = (title || '').trim();
    if(!t || atCap()) return;
    // De-dupe case-insensitively against existing picks.
    if(selectedRoles.some(r => normalizeForSearch(r) === normalizeForSearch(t))) return;
    selectedRoles.push(t);
    renderRoleChips();
    renderTitleOptions();
    // NO auto-search. Picking a role BUILDS the query; Search RUNS it.
    // Auto-firing here searched before the student had reached Location, so
    // their first results were silently nationwide — and then a location they
    // typed afterward did nothing until they found the Search button anyway.
    // The keyword path never auto-fired, so this also makes both routes behave
    // the same: one button, one meaning.
    markResultsStale();
  }

  majorSelect.addEventListener('change', renderTitleOptions);
  titleSelect.addEventListener('change', ()=>{
    if(titleSelect.value) addRole(titleSelect.value);
  });
  renderTitleOptions();
  window.renderRoleChips();
}

// ---- Location chips -------------------------------------------------------
// Mirrors the role-chip pattern: a text box where the user types a place and
// presses Enter (or comma) to add a chip, up to MAX_LOCATIONS. The chips OR
// together. Kept as its own setup block so it doesn't entangle with the
// major/role dropdown wiring above.
function setupLocationChips(){
  const input = document.getElementById('locInput');
  const box   = document.getElementById('locChips');
  if(!input || !box) return;

  const atCap = () => selectedLocations.length >= MAX_LOCATIONS;

  function setPlaceholder(){
    input.placeholder = atCap()
      ? '3 of 3 added — remove one to change'
      : (selectedLocations.length ? 'Add another place — then press Enter'
                                  : 'e.g. Dallas, TX — then press Enter');
    input.disabled = atCap();
  }

  window.renderLocChips = function renderLocChips(){
    if(selectedLocations.length === 0){
      box.innerHTML = '';
    } else {
      const chips = selectedLocations.map((l,i)=>
        `<span class="loc-chip"><span class="loc-chip-label">${esc(l)}</span>`+
        `<button type="button" class="loc-chip-del" data-i="${i}" aria-label="Remove ${esc(l)}">×</button></span>`
      ).join('');
      const orNote = selectedLocations.length >= 2
        ? `<span class="loc-chips-hint">Showing jobs in ${selectedLocations.length === 2 ? 'either' : 'any'} location.</span>`
        : '';
      box.innerHTML = chips + orNote;
    }
    box.querySelectorAll('.loc-chip-del').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const i = parseInt(btn.dataset.i, 10);
        if(!isNaN(i)){
          selectedLocations.splice(i,1);
          syncLocField();
          renderLocChips();
          setPlaceholder();
          markResultsStale();
        }
      });
    });
    setPlaceholder();
  };

  function addLocation(raw){
    const t = (raw || '').trim().replace(/[;]+$/,'').trim();
    if(!t || atCap()) return;
    // De-dupe case-insensitively.
    if(selectedLocations.some(l => l.toLowerCase() === t.toLowerCase())) return;
    selectedLocations.push(t);
    syncLocField();
    renderLocChips();
    input.value = '';
    // NO auto-search — same rule as roles: adding a place BUILDS the query,
    // Search RUNS it.
    markResultsStale();
  }

  input.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ','){
      e.preventDefault();
      addLocation(input.value);
    } else if(e.key === 'Backspace' && input.value === '' && selectedLocations.length){
      // Empty box + Backspace removes the last chip, like a tag editor.
      selectedLocations.pop();
      syncLocField();
      renderLocChips();
      markResultsStale();
    }
  });
  // Adding on blur would surprise people mid-typing; commit only on Enter/comma.
  // But if they typed a place and hit Search without pressing Enter, don't lose
  // it — commit any pending text just before a search runs (wired below).
  window._commitPendingLocation = ()=>{ if(input.value.trim()) addLocation(input.value); };

  // Keep chips in sync when #loc is set programmatically (examples, restore,
  // reset). Those paths write #loc directly; this rebuilds the chip array and
  // redraws from whatever landed there.
  window.rebuildLocChipsFromField = function(){
    const v = (document.getElementById('loc').value || '').trim();
    selectedLocations = v ? v.split(';').map(s=>s.trim()).filter(Boolean).slice(0, MAX_LOCATIONS) : [];
    input.value = '';
    renderLocChips();
  };

  renderLocChips();
}
setupLocationChips();

document.querySelectorAll('.quick').forEach(btn=>btn.addEventListener('click',()=>{
  runKeywordSearch(btn.dataset.kw || '');
}));
initMajorSearch();
/* ---- Browser job alerts (opt-in, no login, no server) --------------------
 * Rides on the existing saved searches. A user can turn on a bell for any
 * saved search; the app then remembers which job IDs that search has already
 * shown (baseline in localStorage). The next time that saved search is run —
 * by clicking its chip — any IDs not in the baseline are "new since last
 * check", and the app fires a native browser notification naming how many new
 * early-career roles appeared, then updates the baseline.
 *
 * Entirely client-side: notifications only fire while the user is on the page
 * running that search. There is no background polling, no email, and nothing
 * leaves the browser — consistent with the tool's no-login model. If the
 * Notification API is unavailable or permission is denied, the bell simply
 * does nothing and the saved search behaves normally.
 */
const ALERTS_KEY = 'coachJeffSearchAlerts';   // { [searchName]: [seen job ids] }

function alertsStore(){
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || '{}') || {}; }
  catch(e){ return {}; }
}
function writeAlertsStore(o){
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(o)); } catch(e){}
}
function isAlertOn(name){ return Object.prototype.hasOwnProperty.call(alertsStore(), name); }

// Turn an alert on: request permission, then baseline against whatever is on
// screen now (so the user is only notified about roles that appear AFTER they
// subscribe, never spammed with the current page on the first run).
async function enableAlert(name){
  if(!('Notification' in window)){
    alert('This browser doesn\u2019t support notifications, so alerts can\u2019t be turned on here. Your saved search still works normally.');
    return false;
  }
  let perm = Notification.permission;
  if(perm === 'default'){
    try { perm = await Notification.requestPermission(); } catch(e){ perm = 'denied'; }
  }
  if(perm !== 'granted'){
    alert('Notifications are blocked for this site, so alerts can\u2019t fire. You can allow them in your browser\u2019s site settings, then try again.');
    return false;
  }
  const store = alertsStore();
  store[name] = currentResultJobIds();   // baseline = current results
  writeAlertsStore(store);
  return true;
}
function disableAlert(name){
  const store = alertsStore();
  if(Object.prototype.hasOwnProperty.call(store, name)){
    delete store[name];
    writeAlertsStore(store);
  }
}

// IDs of the jobs currently rendered. Uses the same _jobsById map the rest of
// the app populates, so it needs no new plumbing in the search pipeline.
function currentResultJobIds(){
  try { return Object.keys(window._jobsById || {}); }
  catch(e){ return []; }
}

// Called after a saved search finishes running. If that search has an alert
// on, diff the current results against the stored baseline and notify on any
// genuinely new IDs, then refresh the baseline.
function checkAlertAfterRun(name){
  if(!name || !isAlertOn(name)) return;
  if(!('Notification' in window) || Notification.permission !== 'granted') return;
  const store = alertsStore();
  const seen = new Set(Array.isArray(store[name]) ? store[name] : []);
  const now = currentResultJobIds();
  const fresh = now.filter(id => !seen.has(id));
  // Update baseline to the full current set regardless, so removed roles don't
  // linger and the next diff is against what the user just saw.
  store[name] = now;
  writeAlertsStore(store);
  if(fresh.length > 0){
    try {
      const n = new Notification('New early-career roles', {
        body: `${fresh.length} new role${fresh.length===1?'':'s'} for "${name}".`,
        icon: '/icon-192.png',
        tag: 'jobfinder-' + name          // collapses repeats for the same search
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch(e){}
  }
}
window._checkAlertAfterRun = checkAlertAfterRun;

// Brief, self-clearing confirmation shown under the Saved searches title when a
// user turns an alert on or off, so the click has visible feedback.
function showSavedBarNote(msg){
  const bar = document.getElementById('savedBar');
  if(!bar) return;
  let note = document.getElementById('savedBarNote');
  if(!note){
    note = document.createElement('div');
    note.id = 'savedBarNote';
    note.className = 'hint';
    note.style.cssText = 'margin:-4px 0 11px;color:#1f7a4d;font-weight:600';
    const help = bar.querySelector('.savedbar-help');
    if(help && help.parentNode) help.parentNode.insertBefore(note, help.nextSibling);
    else bar.appendChild(note);
  }
  note.textContent = msg;
  note.style.display = '';
  clearTimeout(window._savedBarNoteT);
  window._savedBarNoteT = setTimeout(()=>{ if(note) note.style.display = 'none'; }, 6000);
}

document.getElementById('saveSearch').addEventListener('click',()=>{
  const st = currentSearchState();
  const roleLabel = (st.roles && st.roles.length) ? st.roles.join(' / ') : '';
  const kwLabel = [st.kw, roleLabel].filter(Boolean).join(' / ') || 'All early-career';
  const name = [st.loc, kwLabel, st.work !== 'any' ? st.work : ''].filter(Boolean).join(' · ');
  const saves = savedSearches().filter(s => s.name !== name).slice(0,7);
  saves.unshift({name, state:st});
  localStorage.setItem('coachJeffSavedSearches', JSON.stringify(saves));
  renderSavedSearches();
});
renderSavedSearches();

document.getElementById('lvl').addEventListener('change', syncExperienceControls);
syncExperienceControls();

// Show the sponsorship filter dropdown only when "Work Authorization" is checked,
// and keep the top-level toggle (7) in lockstep with the Advanced Filters box.
//
// #noclear remains the ONLY state the search pipeline reads. #sponsorTop is a
// mirror. Syncing both ways means a student can use whichever control they find
// first — and someone who ticks the top-level toggle then opens Advanced Filters
// sees it already checked there, rather than two controls disagreeing.
function syncSponsorFilter(){
  const on = document.getElementById('noclear').checked;
  const wrap = document.getElementById('sponsorFilterWrap');
  if(wrap) wrap.style.display = on ? 'block' : 'none';
  const top = document.getElementById('sponsorTop');
  if(top && top.checked !== on) top.checked = on;
}
document.getElementById('noclear').addEventListener('change', syncSponsorFilter);
syncSponsorFilter();

// Top-level toggle → drive #noclear, then re-run if there are results on screen.
// Re-running only when a search has already happened avoids firing an empty
// search at someone who ticks the box before typing anything.
(function(){
  const top = document.getElementById('sponsorTop');
  if(!top) return;
  top.addEventListener('change', ()=>{
    const box = document.getElementById('noclear');
    box.checked = top.checked;
    syncSponsorFilter();
    const kwEl = document.getElementById('kw');
    const hasQuery = (kwEl && kwEl.value.trim()) || selectedRoles.length;
    const hasResults = document.getElementById('results').children.length > 0;
    if(hasQuery && hasResults) search();
  });
})();
// Re-run the search when the sponsorship filter changes (only meaningful with box on).
document.getElementById('sponsorFilter').addEventListener('change', ()=>{
  if(document.getElementById('noclear').checked) search();
});

// "Try an example" — populates a representative search the way a user would,
// then runs it, so first-time visitors see the full flow (major → role →
// location → results) in one click. Uses event dispatch so the same role-chip
// and title-list wiring fires as if the user selected it by hand.
const tryExampleBtn = document.getElementById('tryExample');
if(tryExampleBtn){
  tryExampleBtn.addEventListener('click', ()=>{
    const majorSel = document.getElementById('majorSelect');
    const titleSel = document.getElementById('majorTitleSelect');
    // Clear any in-progress picks so the example starts clean.
    selectedRoles = [];
    if(majorSel){
      majorSel.value = 'Business Analytics';
      majorSel.dispatchEvent(new Event('change'));
    }
    // After the title list repopulates, pick Data Analyst the same way a click would.
    if(titleSel){
      titleSel.value = 'Data Analyst';
      titleSel.dispatchEvent(new Event('change'));
    }
    document.getElementById('loc').value = 'Texas';
    if(typeof window.rebuildLocChipsFromField === 'function') window.rebuildLocChipsFromField();
    if(typeof window.renderRoleChips === 'function') window.renderRoleChips();
    search();
  });
}
document.getElementById('reset').addEventListener('click', ()=>{
  document.getElementById('kw').value = '';
  document.getElementById('loc').value = '';
  if(typeof window.rebuildLocChipsFromField === 'function') window.rebuildLocChipsFromField();
  document.getElementById('lvl').value = 'early';
  document.getElementById('work').value = 'any';
  document.getElementById('sector').value = 'any';
  document.getElementById('company').value = 'any';
  document.getElementById('sort').value = 'best';
  document.getElementById('usonly').checked = true;
  document.getElementById('degreeonly').checked = true;
  if(document.getElementById('nointern')) document.getElementById('nointern').checked = true;
  if(document.getElementById('showexperienced')) document.getElementById('showexperienced').checked = false;
  document.getElementById('noclear').checked = false;
  document.getElementById('showsuggest').checked = false;
  syncExperienceControls();
  syncSponsorFilter();   // keeps the top-level sponsorship toggle in step with the reset
  selectedRoles = [];
  if(typeof window.renderRoleChips === 'function') window.renderRoleChips();
  results.innerHTML = '';
  countEl.textContent = '';
  statusEl.textContent = '';
  clearResultsStale();
  if(document.getElementById('majorSelect') && document.getElementById('majorTitleSelect')){
    document.getElementById('majorSelect').selectedIndex = 0;
    const evt = new Event('change');
    document.getElementById('majorSelect').dispatchEvent(evt);
  }
  document.getElementById('kw').focus();
});


