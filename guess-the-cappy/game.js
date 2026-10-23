/* ===================== crypto & helpers ===================== */
function sha256(msg) {
  const bytes = new TextEncoder().encode(msg);
  const rrot = (v, a) => (v >>> a) | (v << (32 - a));
  const K = [], H0 = [];
  const isC = {};
  let pc = 0;
  for (let c = 2; pc < 64; c++) {
    if (!isC[c]) {
      for (let i = 0; i < 313; i += c) isC[i] = c;
      if (pc < 8) H0[pc] = (Math.pow(c, 0.5) * 4294967296) | 0;
      K[pc++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
    }
  }
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  const bitLen = bytes.length * 8;
  dv.setUint32(total - 4, bitLen >>> 0);
  dv.setUint32(total - 8, Math.floor(bitLen / 4294967296));
  let h = H0.slice();
  for (let off = 0; off < total; off += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4) | 0;
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rrot(w15, 7) ^ rrot(w15, 18) ^ (w15 >>> 3);
      const s1 = rrot(w2, 17) ^ rrot(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h = [h[0] + a | 0, h[1] + b | 0, h[2] + c | 0, h[3] + d | 0,
         h[4] + e | 0, h[5] + f | 0, h[6] + g | 0, h[7] + hh | 0];
  }
  return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

function normText(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function normCode(s) {
  return s.toUpperCase().replace(/\s+/g, "");
}
function hashOf(cfg, s) {
  return sha256(cfg.salt + "|" + s);
}
function decryptBlob(b64, code) {
  const bin = atob(b64);
  const key = new TextEncoder().encode(code);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) ^ key[i % key.length];
  return JSON.parse(new TextDecoder().decode(out));
}
function caesar(text, shift) {
  return text.replace(/[a-z]/gi, ch => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode((((ch.charCodeAt(0) - base + shift) % 26) + 26) % 26 + base);
  });
}
function loginTeam(cfg, rawCode) {
  const code = normCode(rawCode);
  const blob = cfg.teams[hashOf(cfg, "TEAM|" + code)];
  if (!blob) return null;
  try { return { code, data: decryptBlob(blob, code) }; } catch (e) { return null; }
}
function checkPhrase(cfg, input) { return hashOf(cfg, "PHRASE|" + normText(input)) === cfg.phraseHash; }
function checkFlag(cfg, input) { return hashOf(cfg, "FLAG|" + normText(input)) === cfg.flagHash; }

/* ===================== UI ===================== */
if (typeof document !== "undefined") {
  const KEY = "cappy_state_v1";
  const $ = id => document.getElementById(id);
  const screens = ["login", "stage1", "stage2", "win"];

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  let state = load();
  let team = null;

  function show(name) {
    screens.forEach(s => $(s).classList.toggle("hidden", s !== name));
    $("logout").classList.toggle("hidden", name === "login");
    window.scrollTo(0, 0);
  }
  function setMsg(id, text, ok) {
    const el = $(id);
    el.textContent = text || "";
    el.className = "msg " + (text ? (ok ? "ok" : "err") : "");
  }
  function shake(el) {
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
  }
  function fmtDuration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function render() {
    if (!state) return show("login");
    team = loginTeam(CONFIG, state.code);
    if (!team) { clear(); state = null; return show("login"); }

    if (state.stage === 1) {
      $("team-name-1").textContent = team.data.name;
      $("cipher").textContent = team.data.ct;
      $("hint").textContent = team.data.hint;
      $("tool").classList.toggle("hidden", !CONFIG.showTool);
      updateTool();
      show("stage1");
    } else if (state.stage === 2) {
      $("team-name-2").textContent = team.data.name;
      const q = normText(state.phrase || "");
      $("quest-q").textContent = q ? q.charAt(0).toUpperCase() + q.slice(1) + "?" : "";
      $("zip-link").href = CONFIG.zipFile;
      show("stage2");
    } else {
      $("win-team").textContent = team.data.name;
      $("win-time").textContent = fmtDuration((state.end || Date.now()) - state.start);
      $("win-clock").textContent = state.end ? new Date(state.end).toLocaleTimeString("id-ID") : "";
      show("win");
    }
  }

  function updateTool() {
    const n = parseInt($("shift").value, 10);
    $("shift-val").textContent = n;
    $("tool-out").textContent = caesar(team ? team.data.ct : "", -n);
  }

  $("login-form").addEventListener("submit", e => {
    e.preventDefault();
    const t = loginTeam(CONFIG, $("code").value);
    if (!t) { setMsg("login-msg", "Kode tim tidak dikenal.", false); shake($("code")); return; }
    state = { code: t.code, stage: 1, start: Date.now() };
    save(state);
    setMsg("login-msg", "");
    render();
  });

  $("shift").addEventListener("input", updateTool);

  $("phrase-form").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("phrase").value;
    if (checkPhrase(CONFIG, v)) {
      state.stage = 2; state.phrase = v;
      save(state); setMsg("phrase-msg", ""); $("phrase").value = "";
      render();
    } else {
      setMsg("phrase-msg", "Belum tepat. Cek lagi urutan kata dari semua tim.", false);
      shake($("phrase"));
    }
  });

  $("flag-form").addEventListener("submit", e => {
    e.preventDefault();
    if (checkFlag(CONFIG, $("flag").value)) {
      state.stage = 3; state.end = Date.now();
      save(state); setMsg("flag-msg", ""); render();
    } else {
      setMsg("flag-msg", "Flag salah. Coba barcode lain!", false);
      shake($("flag"));
    }
  });

  $("logout").addEventListener("click", () => {
    if (confirm("Keluar dari tim ini? Progres di HP ini akan dihapus.")) {
      clear(); state = null; team = null; render();
    }
  });

  render();
}

if (typeof module !== "undefined") {
  module.exports = { sha256, normText, normCode, caesar, loginTeam, checkPhrase, checkFlag };
}
