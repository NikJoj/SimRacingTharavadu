/* ═══════════════════════════════════════════════════
   CONFIGURATION - App Config & Demo Data
   ═══════════════════════════════════════════════════ */

const CONFIG = {
  // Step 3 in setup guide: paste your Apps Script web app URL here
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxiA_RCwbQrp1OitvYeficXLDGGhXXbbc3EyluaYwtgeHR1lwwk43DjRf7RcoEa51h9jA/exec",

  // Step 5 in setup guide: paste your published sheet JSON URLs here
  // Template: https://docs.google.com/spreadsheets/d/1vFLLZFCIlboKZWQy5diB5dcLKtjwPe-Bfoz1xSxV-F4/gviz/tq?tqx=out:json&sheet=Events
  EVENTS_SHEET_URL: "https://docs.google.com/spreadsheets/d/1vFLLZFCIlboKZWQy5diB5dcLKtjwPe-Bfoz1xSxV-F4/gviz/tq?tqx=out:json&sheet=Events",
  LEAGUES_SHEET_URL: "https://docs.google.com/spreadsheets/d/1vFLLZFCIlboKZWQy5diB5dcLKtjwPe-Bfoz1xSxV-F4/gviz/tq?tqx=out:json&sheet=League",
  LEADERBOARD_SHEET_URL: "https://docs.google.com/spreadsheets/d/1vFLLZFCIlboKZWQy5diB5dcLKtjwPe-Bfoz1xSxV-F4/gviz/tq?tqx=out:json&sheet=Leaderboard",

  // Keep true until URLs above are configured — shows realistic demo data
  DEMO_MODE: false,

  // Assetto Corsa API Configuration
  // Championship ID for standings API
  ASSETTO_CHAMPIONSHIP_ID: "1bb2f11c-d4db-45e8-9505-97cd6ec1e806",
  
  // Serverless API Endpoints (deployed on Vercel)
  // For local development: use http://localhost:3000/api/...
  // For production: use your Vercel deployment URL or relative paths
  API_BASE_URL: "/api", // Relative path works when deployed together
  
  // API Endpoints
  ASSETTO_API: {
    STANDINGS: "/api/standings",           // Championship standings
    CHAMPIONSHIPS: "/api/championships",   // List all championships
    LIVE_LEADERBOARD: "/api/live-leaderboard", // Live timing leaderboard
    LIVE_BASIC: "/api/live-basic",        // Basic live timing info
    RESULTS: "/api/results",              // Race results list
    RACE_RESULT: "/api/race-result"       // Individual race result
  },
  
  // Legacy settings (no longer needed with serverless functions)
  USE_CORS_PROXY: false,
  CORS_PROXIES: [] // Not needed anymore!
};

/* ── DEMO DATA ───────────────────────────────────────── */
const DEMO_EVENTS = [
  {id:"1",name:"Kerala GT3 Challenge",sim:"Assetto Corsa Competizione",status:"ongoing",track:"Mount Panorama / Bathurst",startDate:"2026-03-01T00:00:00Z",endDate:"2026-03-15T23:59:59Z",format:"Sprint Race · 30 mins",drivers:"32",maxDrivers:"32",rounds:"3",season:"S2 2026",description:"Experience the thrill of GT3 racing on the iconic Mount Panorama circuit. This endurance event features multiple rounds with professional setups and competitive matchmaking."},
  {id:"2",name:"Tharavadu Open Series",sim:"iRacing",status:"ongoing",track:"Silverstone GP",startDate:"2026-02-20T00:00:00Z",endDate:"2026-03-20T23:59:59Z",format:"Endurance · 2 hrs",drivers:"22",maxDrivers:"30",rounds:"5",season:"S1 2026",description:"A comprehensive open series on iRacing featuring endurance racing at Silverstone. Perfect for drivers of all skill levels with detailed race strategies and team coordination."},
  {id:"3",name:"Formula Monsoon Cup",sim:"Assetto Corsa",status:"upcoming",track:"Spa-Francorchamps",startDate:"2026-03-22T14:00:00Z",endDate:"2026-03-22T16:00:00Z",format:"Qualifying + Race",drivers:"14",maxDrivers:"24",rounds:"1",season:"S2 2026",description:"Dive into formula racing at the legendary Spa circuit. This cup features monsoon weather conditions and requires precise driving skills for optimal lap times."},
  {id:"4",name:"Street Warriors Invitational",sim:"Gran Turismo 7",status:"upcoming",track:"Tokyo Expressway",startDate:"2026-04-05T15:00:00Z",endDate:"2026-04-05T16:00:00Z",format:"Sprint Race · 20 mins",drivers:"8",maxDrivers:"20",rounds:"2",season:"S2 2026",description:"An invitational event for street racing enthusiasts on Gran Turismo 7. Navigate the bustling Tokyo Expressway with custom tuned cars and aggressive racing lines."},
  {id:"5",name:"F1 Kerala Grand Prix",sim:"F1 24",status:"upcoming",track:"Bahrain International Circuit",startDate:"2026-04-12T10:00:00Z",endDate:"2026-04-12T18:00:00Z",format:"Full Weekend",drivers:"5",maxDrivers:"20",rounds:"1",season:"S2 2026",description:"The premier F1 event of the season at Bahrain. Experience a full F1 weekend simulation with practice, qualifying, and the main race under authentic conditions."}
];

const DEMO_LEAGUES = [
  {id:"1",name:"SRT League — GT3 Season",sim:"Assetto Corsa Competizione",status:"upcoming",track:"Multi-Track Season",startDate:"2026-05-10T00:00:00Z",endDate:"2026-06-28T23:59:59Z",format:"Weekly Rounds",drivers:"0",maxDrivers:"36",rounds:"8",season:"2026",description:"A structured GT3 league season with weekly rounds, stewarding, and points standings.",carOptions:"GT3",blobStore:"SRT-GT3-Season-1",championshipId:"1bb2f11c-d4db-45e8-9505-97cd6ec1e806"},
  {id:"2",name:"SRT League — Formula Series",sim:"Assetto Corsa",status:"upcoming",track:"Multi-Track Season",startDate:"2026-05-17T00:00:00Z",endDate:"2026-07-12T23:59:59Z",format:"Weekly Rounds",drivers:"0",maxDrivers:"24",rounds:"9",season:"2026",description:"A clean and competitive open-wheel season with consistent weekly racing and leaderboard points.",carOptions:"Formula",blobStore:"SRT-Formula-Season-1",championshipId:""}
];

const DEMO_LB = {
  "1":[
    {pos:"1",driver:"Vishnu Krishnan",tag:"VSH_KR",team:"Red Flag Racing",pts:"87",time:"2:03.412",gap:"Leader"},
    {pos:"2",driver:"Arun Nair",tag:"ARN_NR",team:"Kochi Raceworks",pts:"74",time:"2:03.891",gap:"+0.479"},
    {pos:"3",driver:"Devika Menon",tag:"DEV_MN",team:"Malabar Motorsport",pts:"62",time:"2:04.101",gap:"+0.689"},
    {pos:"4",driver:"Sanjay Pillai",tag:"SJY_PL",team:"Trivandrum Speed",pts:"55",time:"2:04.458",gap:"+1.046"},
    {pos:"5",driver:"Lakshmi Raj",tag:"LKM_RJ",team:"Red Flag Racing",pts:"47",time:"2:04.701",gap:"+1.289"},
    {pos:"6",driver:"Muhammed Rafi",tag:"MHD_RF",team:"Independent",pts:"40",time:"2:05.023",gap:"+1.611"}
  ],
  "2":[
    {pos:"1",driver:"Rahul Varma",tag:"RHL_VM",team:"Storm Dynamics",pts:"102",time:"1:44.218",gap:"Leader"},
    {pos:"2",driver:"Sneha Gopal",tag:"SNH_GP",team:"Trivandrum Speed",pts:"91",time:"1:44.519",gap:"+0.301"},
    {pos:"3",driver:"Jobin Mathew",tag:"JBN_MT",team:"Independent",pts:"78",time:"1:44.811",gap:"+0.593"},
    {pos:"4",driver:"Meera Babu",tag:"MR_BBU",team:"Storm Dynamics",pts:"67",time:"1:45.102",gap:"+0.884"},
    {pos:"5",driver:"Suresh Chandran",tag:"SRS_CH",team:"Kochi Raceworks",pts:"55",time:"1:45.489",gap:"+1.271"}
  ]
};

// Made with Bob
