
// V18: Major-to-job-title search map. Ordered roughly by broad U.S. undergraduate popularity
// and usefulness for early-career job seekers. Each title becomes a one-click keyword search.
const MAJOR_TITLE_MAP = {
  "Accounting": {popular:["Staff Accountant", "Audit Associate", "Tax Associate", "Accounting Analyst", "Accounts Payable Specialist"]},
  "Advertising": {popular:["Account Coordinator", "Media Planner", "Marketing Coordinator", "Social Media Coordinator", "Brand Coordinator"]},
  "Biology": {popular:["Research Assistant", "Laboratory Technician", "Clinical Research Coordinator", "Quality Assurance Analyst", "Environmental Scientist"]},
  "Biomedical Engineering": {popular:["Biomedical Engineer", "Quality Engineer", "Clinical Research Coordinator", "Validation Engineer", "Product Development Engineer"]},
  "Business Administration": {popular:["Business Analyst", "Operations Analyst", "Project Coordinator", "Management Trainee", "Client Success Associate", "Account Coordinator", "Business Development Representative", "Program Coordinator"]},
  "Business Analytics": {popular:["Data Analyst", "Business Analyst", "Business Intelligence Analyst", "Operations Analyst", "Reporting Analyst", "Product Analyst"], emerging:["Analytics Engineer", "Data Engineer", "AI Analyst", "Machine Learning Analyst"]},
  "Chemical Engineering": {popular:["Process Engineer", "Chemical Engineer", "Quality Engineer", "Manufacturing Engineer", "Validation Engineer"]},
  "Chemistry": {popular:["Chemist", "Laboratory Technician", "Quality Control Analyst", "Research Associate", "Environmental Analyst"]},
  "Civil Engineering": {popular:["Civil Engineer", "Project Engineer", "Construction Coordinator", "Transportation Engineer", "Field Engineer"]},
  "Communications": {popular:["Communications Coordinator", "Public Relations Assistant", "Marketing Coordinator", "Social Media Coordinator", "Content Specialist"]},
  "Computer Engineering": {popular:["Software Engineer", "Embedded Software Engineer", "Hardware Engineer", "Systems Engineer", "Test Engineer", "Firmware Engineer"], emerging:["AI Engineer", "Machine Learning Engineer", "Robotics Engineer"]},
  "Computer Science": {popular:["Software Engineer", "Software Developer", "Full Stack Developer", "Backend Engineer", "Frontend Engineer", "QA Engineer", "Technical Support Engineer"], emerging:["Data Engineer", "AI Engineer", "Machine Learning Engineer"]},
  "Criminal Justice": {popular:["Investigator", "Compliance Analyst", "Probation Officer", "Case Manager", "Security Analyst"]},
  "Cybersecurity": {popular:["Security Analyst", "SOC Analyst", "Information Security Analyst", "Cybersecurity Analyst", "IT Risk Analyst", "GRC Analyst"], emerging:["Cloud Security Analyst", "Security Automation Engineer"]},
  "Data Analytics": {popular:["Data Analyst", "Reporting Analyst", "Business Intelligence Analyst", "Operations Analyst", "Research Analyst", "Product Analyst"], emerging:["Analytics Engineer", "Data Engineer", "Machine Learning Analyst", "AI Analyst"]},
  "Economics": {popular:["Research Analyst", "Data Analyst", "Financial Analyst", "Pricing Analyst", "Policy Analyst"]},
  "Electrical Engineering": {popular:["Electrical Engineer", "Controls Engineer", "Test Engineer", "Power Engineer", "Field Engineer"]},
  "Elementary Education": {popular:["Elementary Teacher", "Instructional Assistant", "Education Coordinator", "Tutor", "Youth Program Coordinator"]},
  "English": {popular:["Content Writer", "Editor", "Communications Coordinator", "Technical Writer", "Marketing Coordinator"]},
  "Entrepreneurship": {popular:["Business Development Representative", "Sales Development Representative", "Operations Coordinator", "Marketing Coordinator", "Account Coordinator"]},
  "Environmental Science": {popular:["Environmental Scientist", "Sustainability Analyst", "Environmental Coordinator", "EHS Specialist", "Research Technician"]},
  "Finance": {popular:["Financial Analyst", "Credit Analyst", "Investment Analyst", "Risk Analyst", "Client Service Associate"]},
  "Graphic Design": {popular:["Graphic Designer", "Visual Designer", "Production Designer", "Marketing Designer", "UX Designer"]},
  "Health Sciences": {popular:["Clinical Coordinator", "Patient Care Coordinator", "Public Health Analyst", "Health Program Coordinator", "Healthcare Analyst"]},
  "Healthcare Administration": {popular:["Healthcare Analyst", "Administrative Fellow", "Practice Coordinator", "Patient Services Coordinator", "Operations Analyst"]},
  "History": {popular:["Research Assistant", "Archivist Assistant", "Museum Coordinator", "Policy Assistant", "Communications Coordinator"]},
  "Hospitality Management": {popular:["Event Coordinator", "Revenue Analyst", "Hotel Operations Coordinator", "Guest Services Manager Trainee", "Sales Coordinator"]},
  "Human Resources": {popular:["HR Coordinator", "Talent Acquisition Coordinator", "Recruiting Coordinator", "HR Generalist", "People Operations Associate"]},
  "Industrial Engineering": {popular:["Industrial Engineer", "Process Improvement Analyst", "Operations Analyst", "Manufacturing Engineer", "Supply Chain Analyst"]},
  "Information Systems": {popular:["Business Systems Analyst", "IT Analyst", "Systems Analyst", "Application Support Analyst", "Data Analyst", "Business Intelligence Analyst"], emerging:["Data Engineer", "AI Business Analyst"]},
  "Information Technology": {popular:["IT Support Specialist", "Help Desk Analyst", "Systems Administrator", "Network Technician", "Application Support Analyst", "Cloud Support Associate"], emerging:["Cloud Engineer", "DevOps Engineer"]},
  "International Business": {popular:["Business Analyst", "Import Export Coordinator", "Supply Chain Analyst", "Account Coordinator", "Operations Analyst"]},
  "Journalism": {popular:["Reporter", "Editorial Assistant", "Content Writer", "Communications Coordinator", "Social Media Coordinator"]},
  "Kinesiology / Exercise Science": {popular:["Exercise Specialist", "Wellness Coordinator", "Rehabilitation Aide", "Fitness Specialist", "Health Coach"]},
  "Management": {popular:["Management Trainee", "Operations Coordinator", "Business Analyst", "Project Coordinator", "Client Success Associate"]},
  "Marketing": {popular:["Marketing Coordinator", "Digital Marketing Specialist", "Marketing Analyst", "Social Media Coordinator", "Content Marketing Specialist"]},
  "Mathematics": {popular:["Data Analyst", "Actuarial Analyst", "Quantitative Analyst", "Research Analyst", "Operations Research Analyst", "Business Intelligence Analyst"], emerging:["Data Engineer", "AI Engineer", "Machine Learning Engineer"]},
  "Mechanical Engineering": {popular:["Mechanical Engineer", "Manufacturing Engineer", "Quality Engineer", "Process Engineer", "Project Engineer"]},
  "Nursing": {popular:["Registered Nurse", "New Grad RN", "Nurse Residency", "Clinical Nurse", "Public Health Nurse"]},
  "Physics": {popular:["Research Assistant", "Data Analyst", "Test Engineer", "Laboratory Technician", "Systems Engineer"]},
  "Political Science": {popular:["Policy Analyst", "Legislative Assistant", "Program Coordinator", "Research Assistant", "Government Affairs Associate"]},
  "Psychology": {popular:["Case Manager", "Behavioral Health Technician", "HR Coordinator", "Research Assistant", "Client Services Coordinator"]},
  "Public Administration": {popular:["Program Analyst", "Policy Analyst", "Administrative Analyst", "Government Affairs Associate", "Program Coordinator"]},
  "Public Health": {popular:["Public Health Analyst", "Health Program Coordinator", "Epidemiology Assistant", "Community Health Coordinator", "Research Assistant"]},
  "Public Relations": {popular:["Public Relations Assistant", "Communications Coordinator", "Media Relations Coordinator", "Account Coordinator", "Social Media Coordinator"]},
  "Social Work": {popular:["Case Manager", "Social Services Coordinator", "Community Outreach Coordinator", "Family Support Specialist", "Program Coordinator"]},
  "Sociology": {popular:["Case Manager", "Program Coordinator", "Research Assistant", "Community Outreach Coordinator", "Social Services Coordinator"]},
  "Sports Management": {popular:["Athletic Operations Coordinator", "Event Coordinator", "Ticket Sales Representative", "Marketing Coordinator", "Partnerships Coordinator"]},
  "Statistics": {popular:["Data Analyst", "Statistical Analyst", "Research Analyst", "Business Intelligence Analyst", "Actuarial Analyst", "Quantitative Analyst"], emerging:["Data Engineer", "AI Engineer", "Machine Learning Engineer"]},
  "Supply Chain Management": {popular:["Supply Chain Analyst", "Logistics Coordinator", "Procurement Analyst", "Operations Analyst", "Inventory Analyst"]}
};

// V20.1 beta update:
// • Majors are alphabetized automatically.
// • Recommended titles are curated by likely entry-level search volume, not alphabetized.
// • AI/data specialties are separated so users can choose them without hiding broader options.
// Regression-test these keywords after deployment: AI Engineer, Machine Learning Engineer,
// ML Engineer, Data Engineer, Analytics Engineer, Applied Scientist, Research Engineer, LLM Engineer.

// Curated grad-friendly employers across sectors. {slug, ats, sector}. Edit freely.
// Some slugs will 404 over time as companies rename or switch ATS — the tool
// reports "boards live vs unreachable" so you can prune dead ones.
const COMPANIES = [
  // ---- tech / software ----
  {slug:"stripe", ats:"gh", sector:"tech"},
  {slug:"databricks", ats:"gh", sector:"tech"},
  {slug:"airbnb", ats:"gh", sector:"tech"},
  {slug:"coinbase", ats:"gh", sector:"fintech"},
  {slug:"dropbox", ats:"gh", sector:"tech"},
  {slug:"instacart", ats:"gh", sector:"tech"},
  {slug:"robinhood", ats:"gh", sector:"fintech"},
  {slug:"gitlab", ats:"gh", sector:"tech"},
  {slug:"cloudflare", ats:"gh", sector:"tech"},
  {slug:"asana", ats:"gh", sector:"tech"},
  {slug:"figma", ats:"gh", sector:"tech"},
  {slug:"twitch", ats:"gh", sector:"media"},
  {slug:"affirm", ats:"gh", sector:"fintech"},
  {slug:"samsara", ats:"gh", sector:"tech"},
  {slug:"reddit", ats:"gh", sector:"media"},
  {slug:"pinterest", ats:"gh", sector:"media"},
  {slug:"discord", ats:"gh", sector:"tech"},
  {slug:"datadog", ats:"gh", sector:"tech"},
  {slug:"twilio", ats:"gh", sector:"tech"},
  {slug:"elastic", ats:"gh", sector:"tech"},
  {slug:"mongodb", ats:"gh", sector:"tech"},
  {slug:"roblox", ats:"gh", sector:"tech"},
  {slug:"lyft", ats:"gh", sector:"tech"},
  {slug:"flexport", ats:"gh", sector:"tech"},
  {slug:"verkada", ats:"gh", sector:"tech"},
  {slug:"scaleai", ats:"gh", sector:"tech"},
  {slug:"anthropic", ats:"gh", sector:"tech"},
  {slug:"chime", ats:"gh", sector:"fintech"},
  {slug:"gusto", ats:"gh", sector:"fintech"},
  {slug:"airtable", ats:"gh", sector:"tech"},
  {slug:"webflow", ats:"gh", sector:"tech"},
  {slug:"vercel", ats:"gh", sector:"tech"},
  // ---- finance / fintech ----
  {slug:"sofi", ats:"gh", sector:"fintech"},
  {slug:"betterment", ats:"gh", sector:"fintech"},
  {slug:"marqeta", ats:"gh", sector:"fintech"},
  {slug:"blend", ats:"gh", sector:"fintech"},
  {slug:"point72", ats:"gh", sector:"finance"},
  // ---- consumer / retail / media ----
  {slug:"glossier", ats:"gh", sector:"consumer"},
  {slug:"peloton", ats:"gh", sector:"consumer"},
  {slug:"sweetgreen", ats:"gh", sector:"consumer"},
  {slug:"thefarmersdog", ats:"gh", sector:"consumer"},
  {slug:"buzzfeed", ats:"gh", sector:"media"},
  {slug:"spotify", ats:"lever", sector:"media"},
  // ---- healthcare / bio ----
  {slug:"oscar", ats:"gh", sector:"healthcare"},
  // ---- enterprise / industrial / defense / other ----
  {slug:"palantir", ats:"lever", sector:"defense"},
  {slug:"relativity", ats:"gh", sector:"defense"},
  {slug:"faire", ats:"gh", sector:"tech"},
  {slug:"toast", ats:"gh", sector:"fintech"},
  {slug:"gemini", ats:"gh", sector:"fintech"},
  // ---- Lever ----
  {slug:"netflix", ats:"lever", sector:"media"},
  {slug:"plaid", ats:"lever", sector:"fintech"},
  {slug:"brex", ats:"gh", sector:"fintech"},
  {slug:"mistral", ats:"lever", sector:"tech"},
  {slug:"attentive", ats:"gh", sector:"tech"},
  {slug:"alloy", ats:"lever", sector:"fintech"},
  {slug:"upgrade", ats:"gh", sector:"fintech"},
  {slug:"sigmacomputing", ats:"gh", sector:"tech"},
  {slug:"voleon", ats:"lever", sector:"finance"},
  {slug:"kraken", ats:"lever", sector:"fintech"},
  {slug:"fanaticsinc", ats:"gh", sector:"consumer"},
  {slug:"shieldai", ats:"lever", sector:"defense"},
  {slug:"matchgroup", ats:"lever", sector:"consumer"},
  {slug:"coherehealth", ats:"gh", sector:"tech"},
  {slug:"nuro", ats:"gh", sector:"industrial"},

  // ===== EXPANSION BATCH =====
  // ---- more tech / AI ----
  {slug:"amplitude", ats:"gh", sector:"tech"},
  {slug:"mixpanel", ats:"gh", sector:"tech"},
  {slug:"postman", ats:"gh", sector:"tech"},
  {slug:"grafanalabs", ats:"gh", sector:"tech"},
  {slug:"cockroachlabs", ats:"gh", sector:"tech"},
  {slug:"applovin", ats:"gh", sector:"tech"},
  {slug:"duolingo", ats:"gh", sector:"tech"},
  {slug:"squarespace", ats:"gh", sector:"tech"},
  {slug:"calendly", ats:"gh", sector:"tech"},
  // ---- finance / banking / consulting ----
  {slug:"jumptrading", ats:"gh", sector:"finance"},
  {slug:"imc", ats:"gh", sector:"finance"},
  {slug:"akunacapital", ats:"gh", sector:"finance"},
  {slug:"carta", ats:"gh", sector:"fintech"},
  {slug:"current", ats:"gh", sector:"fintech"},
  {slug:"mercury", ats:"gh", sector:"fintech"},
  // ---- healthcare / biotech / climate / energy ----
  {slug:"flatironhealth", ats:"gh", sector:"healthcare"},
  {slug:"komodohealth", ats:"gh", sector:"healthcare"},
  {slug:"includedhealth", ats:"lever", sector:"healthcare"},
  {slug:"ginkgobioworks", ats:"gh", sector:"healthcare"},
  {slug:"form", ats:"lever", sector:"climate"},
  {slug:"watershed", ats:"gh", sector:"climate"},
  {slug:"arcadia", ats:"lever", sector:"climate"},
  {slug:"sila", ats:"lever", sector:"climate"},
  {slug:"redwoodmaterials", ats:"gh", sector:"climate"},

  // ===== EXPANSION BATCH 2 =====
  // ---- e-commerce / retail / consumer brands ----
  {slug:"renttherunway", ats:"gh", sector:"retail"},
  {slug:"gopuff", ats:"lever", sector:"retail"},
  {slug:"misfitsmarket", ats:"gh", sector:"retail"},
  {slug:"ritual", ats:"gh", sector:"consumer"},
  {slug:"oura", ats:"gh", sector:"consumer"},
  {slug:"whoop", ats:"lever", sector:"consumer"},
  {slug:"ro", ats:"lever", sector:"consumer"},
  {slug:"liquiddeath", ats:"gh", sector:"consumer"},
  // ---- cybersecurity / devtools / infrastructure ----
  {slug:"wizinc", ats:"gh", sector:"security"},
  {slug:"abnormalsecurity", ats:"gh", sector:"security"},
  {slug:"tailscale", ats:"gh", sector:"security"},
  {slug:"okta", ats:"gh", sector:"security"},
  {slug:"temporal", ats:"gh", sector:"tech"},
  {slug:"planetscale", ats:"gh", sector:"tech"},
  {slug:"clickhouse", ats:"gh", sector:"tech"},
  // ---- robotics / aerospace / hardware ----
  {slug:"astranis", ats:"gh", sector:"industrial"},
  {slug:"figure", ats:"gh", sector:"industrial"},
  {slug:"spacex", ats:"gh", sector:"industrial"},
  {slug:"waymo", ats:"gh", sector:"industrial"},
  {slug:"wing", ats:"gh", sector:"industrial"},
  // ---- insurance / proptech / legal tech ----
  {slug:"hometap", ats:"gh", sector:"fintech"},
  {slug:"everlaw", ats:"gh", sector:"tech"},
  {slug:"latch", ats:"lever", sector:"fintech"},
];

const MANUAL_COMPANIES = [
  // Dell moved from its legacy jobs.dell.com / Workday setup to Oracle HCM in 2026.
  // Keep Dell as a direct-search employer until a server-side Oracle HCM feed is added.
  // Oracle Candidate Experience accepts the keyword query parameter on the current careers site.
  {name:"Dell", slug:"dell", sector:"tech", priority:95, atsType:"oracle/direct", url:"https://enterpriseplatform.dell.com/hcmUI/CandidateExperience/en/sites/careers/jobs?mode=location", searchUrl:"https://enterpriseplatform.dell.com/hcmUI/CandidateExperience/en/sites/careers/jobs?keyword={q}&mode=location", note:"Dell Technologies · current Oracle HCM careers search. Strong fit for sales, analytics, program, and early-career business/tech tracks."},
  // IBM official Entry-Level careers search. IBM currently serves job details from careers.ibm.com;
  // keep this as a direct employer search until a server-side IBM/Next.js feed is added.
  {name:"IBM", slug:"ibm", sector:"tech", priority:94, atsType:"ibm/direct", url:"https://www.ibm.com/careers/search?field_keyword_18%5B0%5D=Entry%20Level", searchUrl:"https://www.ibm.com/careers/search?field_keyword_18%5B0%5D=Entry%20Level", note:"Search IBM's official Entry-Level careers site for additional current opportunities."},
  {name:"Oracle", slug:"oracle", sector:"tech", priority:88, atsType:"oracle", url:"https://careers.oracle.com", searchUrl:"https://careers.oracle.com/jobs/#en/sites/jobsearch/requisitions?keyword={q}", note:"Large employer with recurring new-grad and early-career tech/business roles."},
  {name:"Salesforce", slug:"salesforce", sector:"tech", priority:86, atsType:"custom", url:"https://careers.salesforce.com", searchUrl:"https://careers.salesforce.com/en/jobs/?search={q}", note:"Watch Futureforce/new-grad, BDR, customer success, and analyst tracks."},
  {name:"Vanguard", slug:"vanguard", sector:"finance", priority:90, atsType:"workday/custom", url:"https://careers.vanguard.com", searchUrl:"https://www.google.com/search?q=site%3Acareers.vanguard.com+{q}", note:"Good for client service, finance, operations, and rotational early-career tracks."},
  {name:"Charles Schwab", slug:"schwab", sector:"finance", priority:85, atsType:"custom", url:"https://www.schwabjobs.com", searchUrl:"https://www.schwabjobs.com/search-jobs/{q}/33727/1", note:"Good for financial services, client support, operations, and licensing-supported tracks."},
  {name:"USAA", slug:"usaa", sector:"finance", priority:83, atsType:"workday/custom", url:"https://www.usaajobs.com", searchUrl:"https://www.usaajobs.com/search-jobs/{q}/1207/1", note:"Good for Phoenix/Texas client-service, analyst, insurance, and operations roles."},
  {name:"ADP", slug:"adp", sector:"business", priority:84, atsType:"custom", url:"https://jobs.adp.com", searchUrl:"https://jobs.adp.com/search-jobs/{q}/747/1", note:"Good for entry sales, client success, payroll, implementation, and business roles."},
  {name:"Gartner", slug:"gartner", sector:"business", priority:82, atsType:"custom", url:"https://jobs.gartner.com", searchUrl:"https://jobs.gartner.com/search-jobs/{q}/494/1", note:"Good for sales development, research, client service, and early-career business roles."},
  {name:"Texas State Jobs", slug:"texas-state", sector:"government", priority:87, atsType:"governmentjobs", url:"https://www.governmentjobs.com/careers/texas", searchUrl:"https://www.governmentjobs.com/careers/texas?keywords={q}", note:"Useful for public-sector program, analyst, IT, and administrative tracks."},
  {name:"UT Austin", slug:"ut-austin", sector:"education", priority:84, atsType:"workday", url:"https://utaustin.wd1.myworkdayjobs.com/UTstaff", searchUrl:"https://utaustin.wd1.myworkdayjobs.com/UTstaff?q={q}", note:"Useful for university research, data, IT, advising, program, and admin roles."},
  {name:"USAJobs", slug:"usajobs", sector:"government", priority:89, atsType:"usajobs", url:"https://www.usajobs.gov", searchUrl:"https://www.usajobs.gov/search/results/?k={q}&l=United%20States&p=1", note:"Federal roles; best with citizenship, clearance, and location filters reviewed carefully."},
  {name:"Tarrant County", slug:"tarrant-county", sector:"government", priority:80, atsType:"governmentjobs", url:"https://www.governmentjobs.com/careers/tarrant", searchUrl:"https://www.governmentjobs.com/careers/tarrant?keywords={q}", note:"Local public-sector roles for program, public health, data, IT, and administrative tracks."},
  {name:"Parkland Health", slug:"parkland", sector:"healthcare", priority:78, atsType:"custom", url:"https://www.parklandcareers.com", searchUrl:"https://www.google.com/search?q=site%3Aparklandcareers.com+{q}", note:"Good non-clinical healthcare target for program, analyst, admin, and public-health adjacent roles."},
  {name:"UT Southwestern", slug:"ut-southwestern", sector:"healthcare", priority:79, atsType:"workday/custom", url:"https://jobs.utsouthwestern.edu", searchUrl:"https://www.google.com/search?q=site%3Ajobs.utsouthwestern.edu+{q}", note:"Good for research, analytics, admin, healthcare operations, and IT roles in DFW."},

  // ===== TEXAS / DFW EMPLOYERS (mostly Workday/iCIMS — surfaced as direct search links) =====
  {name:"AT&T", slug:"att", sector:"tech", priority:86, atsType:"custom", url:"https://www.att.jobs", searchUrl:"https://www.att.jobs/search-jobs/{q}", note:"Dallas HQ. Strong for analyst, tech, sales, finance, and early-career business tracks."},
  {name:"American Airlines", slug:"american-airlines", sector:"industrial", priority:84, atsType:"workday", url:"https://jobs.aa.com", searchUrl:"https://www.google.com/search?q=site%3Ajobs.aa.com+{q}", note:"Fort Worth HQ. Analyst, operations, finance, IT, and corporate early-career roles."},
  {name:"Texas Instruments", slug:"ti", sector:"industrial", priority:85, atsType:"custom", url:"https://careers.ti.com", searchUrl:"https://careers.ti.com/search-jobs/{q}/", note:"Dallas HQ. Engineering, data, finance, and rotational new-grad programs."},
  {name:"Toyota North America", slug:"toyota-na", sector:"industrial", priority:82, atsType:"workday", url:"https://www.toyota.com/usa/careers", searchUrl:"https://www.google.com/search?q=site%3Atmna.wd1.myworkdayjobs.com+{q}", note:"Plano HQ. Finance, analytics, supply chain, and corporate early-career tracks."},
  {name:"PepsiCo / Frito-Lay", slug:"pepsico", sector:"consumer", priority:81, atsType:"custom", url:"https://www.pepsicojobs.com", searchUrl:"https://www.pepsicojobs.com/main/jobs?keywords={q}", note:"Plano/Frisco HQ. Analyst, supply chain, finance, marketing, and sales early-career roles."},
  {name:"Comerica Bank", slug:"comerica", sector:"finance", priority:76, atsType:"workday", url:"https://careers.comerica.com", searchUrl:"https://www.google.com/search?q=site%3Acareers.comerica.com+{q}", note:"Dallas HQ. Banking, analyst, operations, and client-service early-career roles."},
  {name:"Lockheed Martin (Fort Worth)", slug:"lockheed", sector:"defense", priority:74, atsType:"custom", url:"https://www.lockheedmartinjobs.com", searchUrl:"https://www.lockheedmartinjobs.com/search-jobs/{q}", note:"Fort Worth aeronautics. Engineering and analyst roles — most require US citizenship."},
  {name:"State of Texas (CAPPS)", slug:"texas-capps", sector:"government", priority:80, atsType:"custom", url:"https://capps.taleo.net/careersection/ex/jobsearch.ftl", searchUrl:"https://www.google.com/search?q=site%3Acapps.taleo.net+texas+{q}", note:"Statewide public-sector analyst, program, IT, and administrative roles."},
  {name:"City of Fort Worth", slug:"fort-worth", sector:"government", priority:78, atsType:"governmentjobs", url:"https://www.governmentjobs.com/careers/fortworth", searchUrl:"https://www.governmentjobs.com/careers/fortworth?keywords={q}", note:"Local public-sector program, analyst, public health, IT, and admin roles."},
  {name:"City of Dallas", slug:"dallas", sector:"government", priority:78, atsType:"governmentjobs", url:"https://www.governmentjobs.com/careers/dallas", searchUrl:"https://www.governmentjobs.com/careers/dallas?keywords={q}", note:"Local public-sector program, analyst, public health, IT, and admin roles."},
  {name:"UNT (Denton/DFW)", slug:"unt", sector:"education", priority:76, atsType:"custom", url:"https://jobs.untsystem.edu", searchUrl:"https://www.google.com/search?q=site%3Ajobs.untsystem.edu+{q}", note:"University research, data, IT, advising, program, and admin roles in DFW."},

  // ===== PROFESSIONAL HEALTHCARE (clinical + business) — Workday/iCIMS/Taleo, surfaced as search links =====
  // -- National health systems & providers --
  {name:"HCA Healthcare", slug:"hca", sector:"healthcare", priority:84, atsType:"custom", url:"https://careers.hcahealthcare.com", searchUrl:"https://careers.hcahealthcare.com/search-jobs/{q}", note:"Nation's largest hospital system. Nursing, allied health, lab, imaging, plus analyst/admin/finance roles."},
  {name:"Kaiser Permanente", slug:"kaiser", sector:"healthcare", priority:83, atsType:"custom", url:"https://www.kaiserpermanentejobs.org", searchUrl:"https://www.kaiserpermanentejobs.org/search-jobs/{q}", note:"Integrated provider + health plan. Clinical, pharmacy, and large non-clinical business/ops tracks."},
  {name:"Mayo Clinic", slug:"mayo", sector:"healthcare", priority:82, atsType:"custom", url:"https://jobs.mayoclinic.org", searchUrl:"https://jobs.mayoclinic.org/search-jobs/{q}", note:"Top academic medical center. Nursing, lab, research, allied health, and administrative fellowships."},
  {name:"Cleveland Clinic", slug:"cleveland-clinic", sector:"healthcare", priority:80, atsType:"workday", url:"https://jobs.clevelandclinic.org", searchUrl:"https://www.google.com/search?q=site%3Ajobs.clevelandclinic.org+{q}", note:"Clinical and non-clinical roles; strong new-grad nurse residency and admin fellowships."},
  {name:"CVS Health", slug:"cvs", sector:"healthcare", priority:81, atsType:"custom", url:"https://jobs.cvshealth.com", searchUrl:"https://jobs.cvshealth.com/us/en/search-results?keywords={q}", note:"Pharmacy, retail health, plus Aetna health-plan analyst, ops, and corporate roles."},
  {name:"UnitedHealth Group / Optum", slug:"unitedhealth", sector:"healthcare", priority:83, atsType:"custom", url:"https://careers.unitedhealthgroup.com", searchUrl:"https://careers.unitedhealthgroup.com/job-search-results/?keywords={q}", note:"Huge for healthcare data/analyst, claims, clinical ops, and new-grad business programs."},
  {name:"Elevance Health", slug:"elevance", sector:"healthcare", priority:78, atsType:"workday", url:"https://careers.elevancehealth.com", searchUrl:"https://www.google.com/search?q=site%3Acareers.elevancehealth.com+{q}", note:"Health-plan analyst, actuarial, clinical, and operations early-career tracks."},
  {name:"Cigna / Evernorth", slug:"cigna", sector:"healthcare", priority:78, atsType:"workday", url:"https://jobs.cigna.com", searchUrl:"https://www.google.com/search?q=site%3Ajobs.cigna.com+{q}", note:"Health-services analyst, finance, pharmacy, and clinical operations roles."},
  // -- Texas / DFW health systems --
  {name:"Baylor Scott & White", slug:"bswhealth", sector:"healthcare", priority:82, atsType:"workday", url:"https://jobs.bswhealth.com", searchUrl:"https://www.google.com/search?q=site%3Ajobs.bswhealth.com+{q}", note:"Largest not-for-profit system in Texas. Nursing, allied health, lab, plus analyst/admin tracks in DFW."},
  {name:"Texas Health Resources", slug:"thr-health", sector:"healthcare", priority:80, atsType:"cbcws", url:"https://jobs.texashealth.org", searchUrl:"https://www.google.com/search?q=site%3Ajobs.texashealth.org+{q}", note:"Arlington-based DFW system. Clinical, nurse residency, plus non-clinical analyst/IT/program roles."},
  {name:"Cook Children's (Fort Worth)", slug:"cooks", sector:"healthcare", priority:78, atsType:"workday", url:"https://jobs.cookchildrens.org", searchUrl:"https://www.google.com/search?q=site%3Ajobs.cookchildrens.org+{q}", note:"Fort Worth pediatric system. Nursing, therapy, child-life, lab, and administrative roles."},
  {name:"Children's Health (Dallas)", slug:"childrens-health", sector:"healthcare", priority:78, atsType:"workday", url:"https://jobs.childrens.com", searchUrl:"https://www.google.com/search?q=site%3Ajobs.childrens.com+{q}", note:"Dallas pediatric system. Clinical, allied health, plus data/analyst and program tracks."},
  {name:"Methodist Health System (Dallas)", slug:"methodist-dallas", sector:"healthcare", priority:76, atsType:"icims", url:"https://jobs.methodisthealthsystem.org", searchUrl:"https://www.google.com/search?q=site%3Ajobs.methodisthealthsystem.org+{q}", note:"DFW system. Nursing, allied health, lab/imaging, and business-office roles."},
  {name:"Medical City Healthcare (HCA DFW)", slug:"medical-city", sector:"healthcare", priority:75, atsType:"custom", url:"https://careers.medicalcityhealthcare.com", searchUrl:"https://www.google.com/search?q=site%3Acareers.medicalcityhealthcare.com+{q}", note:"HCA's DFW network. Nurse residency, allied health, and support roles across the metroplex."}
];

const SECTORS = ["tech","fintech","finance","business","consumer","retail","media","healthcare","security","defense","industrial","climate","government","education"];

// Level buckets — matched against job titles. V3 is intentionally more inclusive
// for real entry-level titles that often omit "new grad" wording.
const INTERN_RX = /\b(intern|internship|co[- ]?op|summer (analyst|associate|intern))\b/i;
const NEWGRAD_RX = /\b(new ?grad|new graduate|university (grad|graduate)|recent grad|campus|graduate (program|rotational|rotation)|rotational|early career|early[- ]in[- ]career|\bapm\b|associate product manager)\b/i;
const ENTRYLVL_RX = /\b(entry[- ]?level|junior|jr\.?|associate i\b|associate (analyst|engineer|consultant|developer|scientist|manager|accountant|designer|specialist|recruiter)|analyst( i)?\b|coordinator|assistant|level 1|l1|grad )\b/i;
const REALISTIC_GRAD_RX = /\b(analyst|business analyst|data analyst|research analyst|program (assistant|coordinator|specialist)|project coordinator|operations (associate|coordinator|analyst)|customer success associate|client service|implementation consultant|sales development|business development|account coordinator|marketing coordinator|hr coordinator|it support|support specialist|financial representative)\b/i;
const ANY_EARLY_RX = /\b(intern|internship|co[- ]?op|new ?grad|new graduate|university|recent grad|campus|graduate (program|rotational|rotation)|rotational|early career|entry[- ]?level|junior|jr\.?|associate i\b|associate (analyst|engineer|consultant|developer|scientist|product manager|accountant|designer|specialist|recruiter)|assistant|coordinator|apprentice|grad )\b/i;
// Senior signals that disqualify a role from early-career buckets.
const SENIOR_RX = /\b(senior|sr\.?|staff|principal|lead|director|supervisor|architect|head of|chief|vp|vice president|executive|mid[- ]?level|experienced|\bii\b|iii|iv|\bv\b|level [2-9]|l[2-9]|10\+|[3-9]\+ years|years of experience)\b/i;

// Advanced-practice / advanced-certification healthcare roles. These require a
// graduate degree PLUS specialty licensure/certification (and usually years of
// RN experience), so a new grad cannot hold them — they belong in "all levels,"
// not early-career buckets. Kept separate from SENIOR_RX for clarity. Matches
// credential tokens and advanced-practice phrases; deliberately does NOT match
// bare "RN", "registered nurse", or "nurse" (those can be genuine new-grad roles).
// RNFA = RN First Assistant; APRN/NP/CRNA/CNS/CNM = advanced practice nursing;
// PA/PA-C = physician assistant. "First assist" and "advanced practice" catch
// the spelled-out variants.
const ADVANCED_CRED_RX = /\b(nurse practitioner|advanced practice|advanced practice provider|\bapp\b|\baprn\b|\bnp\b|\bcrna\b|\bcnm\b|\bcns\b|\brnfa\b|first assist(ant)?|\bpa-?c\b|physician assistant|nurse anesthetist|nurse midwife|clinical nurse specialist|certified registered nurse)\b/i;

// SUB-DEGREE roles: this tool serves (soon-to-be) college graduates, so roles
// whose credential tops out BELOW a bachelor's — a vocational certificate or
// sub-degree license — are dropped entirely, from every source, at all levels.
// Two signals: (a) the title names such a role, or (b) the description states a
// sub-degree credential as the requirement without also asking for a degree.
// "associate" is intentionally absent (ambiguous: associate DEGREE vs associate
// job title); associate/ADN nursing is protected via DEGREE_REQ below.
const SUBDEGREE_TITLE_RX = /\b(lvn|licensed vocational nurse|lpn|licensed practical nurse|cna|certified nursing assistant|nurse aide|nursing assistant|patient care (tech|technician|assistant)|\bpct\b|medical assistant|certified medical assistant|\bcma\b|clinical medical assistant|phlebotom(y|ist)|pharmacy tech(nician)?|pharmacy clerk|\bemt\b|emergency medical technician|paramedic|medical lab(oratory)? tech(nician)?|\bmlt\b|radiologic technologist|x-?ray tech(nologist|nician)?|mri tech(nologist|nician)?|\bct tech(nologist|nician)?|surgical tech(nologist|nician)?|surg tech|scrub tech|sterile processing|central sterile|dialysis tech(nician)?|ekg tech(nician)?|cardiovascular tech(nologist|nician)?|occupational therapy assistant|\bcota\b|physical therapist assistant|physical therapy assistant|\bpta\b|dental assistant|ophthalmic tech(nician)?|optometric tech(nician)?|medical records (specialist|tech(nician)?)|health information tech(nician)?|medical coding specialist|medical coder|medical billing specialist|patient access (rep|representative)|patient registration (rep|representative)|patient services (rep|representative)|unit secretary|health unit coordinator|medical receptionist|medical scheduler|care coordinator|home health aide|\bhha\b|personal care aide|behavioral health tech(nician)?|psychiatric tech(nician)?|mental health tech(nician)?|rehab(ilitation)? tech(nician)?|hospital supply tech(nician)?|nurse extern|monitor tech|telemetry tech|caregiver|orderly|dietary aide|environmental services|housekeep)\b/i;

// Nurse roles that REQUIRE years of prior RN experience — a new grad can never
// hold them, so they're dropped entirely (every level), like sub-degree roles.
// Charge/lead/supervisor/coordinator nurse roles and house supervisors. NOT
// gated-to-all-levels (that tier is for roles just above a new grad); these are
// genuinely out of reach, so they're removed outright.
// The two trailing alternatives catch mid-title "charge" (e.g. "Registered Nurse -
// Charge - Behavioral Health"), where charge sits between words rather than directly
// before "nurse". Adjacency ([\s-]+) keeps billing-sense titles ("Charge Capture
// Specialist", "Charge Account Analyst") from matching — they have no nurse token.
const EXPERIENCED_NURSE_RX = /\b(charge (registered )?nurse|charge rn|nurse charge|lead (registered )?nurse|lead rn|nurse lead|house supervisor \(rn\)|nursing supervisor|nurse supervisor|nurse coordinator|nursing coordinator|nurse preceptor|nurse manager|travel (registered )?nurse|travel rn|travel nursing|traveling (registered )?nurse|traveling rn|forensic nurse|sexual assault nurse examiner|\bsane\b|nurse examiner)\b|\b(registered nurse|rn|nurse)\b[\s-]+charge\b|\bcharge\b[\s-]+\b(registered nurse|rn|nurse)\b/i;
const SUBDEGREE_REQ_RX = /\b(high school diploma|hs diploma|ged|vocational (certificate|program|school|diploma)|certificate program|certified (nurse|nursing|medical)|licensed vocational|licensed practical|completion of an? (accredited )?(certificate|vocational|diploma) program)\b/i;
const DEGREE_REQ_RX = /\b(bachelor'?s?|baccalaureate|\bbsn\b|\bbs\b|\bba\b|master'?s?|\bmsn\b|\bmba\b|\bmph\b|doctora|\bphd\b|\bmd\b|4-year degree|four-year degree|undergraduate degree|associate degree|associate'?s degree|\badn\b)\b/i;

// True when a role's credential is below a bachelor's. Title match is decisive;
// otherwise a description that names a sub-degree requirement AND omits any
// degree requirement. Reads title + description (desc only when a source scanned it).
function isSubDegreeRole(j){
  // TITLE-ONLY. The description heuristic was removed: "high school diploma or
  // equivalent" appears as the stated minimum on a huge share of ordinary
  // entry-level postings across every sector, so matching it dropped most real
  // early-career jobs, not just sub-degree healthcare roles. The curated title
  // list is specific and safe; that's the sole signal now.
  // Also drops experience-required nurse roles (charge/lead/supervisor/coordinator)
  // — genuinely out of reach for a new grad, so removed at every level.
  const title = (j && j.title) || '';
  return SUBDEGREE_TITLE_RX.test(title) || EXPERIENCED_NURSE_RX.test(title);
}

// "Manager" is senior EXCEPT for genuine new-grad manager titles (APM etc.).
// Checked separately so we don't nuke "Associate Product Manager".
const MANAGER_SENIOR_RX = /\b(manager|mgr)\b/i;
const MANAGER_EXEMPT_RX = /\b(associate (product |program |project )?manager|apm|assistant manager|manager (trainee|in training)|management (trainee|associate|development program))\b/i;

// Single source of truth for "is this title senior / not early-career?"
// This is now a gate, not just a score adjustment. By default, these roles
// are hidden unless the user checks "Show experienced jobs."
function isSeniorTitle(title){
  const t = title || '';
  // "Staff Nurse" is a standard floor/bedside RN title, NOT a seniority signal —
  // the word "staff" here means the opposite of senior. Exempt it before the
  // SENIOR_RX check so these entry-level RN roles aren't wrongly gated. (RN II/III
  // are still caught by the ii/iii markers below, which is intended.)
  const staffNurseExempt = /\bstaff (nurse|rn)\b/i.test(t) && !/\b(ii|iii|iv|senior|sr\.?|lead|charge|manager|director|supervisor)\b/i.test(t);
  if(!staffNurseExempt && SENIOR_RX.test(t)) return true;
  if(MANAGER_SENIOR_RX.test(t) && !MANAGER_EXEMPT_RX.test(t)) return true;
  // Advanced-practice / advanced-cert healthcare roles are beyond new-grad reach
  // (grad degree + specialty licensure), so gate them like senior roles: hidden
  // under early-career filters, shown only when the user picks "all levels."
  if(ADVANCED_CRED_RX.test(t)) return true;
  return false;
}

function experiencedPenalty(title){
  const t = title || '';
  if(/\b(director|vp|vice president|head of|chief|executive)\b/i.test(t)) return 100;
  if(/\b(senior|sr\.?|staff|principal|lead|manager|architect|supervisor)\b/i.test(t) && !MANAGER_EXEMPT_RX.test(t)) return 70;
  if(/\b(ii|iii|iv|v|level [2-9]|l[2-9])\b/i.test(t)) return 45;
  return isSeniorTitle(t) ? 60 : 0;
}

function hasEntrySignal(title){
  const t = title || '';
  return INTERN_RX.test(t) || NEWGRAD_RX.test(t) || ENTRYLVL_RX.test(t) || REALISTIC_GRAD_RX.test(t) || ANY_EARLY_RX.test(t);
}

/* ============================================================
   CURATED H-1B SPONSOR HISTORY  (student-facing hint)
   Shown ONLY on 🟡 "sponsorship not specified" jobs, to help an
   international student tell "big sponsor that just didn't mention
   it on this posting" from "employer with no known sponsorship record."

   Tiers:
     'strong'   = high, consistent recent H-1B filing volume
     'moderate' = files regularly but at lower volume
   Employers not listed here get NO flag (safe: no false reassurance).

   SOURCE: USCIS H-1B Employer Data Hub + DOL LCA disclosure data,
   cross-checked against multiple 2025-2026 sponsor summaries.
   ------------------------------------------------------------
   >>> LAST REVIEWED: 2026-07-09  (review ~twice a year) <<<
   Next review target: ~Nov 2026 (after DOL annual data) and ~Apr 2027.
   To update: change a tier, add/remove a name (lowercase key), and
   bump the LAST REVIEWED date above.

   NOTE ON 2026 RULES: The H-1B lottery became wage-weighted for the
   FY2027 cap season (registration opened Mar 2026); selection odds now
   depend on the offered wage level, so "strong sponsor" no longer implies
   good lottery odds. The on-card note reflects this and links students to
   verify current status themselves.
   ============================================================ */
const SPONSOR_HISTORY_REVIEWED = '2026-07-09';
const SPONSOR_HISTORY = {
  // strong — large, consistent recent sponsors
  'spacex':'strong', 'space exploration technologies':'strong',
  'stripe':'strong', 'databricks':'strong', 'airbnb':'strong',
  'palantir':'strong', 'snowflake':'strong', 'coinbase':'strong',
  'pinterest':'strong', 'lyft':'strong', 'datadog':'strong',
  'mongodb':'strong', 'twilio':'strong', 'reddit':'strong',
  'spotify':'strong', 'roblox':'strong', 'affirm':'strong',
  'instacart':'strong', 'robinhood':'strong', 'cloudflare':'strong',
  'gitlab':'strong', 'dropbox':'strong', 'discord':'strong',
  // moderate — files regularly, lower volume
  'figma':'moderate', 'asana':'moderate', 'samsara':'moderate',
  'duolingo':'moderate', 'chime':'moderate', 'gusto':'moderate',
  'airtable':'moderate', 'webflow':'moderate', 'vercel':'moderate',
  'sofi':'moderate', 'betterment':'moderate', 'marqeta':'moderate',
  'flexport':'moderate', 'verkada':'moderate', 'faire':'moderate',
  'peloton':'moderate', 'twitch':'moderate', 'relativity':'moderate',
  'oscar':'moderate', 'point72':'moderate'
};

// Normalize an employer name and return its tier, or null if not listed.
function sponsorHistoryTier(company){
  if(!company) return null;
  let c = company.toLowerCase().trim();
  // strip common suffixes / punctuation so "Stripe, Inc." matches "stripe"
  c = c.replace(/[.,]/g,' ')
       .replace(/\b(inc|llc|corp|corporation|co|ltd|the|group|technologies|technology|labs)\b/g,' ')
       .replace(/\s+/g,' ')
       .trim();
  if(SPONSOR_HISTORY[c]) return SPONSOR_HISTORY[c];
  // also try the raw lowercased name and a first-token match for safety
  const raw = company.toLowerCase().trim();
  if(SPONSOR_HISTORY[raw]) return SPONSOR_HISTORY[raw];
  const first = c.split(' ')[0];
  if(first && SPONSOR_HISTORY[first]) return SPONSOR_HISTORY[first];
  return null;
}


// Roles whose titles strongly signal non-degree / hourly / trade work.
const NONDEGREE_RX = /\b(warehouse|fulfillment|picker|packer|forklift|driver|delivery|courier|dispatch(er)?|barista|cook|chef|line cook|kitchen|server|waiter|waitress|bartender|busser|dishwasher|cashier|retail associate|sales associate|store associate|stocker|merchandiser|janitor|custodian|housekeep(er|ing)|cleaner|maintenance tech|hvac|plumber|electrician|welder|machinist|mechanic|technician|installer|laborer|landscaper|security guard|caregiver|home health aide|cna|receptionist|front desk|valet|usher|groundskeeper|assembler|line worker|production (associate|worker|operator)|loader|crew member|team member)\b/i;

// Clinical / licensed / degreed healthcare titles that should NOT be treated as
// non-degree even if they contain a word like "technician" or "assistant".
// These require a degree, license, or accredited certification program.
// Placeholder "company" values that mean the poster is anonymous. Adzuna uses
// the literal "Employer"; others use variants. A job with no identifiable
// employer can't be researched, networked into, or addressed in a cover
// letter — the three things this tool's coaching depends on.
const ANON_COMPANY_RX = /^(employer|confidential|undisclosed|company confidential|private|n\/?a|unknown|recruiter|staffing|various)\.?$/i;

// Crowdwork / gig platforms dressed up as analyst roles. These are piece-rate
// data-labeling and model-evaluation tasks (Mercor, Outlier, Scale's networks),
// not jobs: no employer, no salary floor, no career track. They flood any "AI"
// search because the titles are engineered to match one — a search for
// "AI analyst" returned nine of these under one listing, one per language.
const GIGWORK_RX = /\b(train ai models?|ai training|expert network|join our (expert|talent) network|freelance|gig|piece[- ]rate|per[- ]task|contributor|crowdsourc|data (labeling|annotation)|rate (ai|model) (responses|outputs)|evaluate (ai|model) (responses|outputs))\b/i;

// Roles gated behind a licence or board certification a new grad cannot hold.
// Distinct from CLINICAL_RX: a BCBA (Board Certified Behavior Analyst) has
// "Analyst" in the title, so every early-career title regex fires on it while
// the actual requirement is a master's degree plus board certification and
// supervised fieldwork hours.
const LICENSED_RX = /\b(board certified|board[- ]eligible|licensed|registered|certified) (behavior|behaviour|dietitian|counselor|counsellor|therapist|social worker|pharmacist|physician|surgeon|anesthe)|(\bbcba\b|\bbcaba\b|\bcpa\b|\bpe\b license|\bp\.e\.\b|\blcsw\b|\blmft\b|\blpc\b|\bcfa\b charter)/i;

const CLINICAL_RX = /\b(nurse|nursing|rn\b|lpn|lvn|np\b|nurse practitioner|physician|doctor|md\b|surgeon|surgical|sterile processing|pharmacist|pharmacy|therap(ist|y)|physical therap|occupational therap|respiratory|radiolog|imaging|sonograph|laboratory|lab (tech|scientist)|clinical|patient care|medical (assistant|technologist|laboratory)|technologist|dietitian|nutritionist|counselor|social work|psycholog|paramedic|emt\b|sterile|anesthe|cardiac|dental hygien|optometr|audiolog|speech|genetic counsel|perfusion|histolog|cytolog|phlebotom)\b/i;

// Broader pattern used ONLY to decide whether a SEARCH keyword is healthcare-ish,
// so we auto-show employer links. Kept separate from CLINICAL_RX so it doesn't
// affect the degree-track exemption logic.
const HEALTHCARE_KEYWORD_RX = /(nurse|nursing|\brn\b|\blpn\b|\blvn\b|physician|doctor|surgeon|pharmac|therap|respiratory|radiolog|sonograph|clinical|patient care|medical|healthcare|health care|dietit|nutrition|paramedic|\bemt\b|dental|optometr|audiolog|phlebotom|hospital|midwife|hospice|public health|epidemiolog)/i;
const CLEAR_RX = /\b(clearance|cleared|ts\/sci|top secret|secret clearance|polygraph|\bpoly\b|us ?person|u\.s\. ?person|us ?citizen|u\.s\. ?citizen|citizenship required|must be a (us|u\.s\.) citizen|no (visa )?sponsorship|without sponsorship|not (able to )?sponsor|sponsorship is not)\b/i;
const NO_SPONSOR_RX = /\b(no (visa )?sponsorship|without sponsorship|not (able to )?sponsor|sponsorship is not|must be authorized to work.*without)\b/i;
const REMOTE_RX = /\bremote\b/i;
const HYBRID_RX = /\bhybrid\b/i;

// US-location detection (best-effort, location text is free-form).
const US_STATES = "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming";
const US_ABBR = "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const US_RX = new RegExp("\\b(united states|usa|u\\.s\\.a|u\\.s\\.|us|"+US_STATES+")\\b|,\\s*("+US_ABBR+")\\b", "i");
// Common non-US signals to actively exclude.
const NONUS_RX = /\b(canada|canadian|ontario|toronto|vancouver|montreal|quebec|united kingdom|u\.k\.|uk|england|london|ireland|dublin|germany|berlin|munich|france|paris|spain|madrid|netherlands|amsterdam|india|bangalore|bengaluru|hyderabad|mumbai|gurgaon|pune|japan|tokyo|singapore|australia|sydney|melbourne|brazil|mexico|china|hong kong|poland|warsaw|portugal|lisbon|sweden|stockholm|emea|apac|latam|philippines|manila|israel|tel aviv|united arab emirates|dubai|nigeria|kenya|south africa|colombia|argentina|new zealand|switzerland|zurich|italy|romania|bucharest|ukraine|estonia|lithuania)\b/i;

function isUSLocation(loc){
  const t = (loc||'').trim();
  if(!t || t==='—') return true;            // unknown → don't exclude
  if(NONUS_RX.test(t)) return false;         // names a foreign place → drop
  if(US_RX.test(t)) return true;             // names a US place → keep
  if(/\bremote\b/i.test(t)) return true;     // bare "Remote" with no country → keep
  // Adzuna returns "City, County Name" with no state or country — e.g.
  // "Commerce, Los Angeles County", "Alameda, Bernalillo County". These were
  // being dropped as foreign, discarding every Adzuna result. County/Parish/
  // Borough are US administrative terms; NONUS_RX has already excluded known
  // foreign places above, so anything reaching here with one is US.
  if(/\b(county|parish|borough)\b/i.test(t)) return true;
  return false;                              // names some other place, not US → drop
}

// Some aggregator postings carry a US location field while the TITLE says
// otherwise — Adzuna returned "INTL INDIA (Mumbai) - AI Analyst - UX/UI" tagged
// as a US job. When a title explicitly names a country or an INTL marker, trust
// the title: an employer who put it there meant it, whereas the location field
// is often just where the aggregator's crawler indexed the posting.
const TITLE_NONUS_RX = /\b(intl|international)\b.*\b(india|china|japan|brazil|mexico|canada|uk|emea|apac|latam)\b|\b(mumbai|bangalore|bengaluru|hyderabad|pune|delhi|chennai|manila|jakarta|sydney|melbourne|toronto|vancouver|london|berlin|paris|madrid|warsaw|krakow|lisbon|porto|dublin|amsterdam|bogot[aá]|s[aã]o paulo|buenos aires|santiago|guadalajara|monterrey|tel aviv|singapore|kuala lumpur|bangkok|seoul|tokyo|shanghai|beijing|shenzhen)\b/i;

// Non-English posting conventions. These are stronger evidence of a foreign
// market than a city name, because no US employer writes them:
//   "Alternance"   French work-study contract (no US equivalent)
//   "(F/H)" "(H/F)" French Femme/Homme — the EU gender-neutrality convention
//   "(m/w/d)" "(m/f/d)" German männlich/weiblich/divers
//   "(all genders)" German-market English postings
//   "Werkstudent" "Praktikum" "Ausbildung"  German student/trainee contracts
//   "Stage" / "Stagiaire"  French internship
//   "Alternant"    French apprentice
// Adzuna listed a VISEO "Alternance – AI Business Analyst (F/H)" as a US job;
// the location metadata said US, the title said France, and the title was right.
const TITLE_FOREIGN_CONVENTION_RX = /\b(alternance|alternant(e)?|stagiaire|werkstudent|praktikum|ausbildung|apprenti(e)?)\b|\((f\/h|h\/f|m\/w\/d|m\/f\/d|w\/m\/d|all genders|m\/f\/x|f\/m\/d)\)|\b(m\/w\/d|m\/f\/d)\b/i;

function isUSJob(j){
  const title = j.title || '';
  if(TITLE_NONUS_RX.test(title)) return false;
  if(TITLE_FOREIGN_CONVENTION_RX.test(title)) return false;
  // Workday's list endpoint returns a FACILITY name as the location ("Saint
  // Joseph Hospital", "TOSH", "West Jordan Clinic"), not a city/state — so
  // isUSLocation can't see a US marker and wrongly drops it under "US only",
  // zeroing out facility-name employers like Intermountain. WORKDAY_EMPLOYERS
  // is a hand-curated all-US roster, so a Workday job is US unless something
  // actively signals foreign: the two title checks above already ran, and
  // NONUS_RX still catches a location that names a foreign place. Same spirit
  // as the Adzuna "City, County" and bare-"Remote" carve-outs in isUSLocation.
  if(j.ats === 'workday' || j.source === 'workday'){
    return !NONUS_RX.test(j.location || '');
  }
  return isUSLocation(j.location);
}

// Workday employer registry — defined here (above the dropdown builder)
// because initDropdowns() below references WORKDAY_EMPLOYERS immediately.
const WORKDAY_EMPLOYERS = [
  // All coordinates verified live via /.netlify/functions/workday (each returns
  // structured analyst data). Broad mix across sectors for new-grad relevance.
  // Location is NOT sent to Workday; the page's own location filter narrows the
  // merged results, so an employer's HQ doesn't limit who sees its jobs.
  { name:'UT Austin',        slug:'wd-utaustin',     tenant:'utaustin',     wd:'1',  site:'UTstaff',                 sector:'education'   },
  { name:'Cigna',            slug:'wd-cigna',        tenant:'cigna',        wd:'5',  site:'cignacareers',            sector:'healthcare'  },
  { name:'CVS Health',       slug:'wd-cvshealth',    tenant:'cvshealth',    wd:'1',  site:'CVS_Health_Careers',      sector:'healthcare'  },
  { name:'Toyota',           slug:'wd-toyota',       tenant:'toyota',       wd:'503',site:'TMNA',                    sector:'industrial'  },
  { name:'Salesforce',       slug:'wd-salesforce',   tenant:'salesforce',   wd:'12', site:'External_Career_Site',    sector:'tech'        },
  { name:'NVIDIA',           slug:'wd-nvidia',       tenant:'nvidia',       wd:'5',  site:'NVIDIAExternalCareerSite',sector:'tech'        },
  { name:'Target',           slug:'wd-target',       tenant:'target',       wd:'5',  site:'targetcareers',           sector:'retail'      },
  { name:'Adobe',            slug:'wd-adobe',        tenant:'adobe',        wd:'5',  site:'external_experienced',    sector:'tech'        },
  { name:'Mastercard',       slug:'wd-mastercard',   tenant:'mastercard',   wd:'1',  site:'CorporateCareers',        sector:'finance'     },
  { name:'Thermo Fisher',    slug:'wd-thermofisher', tenant:'thermofisher', wd:'5',  site:'ThermoFisherCareers',     sector:'healthcare'  },
  { name:'Capital One',      slug:'wd-capitalone',   tenant:'capitalone',   wd:'12', site:'Capital_One',             sector:'finance'     },
  { name:'Prudential',       slug:'wd-pru',          tenant:'pru',          wd:'5',  site:'Careers',                 sector:'insurance'   },
  { name:'Unilever',         slug:'wd-unilever',     tenant:'unilever',     wd:'3',  site:'Unilever_Experienced_Professionals', sector:'consumer' },
  { name:'Booz Allen',       slug:'wd-bah',          tenant:'bah',          wd:'1',  site:'BAH_Jobs',                sector:'consulting'  },
  { name:'PwC',              slug:'wd-pwc',          tenant:'pwc',          wd:'3',  site:'Global_Experienced_Careers', sector:'consulting' },
  { name:'Northrop Grumman', slug:'wd-ngc',          tenant:'ngc',          wd:'1',  site:'Northrop_Grumman_External_Site', sector:'defense'   },
  { name:'Accenture',        slug:'wd-accenture',    tenant:'accenture',    wd:'103',site:'AccentureCareers',        sector:'consulting'  },
  { name:'Cardinal Health',  slug:'wd-cardinalhealth',tenant:'cardinalhealth',wd:'1', site:'EXT',                    sector:'healthcare'  },
  { name:'Cognizant',        slug:'wd-cognizant',    tenant:'collaborative',wd:'1',  site:'AllOpenings',             sector:'consulting'  },
  { name:'Intermountain Health', slug:'wd-intermountain', tenant:'imh',      wd:'108',site:'IntermountainCareers',    sector:'healthcare'  },
  { name:'Saint Francis Health System', slug:'wd-saintfrancis', tenant:'saintfrancis', wd:'115',site:'External',        sector:'healthcare'  },
  // Not Workday (verified): American Airlines, Baylor Scott & White, Comerica,
  // Texas Health, Charles Schwab, Intuit — these run Phenom/Taleo/iCIMS/custom
  // and can't use this function; they stay as their existing link-outs.
  // Dell also dropped: its myworkdayjobs tenant still responds but returns 0
  // jobs — Dell migrated to Oracle HCM (enterpriseplatform.dell.com), so the
  // stale wd1/External tenant is empty. Re-add only if it moves back to Workday.
  // Toyota's correct data center is wd503 (not wd5, which 422'd) — added above.
  // Cleveland Clinic (ccf/wd1/ClevelandClinicCareers) was swapped out for CVS
  // Health for a more nationwide footprint; still valid Workday if wanted back.
];

// Populate sector + company dropdowns from the list
(function initDropdowns(){
  const secSel = document.getElementById('sector');
  SECTORS.forEach(s=>{
    const o=document.createElement('option'); o.value=s;
    o.textContent=s.charAt(0).toUpperCase()+s.slice(1); secSel.appendChild(o);
  });
  const coSel = document.getElementById('company');
  const companyOptions = [
    ...COMPANIES.map(c => ({slug:c.slug, label:c.slug})),
    ...MANUAL_COMPANIES.map(c => ({slug:c.slug, label:c.name || c.slug})),
    ...WORKDAY_EMPLOYERS.map(c => ({slug:c.slug, label:c.name}))
  ].sort((a,b) => a.label.localeCompare(b.label));
  companyOptions.forEach(c=>{
    const o=document.createElement('option');
    o.value=c.slug;
    o.textContent=c.label;
    coSel.appendChild(o);
  });
})();

const results = document.getElementById('results');
const statusEl = document.getElementById('status');
document.getElementById('results').addEventListener('click', (e) => {
  const c = e.target.closest('[data-rf-clear]');
  if(c && typeof RF !== 'undefined'){
    RF.active.loc.clear(); RF.active.role.clear();
    repaintFiltered();
  }
});

const countEl = document.getElementById('count');

// ===========================================================================
// POST-RESULT FILTERING (RF)
// ===========================================================================
// Narrows the already-fetched result set by location and/or role, instantly,
// with no re-search. Multi-select WITHIN a category (Texas OR Remote) and
// combine ACROSS categories (that location set AND that role set) — the model
// chosen because new grads are typically open to several locations at once and
// have often already picked several roles on the way in.
//
// Location is derived from each job's `location` string by pulling a US state
// (or "Remote"). Role is the selected search role a job matched, when the user
// used the multi-role picker; on a plain keyword search there's one role or
// none, so the role group auto-hides.
const RF = {
  allJobs: [], kw: '', loc: '', selectedRoles: [],
  active: { loc: new Set(), role: new Set(), sector: new Set(), exp: new Set() },

  // Map a free-text location to a coarse bucket for filtering. Full state names
  // and common abbreviations both map to the state name; anything remote-ish
  // buckets to "Remote"; unrecognized strings bucket to "Other".
  US_STATES: {
    'alabama':'Alabama','alaska':'Alaska','arizona':'Arizona','arkansas':'Arkansas','california':'California',
    'colorado':'Colorado','connecticut':'Connecticut','delaware':'Delaware','florida':'Florida','georgia':'Georgia',
    'hawaii':'Hawaii','idaho':'Idaho','illinois':'Illinois','indiana':'Indiana','iowa':'Iowa','kansas':'Kansas',
    'kentucky':'Kentucky','louisiana':'Louisiana','maine':'Maine','maryland':'Maryland','massachusetts':'Massachusetts',
    'michigan':'Michigan','minnesota':'Minnesota','mississippi':'Mississippi','missouri':'Missouri','montana':'Montana',
    'nebraska':'Nebraska','nevada':'Nevada','new hampshire':'New Hampshire','new jersey':'New Jersey','new mexico':'New Mexico',
    'new york':'New York','north carolina':'North Carolina','north dakota':'North Dakota','ohio':'Ohio','oklahoma':'Oklahoma',
    'oregon':'Oregon','pennsylvania':'Pennsylvania','rhode island':'Rhode Island','south carolina':'South Carolina',
    'south dakota':'South Dakota','tennessee':'Tennessee','texas':'Texas','utah':'Utah','vermont':'Vermont',
    'virginia':'Virginia','washington':'Washington','west virginia':'West Virginia','wisconsin':'Wisconsin','wyoming':'Wyoming',
    'district of columbia':'Washington, D.C.','washington, d.c.':'Washington, D.C.','washington dc':'Washington, D.C.'
  },
  ST_ABBR: {
    'al':'Alabama','ak':'Alaska','az':'Arizona','ar':'Arkansas','ca':'California','co':'Colorado','ct':'Connecticut',
    'de':'Delaware','fl':'Florida','ga':'Georgia','hi':'Hawaii','id':'Idaho','il':'Illinois','in':'Indiana','ia':'Iowa',
    'ks':'Kansas','ky':'Kentucky','la':'Louisiana','me':'Maine','md':'Maryland','ma':'Massachusetts','mi':'Michigan',
    'mn':'Minnesota','ms':'Mississippi','mo':'Missouri','mt':'Montana','ne':'Nebraska','nv':'Nevada','nh':'New Hampshire',
    'nj':'New Jersey','nm':'New Mexico','ny':'New York','nc':'North Carolina','nd':'North Dakota','oh':'Ohio','ok':'Oklahoma',
    'or':'Oregon','pa':'Pennsylvania','ri':'Rhode Island','sc':'South Carolina','sd':'South Dakota','tn':'Tennessee',
    'tx':'Texas','ut':'Utah','vt':'Vermont','va':'Virginia','wa':'Washington','wv':'West Virginia','wi':'Wisconsin',
    'wy':'Wyoming','dc':'Washington, D.C.'
  },

  // Coarse sector label for filtering. Jobs carry a lowercase-ish sector tag
  // (e.g. "tech", "healthcare & nursing jobs"); we title-case a short form and
  // fold obvious variants together so the chip list stays small.
  sectorBucket(sec){
    let s = String(sec || '').toLowerCase().trim();
    if(!s) return null;                       // untagged -> no sector chip
    // Trim noisy suffixes some sources append.
    s = s.replace(/\s*(jobs|roles)\s*$/,'').replace(/\s*&.*$/,'').trim();
    const MAP = {
      'tech':'Tech','technology':'Tech','it':'Tech','it-services':'Tech','software':'Tech','engineering':'Tech',
      'healthcare':'Healthcare','health':'Healthcare','nursing':'Healthcare','medical':'Healthcare','pharma':'Healthcare',
      'finance':'Finance','financial':'Finance','banking':'Finance','accounting':'Finance',
      'insurance':'Insurance','consulting':'Consulting','education':'Education','retail':'Retail',
      'consumer':'Consumer','marketing':'Marketing','sales':'Sales','staffing':'Staffing',
      'industrial':'Industrial','manufacturing':'Industrial','government':'Government','legal':'Legal',
      'media':'Media','hospitality':'Hospitality','logistics':'Logistics','nonprofit':'Nonprofit'
    };
    if(MAP[s]) return MAP[s];
    // Unknown but present: title-case the first word so it's still usable.
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  // Experience bucket from the scanned minimum-years figure. Only jobs whose
  // description was actually scanned carry j.minYears; unscanned jobs return
  // null and simply don't appear under any experience chip (honest — we won't
  // label a job we didn't read). The 6+ "not entry-level" tier is already
  // hidden upstream, so only these two buckets can occur.
  expBucket(j){
    const y = Number(j && j.minYears || 0);
    if(!(j && 'minYears' in j) || !y) return null;   // unscanned or 0 -> no chip
    const eff = j.yearsPreferred ? Math.max(1, y - 1) : y;
    if(eff <= 2) return 'Entry-level (0–2 yrs)';
    return 'Stretch (3–5 yrs)';
  },

  locBucket(loc){
    const s = String(loc || '').toLowerCase();
    if(!s || s === '—') return 'Not specified';
    if(/\bremote\b/.test(s)) return 'Remote';
    // Full state name anywhere in the string.
    for(const key in this.US_STATES){ if(s.includes(key)) return this.US_STATES[key]; }
    // Trailing ", XX" abbreviation (e.g. "Austin, TX").
    const m = s.match(/,\s*([a-z]{2})\b/);
    if(m && this.ST_ABBR[m[1]]) return this.ST_ABBR[m[1]];
    return 'Other';
  },

  // Which selected search-role(s) a job matches. MUST use the same matcher the
  // search itself uses (expandedKeywordMatches) — otherwise a job that matched
  // "Software Engineer" via a synonym like "Developer" wouldn't be attributed
  // to any role here, the per-role counts would all collapse toward zero, and
  // the whole Role group would wrongly hide. That was the original bug: this
  // used a strict literal title match while the search used synonym expansion.
  jobRoles(j){
    if(!this.selectedRoles.length) return [];
    // Match against title + company, the same blob field the search scores on
    // for these ATS results (kept minimal — the title carries the role signal).
    const blob = `${j.title || ''} ${j.company || ''}`;
    return this.selectedRoles.filter(r => {
      try { return expandedKeywordMatches(blob, r); }
      catch(_) {
        // Fallback to literal word match if the expander isn't available.
        const t = String(j.title || '').toLowerCase();
        return String(r).toLowerCase().split(/\s+/).filter(Boolean).every(term => t.includes(term));
      }
    });
  },

  filtered(jobs){
    const src = jobs || this.allJobs;
    const fl = this.active.loc, fr = this.active.role, fs = this.active.sector, fe = this.active.exp;
    if(!fl.size && !fr.size && !fs.size && !fe.size) return src;
    return src.filter(j => {
      if(fl.size && !fl.has(this.locBucket(j.location))) return false;
      if(fr.size){
        const roles = this.jobRoles(j);
        if(!roles.some(r => fr.has(r))) return false;
      }
      if(fs.size){
        const sb = this.sectorBucket(j.sector);
        if(!sb || !fs.has(sb)) return false;
      }
      if(fe.size){
        const eb = this.expBucket(j);
        if(!eb || !fe.has(eb)) return false;
      }
      return true;
    });
  }
};

// Build the filter bar from the states/roles present in the current results.
function buildResultFilters(){
  const bar = document.getElementById('resultFilter');
  if(!bar) return;
  const jobs = RF.allJobs || [];

  // Tally location buckets.
  const locCounts = {};
  jobs.forEach(j => { const b = RF.locBucket(j.location); locCounts[b] = (locCounts[b]||0)+1; });
  // Tally role buckets (only if the multi-role picker was used).
  const roleCounts = {};
  if(RF.selectedRoles.length > 1){
    jobs.forEach(j => RF.jobRoles(j).forEach(r => { roleCounts[r] = (roleCounts[r]||0)+1; }));
  }
  // Tally sector buckets.
  const sectorCounts = {};
  jobs.forEach(j => { const b = RF.sectorBucket(j.sector); if(b) sectorCounts[b] = (sectorCounts[b]||0)+1; });
  // Tally experience buckets (scanned jobs only).
  const expCounts = {};
  jobs.forEach(j => { const b = RF.expBucket(j); if(b) expCounts[b] = (expCounts[b]||0)+1; });

  const locKeys = Object.keys(locCounts);
  const roleKeys = Object.keys(roleCounts);
  const sectorKeys = Object.keys(sectorCounts);
  const expKeys = Object.keys(expCounts);

  // Nothing worth filtering at all: hide the bar.
  if(jobs.length < 2 ||
     (locKeys.length < 2 && roleKeys.length < 2 && sectorKeys.length < 2 && expKeys.length < 2)){
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  const chipHtml = (cat, key, n, on) =>
    `<button class="rf-chip" role="button" aria-pressed="${on?'true':'false'}" data-rf-cat="${cat}" data-rf-key="${esc(key)}">${esc(key)} <span class="rf-n">${n}</span></button>`;

  const orderByCount = (obj) => Object.keys(obj).sort((a,b)=> obj[b]-obj[a] || a.localeCompare(b));

  // Render a group. Long groups (many chips, e.g. states) show the top N and
  // tuck the rest behind a "+ N more" toggle so the panel stays scannable.
  const TOP_N = 6;
  const renderGroup = (cat, label, counts, activeSet) => {
    const keys = orderByCount(counts);
    if(keys.length < 2) return '';
    const head = keys.slice(0, TOP_N);
    const rest = keys.slice(TOP_N);
    const headChips = head.map(k => chipHtml(cat, k, counts[k], activeSet.has(k))).join('');
    // Any hidden chip that's currently active must stay visible, so pull active
    // ones out of the "rest" into the always-shown row.
    const restActive = rest.filter(k => activeSet.has(k));
    const restHidden = rest.filter(k => !activeSet.has(k));
    const activeChips = restActive.map(k => chipHtml(cat, k, counts[k], true)).join('');
    const moreChips = restHidden.map(k => chipHtml(cat, k, counts[k], false)).join('');
    const moreBlock = restHidden.length
      ? `<span class="rf-more-wrap" data-rf-more="${cat}">
           <span class="rf-more-chips" hidden>${moreChips}</span>
           <button type="button" class="rf-more-btn" data-rf-more-btn="${cat}" data-rf-expanded="0" data-rf-count="${restHidden.length}">+ ${restHidden.length} more</button>
         </span>`
      : '';
    return `
      <div class="rf-group">
        <div class="rf-glabel">${label}</div>
        <div class="rf-chips">${headChips}${activeChips}${moreBlock}</div>
      </div>`;
  };

  const locGroup    = renderGroup('loc',    'Location',   locCounts,    RF.active.loc);
  const roleGroup   = renderGroup('role',   'Role',       roleCounts,   RF.active.role);
  const sectorGroup = renderGroup('sector', 'Sector',     sectorCounts, RF.active.sector);
  const expGroup    = renderGroup('exp',    'Experience', expCounts,    RF.active.exp);

  const shownN = RF.filtered(jobs).length;
  const anyActive = RF.active.loc.size + RF.active.role.size + RF.active.sector.size + RF.active.exp.size;

  bar.innerHTML = `
    <button class="rf-toggle" aria-expanded="false">
      <span class="rf-t-label">Filter</span>
      <span class="rf-t-active">${anyActive ? '· '+anyActive+' active' : ''}</span>
      <span class="rf-t-shown">${shownN} shown</span>
      <span class="rf-caret" aria-hidden="true">▾</span>
    </button>
    <div class="rf-panel">
      <div class="rf-head">
        <span class="rf-title">Filter these results</span>
        <span class="rf-shown">${shownN} of ${jobs.length} shown</span>
      </div>
      <div class="rf-groups">${locGroup}${roleGroup}${sectorGroup}${expGroup}</div>
      ${anyActive ? `<div class="rf-clear"><button data-rf-clear="1">✕ Clear filters</button></div>` : ''}
    </div>`;
  bar.style.display = 'block';
  if(bar.classList.contains('rf-open')) bar.querySelector('.rf-toggle').setAttribute('aria-expanded','true');
}

// Re-paint results for the current filter selection, without re-searching.
// Repaints ONLY the job cards from already-fetched data — no network, no
// checkjobs, no coach-picks/direct-links rebuild. Those stay as the search
// left them; filtering is a pure view operation over RF.allJobs.
const RENDER_CAP_RF = 50;
function repaintFiltered(){
  if(!RF.allJobs.length) return;
  const results = document.getElementById('results');
  if(!results) return;

  const view = RF.filtered(RF.allJobs);
  const kw = RF.kw, loc = RF.loc;

  // Rebuild the card region. We replace the cards but leave any trailing
  // coach-picks / employer-link sections that follow them intact by scoping to
  // a dedicated wrapper. On first paint the wrapper may not exist yet; if so,
  // fall back to repainting the whole results node's card area.
  let wrap = document.getElementById('rf-cards');
  const cardsHtml = view.length
    ? view.slice(0, RENDER_CAP_RF).map(j => renderJob(j, kw, loc)).join('') +
      (view.length > RENDER_CAP_RF
        ? `<div class="more-wrap"><button id="showMore" class="secondary">Show ${view.length - RENDER_CAP_RF} more result${view.length - RENDER_CAP_RF===1?'':'s'}</button></div>`
        : '')
    : `<div class="empty"><strong>No results match these filters.</strong>
        <br>Your search found ${RF.allJobs.length} job${RF.allJobs.length===1?'':'s'}, but none match every filter you've selected.
        <div class="empty-actions"><button class="loosen-btn" data-rf-clear="1">Clear result filters</button></div>
      </div>`;

  if(wrap){
    wrap.innerHTML = cardsHtml;
  } else {
    // First-time: wrap the existing card area so future repaints are scoped.
    results.innerHTML = `<div id="rf-cards">${cardsHtml}</div>` + results.innerHTML;
  }

  // Re-wire "show more" for the filtered view.
  const moreBtn = document.getElementById('showMore');
  if(moreBtn){
    moreBtn.addEventListener('click', () => {
      const rest = view.slice(RENDER_CAP_RF);
      moreBtn.closest('.more-wrap').insertAdjacentHTML('beforebegin', rest.map(j => renderJob(j, kw, loc)).join(''));
      moreBtn.closest('.more-wrap').remove();
    });
  }

  buildResultFilters();   // refresh counts + active state in the bar
}

// Delegated handler for the filter bar: chip toggles, clear, and mobile expand.
document.getElementById('resultFilter').addEventListener('click', (e) => {
  const toggle = e.target.closest('.rf-toggle');
  if(toggle){
    const bar = document.getElementById('resultFilter');
    const open = bar.classList.toggle('rf-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    return;
  }
  // "+ N more" / "show less" toggle: reveal or re-hide the extra chips.
  const moreBtn = e.target.closest('[data-rf-more-btn]');
  if(moreBtn){
    const wrap = moreBtn.closest('.rf-more-wrap');
    const hidden = wrap && wrap.querySelector('.rf-more-chips');
    if(hidden){
      const isExpanded = moreBtn.getAttribute('data-rf-expanded') === '1';
      if(isExpanded){
        hidden.hidden = true;
        moreBtn.setAttribute('data-rf-expanded','0');
        moreBtn.textContent = '+ ' + moreBtn.getAttribute('data-rf-count') + ' more';
      } else {
        hidden.hidden = false;
        moreBtn.setAttribute('data-rf-expanded','1');
        moreBtn.textContent = '− show less';
      }
    }
    return;
  }
  const chip = e.target.closest('.rf-chip');
  if(chip){
    const cat = chip.getAttribute('data-rf-cat');
    const key = chip.getAttribute('data-rf-key');
    const set = RF.active[cat];
    if(set.has(key)) set.delete(key); else set.add(key);
    repaintFiltered();
    return;
  }
  if(e.target.closest('[data-rf-clear]')){
    RF.active.loc.clear();
    RF.active.role.clear();
    RF.active.sector.clear();
    RF.active.exp.clear();
    repaintFiltered();
    return;
  }
});
const goBtn = document.getElementById('go');

// Keep experience-level controls from contradicting each other.
// If Level = All levels, college-grad filtering turns off and experienced jobs are shown.
// If Level = any early-career bucket, experienced jobs are hidden by default.
function syncExperienceControls(){
  const lvl = document.getElementById('lvl');
  const degree = document.getElementById('degreeonly');
  const showExp = document.getElementById('showexperienced');
  if(!lvl || !degree || !showExp) return;

  if(lvl.value === 'all'){
    degree.checked = false;
    degree.disabled = true;
    showExp.disabled = false;
    showExp.checked = true;
  } else {
    degree.disabled = false;
    degree.checked = true;
    showExp.checked = false;
    showExp.disabled = true;
  }
}

