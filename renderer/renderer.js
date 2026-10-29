const $ = (id) => document.getElementById(id);
const video = $('video'), bar = $('bar'), seek = $('seek');
let items = [], index = -1, idleTimer, subUrl = null;

const fmt = (s) => {
  if (!isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
};

let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function renderList() {
  const ul = $('items'); ul.innerHTML = '';
  items.forEach((it, i) => {
    const li = document.createElement('li');
    li.textContent = it.name; li.title = it.name;
    if (i === index) li.className = 'current';
    li.onclick = () => play(i);
    ul.appendChild(li);
  });
}

function play(i) {
  if (i < 0 || i >= items.length) return;
  index = i;
  clearSubtitle();
  video.src = items[i].url;
  video.play().catch(() => {});
  $('empty').classList.add('hidden');
  document.title = items[i].name + ' - Lumina Player';
  renderList();
}

function addItems(list, start = true) {
  if (!list || !list.length) return;
  const first = items.length;
  items = items.concat(list);
  if (start || index === -1) play(first); else renderList();
}

function clearSubtitle() {
  video.querySelectorAll('track').forEach((t) => t.remove());
  if (subUrl) { URL.revokeObjectURL(subUrl); subUrl = null; }
}

function srtToVtt(text) {
  return 'WEBVTT\n\n' + text.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

async function addSubtitle() {
  const s = await window.lumina.openSubtitle();
  if (!s) return;
  clearSubtitle();
  const vtt = s.ext === 'srt' ? srtToVtt(s.text) : s.text;
  subUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
  const track = document.createElement('track');
  track.kind = 'subtitles'; track.label = s.name; track.src = subUrl; track.default = true;
  video.appendChild(track);
  track.addEventListener('load', () => { track.track.mode = 'showing'; });
  toast('Sous-titres : ' + s.name);
}

const POS_KEY = 'lumina.pos';
const getPos = () => { try { return JSON.parse(localStorage.getItem(POS_KEY) || '{}'); } catch { return {}; } };
let lastSave = 0;
function savePos() {
  if (index < 0 || !video.duration) return;
  const m = getPos(), u = items[index].url;
  if (video.currentTime > 5 && video.currentTime < video.duration - 10) m[u] = Math.floor(video.currentTime);
  else delete m[u];
  const keys = Object.keys(m);
  if (keys.length > 200) delete m[keys[0]];
  localStorage.setItem(POS_KEY, JSON.stringify(m));
}

async function screenshot() {
  if (!video.videoWidth) return toast('Aucune image à capturer.');
  const c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  try { toast('Capture enregistrée : ' + await window.lumina.saveShot(c.toDataURL('image/png'))); }
  catch { toast('Échec de la capture.'); }
}

async function openDialog() { addItems(await window.lumina.openFiles(), true); }
const togglePlay = () => (video.paused ? video.play() : video.pause());
const skip = (d) => { video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + d)); };
const setVol = (v) => { video.volume = Math.max(0, Math.min(1, v)); video.muted = false; $('vol').value = video.volume; };
const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());

video.addEventListener('play', () => ($('play').textContent = '⏸'));
video.addEventListener('pause', () => ($('play').textContent = '▶'));
video.addEventListener('timeupdate', () => {
  if (Date.now() - lastSave > 3000) { savePos(); lastSave = Date.now(); }
  if (video.duration) seek.value = (video.currentTime / video.duration) * 1000;
  $('time').textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
});
video.addEventListener('volumechange', () => {
  $('mute').textContent = video.muted || video.volume === 0 ? '🔇' : '🔊';
  localStorage.setItem('lumina.vol', String(video.volume));
});
video.addEventListener('loadedmetadata', () => {
  const p = items[index] && getPos()[items[index].url];
  if (p && p < video.duration - 10) { video.currentTime = p; toast('Reprise à ' + fmt(p)); }
});
window.addEventListener('beforeunload', savePos);
video.addEventListener('ended', () => { savePos(); if (index < items.length - 1) play(index + 1); });
video.addEventListener('error', () => toast('Impossible de lire ce fichier (format ou codec non pris en charge).'));
video.addEventListener('click', togglePlay);
video.addEventListener('dblclick', toggleFull);

seek.addEventListener('input', () => { if (video.duration) video.currentTime = (seek.value / 1000) * video.duration; });
$('vol').addEventListener('input', (e) => setVol(parseFloat(e.target.value)));
$('speed').addEventListener('change', (e) => { video.playbackRate = parseFloat(e.target.value); });
$('play').onclick = togglePlay;
$('prev').onclick = () => play(index - 1);
$('next').onclick = () => play(index + 1);
$('mute').onclick = () => { video.muted = !video.muted; };
$('full').onclick = toggleFull;
$('open').onclick = openDialog;
$('emptyOpen').onclick = openDialog;
$('sub').onclick = addSubtitle;
$('shot').onclick = screenshot;
$('list').onclick = () => { const p = $('playlist'); p.hidden = !p.hidden; };

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); togglePlay(); }
  else if (k === 'arrowright') skip(e.shiftKey ? 30 : 5);
  else if (k === 'arrowleft') skip(e.shiftKey ? -30 : -5);
  else if (k === 'arrowup') { e.preventDefault(); setVol(video.volume + 0.05); }
  else if (k === 'arrowdown') { e.preventDefault(); setVol(video.volume - 0.05); }
  else if (k === 'f') toggleFull();
  else if (k === 'm') video.muted = !video.muted;
  else if (k === 'o') openDialog();
  else if (k === 's') screenshot();
  else if (k === 'l') $('list').click();
  else if (k === 'n') play(index + 1);
  else if (k === 'p') play(index - 1);
  else if (k === 'escape' && document.fullscreenElement) document.exitFullscreen();
});

function wake() {
  bar.classList.remove('idle'); $('stage').classList.remove('stage-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!video.paused) { bar.classList.add('idle'); $('stage').classList.add('stage-idle'); }
  }, 2500);
}
$('stage').addEventListener('mousemove', wake);
video.addEventListener('pause', wake);

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  addItems(await window.lumina.resolveDropped([...e.dataTransfer.files]), true);
});

window.lumina.onOpenItems((list) => addItems(list, true));
(async () => {
  const saved = parseFloat(localStorage.getItem('lumina.vol'));
  if (!isNaN(saved)) setVol(saved);
  addItems(await window.lumina.initialItems(), true);
  wake();
})();
