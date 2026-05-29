const grid = document.getElementById("grid");
const playerView = document.getElementById("playerView");
const player = new Plyr("#player");

const videoMeta = document.getElementById("videoMeta");
const videoDescription = document.getElementById("videoDescription");
const fallbackLink = document.getElementById("fallbackLink");
const recommendedBox = document.getElementById("recommended");

const searchBox = document.getElementById("search");
const langSel = document.getElementById("lang");

const proxyMode = document.getElementById("proxyMode");
const proxyURL = document.getElementById("proxyURL");

const modal = document.getElementById("modal");

let BADWORDS = [];
let currentQuery = "collection:opensource_movies";
let settings = { lang: "" };

function openSettings(){ modal.style.display="flex"; }
function closeSettings(){ modal.style.display="none"; }

async function loadBadWords(){
  try {
    const res = await fetch("badwords.txt");
    const text = await res.text();

    BADWORDS = text
      .split(/\r?\n/)
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);
  } catch {
    BADWORDS = [];
  }
}

function isSensitive(v){
  const text = (
    (v.title || "") + " " +
    (v.description || "") + " " +
    (Array.isArray(v.subject) ? v.subject.join(" ") : (v.subject || ""))
  ).toLowerCase();

  return BADWORDS.some(w => text.includes(w));
}

function fetchWith(url){
  const proxy = getProxyURL();
  return fetch(proxy ? proxy + encodeURIComponent(url) : url)
    .then(r => r.json());
}

function buildQuery(q){
  return settings.lang ? `${q} AND language:${settings.lang}` : q;
}

async function fetchVideos(query){
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(buildQuery(query))}` +
    `&fl[]=identifier,title,description,downloads,subject,publicdate&output=json&rows=80`;

  const data = await fetchWith(url);

  return data.response.docs;
}

async function fetchMeta(id){
  const url = `https://archive.org/metadata/${id}`;
  return await fetchWith(url);
}

function normalizeSubjects(s){
  if(!s) return [];
  if(Array.isArray(s)) return s;
  return String(s).split(/[;,]/g).map(x=>x.trim()).filter(Boolean);
}

function scoreSubjects(a,b){
  const set = new Set(b);
  return a.filter(x => set.has(x)).length;
}

function formatViews(n){
  if(!n) return "0 views";
  if(n > 1e6) return (n/1e6).toFixed(1)+"M views";
  if(n > 1e3) return (n/1e3).toFixed(1)+"K views";
  return n+" views";
}

function openVideo(id){
  location.hash = "#/video/" + encodeURIComponent(id);
}

function back(){
  location.hash = "";
}

async function renderRecommendations(meta, id){
  const items = await fetchVideos(currentQuery);

  const cur = normalizeSubjects(meta.metadata?.subject);

  const scored = items
    .filter(v => v.identifier !== id)
    .map(v => ({
      v,
      score: scoreSubjects(cur, normalizeSubjects(v.subject))
    }))
    .filter(x => x.score > 0)
    .sort((a,b)=>b.score - a.score)
    .slice(0,8);

  recommendedBox.innerHTML = "";

  scored.forEach(({v})=>{
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "thumb";
    img.src = `https://archive.org/services/img/${v.identifier}`;

    if(isSensitive(v)) img.classList.add("thumbBlur");

    img.onclick = () => openVideo(v.identifier);
    card.onclick = () => openVideo(v.identifier);

    if(isSensitive(v)){
      const tag = document.createElement("div");
      tag.className = "sensitiveTag";
      tag.textContent = "Sensitive";
      card.appendChild(tag);
    }

    const t = document.createElement("div");
    t.className = "title";
    t.textContent = v.title || "";

    const m = document.createElement("div");
    m.className = "meta";
    m.textContent = formatViews(v.downloads);

    card.appendChild(img);
    card.appendChild(t);
    card.appendChild(m);

    recommendedBox.appendChild(card);
  });
}

async function playMedia(id){
  playerView.style.display="block";
  grid.style.display="none";

  videoMeta.textContent="";
  videoDescription.textContent="";
  fallbackLink.innerHTML="";
  recommendedBox.innerHTML="";

  const meta = await fetchMeta(id);
  const m = meta.metadata || {};
  const files = meta.files || [];

  const mp4 = files.find(f => f.name?.endsWith(".mp4"));

  videoMeta.textContent =
    `${m.creator || ""} • ${formatViews(m.downloads)} • ${m.publicdate || ""}`;

  videoDescription.textContent =
    Array.isArray(m.description)
      ? m.description.join("\n")
      : (m.description || "");

  if(mp4){
    const url = `https://archive.org/download/${id}/${mp4.name}`;
    player.source = { type:"video", sources:[{src:url,type:"video/mp4"}] };
    player.play().catch(()=>{});
  } else {
    fallbackLink.innerHTML =
      `<a href="https://archive.org/details/${id}" target="_blank">Open on Archive.org</a>`;
  }

  await renderRecommendations(meta, id);
}

async function render(items){
  grid.innerHTML="";

  items.forEach(v=>{
    const card=document.createElement("div");
    card.className="card";

    const img=document.createElement("img");
    img.className="thumb";
    img.src=`https://archive.org/services/img/${v.identifier}`;

    if(isSensitive(v)) img.classList.add("thumbBlur");

    const t=document.createElement("div");
    t.className="title";
    t.textContent=v.title||"";

    const m=document.createElement("div");
    m.className="meta";
    m.textContent=formatViews(v.downloads);

    if(isSensitive(v)){
      const tag = document.createElement("div");
      tag.className = "sensitiveTag";
      tag.textContent = "Sensitive";
      card.appendChild(tag);
    }

    img.onclick=()=>openVideo(v.identifier);
    card.onclick=()=>openVideo(v.identifier);

    card.appendChild(img);
    card.appendChild(t);
    card.appendChild(m);

    grid.appendChild(card);
  });
}

async function loadFeed(){
  const vids = await fetchVideos(currentQuery);
  render(vids);
}

function load(){
  const id = decodeURIComponent(location.hash.replace("#/video/",""));
  if(id) playMedia(id);
  else {
    playerView.style.display="none";
    grid.style.display="grid";
  }
}

/* SETTINGS */
proxyMode.onchange = e => CONFIG.proxyEnabled = e.target.value === "on";
proxyURL.onchange = e => CONFIG.proxyURL = e.target.value.trim();

searchBox.oninput = e => {
  currentQuery = e.target.value || "collection:opensource_movies";
  loadFeed();
};

langSel.onchange = e => {
  settings.lang = e.target.value;
  loadFeed();
};

window.addEventListener("hashchange", load);

(async()=>{
  await loadBadWords();
  await loadFeed();
  load();
})();
