function normalizeForSearch(s){
  return (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


// --- Search Expansion v17: role synonyms + metro/state expansion ---
// v17 adds tech/AI/ML/data role families to ROLE_EXPANSIONS + fallback routing in
// getRoleExpansionTerms. Fixes the bug where "Machine Learning Engineer" and "ML
// Engineer" searches returned zero because neither was expanded, so a search for
// one could never match a job titled the other. Now ML/AI/SWE/Data/HPC titles
// cross-match. NOTE: this does not change the Level filter — with Level set to an
// early-career bucket, many ML/AI roles (rarely labeled "new grad") are still
// hidden; switch Level to "All levels" to see them.
const ROLE_EXPANSIONS = {
  "data analyst": ["data analyst","business analyst","analytics analyst","bi analyst","business intelligence analyst","reporting analyst","insights analyst","operations analyst","research analyst","data specialist","data associate","workforce analyst","revenue analyst"],
  "data analytics": ["data analyst","analytics analyst","bi analyst","business intelligence analyst","reporting analyst","insights analyst","data specialist"],
  "business analyst": ["business analyst","data analyst","systems analyst","operations analyst","process analyst","product analyst","reporting analyst"],
  "marketing": ["marketing","marketing coordinator","marketing analyst","growth marketing","digital marketing","campaign","content marketing","brand marketing"],
  "marketing coordinator": ["marketing coordinator","marketing assistant","marketing specialist","digital marketing","campaign coordinator","content coordinator","marketing analyst"],
  "sales": ["sales","sales development","business development","sdr","bdr","account executive","inside sales","client service","customer success"],
  "sales development": ["sales development","business development","sdr","bdr","inside sales","account executive","sales associate","client service"],
  "it support": ["it support","help desk","desktop support","technical support","support specialist","service desk","systems support"],
  "project coordinator": ["project coordinator","program coordinator","project assistant","program assistant","operations coordinator","implementation coordinator"],
  // v17: tech / AI / ML / data role families. These emerging CS titles are posted
  // under many near-synonymous names; without expansion, searching one exact title
  // (e.g. "machine learning engineer") would never match a job titled "ML Engineer"
  // and vice versa. Each family cross-maps so any entry finds the others.
  "machine learning engineer": ["machine learning engineer","ml engineer","ai engineer","ai/ml engineer","applied scientist","applied ml engineer","machine learning scientist","deep learning engineer","ml scientist","research engineer","ai researcher","machine learning"],
  "ml engineer": ["ml engineer","machine learning engineer","ai engineer","ai/ml engineer","applied scientist","applied ml engineer","machine learning scientist","deep learning engineer","ml scientist","research engineer"],
  "ai engineer": ["ai engineer","machine learning engineer","ml engineer","ai/ml engineer","applied scientist","llm engineer","generative ai engineer","ai/ml","machine learning","deep learning engineer"],
  "data engineer": ["data engineer","analytics engineer","data platform engineer","etl engineer","big data engineer","data infrastructure engineer","data pipeline engineer","dataops engineer"],
  "software engineer": ["software engineer","software developer","sde","backend engineer","back end engineer","full stack engineer","full stack developer","application developer","programmer","software engineer i"],
  "software developer": ["software developer","software engineer","application developer","programmer","full stack developer","sde"],
  "backend engineer": ["backend engineer","back end engineer","back-end engineer","software engineer","backend developer","server side engineer","api engineer"],
  "frontend engineer": ["frontend engineer","front end engineer","front-end engineer","ui engineer","frontend developer","web developer","javascript engineer"],
  "full stack developer": ["full stack developer","full stack engineer","fullstack developer","full-stack engineer","software engineer","web developer"],
  "qa engineer": ["qa engineer","quality assurance engineer","test engineer","sdet","automation engineer","quality engineer","qa analyst"],
  "data scientist": ["data scientist","machine learning engineer","applied scientist","ml scientist","research scientist","quantitative analyst","ai scientist"],
  "research engineer": ["research engineer","research scientist","applied scientist","machine learning engineer","ml engineer","ai researcher"],
  "hpc engineer": ["hpc engineer","high performance computing engineer","performance engineer","gpu engineer","cuda engineer","scientific computing engineer","parallel computing engineer","computational scientist"],
  // Physical / process engineering families. Without these, every non-software
  // "* engineer" title fell through to the software-engineer catch-all in
  // getRoleExpansionTerms and returned only software jobs. Each family cross-maps
  // to the adjacent titles a new-grad in that discipline would realistically hold.
  "chemical engineer": ["chemical engineer","process engineer","process development engineer","manufacturing engineer","production engineer","validation engineer","quality engineer","plant engineer","refinery engineer","chemical process engineer"],
  "process engineer": ["process engineer","chemical engineer","manufacturing engineer","production engineer","process development engineer","continuous improvement engineer","validation engineer","plant engineer","industrial engineer"],
  "mechanical engineer": ["mechanical engineer","design engineer","manufacturing engineer","project engineer","product development engineer","mechanical design engineer","hvac engineer","test engineer","quality engineer"],
  "manufacturing engineer": ["manufacturing engineer","process engineer","production engineer","industrial engineer","quality engineer","mechanical engineer","continuous improvement engineer","tooling engineer"],
  "industrial engineer": ["industrial engineer","manufacturing engineer","process engineer","process improvement analyst","operations analyst","continuous improvement engineer","supply chain analyst","production engineer"],
  "civil engineer": ["civil engineer","structural engineer","project engineer","construction engineer","transportation engineer","field engineer","geotechnical engineer","site engineer","construction coordinator"],
  "quality engineer": ["quality engineer","quality assurance engineer","validation engineer","supplier quality engineer","manufacturing engineer","process engineer","reliability engineer","qa engineer"],
  "validation engineer": ["validation engineer","quality engineer","process engineer","manufacturing engineer","cqv engineer","commissioning engineer","compliance engineer"],
  "biomedical engineer": ["biomedical engineer","biomedical engineering","validation engineer","quality engineer","clinical research coordinator","product development engineer","r&d engineer","medical device engineer"],
  "electrical engineer": ["electrical engineer","electronics engineer","hardware engineer","controls engineer","power engineer","design engineer","test engineer","rf engineer","electrical design engineer"],
  "project engineer": ["project engineer","field engineer","construction engineer","mechanical engineer","civil engineer","design engineer","site engineer"]
};

function getRoleExpansionTerms(kw){
  const q = normalizeForSearch(kw);
  if(!q) return [];
  if(ROLE_EXPANSIONS[q]) return ROLE_EXPANSIONS[q];
  if(q.includes("data") && q.includes("analyst")) return ROLE_EXPANSIONS["data analyst"];
  if(q.includes("business") && q.includes("analyst")) return ROLE_EXPANSIONS["business analyst"];
  if(q.includes("marketing")) return ROLE_EXPANSIONS["marketing"];
  if(q.includes("sales")) return ROLE_EXPANSIONS["sales"];
  if(q.includes("support") || q.includes("help desk")) return ROLE_EXPANSIONS["it support"];
  if(q.includes("project") || q.includes("program")) return ROLE_EXPANSIONS["project coordinator"];
  // v17: tech / AI / ML / data family fallbacks so variants like "senior machine
  // learning engineer" or "ai/ml engineer" still route to the right synonym set.
  if((q.includes("machine learning") || /\bml\b/.test(q)) ) return ROLE_EXPANSIONS["machine learning engineer"];
  if(q.includes("data engineer")) return ROLE_EXPANSIONS["data engineer"];
  if(q.includes("data scientist")) return ROLE_EXPANSIONS["data scientist"];
  if(/\bai\b/.test(q) && q.includes("engineer")) return ROLE_EXPANSIONS["ai engineer"];
  if(q.includes("hpc") || q.includes("high performance") || q.includes("high-performance")) return ROLE_EXPANSIONS["hpc engineer"];
  if(q.includes("full stack") || q.includes("fullstack")) return ROLE_EXPANSIONS["full stack developer"];
  if(q.includes("backend") || q.includes("back end") || q.includes("back-end")) return ROLE_EXPANSIONS["backend engineer"];
  if(q.includes("frontend") || q.includes("front end") || q.includes("front-end")) return ROLE_EXPANSIONS["frontend engineer"];
  if(q.includes("qa") || q.includes("quality assurance") || q.includes("test engineer") || q.includes("sdet")) return ROLE_EXPANSIONS["qa engineer"];
  if(q.includes("research") && (q.includes("engineer") || q.includes("scientist"))) return ROLE_EXPANSIONS["research engineer"];
  // Physical / process engineering routing. These MUST come before the software
  // catch-all below — otherwise any "* engineer" title without "data" was swept
  // into the software-engineer family and a chemical engineer saw only SWE jobs.
  if(q.includes("chemical")) return ROLE_EXPANSIONS["chemical engineer"];
  if(q.includes("process") && q.includes("engineer")) return ROLE_EXPANSIONS["process engineer"];
  if(q.includes("mechanical")) return ROLE_EXPANSIONS["mechanical engineer"];
  if(q.includes("manufacturing")) return ROLE_EXPANSIONS["manufacturing engineer"];
  if(q.includes("industrial")) return ROLE_EXPANSIONS["industrial engineer"];
  if(q.includes("civil") || q.includes("structural") || q.includes("geotechnical")) return ROLE_EXPANSIONS["civil engineer"];
  if(q.includes("validation") || q.includes("cqv") || q.includes("commissioning")) return ROLE_EXPANSIONS["validation engineer"];
  if(q.includes("quality") && (q.includes("engineer") || q.includes("assurance"))) return ROLE_EXPANSIONS["quality engineer"];
  if(q.includes("biomedical") || q.includes("biomed")) return ROLE_EXPANSIONS["biomedical engineer"];
  if(q.includes("electrical") || q.includes("electronics") || (q.includes("controls") && q.includes("engineer"))) return ROLE_EXPANSIONS["electrical engineer"];
  if(q.includes("project engineer") || q.includes("field engineer") || q.includes("construction")) return ROLE_EXPANSIONS["project engineer"];
  // Software catch-all — now only claims titles with an explicit software signal.
  // A bare "* engineer" no longer defaults here; it falls through to a literal
  // match on its own terms rather than being rewritten into software roles.
  if(q.includes("software") || q.includes("developer") || /\bsde\b/.test(q)) return ROLE_EXPANSIONS["software engineer"];
  return [q];
}

function shouldShowFallbackLinks(liveCount){
  return liveCount < 10;
}


function expandedKeywordMatches(blob, kw){
  const b = normalizeForSearch(blob);
  const q = normalizeForSearch(kw);
  if(!q) return true;
  if(b.includes(q)) return true;

  const terms = getRoleExpansionTerms(q);
  if(terms.some(term => b.includes(normalizeForSearch(term)))) return true;

  if(q.includes("data") && q.includes("analyst")){
    // Require a genuine data/analytics signal AND an analyst-type role word.
    // Deliberately excludes bare "operations"/"associate" so titles like
    // "Operations Associate" don't false-match a data-analyst search.
    const hasDataSignal = /\b(data|analytics|business intelligence|\bbi\b|reporting|quantitative|statistician)\b/.test(b);
    const hasAnalystRole = /\b(analyst|analytics|reporting|data scientist|business intelligence|\bbi\b)\b/.test(b);
    return hasDataSignal && hasAnalystRole;
  }
  return q.split(' ').filter(Boolean).every(t => b.includes(t));
}

// ---- Multi-role (pick up to 3) support -------------------------------------
// selectedRoles holds up to 3 chosen job titles. Matching is OR across the
// typed keyword AND each selected role, with each role run through the SAME
// expandedKeywordMatches above — so per-role expansion and the strict
// data-analyst precision are preserved per title, never flattened together.
const MAX_ROLES = 3;
let selectedRoles = [];

// selectedLocations holds up to 3 chosen places (cities, states, or "Remote").
// Matching is OR across them (see locationMatches). Chips are the visible UI;
// this array is mirrored into the hidden #loc field as a " ; "-joined string by
// syncLocField(), so the whole search pipeline keeps reading #loc unchanged.
const MAX_LOCATIONS = 3;
let selectedLocations = [];

function syncLocField(){
  const el = document.getElementById('loc');
  if(el) el.value = selectedLocations.join(' ; ');
}

// Return the list of active query terms: the typed keyword (if any) plus every
// selected role, de-duplicated. This is the OR set.
function activeQueryTerms(kw){
  const terms = [];
  const seen = new Set();
  const push = (t) => {
    const v = (t || '').trim();
    const key = normalizeForSearch(v);
    if(v && key && !seen.has(key)){ seen.add(key); terms.push(v); }
  };
  push(kw);
  selectedRoles.forEach(push);
  return terms;
}

// OR-aware wrapper around expandedKeywordMatches. A job matches if it matches
// ANY active term. With no terms, everything passes (same as empty keyword).
function keywordMatchesAny(blob, kw){
  const terms = activeQueryTerms(kw);
  if(terms.length === 0) return true;
  return terms.some(t => expandedKeywordMatches(blob, t));
}

// Which active term actually matched this blob (for "why this job" tagging).
// Returns the first matching term, or '' if none.
function matchedTerm(blob, kw){
  const terms = activeQueryTerms(kw);
  for(const t of terms){ if(expandedKeywordMatches(blob, t)) return t; }
  return '';
}

function scoreJob(j, kw, loc){
  const title = (j.title || '');
  const tl = title.toLowerCase();
  const locText = (j.location || '').toLowerCase();
  let s = 0;

  // 1) Early-career signal in the title (the core of what this board is for)
  //
  // Ambiguous titles get HALF credit unless the description was actually read.
  // "AI Security Analyst" fires ENTRYLVL_RX purely because it ends in "Analyst",
  // and full credit there was enough to push unverified roles to a
  // "high-priority lead" badge — asserting confidence the tool doesn't have.
  // Intern/new-grad titles are self-evident and keep full credit unscanned.
  const scanned = j.minYears !== undefined && j.minYears !== null;
  if(INTERN_RX.test(title) || NEWGRAD_RX.test(title)) s += 4;        // strongest: explicit grad/intern
  else if(ENTRYLVL_RX.test(title)) s += (scanned ? 3 : 1.5);         // entry-level / junior / associate
  else if(REALISTIC_GRAD_RX.test(title)) s += (scanned ? 2 : 1);     // realistic grad titles w/o the wording
  else if(ANY_EARLY_RX.test(title)) s += (scanned ? 1 : 0.5);        // weak early signal

  // 2) Keyword relevance — title match worth more than anywhere-match.
  //    OR-aware: counts a title hit for the typed keyword OR any selected role.
  if(kw || selectedRoles.length){
    if(keywordMatchesAny(title, kw)) s += 3;                         // a query term is right in the title
    else s += 1;                                                     // matched elsewhere (already filtered in)
  }

  // 3) Location relevance
  if(loc){
    if(locationMatches(j.location, loc)) s += 2;                                // matches what they typed
  }
  if(isUSLocation(j.location)) s += 1;                               // US-based (audience default)
  if(REMOTE_RX.test(locText)) s += 1;                                // remote-friendly is a plus for grads

  // 4) Recency (Lever gives dates; Greenhouse often doesn't)
  if(j.posted){
    const days = (Date.now() - (typeof j.posted === 'number' ? j.posted : Date.parse(j.posted))) / 86400000;
    if(days <= 14) s += 2;                                           // fresh
    else if(days <= 45) s += 1;                                      // recent-ish
  }

  // 5) Penalties — soft signals the role may not fit a new grad
  if(j.aggregator) s -= 3;                                            // (2) aggregator wall (signup gate) ranks below real employer/ATS links
  if(isSeniorTitle(title)) s -= experiencedPenalty(title);             // experienced roles should rank far below true early-career roles
  if(CLEAR_RX.test(title + ' ' + locText)) s -= 1;                  // clearance/sponsorship friction
  if(/\b([2-9]|1[0-9])\s*\+?\s*years?\b/i.test(title)) s -= 5;       // explicit experience requirement in title

  // A DESCRIPTION-STATED FLOOR MUST COST AS MUCH AS A TITLE-STATED ONE.
  //
  // The title regex above only fires when the years are IN the title. A role
  // called "Compliance Analyst" whose body says "4+ years, including 2 as an
  // AML investigator" took no penalty at all — it collected keyword, location,
  // US and scanned-title points and cleared the badge threshold, so the tool
  // showed a new grad a 7-year role wearing "high-priority lead" right next to
  // a "Proceed with caution" tier chip. The two chips contradicted each other
  // and the badge was the one users read first.
  //
  // Scales with the floor rather than a flat hit, because 3 years and 8 years
  // are not the same distance from a graduating senior. Softened requirements
  // ("preferred", "a plus") are discounted, matching the rule already used by
  // experienceTier() and the gating checks.
  const floorYears = Number(j.minYears || 0);
  if(floorYears >= 2){
    const effectiveFloor = j.yearsPreferred ? Math.max(1, floorYears - 1) : floorYears;
    s -= Math.min(10, effectiveFloor * 2);
  }

  // Guard: a role with NO genuine early-career signal in its title shouldn't
  // reach the "high-priority lead" badge on circumstantial points alone
  // (keyword + location + US). Cap it just below the badge threshold.
  const hasEarlySignalFlag = hasEntrySignal(title) && !isSeniorTitle(title);
  if(!hasEarlySignalFlag && s >= 8) s = 7;

  // Same cap when the ONLY early signal is an ambiguous title we never verified.
  // "high-priority lead" sitting next to "experience not verified" is the tool
  // contradicting itself in the space of two chips — one says this is among your
  // best matches, the other says we don't know if you can even apply.
  const unambiguousEarly = INTERN_RX.test(title) || NEWGRAD_RX.test(title);
  if(!scanned && !unambiguousEarly && s >= 8) s = 7;

  // HARD CEILING: nothing at or above the guide's top tier can be a "lead".
  // The Early-Career Experience Equivalency Guide tops out at 3-5 years and
  // calls that row "rarely crossable without direct industry proof-of-work or
  // a referral" — that is not a high-priority lead for a graduating senior, no
  // matter how well the keyword and location line up. Above 5 years the guide
  // has no row at all, because there is no defensible framing to offer.
  // Applied after the caps above so no later addition can reopen the gap.
  if(floorYears >= (j.yearsPreferred ? 4 : 3) && s >= 8) s = 7;

  return s;
}

function matchPercent(rawScore){
  const n = Math.round(55 + Math.max(0, Math.min(12, rawScore || 0)) * 3.6);
  return Math.max(45, Math.min(98, n));
}
function matchClass(p){ return p >= 85 ? 'good' : (p >= 70 ? 'mid' : 'low'); }
function freshnessText(posted){
  if(!posted) return 'Date unavailable';
  const ts = typeof posted === 'number' ? posted : Date.parse(posted);
  if(!ts || Number.isNaN(ts)) return 'Date unavailable';
  const days = Math.max(0, Math.floor((Date.now() - ts) / 86400000));
  if(days === 0) return 'Posted today';
  if(days === 1) return 'Posted yesterday';
  if(days <= 6) return `Posted ${days} days ago`;
  if(days <= 13) return 'Posted last week';
  if(days <= 30) return `Posted ${Math.ceil(days/7)} weeks ago`;
  return 'Posted 30+ days ago';
}
// LIKELY US-PERSON / CLEARANCE GATED?
//
// Defense and export-controlled roles are, in practice, usually restricted to
// "US persons" (citizens, permanent residents, asylees, refugees) or require a
// security clearance — but the POSTING almost never says so. By law it can't:
// per DOJ/IER guidance, restricting a job posting on citizenship or immigration
// status can violate the INA/Title VII even when the role genuinely requires
// export authorization. So the sponsorship scanner reads these as "not
// specified" — technically true, practically misleading for an international
// student, who burns an application on a role that was never reachable.
//
// This flags the likelihood from sector + description language, and is
// deliberately phrased as "often" downstream, never "will": "US person"
// includes green-card holders, so some of these ARE open to non-citizens who
// have permanent residence. We inform; we don't assert a certainty the posting
// itself withholds.
const ITAR_RX = /\b(itar|ear\b|export[- ]control|export controlled|security clearance|active clearance|ts\/sci|top secret|secret clearance|us person|u\.s\. person|us citizen|u\.s\. citizen|citizenship (is )?required|must be a? ?(us|u\.s\.) citizen|clearance (is )?required|dod\b|department of defense)\b/i;

function likelyUSPersonGated(j){
  const sector = String(j.sector || '').toLowerCase();
  if(sector.includes('defense')) return true;
  // Federal (USAJOBS) roles are, in practice, almost always restricted to U.S.
  // citizens — "open to the public" in federal hiring means citizens/nationals,
  // not visa holders, and "U.S. National" is a narrow legal category (American
  // Samoa/Swains Island), NOT a path for F-1/OPT/H-1B candidates. A minority of
  // federal jobs can hire non-citizens when no qualified citizen is available,
  // so this stays a "likelihood, not a verdict" like the defense case below —
  // green-card holders may still qualify. Treating these as gated keeps an
  // international student (sponsorship filter on) from burning an application on
  // a citizens-only federal role the posting labels only as "not specified".
  if(j.source === 'usajobs' || j.ats === 'usajobs') return true;
  // Description text isn't returned to the client, so title language is the
  // only other signal available here. That catches roles that name the barrier
  // outright ("... - Active Clearance Required", "US Citizen"). Roles that hide
  // it in the body are caught only when their sector is defense — which covers
  // the common case, since the sector tag comes from the board's own metadata.
  if(ITAR_RX.test(String(j.title || ''))) return true;
  return false;
}

function sponsorshipLabel(j){
  // Only show a sponsorship badge when a real description-based scan has run
  // (i.e. the student ticked "Work Authorization Requirements"). Without a scan
  // we haven't actually examined sponsorship, so we show NO badge rather than a
  // misleading "unknown" on every result.
  if(j.sponsorScan === 'available') return {text:'🟢 Sponsorship available', cls:'sp-yes'};
  if(j.sponsorScan === 'none')      return {text:'🔴 No sponsorship', cls:'sp-no'};
  if(j.sponsorScan === 'unknown')   return {text:'🟡 Sponsorship not specified', cls:'sp-unk'};
  // Preview paint with the sponsorship scan requested: the scan hasn't run yet.
  // This is the badge international students are here for, so an empty space
  // that later fills in is worse than saying it's coming.
  if(j._previewPending && j._previewSponsor) return {text:'⏳ Checking sponsorship…', cls:'sp-unk'};
  // No scan run for this job → no badge.
  return null;
}
// Prefer the salary the EMPLOYER actually published. Only fall back to a
// field-wide estimate when the posting states nothing. Showing a generic
// "typical entry-level range" over a real posted number is worse than showing
// nothing: it silently contradicts the employer (the Scrunch AI Search Analyst
// listed $115K-$145K while this function guessed $55K-$85K).
function salaryEstimate(j){
  const real = String(j.salary || '').trim();
  if(real) return real;

  // Every fallback below is explicitly an ENTRY-LEVEL range, so it must not
  // appear on a role we've established isn't entry-level. Showing
  // "Typical entry-level range: $55K-$85K" directly beneath "Proceed with
  // caution · 6+ yrs" contradicts our own tier label, and understates the pay
  // badly enough to put a student off a role they might still want.
  if(Number(j.minYears || 0) >= 3) return '';

  // ...and it must not appear on a role we haven't CHECKED either. An unscanned
  // "Cyber Intelligence Analyst" carries "experience not verified" — quoting an
  // entry-level range beside that chip quietly re-asserts the very claim the
  // chip just disclaimed. Unambiguous titles (Intern, New Grad) are exempt:
  // those are entry-level by definition, whatever the source.
  const scanned = j.minYears !== undefined && j.minYears !== null;
  const unambiguous = INTERN_RX.test(j.title || '') || NEWGRAD_RX.test(j.title || '');
  if(!scanned && !unambiguous) return '';

  const t = (j.title||'').toLowerCase();
  const prefix = 'Typical entry-level range for this field';
  if(/software|engineer|developer|data scientist|machine learning|ml\b/.test(t)) return prefix + ': $75K\u2013$120K';
  if(/data|business analyst|analyst|analytics|reporting|insights/.test(t)) return prefix + ': $55K\u2013$85K';
  if(/finance|accounting|accountant/.test(t)) return prefix + ': $50K\u2013$75K';
  if(/sales development|business development|account executive|inside sales/.test(t)) return prefix + ': $45K\u2013$70K base + possible commission';
  if(/customer success|client service|support|implementation/.test(t)) return prefix + ': $45K\u2013$75K';
  if(/marketing|communications|content/.test(t)) return prefix + ': $45K\u2013$70K';
  if(/coordinator|assistant|program|project/.test(t)) return prefix + ': $42K\u2013$65K';
  return ''; // no field match -> show nothing rather than a guess
}
// ---- Experience tiers (Early-Career Experience Equivalency Guide) ----------
// Maps a posting's stated years-floor to the coaching verdict from the guide,
// so a student sees "how reachable is this, and with what?" instead of a bare
// number. Replaces the old raw "requires N+ yrs experience" tag.
//
// Deliberately source-agnostic: it reads j.minYears / j.yearsPreferred and
// nothing else, so every fetcher that learns to scan descriptions (Greenhouse
// and Lever next, via checkjobs) gets tiering for free with no changes here.
// Sources that don't scan leave minYears undefined and simply get no tier —
// silence rather than a false "no experience required".
//
// A softened requirement ("3+ years preferred") is treated one tier gentler
// than the same number stated as hard-required, per the guide's 3-5yr row:
// "usually not genuinely entry-level unless listed as preferred rather than
// required."
// The guide's rows overlap (0-1, 1, 1-2, 2-3, 3-5) but a parsed posting gives
// one number: its floor. A floor of N is matched to the row whose LOWER bound
// is N — so "2-4 years" (floor 2) reads as the guide's 2-3 row, not its 1-2
// row. Where a floor touches two rows, that rule picks the harder one, which is
// the right direction to err: overstating reachability wastes applications.
// `from` is the row's lower bound; the last row is the open-ended catch-all.
const EXPERIENCE_TIERS = [
  // ABOVE THE GUIDE'S RANGE. The Early-Career Experience Equivalency Guide
  // stops at 3-5 years — there is no row past it because there is no honest
  // framing to give a graduating senior for a 7-year requirement. Saying
  // "proceed with caution" here would imply a judgment call the student is
  // equipped to make; they aren't, and the answer is no. Say so plainly.
  { from: 6, label: 'Not an entry-level role',        cls: 'tier-out',
    note: 'The stated requirement is beyond the range where internships, projects, or coursework can substitute. Time is better spent on roles you can actually win.' },
  { from: 3, label: 'Proceed with caution',           cls: 'tier-warn',
    note: 'Reflects experience inflation. Rarely crossable without direct industry proof-of-work or a referral.' },
  { from: 2, label: 'Possible — not automatic',       cls: 'tier-mid',
    note: 'Needs real ownership: tools used, outcomes owned, deadlines met. Multiple internships plus a capstone can clear this; a weak portfolio will not.' },
  { from: 1, label: 'Defensible with internships',    cls: 'tier-ok',
    note: 'An internship or co-op is the strongest framing here — it is the experience employers most directly recognize at entry level.' },
  { from: 0, label: 'Reachable with strong projects', cls: 'tier-ok',
    note: 'Coursework alone is insufficient — lead with 1–2 portfolio projects that show measurable outcomes.' },
];

// Does a SCANNED description put this role out of reach for a new grad?
//
// The existing gate checks isSeniorTitle() only, which reads the title. That
// misses the case that prompted this: a role titled "Compliance Analyst" whose
// body requires 4+ years including 2 as an AML investigator. The title is
// neutral, so the role sailed through every filter and landed in a graduating
// senior's results.
//
// Threshold follows the Early-Career Experience Equivalency Guide: its 3-5yr
// row is "usually not genuinely entry-level unless listed as preferred rather
// than required", so 3+ required (or 4+ preferred) is where a role stops being
// worth a new grad's application slot.
//
// Returns false when minYears is undefined — sources that don't scan get
// silence, never a guess. Those roles are still gated by title as before.
function beyondEarlyCareer(j){
  const y = Number(j.minYears || 0);
  if(!y) return false;
  return y >= (j.yearsPreferred ? 4 : 3);
}

function experienceTier(j){
  const y = Number(j.minYears || 0);
  if(!y) return null;                       // nothing stated (or source didn't scan)
  // "Preferred" softens the ask by one year for tiering purposes.
  const effective = j.yearsPreferred ? Math.max(1, y - 1) : y;
  const tier = EXPERIENCE_TIERS.find(t => effective >= t.from);
  const yrsText = `${y}+ yr${y === 1 ? '' : 's'}${j.yearsPreferred ? ' preferred' : ''}`;
  return { label: tier.label, cls: tier.cls, note: tier.note, yrsText };
}

// Age in days for a posting, or null if we can't determine it.
function postedAgeDays(posted){
  if(!posted) return null;
  const ts = typeof posted === 'number' ? posted : Date.parse(posted);
  if(!ts || Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
}

// "WHY THIS JOB?" lists reasons FOR the job. Every line here is rendered with
// a ✓, so only genuinely positive signals belong. Things that argue AGAINST a
// job (a stale posting, a senior title, an unknown date) must not appear —
// a ✓ next to "Posted 30+ days ago" tells the student the opposite of the
// truth. Those signals still show in the tag row via freshnessText(), which
// is neutral reporting rather than a checkmarked endorsement.
// How deeply did we actually inspect this listing? Users trust the result more
// when they can see whether we read the real description or only screened the
// title. Built from the same flags the badges use — minYears defined means the
// description was fetched and parsed; sponsorScan set means visa language was
// read. Never overclaims: title-only stays title-only.
function verificationStatus(j){
  const descChecked = j.minYears !== undefined && j.minYears !== null;
  const sponsorChecked = j.sponsorScan !== undefined && j.sponsorScan !== null;
  // PREVIEW PAINT: the description scan runs once, after every source has
  // reported, so during progressive rendering nothing has been scanned yet.
  // Showing "🟡 Title screening only" here would be a lie that silently
  // upgrades to "✅ Description checked" a few seconds later — the student
  // would have no way to know the badge they read was provisional. Say we're
  // still working instead.
  if(j._previewPending && !descChecked && !sponsorChecked)
    return {text:'⏳ Still checking…', cls:'gray', note:'We\'re still reading this posting\'s full description. This badge will update when the check finishes.'};
  if(descChecked && sponsorChecked)
    return {text:'✅ Full description scanned', cls:'green', note:'We read this posting\'s full description, including its work-authorization language. Any sponsorship or experience badges reflect what that scan found.'};
  if(descChecked)
    return {text:'✅ Description scanned', cls:'green', note:'We read this posting\'s full description to verify the role level.'};
  if(sponsorChecked)
    return {text:'🟢 Sponsorship language scanned', cls:'green', note:'We scanned this posting for visa / sponsorship language.'};
  return {text:'🟡 Title screening only', cls:'gray', note:'This source doesn\'t expose the description, so we screened by title only. Read the posting before ruling it in or out.'};
}
function whyThisJob(j, kw, loc){
  const reasons = [];
  // Profile matches lead — they reflect what the user told us in "Improve My
  // Matches" and are the strongest personalized signal. Captured during scoring
  // so this list can never claim a match the score didn't actually credit.
  if(Array.isArray(j.profileReasons)) j.profileReasons.forEach(r => reasons.push(r));
  const title = j.title || '';
  const blob = (title + ' ' + (j.location||'') + ' ' + (j.company||'')).toLowerCase();
  if(kw || selectedRoles.length){
    const hit = matchedTerm(blob, kw);
    if(hit) reasons.push(`Matches: ${hit}`);
  }
  // A senior title is a strike against an entry-level search, not a reason for
  // it, so it is deliberately absent here. The other branches stay.
  // A description-stated experience floor also disqualifies the early-career
  // ✓ — the title may read junior while the requirements say otherwise.
  const yearsGated = Number(j.minYears || 0) >= (j.yearsPreferred ? 3 : 2);
  const wasScanned = j.minYears !== undefined && j.minYears !== null;
  if(isSeniorTitle(title) || yearsGated) { /* no positive reason to add */ }
  else if(INTERN_RX.test(title)) reasons.push('Internship signal');
  else if(NEWGRAD_RX.test(title)) reasons.push('New-grad signal');
  // Same rule as the badge: only claim "early-career" off an ambiguous title
  // when we actually read the description. Intern/new-grad titles above are
  // self-evident; "Analyst" is not.
  else if(wasScanned && (ENTRYLVL_RX.test(title) || REALISTIC_GRAD_RX.test(title) || ANY_EARLY_RX.test(title))) reasons.push('Early-career title');
  if(loc && locationMatches(j.location, loc)) reasons.push(`Location match: ${loc}`);
  if(isUSLocation(j.location)) reasons.push('US location');
  if(j.sector) reasons.push(`${j.sector} sector`);
  // Freshness is only a selling point while the posting is actually fresh.
  // Older than 30 days (or undated) => say nothing rather than claim a ✓.
  const age = postedAgeDays(j.posted);
  if(age !== null && age <= 30) reasons.push(freshnessText(j.posted));
  if(reasons.length < 3) reasons.push('Direct employer career page');
  return reasons.slice(0,5);
}
function renderJob(j, kw, loc){
  const sponsor = sponsorshipLabel(j);
  const experienced = isSeniorTitle(j.title || '');
  // A stated experience floor of 2+ years overrides any title-based early
  // signal. Uses the same softening rule as experienceTier(): "2+ years
  // preferred" is not the same wall as "2+ years required".
  const gated = Number(j.minYears || 0) >= (j.yearsPreferred ? 3 : 2);

  // AMBIGUOUS TITLES NEED EVIDENCE, NOT A GUESS.
  //
  // ENTRYLVL_RX contains `analyst( i)?\b`, so every "Analyst" title fires it —
  // including "AI Security Analyst" and "Cyber Intelligence Analyst", which are
  // rarely new-grad roles. Where the description was scanned, minYears settles
  // it. Where it wasn't (SmartRecruiters, Adzuna, employer boards), the old code
  // fell through to the title and asserted "entry / grad" anyway.
  //
  // That's the tool's own headline promise being broken by a guess: an unscanned
  // "Analyst" wore the same badge as a verified new-grad posting, and the
  // student had no way to tell them apart. An unambiguous signal (Intern, New
  // Grad, Entry-Level, Junior) is safe to trust from the title alone — nobody
  // titles a senior role "New Grad Engineer". A bare seniority-neutral noun
  // like "Analyst" or "Associate" is not.
  const scanned = j.minYears !== undefined && j.minYears !== null;
  const unambiguous = INTERN_RX.test(j.title || '') || NEWGRAD_RX.test(j.title || '');
  const early = hasEntrySignal(j.title || '') && !experienced && !gated
                && (scanned || unambiguous);
  const why = whyThisJob(j, kw, loc).map(r=>`<span>✓ ${esc(r)}</span>`).join('');
  const id = jobId(j);
  const saved = isJobSaved(id);
  const applied = isJobApplied(id);
  return `
        <div class="job" data-jobid="${esc(id)}">
          <div class="job-top">
            <a class="title" href="${j.url}" target="_blank" rel="noopener">${esc(j.title)}</a>
            ${(()=>{ const p = matchPercent(j.score); return `<span class="match-badge ${matchClass(p)}" title="Search-relevance estimate based on title, location, and entry-level fit — not a resume-to-posting ATS score.">${p}% match</span>`; })()}
          </div>
          <div class="loc">${esc(j.company)} · ${esc(j.location)}${j.sector ? ` · ${esc(j.sector)}` : ''}</div>
          <div class="job-meta-row">
            ${early ? '<span class="tag">entry / grad</span>' : ''}
            ${experienced ? '<span class="tag warn">experienced role</span>' : ''}
            <span class="tag blue">${esc(freshnessText(j.posted))}</span>
            ${(()=>{ const v = verificationStatus(j); return `<span class="tag ${v.cls}" title="${esc(v.note)}">${esc(v.text)}</span>`; })()}
            ${sponsor ? `<span class="tag ${sponsor.cls}">${esc(sponsor.text)}</span>` : ''}
            ${likelyUSPersonGated(j) ? ((j.source === 'usajobs' || j.ats === 'usajobs')
              ? '<span class="tag warn" title="Federal (USAJOBS) roles are almost always limited to U.S. citizens — in federal hiring, &quot;open to the public&quot; means citizens/nationals, not visa holders, and &quot;U.S. National&quot; is a narrow legal category, not a path for visa candidates. A minority of federal roles can hire non-citizens, and permanent residents may qualify — this is a likelihood, not a certainty.">⚠️ Federal role — usually U.S. citizens only</span>'
              : '<span class="tag warn" title="Defense and export-controlled roles are usually limited to US persons (citizens or permanent residents) or require a security clearance. By law the posting often cannot say so — this is a likelihood, not a certainty. If you have permanent residence, you may still qualify.">⚠️ Defense role — often US-person / clearance gated</span>') : ''}
            ${(!experienced && (j.score || 0) >= 8) ? '<span class="tag strong">high-priority lead</span>' : ''}
            ${(()=>{
              // Tier label replaces the raw years tag — it carries the number
              // AND the coaching read in one chip. Falls back to the old vague
              // tag for sources that flag experience without a parsed number.
              const tier = experienceTier(j);
              if(tier) return `<span class="tag ${tier.cls}" title="${esc(tier.note)}">${esc(tier.label)} · ${esc(tier.yrsText)}</span>`;
              if(j.expFlag) return '<span class="tag warn">may require experience</span>';
              // Not scanned and the title is seniority-ambiguous ("Analyst",
              // "Associate", "Specialist"). Saying nothing here would let it
              // pass for a verified entry-level role. Say we don't know.
              const wasScanned = j.minYears !== undefined && j.minYears !== null;
              const ambiguous = !INTERN_RX.test(j.title||'') && !NEWGRAD_RX.test(j.title||'')
                                && hasEntrySignal(j.title||'');
              // During a preview paint the scan simply hasn't run yet, so
              // "experience not verified" would state a conclusion we haven't
              // reached. The ⏳ verification chip already says we're working.
              if(j._previewPending) return '';
              if(!wasScanned && ambiguous){
                return '<span class="tag gray" title="This source doesn\'t expose the job description, so we couldn\'t check the experience requirement. Titles like &quot;Analyst&quot; span new-grad to 6+ years — read the posting before ruling it in or out.">experience not verified</span>';
              }
              return '';
            })()}
            ${j.source === 'adzuna' ? '<span class="tag gray">Adzuna</span>' : ''}
            ${j.aggregator ? `<span class="tag warn">via ${esc(j.aggregatorName || 'aggregator')} — signup may be required</span>` : ''}
            ${j.resolvedDirect ? '<span class="tag strong">direct employer link found</span>' : ''}
            ${j.source === 'ashby' ? '<span class="tag gray">Ashby</span>' : ''}
            ${j.source === 'greenhouse' ? '<span class="tag gray">Greenhouse</span>' : ''}
            ${j.source === 'usajobs' ? '<span class="tag gray">USAJOBS</span>' : ''}
            ${j.source === 'themuse' ? '<span class="tag gray">The Muse</span>' : ''}
            ${j.source === 'careeronestop' ? '<span class="tag gray">CareerOneStop (DOL)</span>' : ''}
            ${j.source === 'mcloud' ? '<span class="tag gray">CareerBuilder</span>' : ''}
            ${j.source === 'phenom' ? '<span class="tag gray">Hospital System</span>' : ''}
            ${j.source === 'oracle' ? '<span class="tag gray">Hospital System</span>' : ''}
            ${j.source === 'workday' ? '<span class="tag gray">Workday</span>' : ''}
          </div>
          ${(()=>{ const sal = salaryEstimate(j); return sal ? `<div class="salary">${esc(sal)}</div>` : ''; })()}
          <div class="why"><strong>Why this job?</strong><div class="why-list">${why}</div></div>
          ${(()=>{
            // Only add the employer-history hint when THIS posting didn't state
            // sponsorship (🟡 unknown) AND the employer is in our curated list.
            if(!sponsor || sponsor.cls !== 'sp-unk') return '';
            const tier = sponsorHistoryTier(j.company);
            if(!tier) return '';
            const label = tier === 'strong'
              ? 'has a <strong>strong recent H-1B sponsorship history</strong>'
              : 'has a <strong>moderate recent H-1B sponsorship history</strong>';
            return `<div class="sponsor-history sh-${tier}">
              <span class="sh-ic">ℹ️</span>
              <span class="sh-text">This posting doesn't mention sponsorship, but <strong>${esc(j.company)}</strong> ${label}.
              Note: 2026 H-1B lottery rules are now wage-weighted, so a sponsorship record no longer guarantees selection odds.
              <a href="https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub" target="_blank" rel="noopener">Verify current status →</a></span>
            </div>`;
          })()}
          <div class="job-actions">
            <button class="jbtn save${saved?' on':''}" data-act="save" data-jobid="${esc(id)}" aria-pressed="${saved}">
              <span class="ic">${saved?'★':'☆'}</span><span class="lbl">${saved?'Saved':'Save'}</span>
            </button>
            <button class="jbtn applied${applied?' on':''}" data-act="applied" data-jobid="${esc(id)}" aria-pressed="${applied}">
              <span class="ic">${applied?'✓':'○'}</span><span class="lbl">${applied?'Applied':'Mark applied'}</span>
            </button>
          </div>
        </div>`;
}
// COACH JEFF PICKS — curated off-pipeline employers.
//
// These are large national employers whose early-career postings the Job Finder
// does NOT already surface (they run on Oracle/iCIMS/SuccessFactors/Avature or
// custom systems, not the Greenhouse/Ashby/Lever/Workday feeds the tool crawls,
// and none are in MANUAL_COMPANIES/WORKDAY_EMPLOYERS/COMPANIES). Each links to
// the employer's own students / early-career landing page — a place to browse,
// not a keyword search — so the section is genuinely additive to live results.
//
// Organized by sector. renderCoachPicks() picks the bucket from the search
// keyword; when nothing matches, it falls back to CROSS_SECTOR ("Broad
// early-career employers"). All URLs verified live at time of authoring.
const COACH_PICKS_BY_SECTOR = {
  pharma: {
    label: 'Pharma & Life Sciences',
    picks: [
      {name:'Johnson & Johnson', url:'https://www.careers.jnj.com/en/early-career-programs/', note:'Early-career programs across business, data, finance, ops, engineering, and marketing.'},
      {name:'Merck', url:'https://jobs.merck.com/us/en/student-opportunities', note:'Future Talent Program internships and co-ops across R&D, manufacturing, and commercial.'},
      {name:'Pfizer', url:'https://www.pfizer.com/en/about/careers/early-careers', note:'Pfizer Futures internships plus analytics, finance, strategy, and marketing tracks.'},
      {name:'Eli Lilly', url:'https://careers.lilly.com/us/en/overview', note:'Student internships and full-time early-career roles across the business.'},
      {name:'AbbVie', url:'https://www.abbvie.com/join-us/student-and-new-graduates.html', note:'Internships, co-ops, and development programs for students and new grads.'},
      {name:'Amgen', url:'https://careers.amgen.com/en/students-graduates', note:'Graduate opportunities across functions and geographies in biotech.'}
    ]
  },
  consulting: {
    label: 'Consulting & Professional Services',
    picks: [
      {name:'Deloitte', url:'https://www.deloitte.com/us/en/careers/student-careers.html', note:'Internships and entry-level consulting, audit, tax, and tech across every major.'},
      {name:'EY', url:'https://www.ey.com/en_us/careers/students-and-entry-level-professionals', note:'Internships and early-career programs across assurance, consulting, tax, and strategy.'},
      {name:'KPMG', url:'https://www.kpmguscareers.com/early-career/', note:'Undergraduate internships and early-career programs with national training.'}
    ]
  },
  aerospace: {
    label: 'Aerospace & Defense',
    picks: [
      {name:'Boeing', url:'https://jobs.boeing.com/early-careers', note:'Early-career roles across engineering, business, IT, and operations.'},
      {name:'RTX (Raytheon)', url:'https://careers.rtx.com/global/en', note:'Aerospace and defense early-career roles across Raytheon, Collins, and Pratt & Whitney.'},
      {name:'General Dynamics', url:'https://gdmissionsystems.com/careers/students-and-recent-graduates', note:'Students and recent graduates in engineering, business, and mission systems.'},
      {name:'L3Harris', url:'https://careers.l3harris.com/en/new-grads-and-interns', note:'New-grad and intern rotational and mentoring programs across engineering and business.'}
    ]
  },
  energy: {
    label: 'Energy & Industrial',
    picks: [
      {name:'ExxonMobil', url:'https://corporate.exxonmobil.com/careers', note:'Internships and early-career roles across engineering, business, and operations.'},
      {name:'Chevron', url:'https://careers.chevron.com/early-career', note:'Early-career development programs across technical and business functions.'},
      {name:'GE Aerospace', url:'https://careers.geaerospace.com/global/en/us-students-new-grads', note:'US students and new grads — engineering plus business/finance/ops leadership programs.'},
      {name:'GE Vernova', url:'https://careers.gevernova.com/early-careers', note:'Internships, co-ops, and entry-level energy roles feeding development programs.'}
    ]
  },
  finance: {
    label: 'Banking & Insurance',
    picks: [
      {name:'JPMorgan Chase', url:'https://careers.jpmorgan.com/us/en/students/programs', note:'Analyst programs spanning finance, tech, operations, and business.'},
      {name:'Goldman Sachs', url:'https://www.goldmansachs.com/careers/students', note:'Student programs across investment banking, finance, and wealth management.'},
      {name:'Bank of America', url:'https://careers.bankofamerica.com/en-us/students', note:'Internships and analyst/associate roles across the firm.'},
      {name:'Wells Fargo', url:'https://www.wellsfargojobs.com/en/early-careers/', note:'Internship and development programs for undergraduates and post-graduates.'},
      {name:'Liberty Mutual', url:'https://jobs.libertymutualgroup.com/careers/campus/', note:'Campus internships and development programs across 30+ entry points.'},
      {name:'Progressive', url:'https://careers.progressive.com/en/pages/students-graduates/', note:'Internships and recent-grad jobs across teams enterprise-wide.'}
    ]
  },
  telecom: {
    label: 'Telecom & Communications',
    picks: [
      {name:'Verizon', url:'https://mycareer.verizon.com/life-at-verizon/early-in-career/', note:'Internships and leadership development across corporate, tech, and cyber.'},
      {name:'T-Mobile', url:'https://careers.t-mobile.com/meet-our-teams/students-and-grads', note:'Student and new-grad roles across corporate, tech, and operations.'}
    ]
  },
  transportation: {
    label: 'Transportation & Logistics',
    picks: [
      {name:'FedEx', url:'https://careers.fedex.com/career-areas/student-programs/', note:'Student internships across HR, IT, marketing, engineering, operations, and transportation.'},
      {name:'UPS', url:'https://www.jobs-ups.com/us/en/opportunities-for-students', note:'Internships and co-ops across IT, sales, engineering, and operations.'},
      {name:'Delta Air Lines', url:'https://www.delta.com/us/en/careers/students-and-early-careers', note:'Student programs with exposure across divisions toward entry-level roles.'},
      {name:'United Airlines', url:'https://careers.united.com/us/en/students', note:'Student and early-career roles across revenue, finance, ops, and tech.'},
      {name:'Southwest Airlines', url:'https://careers.southwestair.com/us/en/programs', note:'Dallas HQ. College internships and direct college-hire programs across the business.'}
    ]
  },
  automotive: {
    label: 'Automotive & Manufacturing',
    picks: [
      {name:'Ford', url:'https://www.careers.ford.com/en/programs/students-and-graduates.html', note:'Summer internships plus the Ford College Graduate rotational program.'},
      {name:'General Motors', url:'https://search-careers.gm.com/en/early-careers/', note:'Internships and early-career rotational programs across technical and non-technical fields.'},
      {name:'John Deere', url:'https://www.deere.com/en-us/our-company/careers/students-and-recent-graduates', note:'Student and recent-graduate roles across engineering, business, and operations.'},
      {name:'3M', url:'https://www.3m.com/3M/en_US/careers-us/', note:'Internships plus Optimized Operations, Frontline Sales, and Strategy & Marketing programs.'}
    ]
  },
  consumer: {
    label: 'Consumer / Retail / CPG',
    picks: [
      {name:'Walmart', url:'https://careers.walmart.com/us/en/home', note:'Corporate tracks in analytics, merchandising, supply chain, tech, and finance.'},
      {name:'Procter & Gamble', url:'https://www.pgcareers.com', note:'Internships and full-time roles for students across brands and functions.'},
      {name:'Coca-Cola', url:'https://www.coca-colacompany.com/careers/early-careers', note:'Early-career internships spanning brands, markets, and partners.'},
      {name:'Nike', url:'https://careers.nike.com/career-areas', note:'Internships across retail, corporate, tech, and design.'}
    ]
  },
  healthcare: {
    label: 'Healthcare Systems',
    picks: [
      {name:'Ascension', url:'https://jobs.ascension.org/us/en/students-graduates', note:'Internships, externships, nurse residency, and administrative fellowship.'},
      {name:'Intermountain Health', url:'https://intermountainhealthcare.org/careers/student-programs', note:'Student programs across nursing, tech, business, and allied health.'},
      {name:'Sutter Health', url:'https://jobs.sutterhealth.org/us/en/home', note:'Roles across health info, patient services, HR, finance, IT, and research.'},
      {name:'Trinity Health', url:'https://jobs.trinity-health.org', note:'Early-career roles across one of the largest faith-based health systems.'},
      {name:'Providence', url:'https://providence.jobs', note:'Student placements, internships, and new-grad clinical and non-clinical roles.'}
    ]
  }
};

// Fallback shown when the search keyword matches no sector above. Broad,
// recognizable, cross-functional employers — a safe default for any major.
const COACH_PICKS_CROSS_SECTOR = {
  label: 'Broad early-career employers',
  picks: [
    {name:'American Express', url:'https://www.americanexpress.com/en-us/careers/student-programs/global-students-page.html', note:'Student programs across finance, tech, analytics, marketing, and operations.'},
    {name:'Sherwin-Williams', url:'https://careers.sherwin-williams.com/students-graduates', note:'Management & sales training plus tracks in ops, finance, supply chain, and HR.'},
    {name:'Cintas', url:'https://careers.cintas.com/content/Campus-Recruitment/', note:'Management trainee program and internships across sales, service, and corporate.'},
    {name:'Enterprise Mobility', url:'https://www.enterprisemobility.com/en/careers/career-opportunities/management-trainee-jobs.html', note:'The classic all-majors management trainee — sales, marketing, finance, and ops.'},
    {name:'Aldi', url:'https://careers.aldi.us/district', note:'District Manager program with a paid training track open to any major.'},
    {name:'OpenAI', url:'https://openai.com/careers/emerging-talent/', note:'Emerging Talent — internships, residency, and full-time roles for 0–3 years experience.'}
  ]
};

// Map a search keyword to a COACH_PICKS_BY_SECTOR key. Order matters: the first
// matching pattern wins, so more specific sectors are tested before broad ones.
function coachPickSector(kw){
  const q = (kw || '').toLowerCase();
  if(!q) return null;
  if(/pharma|biotech|life scien|drug|clinical trial|pharmacolog/.test(q)) return 'pharma';
  if(/nurse|nursing|clinical|patient|medical|health|hospital|public health/.test(q)) return 'healthcare';
  if(/consult|advisory|audit|assurance|\btax\b/.test(q)) return 'consulting';
  if(/aerospace|defense|defence|aviation eng|clearance|missile|satellite/.test(q)) return 'aerospace';
  if(/energy|oil|gas|petroleum|utility|utilities|power|turbine|renewable/.test(q)) return 'energy';
  if(/finance|financ|account|bank|invest|insurance|actuar|underwrit|wealth/.test(q)) return 'finance';
  if(/telecom|wireless|network eng|communications/.test(q)) return 'telecom';
  if(/logistics|supply chain|transportation|airline|pilot|cargo|freight|aviation/.test(q)) return 'transportation';
  if(/automotive|manufactur|mechanical|industrial eng|assembly|plant/.test(q)) return 'automotive';
  if(/retail|consumer|cpg|merchandis|brand|marketing|ecommerce|e-commerce/.test(q)) return 'consumer';
  return null;
}

function renderCoachPicks(kw){
  const key = coachPickSector(kw);
  const bucket = key ? COACH_PICKS_BY_SECTOR[key] : COACH_PICKS_CROSS_SECTOR;
  if(!bucket || !bucket.picks || !bucket.picks.length) return '';
  const cards = bucket.picks.map(c =>
    `<a class="searchlink-card" href="${c.url}" target="_blank" rel="noopener"><div class="searchlink-title">${esc(c.name)} <span class="searchlink-arrow">→</span></div><div class="searchlink-meta">Coach Jeff pick · ${esc(c.note || '')}</div></a>`
  ).join('');
  return `<section class="searchlinks coach-picks"><div class="direct-heading">Coach Jeff Picks · ${esc(bucket.label)}</div><p class="searchlink-note">Large national employers the live search above doesn't cover — these open each employer's own early-career page to browse directly.</p><div class="searchlink-grid">${cards}</div></section>`;
}

function buildSearchUrl(c, kw){
  const q = encodeURIComponent((kw || '').trim() || 'entry level');
  if(c.searchUrl) return c.searchUrl.replaceAll('{q}', q);
  return c.url;
}

function manualEmployerScore(c, kw, sector){
  let s = c.priority || 50;
  const hay = ((c.name||'') + ' ' + (c.note||'') + ' ' + (c.sector||'') + ' ' + (c.atsType||'')).toLowerCase();
  const q = (kw || '').toLowerCase().trim();
  if(sector && sector !== 'any' && c.sector === sector) s += 10;
  if(q && hay.includes(q)) s += 8;
  if(q.includes('data') || q.includes('analyst')) {
    if(/analytics|analyst|data|research|program|operations|finance|tech|education|government|healthcare/i.test(c.note || '')) s += 6;
  }
  return s;
}


const STATE_ALIASES = {
  "alabama":["al","alabama"], "alaska":["ak","alaska"], "arizona":["az","arizona"], "arkansas":["ar","arkansas"],
  "california":["ca","california"], "colorado":["co","colorado"], "connecticut":["ct","connecticut"], "delaware":["de","delaware"],
  "florida":["fl","florida"], "georgia":["ga","georgia"], "hawaii":["hi","hawaii"], "idaho":["id","idaho"],
  "illinois":["il","illinois"], "indiana":["in","indiana"], "iowa":["ia","iowa"], "kansas":["ks","kansas"],
  "kentucky":["ky","kentucky"], "louisiana":["la","louisiana"], "maine":["me","maine"], "maryland":["md","maryland"],
  "massachusetts":["ma","massachusetts"], "michigan":["mi","michigan"], "minnesota":["mn","minnesota"], "mississippi":["ms","mississippi"],
  "missouri":["mo","missouri"], "montana":["mt","montana"], "nebraska":["ne","nebraska"], "nevada":["nv","nevada"],
  "new hampshire":["nh","new hampshire"], "new jersey":["nj","new jersey"], "new mexico":["nm","new mexico"], "new york":["ny","new york"],
  "north carolina":["nc","north carolina"], "north dakota":["nd","north dakota"], "ohio":["oh","ohio"], "oklahoma":["ok","oklahoma"],
  "oregon":["or","oregon"], "pennsylvania":["pa","pennsylvania"], "rhode island":["ri","rhode island"], "south carolina":["sc","south carolina"],
  "south dakota":["sd","south dakota"], "tennessee":["tn","tennessee"], "texas":["tx","texas"], "utah":["ut","utah"],
  "vermont":["vt","vermont"], "virginia":["va","virginia"], "washington":["wa","washington"], "west virginia":["wv","west virginia"],
  "wisconsin":["wi","wisconsin"], "wyoming":["wy","wyoming"], "district of columbia":["dc","district of columbia","washington dc","washington, dc"]
};

function normalizeLocationText(s){
  return (s || '')
    .toLowerCase()
    .replace(/\bremote[- ]?us\b/g, 'remote united states')
    .replace(/&/g, ' and ')
    // Reconcile "St." / "St " with "Saint" BEFORE punctuation is stripped, so a
    // user typing "St. Louis" or "St Louis" matches job data that reads "Saint
    // Louis" (Phenom health systems spell it out), and vice-versa. Runs on both
    // the typed input and the job location since both pass through here, so all
    // three spellings collapse to one. Also handles "Ste." (Sainte) and "Mt."
    // (Mount), which appear in the same city data. Matched only before a letter
    // so it never touches a trailing "st" like "1st" or "Ernst".
    .replace(/\bst\.?\s+(?=[a-z])/g, 'saint ')
    .replace(/\bste\.?\s+(?=[a-z])/g, 'sainte ')
    .replace(/\bmt\.?\s+(?=[a-z])/g, 'mount ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function locationTerms(input){
  const q = normalizeLocationText(input);
  if(!q) return [];
  for(const [state, terms] of Object.entries(STATE_ALIASES)){
    if(terms.includes(q) || state === q) return terms;
  }
  return [q];
}

// Parse a location query into { city, stateAliases, terms }.
// Handles three shapes:
//   "texas"          -> { city:null, stateAliases:[tx,texas], terms:[...] }  (state search)
//   "dallas, tx"     -> { city:"dallas", stateAliases:[tx,texas], terms:[...] }  (city+state)
//   "dallas"         -> { city:"dallas", stateAliases:null, terms:["dallas"] }  (plain city)
// The city+state case is the important one: the old locationTerms glued
// "dallas tx" into a single token that only matched a job literally containing
// "dallas tx", so "Dallas, Texas" / "Dallas" were rejected. Splitting the state
// off and matching it via its aliases is what fixes the mass over-filtering.
function parseLocationInput(input){
  const q = normalizeLocationText(input);
  if(!q) return { city:null, stateAliases:null, terms:[] };

  // Whole input is a state name/abbreviation.
  for(const [state, terms] of Object.entries(STATE_ALIASES)){
    if(terms.includes(q) || state === q){
      return { city:null, stateAliases:terms, terms:terms.slice() };
    }
  }

  // Input ends with a state token/alias -> split into city + state.
  const toks = q.split(' ');
  for(let cut = toks.length - 1; cut >= 1; cut--){
    const tail = toks.slice(cut).join(' ');
    for(const [state, terms] of Object.entries(STATE_ALIASES)){
      if(terms.includes(tail) || state === tail){
        const city = toks.slice(0, cut).join(' ');
        return { city, stateAliases:terms, terms:[city, ...terms] };
      }
    }
  }

  // Plain single term (lone city or free text).
  return { city:q, stateAliases:null, terms:[q] };
}

// Cheap, synchronous subset of the real filter chain, used only for the
// progressive preview paints while sources are still arriving. It applies the
// same title/keyword/location/sector/work/clearance/US/degree gates and the same
// dedup, but deliberately skips the server-side description scan (that needs a
// network round trip and only runs once, at the end). Results are score-sorted
// so the preview shows plausible top matches rather than arrival order.
// Anything this lets through that the real chain later drops simply disappears
// on the final render — a preview is allowed to be slightly generous, never
// slightly wrong about a job it shows.
function previewFilter(all, o){
  const seen = new Set();
  const out = [];
  for(const j of all){
    if(!j) continue;
    if(isSubDegreeRole(j)) continue;   // sub-degree roles never shown (all sources, all levels)
    const key = [
      (j.url || '').split('?')[0].toLowerCase(),
      (j.title || '').toLowerCase().replace(/\s+/g,' ').trim(),
      (j.company || '').toLowerCase().replace(/\s+/g,' ').trim(),
      (j.location || '').toLowerCase().replace(/\s+/g,' ').trim()
    ].join('|');
    if(seen.has(key)) continue;
    seen.add(key);

    const t = (j.title || '');
    const blob = (t + ' ' + (j.location||'') + ' ' + (j.company||'')).toLowerCase();

    if(!o.showExperienced && (isSeniorTitle(t) || beyondEarlyCareer(j))) continue;
    if(o.level !== 'all'){
      if(o.level === 'intern' && !INTERN_RX.test(t)) continue;
      if(o.level === 'newgrad' && !NEWGRAD_RX.test(t)) continue;
      if(o.level === 'entrylevel' && !ENTRYLVL_RX.test(t)) continue;
      if(o.level === 'early' && !(ANY_EARLY_RX.test(t) || REALISTIC_GRAD_RX.test(t))) continue;
    }
    if(o.noIntern && o.level !== 'intern' && INTERN_RX.test(t)) continue;
    if((o.kw || selectedRoles.length) && !keywordMatchesAny(blob, o.kw)) continue;
    if(o.loc && !locationMatches(j.location, o.loc)) continue;
    if(o.sector !== 'any' && j.sector !== o.sector) continue;
    if(o.work === 'remote' && !REMOTE_RX.test(blob)) continue;
    if(o.work === 'hybrid' && !HYBRID_RX.test(blob)) continue;
    if(o.work === 'onsite' && (REMOTE_RX.test(blob) || HYBRID_RX.test(blob))) continue;
    if(o.hideClear && CLEAR_RX.test(blob)) continue;
    if(o.usOnly && !isUSJob(j)) continue;
    if(o.degreeOnly && NONDEGREE_RX.test(t) && !CLINICAL_RX.test(t)) continue;
    if(GIGWORK_RX.test(t)) continue;
    if(LICENSED_RX.test(t)) continue;
    if(j.aggregator && ANON_COMPANY_RX.test(j.company || '')) continue;

    out.push(j);
  }
  // Score into a side table rather than onto the job objects: the real pipeline
  // recomputes score anyway, and mutating shared objects mid-search is a good
  // way to create a bug that only shows up on the second search.
  const s = new Map();
  for(const j of out) s.set(j, scoreJob(j, o.kw, o.loc));
  out.sort((a,b) => (s.get(b)||0) - (s.get(a)||0));
  return out;
}

// MULTI-LOCATION (Aug 2026): `input` may now be a single location string OR
// several locations the user chose as chips. Several locations are passed as a
// comma-joined string ("denver, co · dallas, tx" is stored comma-separated) or
// as an array. Semantics are OR: a job matches if it matches ANY chosen
// location — the model that fits a new grad open to a few metros at once.
//
// This wrapper is the ONLY place multi-location is interpreted. Every existing
// call site (main filter, previewFilter, RF filter, scoreJob) passes its `loc`
// straight through unchanged and gets correct OR behavior for free. The single
// matcher below is the original function, renamed — its logic is untouched.
function locationMatches(locText, input){
  const list = splitLocations(input);
  if(list.length <= 1) return locationMatchesOne(locText, list[0] || input);
  return list.some(one => locationMatchesOne(locText, one));
}

// Split a multi-location value into an array of single-location strings.
// Accepts an array (used directly) or a string. For strings we split on commas
// ONLY when the value looks like several locations — a lone "Dallas, TX" must
// stay whole, so we split on a comma only when a segment on its own parses as a
// complete location (a bare state, or a "city + state"). Chips join with " ; "
// as an unambiguous separator to sidestep the city/state comma entirely.
function splitLocations(input){
  if(Array.isArray(input)) return input.map(s => (s||'').trim()).filter(Boolean);
  const raw = (input || '').trim();
  if(!raw) return [];
  if(raw.includes(';')){
    return raw.split(';').map(s => s.trim()).filter(Boolean);
  }
  return [raw];
}

function locationMatchesOne(locText, input){
  const parsed = parseLocationInput(input);
  if(!parsed.terms.length) return true;

  const loc = normalizeLocationText(locText);
  const has = t => (t && t.length === 2)
    ? new RegExp('(^|\\s)' + t + '(\\s|$)').test(loc)
    : (t ? loc.includes(t) : false);

  // City + state typed (e.g. "dallas, tx" or "dallas texas"): require the CITY
  // to appear. The state is corroboration, not a hard requirement — job boards
  // constantly disagree on "TX" vs "Texas" vs omitting the state, and a bare
  // city name is unambiguous enough. This is the fix for the bug where
  // "dallas, tx" collapsed into one rigid "dallas tx" token and rejected
  // "Dallas, Texas", "Dallas", etc. — killing almost every legitimate result.
  if(parsed.city && parsed.stateAliases){
    return loc.includes(parsed.city);
  }

  // State-only search (e.g. "texas"): match if any alias of that state appears.
  if(!parsed.city && parsed.stateAliases){
    // Broad remote/US postings are surfaced too, so a state search doesn't hide
    // remote-US roles a student could take from that state.
    if(/\b(remote|united states)\b/.test(loc)) return true;
    return parsed.stateAliases.some(has);
  }

  // Plain single term (a lone city, or free text). Treat broad remote/US
  // postings as potentially relevant unless the user typed a 2-letter state.
  const term = parsed.city || parsed.terms[0];
  if(/\b(remote|united states)\b/.test(loc) && term && term.length > 2
     && !Object.values(STATE_ALIASES).some(arr => arr.includes(term))){
    return loc.includes(term);
  }
  return has(term);
}

function isStateSearch(input){
  const q = normalizeLocationText(input);
  return Object.values(STATE_ALIASES).some(arr => arr.includes(q));
}

async function search(){
  // A real search re-syncs the results with the form, so any "your roles
  // changed" flag is now resolved.
  clearResultsStale();
  // Reset per-search source-health flags (set by fetchGreenhouseAPI on a failed
  // or partial sweep) so a stale flag from a previous search can't mislabel
  // this one.
  window._ghFailed = false;
  window._ghPartial = null;
  // Reset post-result filters and hide the bar; a new search rebuilds them.
  if(typeof RF !== 'undefined'){ RF.active = { loc: new Set(), role: new Set(), sector: new Set(), exp: new Set() }; }
  const _rfBar = document.getElementById('resultFilter');
  if(_rfBar){ _rfBar.style.display = 'none'; _rfBar.classList.remove('rf-open'); _rfBar.innerHTML = ''; }
  syncExperienceControls();
  // If the user typed a place but didn't press Enter, don't silently drop it.
  if(typeof window._commitPendingLocation === 'function') window._commitPendingLocation();
  const kw = document.getElementById('kw').value.trim().toLowerCase();
  const loc = document.getElementById('loc').value.trim().toLowerCase();
  const level = document.getElementById('lvl').value;
  const work = document.getElementById('work').value;
  const sector = document.getElementById('sector').value;
  const company = document.getElementById('company').value;
  const sortBy = document.getElementById('sort').value;
  const hideClear = document.getElementById('noclear').checked;
  const usOnly = document.getElementById('usonly').checked;
  const degreeOnly = document.getElementById('degreeonly').checked;
  const noIntern = document.getElementById('nointern') ? document.getElementById('nointern').checked : false;
  const showExperienced = document.getElementById('showexperienced') ? document.getElementById('showexperienced').checked : false;
  const showSuggest = document.getElementById('showsuggest') ? document.getElementById('showsuggest').checked : false;

  goBtn.disabled = true;
  // Suppress screen-reader announcements while progressive previews repaint
  // this region. Cleared once the final render lands, so exactly one
  // announcement is made per search instead of one per paint.
  results.setAttribute('aria-busy', 'true');
  results.innerHTML = '';
  countEl.textContent = '';

  try {
    const liveCompanies = COMPANIES.filter(c => c.ats === 'lever');
    const directCompanies = MANUAL_COMPANIES || [];

    const pool = company === 'any'
      ? liveCompanies
      : liveCompanies.filter(c => c.slug === company);

    const selectedDirect = company === 'any'
      ? directCompanies
      : directCompanies.filter(c => c.slug === company);

    // A company can appear in the dropdown even when it is a curated direct-search
    // employer rather than a live API source. Dell is the important case: it moved
    // to Oracle HCM, so its old Workday feed is intentionally gone. When a user
    // explicitly selects one of these direct-only employers, do NOT run the general
    // APIs and show unrelated companies; route the search to that employer instead.
    // IBM is a hybrid source: keep its official direct-search card, but also let
    // our existing live data partners look for IBM postings. Other manual-only
    // employers (notably Dell) keep the direct-only behavior.
    const ibmLiveSelection = company === 'ibm';
    // A "wd-"-prefixed slug means the user picked a specific Workday employer.
    // When that happens, the search should show ONLY that employer's roles, so
    // we run just the Workday source and skip every other API/board sweep.
    const workdayOnlySelection = company !== 'any'
      && WORKDAY_EMPLOYERS.some(emp => emp.slug === company);
    const directOnlySelection = company !== 'any' && selectedDirect.length > 0 && pool.length === 0 && !ibmLiveSelection && !workdayOnlySelection;

    let jobs = [];
    const sourceStats = { direct:0, usajobs:0, adzuna:0, ashby:0, greenhouse:0, lever:0, smartrecruiters:0, themuse:0, careeronestop:0, mcloud:0, phenom:0, oracle:0, workday:0 };
    let okCos = 0, failCos = 0;

    // ---- (1) All six sources start NOW, in parallel ---------------------------
    // Previously each source was awaited in turn, so wall-clock time was the SUM
    // of six round trips. Kicking the five API sources off here means they run
    // while the direct-board sweep below is still going; total time is now the
    // slowest single source rather than the sum. Each promise resolves to a
    // {key, jobs} record and swallows its own errors, so one dead source can
    // never take down the search.
    // MULTI-LOCATION boundary (Aug 2026).
    // `loc` may now carry several " ; "-joined places. Two kinds of source
    // handle location differently, so they get different slices of it:
    //
    //  • Server-param sources (Adzuna, USAJobs, CareerOneStop) put location IN
    //    the API request. Passing a joined multi-city string there matches
    //    nothing, and looping each city would be N× the calls per source —
    //    straight into the 10s Netlify budget and Adzuna's 3-page fan-out. So
    //    these get the FIRST chosen location only (locPrimary). The other
    //    cities are still fully searched by the client-side sources below.
    //
    //  • Client-filter sources (Greenhouse, Ashby, Lever, SmartRecruiters,
    //    Workday, The Muse) pull postings and narrow locally through the now
    //    OR-aware locationMatches(). They cost nothing extra per city, so they
    //    get the full multi-location value and cover every chosen place.
    //
    // Net effect: every source honors at least the primary city; the board
    // network honors all of them; no source makes extra API calls. If a search
    // truly needs all cities from the server-param sources too, that's the
    // separate Camp-B fan-out follow-up — deliberately not built here.
    const _locList = splitLocations(loc);
    const locPrimary = _locList.length ? _locList[0] : loc;
    const SERVER_PARAM_SOURCES = new Set(['adzuna','usajobs','careeronestop']);
    const apiSource = (key, fn) => fn(kw, SERVER_PARAM_SOURCES.has(key) ? locPrimary : loc)
      .then(list => ({ key, jobs: Array.isArray(list) ? list : [] }))
      .catch(() => ({ key, jobs: [] }));

    const apiPromises = directOnlySelection ? [] : (workdayOnlySelection ? [
      // User picked one specific Workday employer: show only its roles.
      // fetchWorkday reads the same dropdown value and narrows to that employer.
      apiSource('workday',        fetchWorkday),
    ] : (ibmLiveSelection ? [
      // IBM Phase 2: use sources that can contain jobs from many employers.
      // Adzuna gets an IBM-biased query; Muse/CareerOneStop use the user's role
      // keyword and are employer-filtered after merge. Do not waste requests on
      // ATS sweeps (Ashby/Greenhouse/Lever/Workday) because IBM is on Avature.
      apiSource('adzuna',         fetchIBMViaAdzuna),
      apiSource('themuse',        fetchTheMuse),
      apiSource('careeronestop',  fetchCareerOneStop),
    ] : [
      apiSource('usajobs',        fetchUSAJobs),
      apiSource('adzuna',         fetchAdzuna),
      apiSource('ashby',          fetchAshby),
      apiSource('greenhouse',     fetchGreenhouseAPI),
      apiSource('lever',          fetchLeverAPI),
      apiSource('smartrecruiters',fetchSmartRecruiters),
      apiSource('themuse',        fetchTheMuse),
      apiSource('careeronestop',  fetchCareerOneStop),
      apiSource('mcloud',         fetchMCloud),
      apiSource('phenom',         fetchPhenom),
      apiSource('oracle',         fetchOracle),
      apiSource('workday',        fetchWorkday),
    ]));

    // ---- (2) Progressive render: paint each source as it lands ----------------
    // Nothing used to appear until every source returned. Now each source paints
    // as it reports, so cards appear within a second or two and fill in.
    //
    // WHY THE YIELDING MATTERS: a .then() callback cannot run until the JS call
    // stack is empty. The board sweep below awaits batches back to back, and a
    // dead board holds its batch for up to 15s (timeout + retry), so without an
    // explicit yield the queued paint handlers all fire AFTER the sweep — which
    // is exactly one paint at the end, the bug this was supposed to fix.
    // yieldToBrowser() releases the stack between batches; rAF then gives the
    // browser an actual frame to composite in.
    const yieldToBrowser = () => new Promise(r => setTimeout(r, 0));

    let progressiveDone = false;
    let paintQueued = false;
    const paintProgressive = () => {
      if(progressiveDone || paintQueued) return;
      paintQueued = true;
      requestAnimationFrame(() => {
        paintQueued = false;
        if(progressiveDone) return;
        try {
          const preview = previewFilter(jobs, {kw, loc, level, work, sector, hideClear, usOnly, degreeOnly, showExperienced, noIntern});
          if(!preview.length) return;
          countEl.textContent = `${preview.length} matching job${preview.length===1?'':'s'} so far…`;
          // Flag these as provisional so renderJob shows "⏳ Still checking…"
          // instead of asserting a verification verdict the scan hasn't reached.
          // Copies, so the flag can never leak into the final render.
          const shown = preview.slice(0, 50).map(j =>
            Object.assign({}, j, {_previewPending:true, _previewSponsor:hideClear}));
          results.innerHTML = shown.map(j => renderJob(j, kw, loc)).join('');
        } catch(e){ /* preview is best-effort; never break the real render */ }
      });
    };

    apiPromises.forEach(p => p.then(r => {
      if(progressiveDone) return;
      sourceStats[r.key] = r.jobs.length;
      if(r.jobs.length) jobs = jobs.concat(r.jobs);
      paintProgressive();
    }));

    statusEl.innerHTML = directOnlySelection
      ? `<span class="loading">Opening the selected employer's current careers search…</span>`
      : `<span class="loading">Searching ${pool.length} direct employer job board${pool.length===1?'':'s'} and job APIs…</span>`;

    // Yield once before the sweep starts. The five APIs are usually much faster
    // than 18 employer boards, so this gives any that have already returned a
    // chance to paint before the long board loop begins — first cards on screen
    // in ~1s rather than after the sweep.
    await yieldToBrowser();

    const BATCH = 10;
    for(let i=0;i<pool.length;i+=BATCH){
      const slice = pool.slice(i, i+BATCH);
      const results = await Promise.all(slice.map(fetchBoardResilient));
      results.forEach(r=>{
        if(r.ok){
          okCos++;
          const boardJobs = Array.isArray(r.jobs) ? r.jobs : [];
          sourceStats.direct += boardJobs.length;
          jobs = jobs.concat(boardJobs);
        }
        else { failCos++; }
      });
      statusEl.innerHTML = `<span class="loading">Searched ${Math.min(i+BATCH,pool.length)} / ${pool.length} direct employer job boards… (job APIs still running)</span>`;
      paintProgressive();
      // Release the call stack so any API .then() handlers queued while this
      // batch was in flight can run and paint. Without this the whole sweep
      // blocks them until it finishes. Zero delay: the point is yielding, not
      // waiting — this is NOT the old artificial 80ms throttle.
      await yieldToBrowser();
    }

    // Wait for whatever the five API sources have left to do. They have been
    // running since before the board sweep started, so by this point most or all
    // have already resolved and merged themselves via the .then() handlers above.
    // allSettled (not all) so a rejected promise can't abort the search — though
    // apiSource already catches, this is belt-and-braces.
    const pending = jobs.length;
    if(pending === 0 && !directOnlySelection){
      statusEl.innerHTML = `<span class="loading">Waiting on the job APIs…</span>`;
    }
    await Promise.allSettled(apiPromises);

    // Fetching is done. Progressive painting stays ARMED through the description
    // scan below: that scan is a single blocking request that can run for
    // several seconds, and killing the preview here would blank the results for
    // its whole duration. progressiveDone flips just before the real render.
    

    // (3) Company-direct resolution: some Adzuna results link to aggregator walls
    // (ZipRecruiter etc.) that gate the job behind a signup. When the Adzuna job's
    // company matches one of our curated ATS boards, swap the wall link for the
    // real board so the click lands on a page the user can actually use.
    try {
      const boardBySlug = new Map();
      for(const c of COMPANIES){
        // Normalize the board token the same way adzuna.js normalizes company names.
        const key = String(c.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if(key && !boardBySlug.has(key)) boardBySlug.set(key, c);
      }
      const boardUrl = (c) => c.ats === 'lever'
        ? `https://jobs.lever.co/${c.slug}`
        : `https://boards.greenhouse.io/${c.slug}`;

      let resolved = 0;
      for(const j of jobs){
        if(j.source !== 'adzuna' || !j.aggregator || !j.companySlug) continue;
        const match = boardBySlug.get(j.companySlug);
        if(match){
          j.url = boardUrl(match);
          j.aggregator = false;
          j.aggregatorName = '';
          j.resolvedDirect = true;   // for the "direct link found" badge
          resolved++;
        }
      }
      if(resolved) sourceStats.adzunaResolved = resolved;
    } catch(e){ /* resolution is best-effort; never break the merge */ }

    // Deduplicate after all sources are merged.
    const seenJobKeys = new Set();
    jobs = jobs.filter(j => {
      const key = [
        (j.url || '').split('?')[0].toLowerCase(),
        (j.title || '').toLowerCase().replace(/\s+/g, ' ').trim(),
        (j.company || '').toLowerCase().replace(/\s+/g, ' ').trim(),
        (j.location || '').toLowerCase().replace(/\s+/g, ' ').trim()
      ].join('|');
      if(seenJobKeys.has(key)) return false;
      seenJobKeys.add(key);
      return true;
    });

    // A selected IBM search must never show look-alike jobs from other employers
    // (for example roles that merely mention IBM technology). The returned company
    // name is the gate. This keeps the Company filter honest while preserving the
    // official IBM link below if live partner coverage is sparse or temporarily zero.
    if(ibmLiveSelection){
      jobs = jobs.filter(j => isIBMEmployerName(j && j.company));
    }

    const totalFetched = jobs.length;
    let afterLevel = 0, afterKeyword = 0, afterLocation = 0, afterSector = 0, afterWork = 0, afterClear = 0, afterUS = 0, afterDegree = 0;

    jobs = jobs.filter(j => {
      const t = (j.title || '');
      const locText = (j.location || '').toLowerCase();
      const blob = (t + ' ' + locText + ' ' + (j.company || '')).toLowerCase();

      // Experienced-role gate: default off, even if Level is set to "All levels".
      // This keeps senior/lead/director/manager/level II+ roles from being labeled
      // as entry/grad just because they match the keyword.
      //
      // Two tests, because a role can be out of reach either way. isSeniorTitle
      // catches "Senior Analyst". beyondEarlyCareer catches the harder case: a
      // neutral title like "Compliance Analyst" whose description requires 4+
      // years including 2 in a specialty. Both are hidden by default and both
      // are revealed by the same toggle — a student who wants to see the tier
      // above them still can, but it isn't the default view.
      // Sub-degree roles (LVN/CNA/tech) are dropped for EVERY source at ALL levels —
      // this tool serves degree-seekers, so these never belong, regardless of the
      // experienced toggle or the Level selection.
      if(isSubDegreeRole(j)) return false;

      if(!showExperienced && (isSeniorTitle(t) || beyondEarlyCareer(j))) return false;

      // Level gate — screen OUT seniority, don't require a level keyword IN the
      // title. The experienced gate above already removed senior titles and
      // (post-scan) description-confirmed 3-4+ yr roles. So for the early-career
      // buckets, a neutral title like "Communications Specialist" is a valid
      // entry-level target and MUST survive — the old code deleted it because
      // the title didn't literally contain "entry level"/"new grad", which
      // zeroed out most real searches (a bare "communications" search returned
      // 0 of 3,452). Description-based seniority still filters these once
      // scanned; unscanned neutral titles show with a "verify the posting"
      // badge (verificationStatus() handles that).
      //
      // 'intern' stays title-bound: an internship announces itself in the title,
      // and a student choosing "Internship" specifically doesn't want full-time
      // neutral roles mixed in.
      if(level === 'intern' && !INTERN_RX.test(t)) return false;
      // "Exclude internships" (default on): drop intern/co-op titles so a
      // graduated job seeker sees full-time roles only. Skipped when the user
      // has deliberately set Level = Internships, since that explicit choice
      // should win over the default.
      if(noIntern && level !== 'intern' && INTERN_RX.test(t)) return false;
      // newgrad / entrylevel / early: no positive-title requirement. Kept unless
      // the senior gate above already cut them.
      afterLevel++;

      if((kw || selectedRoles.length) && !keywordMatchesAny(blob, kw)) return false;
      afterKeyword++;

      if(loc && !locationMatches(j.location, loc)) return false;
      afterLocation++;

      if(sector !== 'any' && j.sector !== sector) return false;
      afterSector++;

      if(work === 'remote' && !REMOTE_RX.test(blob)) return false;
      if(work === 'hybrid' && !HYBRID_RX.test(blob)) return false;
      if(work === 'onsite' && (REMOTE_RX.test(blob) || HYBRID_RX.test(blob))) return false;
      afterWork++;

      if(hideClear && CLEAR_RX.test(blob)) return false;
      afterClear++;

      if(usOnly && !isUSJob(j)) return false;
      afterUS++;

      if(degreeOnly && NONDEGREE_RX.test(t) && !CLINICAL_RX.test(t)) return false;
      afterDegree++;

      // Always drop these — none is a job a new grad can take. Gig/crowdwork
      // listings are piece-rate tasks with no employer; licence-gated roles
      // (BCBA, RN, CPA) need a credential that takes years beyond the degree.
      // Both slip past every other filter because their titles read early-career
      // ("AI Quality Analyst", "Behavior Analyst").
      if(GIGWORK_RX.test(t)) return false;
      if(LICENSED_RX.test(t)) return false;

      // Aggregator postings with no employer name. Adzuna returns the literal
      // string "Employer" when the poster withheld its identity — which is the
      // signature of a repost farm or a gig network, and in any case leaves the
      // student nothing to research, no company to look up, and no one to
      // address a cover letter to. A search for "AI analyst" returned ten of
      // these, nine of them the same listing repeated per language.
      if(j.aggregator && ANON_COMPANY_RX.test(j.company || '')) return false;
      return true;
    });

    jobs = jobs.map(j => {
      let score = scoreJob(j, kw, loc);
      const degree = document.getElementById('profileDegree')?.value || 'any';
      const goal = document.getElementById('profileGoal')?.value || 'any';
      const auth = document.getElementById('profileAuth')?.value || 'any';
      const blob = ((j.title||'') + ' ' + (j.sector||'') + ' ' + (j.location||'')).toLowerCase();
      const pReasons = [];
      if(degree === 'analytics' && /data|analyst|analytics|insights|reporting|business intelligence/.test(blob)){ score += 2; pReasons.push('Fits your Analytics / Data background'); }
      if(degree === 'business' && /business|sales|client|finance|operations|analyst|coordinator/.test(blob)){ score += 1; pReasons.push('Fits your Business background'); }
      if(degree === 'cs' && /software|engineer|developer|it support|technical|data/.test(blob)){ score += 2; pReasons.push('Fits your CS / IT background'); }
      if(degree === 'marketing' && /marketing|content|communications|brand|social/.test(blob)){ score += 2; pReasons.push('Fits your Marketing background'); }
      if(degree === 'healthcare' && /health|clinical|medical|public health|hospital/.test(blob)){ score += 2; pReasons.push('Fits your Healthcare background'); }
      if(goal !== 'any' && blob.includes(goal)){ score += 2; pReasons.push('Matches your target career'); }
      if(auth === 'needs' && CLEAR_RX.test(blob)){ score -= 4; }
      if(auth === 'authorized' && NO_SPONSOR_RX.test(blob)){ score -= 1; }
      // Sponsorship-compatible ✓ only when a real description scan confirms it —
      // never off the title alone, matching the honesty rule the badges follow.
      if(auth === 'needs' && j.sponsorScan === 'available') pReasons.push('Sponsorship compatible');
      return Object.assign({}, j, {score, profileReasons: pReasons});
    });

    if(sortBy === 'title'){
      jobs.sort((a,b)=> a.title.localeCompare(b.title));
    } else if(sortBy === 'newest'){
      jobs.sort((a,b)=>{
        if(a.posted && b.posted) return b.posted - a.posted;
        if(a.posted) return -1;
        if(b.posted) return 1;
        return a.company.localeCompare(b.company);
      });
    } else if(sortBy === 'best'){
      jobs.sort((a,b)=> (b.score || 0) - (a.score || 0) || a.company.localeCompare(b.company));
    } else {
      jobs.sort((a,b)=> a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
    }

    // ---- Description check (server-side) --------------------------------------
    // For "suspicious" ambiguous titles, fetch the real description via our
    // checkjobs function and drop clear non-degree/hourly roles, flag borderline
    // experience ones. Only Greenhouse/Lever jobs with an id can be checked.
    try {
      // Reset per-search: this is read when the status line renders, and a
      // stale value from a previous search would report a truncation that
      // didn't happen on this one.
      window._scanSkipped = 0;
      // Titles worth verifying against their real description. Two families:
      //
      //  (a) HOURLY-IN-DISGUISE — professional-sounding titles that hide
      //      non-degree/shift work ("Operations Associate" at a warehouse).
      //  (b) EXPERIENCE-IN-DISGUISE — legitimately professional titles whose
      //      seniority a title regex simply cannot read. "Analyst" spans
      //      new-grad through 6-year Senior Analyst; only the description
      //      knows which. This family was previously absent, so a Greenhouse
      //      "Data Analyst" demanding 2-4 years was never scanned at all —
      //      the exact gap the Scrunch case exposed on Ashby.
      //
      // Widening this means more descriptions fetched per search and more jobs
      // hitting checkjobs' cap. That's why the response now reports `skipped`
      // and the UI says so, rather than silently truncating.
      const SUSPICIOUS_RX = /\b(operations|fulfillment|warehouse|logistics|hub|depot|fleet|store|retail|field|floor|shift|crew|team member|associate|coordinator|specialist|representative|assistant|agent|clerk|analyst|scientist|engineer|developer|consultant|manager|designer|researcher|strategist|architect|administrator|technician)\b/i;
      // Which jobs can have their description fetched (Greenhouse/Lever with a
      // server-resolvable id). GH jobs given a synthetic string id (a rare
      // fallback for malformed records) are excluded, since checkjobs needs the
      // real Greenhouse numeric id to fetch the description.
      //
      // Workday is included too: checkjobs reconstructs its CXS detail endpoint
      // from the apply url (no id needed), so any workday job with a real url
      // qualifies. This is what lets the experience tier badge appear on Workday
      // roles — subject to the same scan cap as the rest, so the top-ranked
      // matches get scanned and the overflow honestly shows "not verified".
      const fetchable = jobs.filter(j => j && j.id != null
        && (j.ats === 'gh' || j.ats === 'lever' || j.ats === 'workday')
        && !(j.ats === 'gh' && typeof j.id === 'string' && j.id.startsWith('gh-')));

      // When the user ticks "Work Authorization Requirements", do a THOROUGH scan:
      // fetch descriptions for ALL fetchable jobs (for real sponsorship detection),
      // not just the suspicious titles. Otherwise, only the suspicious ones.
      const checkable = hideClear ? fetchable : fetchable.filter(j => SUSPICIOUS_RX.test(j.title || ''));

      // Scan the BEST matches first, whatever the display sort is.
      //
      // checkjobs caps at 30 (60 with the sponsorship scan) and takes the first
      // N of whatever we send. `jobs` is already sorted for DISPLAY by this
      // point, so on the default "Most relevant" sort the top 30 happened to be
      // scanned — but a student who switches to "Company A-Z" or "Newest" would
      // silently spend the whole scan budget on alphabetically-early or
      // recently-posted roles while their strongest matches went unverified.
      //
      // Sorting a copy by score decouples scan priority from display order: the
      // cap always truncates the tail of the relevance ranking. The response is
      // keyed by job id, so the order we send in has no effect on how results
      // are displayed.
      const scanOrder = checkable.slice().sort((a,b) => (b.score || 0) - (a.score || 0));

      if(checkable.length){
        statusEl.innerHTML = hideClear
          ? `<span class="loading">Checking ${checkable.length} roles for work-authorization &amp; sponsorship…</span>`
          : `<span class="loading">Verifying ${checkable.length} role${checkable.length===1?'':'s'} against their descriptions…</span>`;
        // Paint what we have before the scan blocks. Everything is fetched and
        // filtered by now, so this preview is complete apart from the scan
        // verdicts — the ⏳ chips say exactly that. Then yield so the frame
        // actually composites before the request starts.
        paintProgressive();
        await yieldToBrowser();
        const payload = scanOrder.map(j => ({ id:j.id, url:j.url, ats:j.ats, company:j.company, board:j.board }));
        const resp = await fetch('/.netlify/functions/checkjobs', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ jobs: payload, checkSponsorship: hideClear })
        });
        if(resp.ok){
          const data = await resp.json();
          const verdicts = (data && data.verdicts) || {};
          const sponsorship = (data && data.sponsorship) || {};
          const experience = (data && data.experience) || {};
          // Drop the clear non-degree/hourly ones; flag the borderline ones.
          jobs = jobs.filter(j => verdicts[j.id] !== 'drop');
          jobs.forEach(j => { if(verdicts[j.id] === 'flag') j.expFlag = true; });

          // Attach parsed experience floors. This is what experienceTier() reads,
          // so Greenhouse/Lever results now tier exactly like Ashby's — the tier
          // function is source-agnostic and needed no changes. Jobs whose
          // description couldn't be trusted are simply absent from `experience`
          // and stay untiered rather than being given a number we'd be guessing.
          jobs.forEach(j => {
            const e = experience[j.id];
            if(e){
              j.minYears = e.minYears;
              j.yearsPreferred = e.preferred;
            }
          });

          // Hide the "Not an entry-level role" tier (6+ years, the top row of the
          // Equivalency Guide) once the description scan has actually confirmed
          // the requirement. The Guide is explicit that this tier is beyond what
          // internships/projects/coursework can substitute — "the answer is no" —
          // so, like the clearly non-degree/hourly 'drop' verdicts, these are
          // removed rather than shown with a caution badge. The 3–5 year
          // "Proceed with caution" tier is a genuine stretch and STAYS visible;
          // only the 6+ wall is dropped. Uses experienceTier()'s own softening
          // (a "preferred" ask counts one year less), so "7+ preferred" isn't
          // treated as harshly as "6+ required". Respects the user's
          // "show experienced roles" toggle: if they opted in, nothing is hidden.
          if(!showExperienced){
            const notEntryLevel = j => {
              const y = Number(j.minYears || 0);
              if(!y) return false;                                  // unscanned/none -> keep
              const effective = j.yearsPreferred ? Math.max(1, y - 1) : y;
              return effective >= 6;                                // matches the tier-out row (from: 6)
            };
            window._notEntryHidden = jobs.filter(notEntryLevel).length;
            jobs = jobs.filter(j => !notEntryLevel(j));
          }

          // How many qualified for verification but were cut by the server cap.
          // Surfaced below so an unverified role is distinguishable from a
          // verified one — otherwise the cap silently mislabels the overflow.
          window._scanSkipped = (data && data.skipped) || 0;

          if(hideClear){
            // Attach real (description-based) sponsorship status to each job.
            jobs.forEach(j => { j.sponsorScan = sponsorship[j.id] || 'unknown'; });
            // Always hide the explicit "no sponsorship" roles.
            jobs = jobs.filter(j => j.sponsorScan !== 'none');
            // Also hide roles that are LIKELY US-person / clearance gated —
            // defense and export-controlled work the student almost certainly
            // can't take on a visa. These scan as "not specified" (the posting
            // legally can't state the restriction), so without this they'd slip
            // through the filter a sponsorship-needing student explicitly set.
            // Exception: if the scan actually found sponsorship AVAILABLE, the
            // employer said yes outright — trust that over the heuristic.
            window._usPersonHidden = jobs.filter(j => likelyUSPersonGated(j) && j.sponsorScan !== 'available').length;
            jobs = jobs.filter(j => !(likelyUSPersonGated(j) && j.sponsorScan !== 'available'));
            // Remember the pools for the helpful note.
            window._spAvailable = jobs.filter(j => j.sponsorScan === 'available').length;
            window._spUnknown = jobs.filter(j => j.sponsorScan === 'unknown').length;
            // Then apply the user's dropdown choice.
            const mode = (document.getElementById('sponsorFilter') || {}).value || 'all';
            if(mode === 'available'){
              jobs = jobs.filter(j => j.sponsorScan === 'available');
            } else if(mode === 'unknown'){
              jobs = jobs.filter(j => j.sponsorScan === 'unknown');
            } // 'all' keeps both available + unknown
          }
        }
      }
    } catch(e){ /* fail-open: if the checker errors, show everything */ }

    const hiddenByFilters = Math.max(0, totalFetched - jobs.length);
    // Built from one array so adding a source can't leave these strings stale.
    // SmartRecruiters was fetched and merged for weeks while being absent from
    // every status line below, because each name was hardcoded in six places.
    const API_SOURCES = [
      { label: 'USAJobs',         key: 'usajobs' },
      { label: 'Adzuna',          key: 'adzuna' },
      { label: 'Ashby',           key: 'ashby' },
      { label: 'Greenhouse',      key: 'greenhouse' },
      { label: 'Lever',           key: 'lever' },
      { label: 'SmartRecruiters', key: 'smartrecruiters' },
      { label: 'The Muse',        key: 'themuse' },
      { label: 'CareerOneStop',   key: 'careeronestop' },
      { label: 'CareerBuilder',   key: 'mcloud' },
      { label: 'Hospital Systems', key: 'phenom' },
      { label: 'Hospital (Oracle)', key: 'oracle' },
      { label: 'Workday',         key: 'workday' },
    ];
    const sourceLine = `${okCos} employer board${okCos===1?'':'s'} + ${API_SOURCES.map(s=>s.label).join(' + ')} searched`;
    const evalLine = `${totalFetched.toLocaleString()} job${totalFetched===1?'':'s'} evaluated · ${jobs.length.toLocaleString()} matched filters · ${hiddenByFilters.toLocaleString()} filtered out`;
    const sourceBreakdown = 'Source results: employer boards ' + sourceStats.direct.toLocaleString()
      + ', ' + API_SOURCES.map(s => `${s.label} ${(sourceStats[s.key]||0).toLocaleString()}`).join(', ');

    // --- Filter funnel (diagnostic) --------------------------------------------
    // Visible only with ?diag=1 in the URL. The filter chain already counts
    // survivors at each stage but never showed them, which made a total wipeout
    // indistinguishable from an empty API response. Each number is how many jobs
    // remained AFTER that stage, so the first big drop names the culprit.
    let diagLine = '';
    if(new URLSearchParams(location.search).get('diag') === '1'){
      // Raw pull = sum of what every source returned before dedup; totalFetched
      // is the unique count after dedup. The gap is cross-source overlap. Use
      // the unique number as the defensible "postings surfaced" figure — run a
      // few broad early-career searches and average it. Rendered via innerHTML,
      // so the two lines are joined with <br>, not a newline.
      const rawPull = API_SOURCES.reduce((n, s) => n + (sourceStats[s.key] || 0), 0)
        + (sourceStats.direct || 0);
      const overlap = Math.max(0, rawPull - totalFetched);
      diagLine = 'Reach: ' + rawPull.toLocaleString() + ' raw across 8 sources → '
        + totalFetched.toLocaleString() + ' unique (' + overlap.toLocaleString() + ' overlap)<br>'
        + 'Filter funnel: fetched ' + totalFetched
        + ' → level ' + afterLevel
        + ' → keyword ' + afterKeyword
        + ' → location ' + afterLocation
        + ' → sector ' + afterSector
        + ' → work ' + afterWork
        + ' → clearance ' + afterClear
        + ' → US-only ' + afterUS
        + ' → degree ' + afterDegree
        + ' → final ' + jobs.length;
    }

    // --- Source-health logging (developer instrument, local only) ---
    // Records what each source returned per search so Jeff can confirm
    // fixes (e.g. Greenhouse id/ats) actually produce results in the wild
    // on his own device. Nothing leaves the browser. See coachJeffHealth().
    logSourceHealth({
      kw: kw || '', loc: loc || '',
      direct: sourceStats.direct, usajobs: sourceStats.usajobs,
      adzuna: sourceStats.adzuna, ashby: sourceStats.ashby,
      greenhouse: sourceStats.greenhouse,
      lever: sourceStats.lever,
      smartrecruiters: sourceStats.smartrecruiters,
      themuse: sourceStats.themuse,
      careeronestop: sourceStats.careeronestop,
      mcloud: sourceStats.mcloud,
      phenom: sourceStats.phenom,
      oracle: sourceStats.oracle,
      workday: sourceStats.workday,
      adzunaResolved: sourceStats.adzunaResolved || 0,
      boardsOk: okCos, boardsFail: failCos,
      totalFetched, matched: jobs.length
    });

    // If the description scan hit its cap, say so plainly — and say WHICH ones
    // went unverified. Now that the scan runs in score order, the skipped roles
    // are always the lowest-ranked matches, which is a fact worth telling: it
    // turns "16 roles not verified" (which 16?) into something the student can
    // act on without opening 16 postings.
    const skipNote = (window._scanSkipped > 0)
      ? `<br><span class="hint src-fail">${window._scanSkipped} lower-ranked role${window._scanSkipped===1?'':'s'} could not be verified against ${window._scanSkipped===1?'its':'their'} full description (scan limit reached). Your top matches were checked first — check the posting itself before ruling out anything further down.</span>`
      : '';

    // Greenhouse source-health notes. These make a failed or partial Greenhouse
    // sweep VISIBLE instead of silently absent — the bug was never that the
    // sweep sometimes fell short, it was that falling short looked identical to
    // "no matches" and no one could tell.
    const ghNote = window._ghFailed
      ? `<br><span class="hint src-fail">Greenhouse could not be reached for this search — its results are missing. Try again in a moment, or narrow the search.</span>`
      : (window._ghPartial
        ? `<br><span class="hint src-fail">Greenhouse results are partial — ${window._ghPartial.covered} of ${window._ghPartial.total} boards were searched before the time limit. Narrow the search (add a location, or a more specific title) to sweep all of them.</span>`
        : '');

    statusEl.innerHTML = `${sourceLine}${failCos ? ` · <span class="src-fail">${failCos} unreachable</span>` : ''}<br><span class="hint">${evalLine}</span><br><span class="hint">${sourceBreakdown}</span>${diagLine ? `<br><span class="hint" style="color:#b6701c">${diagLine}</span>` : ''}${skipNote}${ghNote}`;

    countEl.textContent = `${jobs.length} matching job${jobs.length===1?'':'s'} found`;

    // Helpful note for international students when "available only" yields few.
    if(hideClear){
      const mode = (document.getElementById('sponsorFilter') || {}).value || 'all';
      const avail = window._spAvailable || 0;
      const unk = window._spUnknown || 0;
      if(mode === 'available' && (avail <= 3) && unk > 0){
        const note = document.createElement('div');
        note.className = 'sponsor-note';
        note.innerHTML = `Only <strong>${avail}</strong> role${avail===1?'':'s'} explicitly confirm sponsorship. ` +
          `<strong>${unk}</strong> more didn't specify either way — switch “Show” to <strong>All</strong> or <strong>Unknown</strong> to see them.`;
        countEl.appendChild(note);
      }
      // Tell the student WHY defense roles vanished, so the drop isn't a mystery.
      // Phrased as "often" — some of these are open to permanent residents, and
      // the student is the one who knows their own status.
      const gatedHidden = window._usPersonHidden || 0;
      if(gatedHidden > 0){
        const dn = document.createElement('div');
        dn.className = 'sponsor-note';
        dn.innerHTML = `<strong>${gatedHidden}</strong> federal / defense / export-controlled role${gatedHidden===1?'':'s'} hidden — federal (USAJOBS) roles are usually limited to U.S. citizens, and defense/export-controlled roles to US persons (citizens or permanent residents) or those with a clearance. The posting often can’t say so outright. If you’re a citizen or permanent resident, uncheck “Need visa sponsorship” to see them.`;
        countEl.appendChild(dn);
      }
    }

    let html = '';
    const RENDER_CAP = 50;

    // Real render owns the DOM from here — stop any queued preview paint from
    // overwriting it. Set immediately before the render, not earlier, so the
    // preview stayed visible during the description scan above.
    progressiveDone = true;

    // Register this result set so Save buttons can persist full job data by ID.
    // All jobs are registered, not just the first page, so Save still works on
    // results revealed later via "Show more".
    registerJobsForSaving(jobs);

    // ---- Post-result filtering: stash the full ranked set + render context so
    // the filter bar can re-paint a subset instantly, with no re-search. The
    // bar is built from the states and roles actually present in `jobs`.
    RF.allJobs = jobs;
    RF.kw = kw;
    RF.loc = loc;
    RF.active = { loc: new Set(), role: new Set(), sector: new Set(), exp: new Set() };
    RF.selectedRoles = (typeof selectedRoles !== 'undefined' && Array.isArray(selectedRoles)) ? selectedRoles.slice() : [];
    buildResultFilters();

    // The card list paints the FILTERED view (RF.active). On first render
    // nothing is selected, so this is the full set; toggling a chip re-runs
    // repaintFiltered() which re-enters this same path with a narrowed view.
    const view = RF.filtered(jobs);

    if(view.length){
      // Render the first page only. A broad search across six sources can return
      // hundreds of results; painting them all in one innerHTML pass is slow on
      // phones. The count above still reports the full total.
      // Cards go in #rf-cards so the post-result filter can repaint just this
      // region without disturbing coach-picks / employer-link sections below.
      const firstPage = view.slice(0, RENDER_CAP);
      html += '<div id="rf-cards">' + firstPage.map(j => renderJob(j, kw, loc)).join('');
      if(view.length > RENDER_CAP){
        const remaining = view.length - RENDER_CAP;
        html += `<div class="more-wrap">
          <button id="showMore" class="secondary">Show ${remaining} more result${remaining===1?'':'s'}</button>
        </div>`;
      }
      html += '</div>';
    } else if(jobs.length && (RF.active.loc.size || RF.active.role.size)){
      // Jobs exist but the post-result filter hid them all — distinct from a
      // genuinely empty search. Offer to clear the filter rather than the
      // search-broadening tips (which don't apply — the search found plenty).
      html += `<div class="empty">
        <strong>No results match these filters.</strong>
        <br>Your search found ${jobs.length} job${jobs.length===1?'':'s'}, but none match every filter you've selected.
        <div class="empty-actions"><button class="loosen-btn" data-rf-clear="1">Clear result filters</button></div>
      </div>`;
    } else if(jobs.length){
      // Build targeted, CLICKABLE suggestions from the filters actually in effect.
      // Each carries data-loosen so one tap resets that control and re-runs search.
      // Ordered most-likely-culprit first for our audience (keyword, location lead).
      const tips = [];
      if(kw && kw.length > 0) tips.push({act:'kw-broaden', label:`Try a broader keyword`});
      if(loc) tips.push({act:'loc', label:`Clear location filter`});
      if(degreeOnly) tips.push({act:'degree', label:`Include all role types`});
      if(level !== 'all' && level !== 'early') tips.push({act:'level', label:`Widen level`});
      if(work !== 'any') tips.push({act:'work', label:`Reset work type`});
      if(sector !== 'any') tips.push({act:'sector', label:`Search all sectors`});
      if(company !== 'any') tips.push({act:'company', label:`Search all companies`});
      if(hideClear) tips.push({act:'clear', label:`Show all work-authorization results`});

      const tipList = tips.length
        ? `<div class="empty-actions">${tips.map(t=>`<button class="loosen-btn" data-loosen="${t.act}">${t.label}</button>`).join('')}${tips.length>1?`<button class="loosen-btn loosen-all" data-loosen="all">Broaden search</button>`:''}</div>`
        : `<p>Try a broader keyword, or check the employer links below.</p>`;

      const filterCount = [loc, degreeOnly, level!=='all'&&level!=='early', work!=='any', sector!=='any', company!=='any', hideClear].filter(Boolean).length;

      html += `<div class="empty">
        <strong>No live matches found yet.</strong>
        ${filterCount >= 2 ? `<br>Your current search is narrow. Try one of these options:` : `<br>Try one of these options:`}
        ${tipList}
        <p class="empty-foot">Some employers cannot be searched live from this page, so direct employer search links are shown below.</strong></p>
      </div>`;
    }

    // Coach Picks are useful for broad searches, but become distracting when the
    // user explicitly chose one employer (for example Dell).
    if(company === 'any') html += renderCoachPicks(kw);

    const clinicalSearch = kw && HEALTHCARE_KEYWORD_RX.test(kw);
    if((showSuggest || jobs.length === 0 || clinicalSearch || company !== 'any') && selectedDirect.length){
      const directHtml = selectedDirect
        .filter(c => sector === 'any' || c.sector === sector)
        .map(c => Object.assign({}, c, {manualScore: manualEmployerScore(c, kw, sector)}))
        .sort((a,b)=> (b.manualScore||0) - (a.manualScore||0) || (a.name||a.slug).localeCompare(b.name||b.slug))
        .map(c => `
          <a class="searchlink-card" href="${buildSearchUrl(c, kw)}" target="_blank" rel="noopener">
            <div class="searchlink-title">${esc(c.name || c.slug)} <span class="searchlink-arrow">→</span></div>
            <div class="searchlink-meta">${esc(c.note || 'Search-link target only — verify directly on employer site.')} · ${esc(c.sector || '')} · ${esc(c.atsType || 'direct')}</div>
          </a>`).join('');

      if(directHtml){
        const selectedName = selectedDirect.length === 1 ? (selectedDirect[0].name || selectedDirect[0].slug) : '';
        const isIBMDirect = company !== 'any' && selectedDirect.length === 1 && selectedDirect[0].slug === 'ibm';
        const directHeading = isIBMDirect
          ? `More IBM Opportunities`
          : company !== 'any' && selectedName
            ? `${esc(selectedName)} jobs — direct employer search`
            : `Priority employer search links${kw ? ` — each opens a search for “${esc(kw)}”` : ''}`;
        const directNote = isIBMDirect
          ? (jobs.length > 0
              ? `Job Finder found <strong>${jobs.length} verified IBM job${jobs.length === 1 ? '' : 's'}</strong> from its live job-data sources. IBM may have additional entry-level openings that aren't included in those sources. Use the button below to search IBM's official careers site for the complete current list.`
              : `No IBM jobs were found through Job Finder's live job-data sources today. IBM may still have current entry-level openings that aren't available through third-party job feeds. Use the button below to search IBM's official careers site for the complete list of current opportunities.`)
          : company !== 'any' && selectedName
            ? `${esc(selectedName)} is a direct-search employer in Job Finder, not a live API source. The button below opens the employer's current careers system${kw ? ` with “${esc(kw)}” entered as the keyword` : ''}.`
            : `${clinicalSearch ? '<strong>Most healthcare employers don\'t post on the boards this tool can search live</strong> — hospitals and health systems use Workday, iCIMS, or Taleo. So for clinical searches, these direct employer links are where the real volume is. ' : ''}These are not live job matches. They are targeted search links for high-value employers that use Workday, iCIMS, GovernmentJobs, USAJobs, Oracle HCM, or custom systems that static browser code cannot reliably query.`;
        html += `<section class="searchlinks">
          <div class="direct-heading">${directHeading}</div>
          <p class="searchlink-note">${directNote}</p>
          <div class="searchlink-grid">${directHtml}</div>
        </section>`;
      }
    }

    results.innerHTML = html;

    // "Show more" appends the remaining results in one pass. Save / Mark-applied
    // use delegated listeners on #results, so appended cards wire automatically.
    const moreBtn = document.getElementById('showMore');
    if(moreBtn){
      const rest = RF.filtered(jobs).slice(RENDER_CAP);
      moreBtn.addEventListener('click', ()=>{
        const wrap = moreBtn.closest('.more-wrap');
        if(!wrap) return;
        wrap.insertAdjacentHTML('beforebegin', rest.map(j => renderJob(j, kw, loc)).join(''));
        wrap.remove();
      });
    }

    // Wire up the clickable "loosen filter" buttons in the empty state
    results.querySelectorAll('.loosen-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        // Post-result filter clear: reset RF and repaint, no re-search.
        if(btn.hasAttribute('data-rf-clear')){
          RF.active.loc.clear(); RF.active.role.clear();
          repaintFiltered();
          return;
        }
        const act = btn.dataset.loosen;
        const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value=val; };
        const uncheck = id=>{ const el=document.getElementById(id); if(el) el.checked=false; };
        if(act==='all'){
          document.getElementById('kw').value = (document.getElementById('kw').value||'').split(' ')[0] || '';
          set('loc',''); set('lvl','early'); set('work','any'); set('sector','any'); set('company','any');
          uncheck('degreeonly'); uncheck('noclear');
        }
        else if(act==='kw-broaden'){ const cur=document.getElementById('kw').value.trim().split(' '); document.getElementById('kw').value = cur[cur.length-1]||''; }
        else if(act==='loc') set('loc','');
        else if(act==='degree') uncheck('degreeonly');
        else if(act==='level') set('lvl','early');
        else if(act==='work') set('work','any');
        else if(act==='sector') set('sector','any');
        else if(act==='company') set('company','any');
        else if(act==='clear') uncheck('noclear');
        search();
      });
    });

  } catch (err) {
    console.error(err);
    statusEl.innerHTML = `<span class="src-fail">Search error</span>`;
    countEl.textContent = '';
    results.innerHTML = `<div class="empty">Something went wrong while searching. The button has been reset. Technical detail: ${esc(err && err.message ? err.message : String(err))}</div>`;
  } finally {
    goBtn.disabled = false;
    // Release the announcement hold on every exit path — success, empty
    // result set, or error. In `finally` so a thrown error can't leave the
    // region permanently silent for screen-reader users.
    results.setAttribute('aria-busy', 'false');
  }
}

function esc(s){return (s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}


/* ============================================================
   SOURCE-HEALTH LOG  (developer instrument — local only)
   Every search appends one row to localStorage.coachJeffSourceHealth
   (capped at the last 100). Nothing is sent anywhere.

   From the browser console, Jeff can run:
     coachJeffHealth()        -> summary table + zero-return rates
     coachJeffHealth(20)      -> also show the last 20 raw searches
     coachJeffHealthClear()   -> wipe the log
   The point: after the Greenhouse id/ats fix, run a handful of
   searches, then coachJeffHealth() — if Greenhouse still shows a
   high "zero-return rate", the fix didn't take.
   ============================================================ */
const HEALTH_KEY = 'coachJeffSourceHealth';
const HEALTH_MAX = 100;

// Diagnostic mode, set once from ?diag=1 — the same switch the filter-funnel
// status line uses. Gates developer console output so a normal visitor's
// console stays clean.
window._jfDiag = (function(){
  try { return new URLSearchParams(location.search).get('diag') === '1'; }
  catch(e){ return false; }
})();

function readHealthLog(){
  try { return JSON.parse(localStorage.getItem(HEALTH_KEY) || '[]'); }
  catch(e){ return []; }
}
function logSourceHealth(rec){
  try {
    const log = readHealthLog();
    log.unshift(Object.assign({ t: new Date().toISOString() }, rec));
    if(log.length > HEALTH_MAX) log.length = HEALTH_MAX;
    localStorage.setItem(HEALTH_KEY, JSON.stringify(log));
    // (11) Per-search dev line. This used to fire on EVERY search for every
    // visitor, which is the console noise worth removing — it's diagnostic
    // output, not something a student should see. Now gated behind ?diag=1,
    // the same switch the filter-funnel line already uses. The log itself
    // still records every search, so coachJeffHealth() is unaffected.
    if(window._jfDiag && window.console && console.debug){
      console.debug(
        `[jobfinder] "${rec.kw||'(all)'}"${rec.loc?(' @ '+rec.loc):''} — ` +
        `boards ${rec.direct} (ok ${rec.boardsOk}/fail ${rec.boardsFail}), ` +
        `USAJobs ${rec.usajobs}, Adzuna ${rec.adzuna}, Ashby ${rec.ashby}, ` +
        `Greenhouse ${rec.greenhouse}, Lever ${rec.lever||0}, SmartRecruiters ${rec.smartrecruiters||0}, ` +
        `The Muse ${rec.themuse||0}, CareerOneStop ${rec.careeronestop||0}, CareerBuilder ${rec.mcloud||0}, ` +
        `Hospital systems ${rec.phenom||0}, Hospital-Oracle ${rec.oracle||0}, Workday ${rec.workday||0} → ${rec.matched} matched`
      );
    }
  } catch(e){ /* storage full or blocked — ignore, never break search */ }
}

// Console summary: per-source totals, average per search, and the
// key signal — how often each source returned ZERO results.
// Shared computation used by both the console report and the on-screen
// panel, so the two can never disagree.
function computeHealthSummary(){
  const log = readHealthLog();
  const n = log.length;
  const sources = [
    ['Employer boards','direct'],
    ['USAJobs','usajobs'],
    ['Adzuna','adzuna'],
    ['Ashby','ashby'],
    ['Greenhouse','greenhouse'],
    ['Lever','lever'],
    ['SmartRecruiters','smartrecruiters'],
    ['The Muse','themuse'],
    ['CareerOneStop','careeronestop'],
    ['CareerBuilder','mcloud'],
    ['Hospital systems','phenom'],
    ['Hospital (Oracle)','oracle'],
    ['Workday','workday']
  ];
  const rows = sources.map(([label,key])=>{
    const vals = log.map(r => Number(r[key])||0);
    const total = vals.reduce((a,b)=>a+b,0);
    const zeros = n ? vals.filter(v => v===0).length : 0;
    return {
      label, key, total,
      avg: n ? +(total/n).toFixed(1) : 0,
      zeros, zeroRate: n ? Math.round(100*zeros/n) : 0
    };
  });
  const boardOk   = log.map(r=>Number(r.boardsOk)||0).reduce((a,b)=>a+b,0);
  const boardFail = log.map(r=>Number(r.boardsFail)||0).reduce((a,b)=>a+b,0);
  return { n, rows, boardOk, boardFail, log };
}

function coachJeffHealth(showRecent){
  const { n, rows, boardOk, boardFail, log } = computeHealthSummary();
  if(!n){ console.log('No searches logged yet on this browser. Run a search first.'); return; }
  const summary = rows.map(r=>({
    Source: r.label, 'Total roles': r.total, 'Avg / search': r.avg,
    'Zero-return searches': `${r.zeros}/${n}`, 'Zero-return rate': `${r.zeroRate}%`
  }));
  console.log(`%cSource health — last ${n} search${n===1?'':'es'} on this browser`,
    'font-weight:bold;font-size:13px');
  (console.table ? console.table : console.log)(summary);
  console.log(`Employer-board reachability across all searches: ${boardOk} ok, ${boardFail} unreachable.`);
  console.log('Tip: a high Zero-return rate for one source means it is silently failing or matching nothing. Greenhouse is the one to watch after the id/ats fix.');

  if(showRecent){
    const k = Math.min(Number(showRecent)||10, log.length);
    const recent = log.slice(0,k).map(r=>({
      when: (r.t||'').replace('T',' ').slice(0,16),
      keyword: r.kw||'(all)', location: r.loc||'',
      boards: r.direct, USAJobs: r.usajobs, Adzuna: r.adzuna,
      Ashby: r.ashby, Greenhouse: r.greenhouse, Lever: r.lever||0,
      SmartRecruiters: r.smartrecruiters||0, 'The Muse': r.themuse||0,
      CareerOneStop: r.careeronestop||0, CareerBuilder: r.mcloud||0,
      'Hospital systems': r.phenom||0, 'Hospital (Oracle)': r.oracle||0, Workday: r.workday||0,
      matched: r.matched
    }));
    console.log(`%cLast ${k} searches`, 'font-weight:bold');
    (console.table ? console.table : console.log)(recent);
  }
  return `Logged searches: ${n}. Run coachJeffHealth(20) for recent rows, coachJeffHealthClear() to reset.`;
}
function coachJeffHealthClear(){
  localStorage.removeItem(HEALTH_KEY);
  const p = document.getElementById('healthPanelBody');
  if(p) renderHealthPanel();
  return 'Source-health log cleared.';
}

/* ---- On-screen health panel (works on mobile — no console needed) ----
   Trigger it two ways:
     • Desktop: Ctrl+Shift+H
     • Mobile:  tap the small "Listings come from…" footer line 5×
                quickly (within ~3s)
   It's invisible to students unless they know the gesture. */
function healthColorFor(rate){
  // Higher zero-return rate = worse. Green < 25%, amber < 60%, red otherwise.
  if(rate < 25) return {bg:'rgba(31,122,77,.12)', fg:'#1f7a4d'};
  if(rate < 60) return {bg:'rgba(217,138,43,.15)', fg:'#b6701c'};
  return {bg:'rgba(185,45,45,.12)', fg:'#a12b2b'};
}
function renderHealthPanel(){
  const body = document.getElementById('healthPanelBody');
  if(!body) return;
  const { n, rows, boardOk, boardFail } = computeHealthSummary();
  if(!n){
    body.innerHTML = `<p class="hp-empty">No searches logged yet on this browser. Run a search, then reopen this panel.</p>`;
    return;
  }
  const rowHtml = rows.map(r=>{
    const c = healthColorFor(r.zeroRate);
    return `<tr>
      <td class="hp-src">${esc(r.label)}</td>
      <td class="hp-num">${r.total}</td>
      <td class="hp-num">${r.avg}</td>
      <td class="hp-num"><span class="hp-rate" style="background:${c.bg};color:${c.fg}">${r.zeroRate}%</span></td>
    </tr>`;
  }).join('');
  body.innerHTML = `
    <p class="hp-sub">Last ${n} search${n===1?'':'es'} on this browser</p>
    <table class="hp-table">
      <thead><tr><th>Source</th><th>Roles</th><th>Avg</th><th>Empty&nbsp;%</th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
    <p class="hp-note">Employer boards: ${boardOk} reachable, ${boardFail} unreachable across all searches. A high <strong>Empty %</strong> for one source means it's returning nothing — watch Greenhouse after the id/ats fix.</p>
    <div class="hp-actions">
      <button class="jbtn" id="healthCopy">Copy as text</button>
      <button class="jbtn" id="healthReset">Clear log</button>
    </div>`;

  const copyBtn = document.getElementById('healthCopy');
  if(copyBtn) copyBtn.addEventListener('click', ()=>{
    const txt = rows.map(r=>`${r.label}: ${r.total} roles, avg ${r.avg}/search, empty ${r.zeroRate}%`).join('\n')
      + `\nBoards: ${boardOk} ok / ${boardFail} unreachable · ${n} searches`;
    if(navigator.clipboard) navigator.clipboard.writeText(txt).then(
      ()=>{ copyBtn.textContent='Copied ✓'; setTimeout(()=>copyBtn.textContent='Copy as text',1400); },
      ()=>{ copyBtn.textContent='Copy failed'; setTimeout(()=>copyBtn.textContent='Copy as text',1400); }
    );
  });
  const resetBtn = document.getElementById('healthReset');
  if(resetBtn) resetBtn.addEventListener('click', ()=>{
    if(confirm('Clear the source-health log on this browser?')){ coachJeffHealthClear(); }
  });
}
function openHealthPanel(){
  const p = document.getElementById('healthPanel');
  if(!p) return;
  renderHealthPanel();
  p.style.display = 'flex';
}
function closeHealthPanel(){
  const p = document.getElementById('healthPanel');
  if(p) p.style.display = 'none';
}

// Desktop shortcut: Ctrl+Shift+H
document.addEventListener('keydown', (e)=>{
  if((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')){
    e.preventDefault();
    const p = document.getElementById('healthPanel');
    if(p && p.style.display === 'flex') closeHealthPanel(); else openHealthPanel();
  }
  if(e.key === 'Escape') closeHealthPanel();
});

// Mobile gesture: 5 quick taps on the footer note line.
(function wireHealthTapGesture(){
  const note = document.querySelector('.note');
  if(!note) return;
  let taps = 0, timer = null;
  const bump = ()=>{
    taps++;
    clearTimeout(timer);
    timer = setTimeout(()=>{ taps = 0; }, 3000);
    if(taps >= 5){ taps = 0; clearTimeout(timer); openHealthPanel(); }
  };
  note.addEventListener('click', bump);
})();

// Expose on window so they're callable from the console reliably.
window.coachJeffHealth = coachJeffHealth;
window.coachJeffHealthClear = coachJeffHealthClear;
window.coachJeffHealthPanel = openHealthPanel;
