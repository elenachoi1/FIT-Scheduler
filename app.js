import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, TIMEZONE } from "./config.js";
import { recommend, slotKey } from "./recommend.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById("app");
let session = null;
let profile = null;
let cleanups = [];

/* ───────────── helpers ───────────── */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (name) => (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const go = (path) => { location.hash = "#" + path; };
const appUrl = () => location.origin + location.pathname;

function fmtTime(min) {
  const h = Math.floor(min / 60) % 24, m = min % 60;
  const ap = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
}
// Dates are stored as New York calendar dates ("YYYY-MM-DD"), so format them without any shift.
function fmtDate(d, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
function todayNY() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function nowLabelNY() {
  return new Date().toLocaleTimeString("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}
async function copy(text, msg = "Link copied") {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { prompt("Copy this link:", text); }
}

/* theme (PRISM has dark + light) */
function getTheme() { try { return localStorage.getItem("fit-theme") || "dark"; } catch { return "dark"; } }
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("fit-theme", t); } catch {}
}
setTheme(getTheme());

/* ───────────── auth ───────────── */
async function loadProfile() {
  if (!session) { profile = null; return; }
  const { data } = await sb.from("profiles").select("id, display_name").eq("id", session.user.id).maybeSingle();
  profile = data || { id: session.user.id, display_name: session.user.email.split("@")[0] };
}

function renderLogin(mode = "signin") {
  app.innerHTML = `
  <div class="auth-screen"><div class="aurora"></div>
    <div class="auth-card">
      <div class="auth-head">
        <img class="auth-mark" src="logo.png" alt="FIT">
        <div><h1>FIT Scheduler</h1><p>Find a time that works for everyone.</p></div>
      </div>
      <button class="google-btn" id="google">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"/></svg>
        Continue with Google
      </button>
      <div class="divider">or use email</div>
      <div class="seg">
        <button data-mode="signin" class="${mode === "signin" ? "active" : ""}">Sign in</button>
        <button data-mode="signup" class="${mode === "signup" ? "active" : ""}">Create account</button>
      </div>
      <form id="auth-form">
        ${mode === "signup" ? `<div class="field"><label>Name</label><input name="name" required maxlength="60" placeholder="Elena Choi" autocomplete="name"></div>` : ""}
        <div class="field"><label>Email</label><input name="email" type="email" required placeholder="you@fitnyc.edu" autocomplete="email"></div>
        <div class="field"><label>Password</label><input name="password" type="password" required minlength="6" autocomplete="${mode === "signup" ? "new-password" : "current-password"}"></div>
        <p class="error" id="auth-error"></p>
        <button class="btn btn-primary btn-lg" type="submit">${mode === "signup" ? "Create account" : "Sign in"}</button>
      </form>
      <p class="muted small" style="text-align:center;margin:0"><a href="privacy.html" style="color:#9298a3">Privacy Policy</a></p>
    </div>
  </div>`;

  app.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => renderLogin(b.dataset.mode)));
  document.getElementById("google").onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: appUrl() } });
    if (error) document.getElementById("auth-error").textContent = error.message;
  };
  document.getElementById("auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const err = document.getElementById("auth-error");
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; err.textContent = "";
    const email = f.get("email").trim(), password = f.get("password");
    const res = mode === "signup"
      ? await sb.auth.signUp({ email, password, options: { data: { display_name: f.get("name").trim() }, emailRedirectTo: appUrl() } })
      : await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (res.error) { err.textContent = res.error.message; return; }
    if (mode === "signup" && !res.data.session) {
      err.style.color = "var(--mine)";
      err.textContent = "Check your email to confirm your account, then sign in.";
    }
  };
}

/* ───────────── shell ───────────── */
function shell(inner) {
  const name = profile?.display_name || "";
  app.innerHTML = `
  <header class="topbar"><div class="topbar-inner">
    <a class="brand" href="#/"><img class="brand-mark" src="logo.png" alt=""><span>FIT Scheduler</span>
      <span class="brand-sep">/</span><span class="brand-sub">New York time</span></a>
    <div class="spacer"></div>
    <button class="nav-btn" id="theme-btn" title="Switch theme">${getTheme() === "dark" ? "☀ Light" : "☾ Dark"}</button>
    <div class="user-chip"><span class="avatar">${esc(initials(name))}</span>
      <div><strong>${esc(name)}</strong><small>${esc(session.user.email)}</small></div></div>
    <button class="btn btn-sm" id="logout">Sign out</button>
  </div></header>
  <main id="view">${inner}</main>`;
  document.getElementById("logout").onclick = () => sb.auth.signOut();
  document.getElementById("theme-btn").onclick = () => { setTheme(getTheme() === "dark" ? "light" : "dark"); route(); };
  return document.getElementById("view");
}

/* ───────────── router ───────────── */
async function route() {
  cleanups.forEach((f) => f());
  cleanups = [];
  const parts = (location.hash.slice(1) || "/").split("/").filter(Boolean);

  if (!session) {
    if (parts.length) { try { sessionStorage.setItem("fit-after-login", location.hash); } catch {} }
    return renderLogin();
  }
  let after = null;
  try { after = sessionStorage.getItem("fit-after-login"); sessionStorage.removeItem("fit-after-login"); } catch {}
  if (after && after !== location.hash) { location.hash = after; return; }

  shell(`<div class="loading">Loading…</div>`);
  try {
    if (parts[0] === "join" && parts[1]) return await joinGroup(parts[1]);
    if (parts[0] === "group" && parts[1] && parts[2] === "new") return await renderNewEvent(parts[1]);
    if (parts[0] === "group" && parts[1]) return await renderGroup(parts[1]);
    if (parts[0] === "event" && parts[1]) return await renderEvent(parts[1]);
    return await renderHome();
  } catch (e) {
    console.error(e);
    shell(`<div class="card"><h2>Something went wrong</h2><p class="muted">${esc(e.message || e)}</p><a class="btn" href="#/">Back home</a></div>`);
  }
}

/* ───────────── home ───────────── */
async function renderHome() {
  const [{ data: groups, error: gErr }, { data: events }] = await Promise.all([
    sb.from("groups").select("id, name, owner_id, group_members(count)").order("created_at", { ascending: false }),
    sb.from("events").select("id, title, dates, group_id, groups(name)").order("created_at", { ascending: false }).limit(20),
  ]);
  if (gErr) throw gErr;
  const today = todayNY();
  const upcoming = (events || []).filter((e) => e.dates.some((d) => d >= today));

  const view = shell(`
    <div class="page-head"><div>
      <div class="eyebrow">Dashboard</div>
      <h1 class="gradient-title">Hi, ${esc(profile.display_name)}</h1>
      <p class="muted small" style="margin:6px 0 0">It's ${esc(nowLabelNY())} in New York.</p>
    </div></div>
    <div class="grid-2">
      <section class="card">
        <div class="card-head"><h2>Your groups</h2><span class="badge gray">${groups.length}</span></div>
        <form id="new-group" class="row" style="margin-bottom:12px">
          <input name="name" placeholder="New group name (e.g. PRISM Team)" maxlength="80" required>
          <button class="btn btn-violet" type="submit">Create group</button>
        </form>
        <div class="list">
          ${groups.length ? groups.map((g) => `
            <a class="list-item" href="#/group/${g.id}"><span class="dot-icon"></span>
              <div class="grow"><div class="title">${esc(g.name)}</div>
              <div class="muted small">${g.group_members?.[0]?.count ?? 1} members</div></div>
              ${g.owner_id === session.user.id ? `<span class="badge">Owner</span>` : ""}
            </a>`).join("") : `<div class="empty">No groups yet. Create one, or open an invite link from a friend.</div>`}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Upcoming events</h2><span class="badge gray">${upcoming.length}</span></div>
        <div class="list">
          ${upcoming.length ? upcoming.map((e) => `
            <a class="list-item" href="#/event/${e.id}"><span class="dot-icon" style="background:#38bdf8;box-shadow:0 0 8px rgba(56,189,248,.8)"></span>
              <div class="grow"><div class="title">${esc(e.title)}</div>
              <div class="muted small">${esc(e.groups?.name || "")} · ${esc(fmtDate([...e.dates].sort()[0], { month: "short", day: "numeric" }))}${e.dates.length > 1 ? ` + ${e.dates.length - 1} more` : ""}</div></div>
            </a>`).join("") : `<div class="empty">No upcoming events. Open a group to create one.</div>`}
        </div>
      </section>
    </div>`);

  view.querySelector("#new-group").onsubmit = async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get("name").trim();
    if (!name) return;
    const { data, error } = await sb.rpc("create_group", { p_name: name });
    if (error) return toast(error.message);
    go(`/group/${data}`);
  };
}

/* ───────────── join ───────────── */
async function joinGroup(code) {
  const { data, error } = await sb.rpc("join_group", { p_code: code });
  if (error) throw error;
  toast("You joined the group");
  location.replace(`#/group/${data}`);
}

/* ───────────── group ───────────── */
async function renderGroup(id) {
  const [{ data: group, error }, { data: members }, { data: events }] = await Promise.all([
    sb.from("groups").select("*").eq("id", id).maybeSingle(),
    sb.from("group_members").select("user_id, role, profiles(display_name)").eq("group_id", id),
    sb.from("events").select("id, title, dates, start_minute, end_minute, created_at").eq("group_id", id).order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  if (!group) throw new Error("This group doesn't exist, or you're not a member. Ask for an invite link.");
  const isOwner = group.owner_id === session.user.id;
  const invite = `${appUrl()}#/join/${group.invite_code}`;

  const view = shell(`
    <div class="page-head">
      <div style="min-width:0">
        <div class="crumb"><a href="#/">Dashboard</a> / Group</div>
        <div id="title-slot"></div>
      </div>
      <div class="row" style="flex:none">
        <button class="btn" id="copy-invite">Copy invite link</button>
        <a class="btn btn-violet" href="#/group/${id}/new">+ New event</a>
      </div>
    </div>
    <div class="layout-side">
      <section class="card">
        <div class="card-head"><h2>Events</h2><span class="badge gray">${events.length}</span></div>
        <div class="list">
          ${events.length ? events.map((e) => {
            const ds = [...e.dates].sort();
            return `<a class="list-item" href="#/event/${e.id}"><span class="dot-icon"></span>
              <div class="grow"><div class="title">${esc(e.title)}</div>
              <div class="muted small">${esc(fmtDate(ds[0], { month: "short", day: "numeric" }))}${ds.length > 1 ? ` – ${esc(fmtDate(ds[ds.length - 1], { month: "short", day: "numeric" }))}` : ""} · ${fmtTime(e.start_minute)}–${fmtTime(e.end_minute)} ET</div></div>
              <span class="muted">›</span></a>`;
          }).join("") : `<div class="empty">No events yet. Click “New event” to find a time.</div>`}
        </div>
      </section>
      <aside>
        <section class="card">
          <div class="card-head"><h2>Members</h2><span class="badge gray">${members.length}</span></div>
          <div class="list">
            ${members.map((m) => `<div class="list-item"><span class="avatar">${esc(initials(m.profiles?.display_name))}</span>
              <div class="grow title">${esc(m.profiles?.display_name || "Member")}${m.user_id === session.user.id ? ` <span class="muted small">(you)</span>` : ""}</div>
              ${m.role === "owner" ? `<span class="badge">Owner</span>` : ""}</div>`).join("")}
          </div>
        </section>
        <section class="card">
          <h2 style="margin-bottom:8px">Invite people</h2>
          <p class="muted small" style="margin:0 0 10px">Anyone with this link can sign in and join the group.</p>
          <input readonly value="${esc(invite)}" onclick="this.select()">
          <div style="margin-top:14px">${isOwner
            ? `<button class="btn btn-danger btn-sm" id="delete-group">Delete group</button>`
            : `<button class="btn btn-danger btn-sm" id="leave-group">Leave group</button>`}</div>
        </section>
      </aside>
    </div>`);

  // Group name, with rename for the owner
  const slot = view.querySelector("#title-slot");
  const showTitle = () => {
    slot.innerHTML = isOwner
      ? `<div class="title-edit"><h1><button class="title-btn" id="title-btn" title="Click to rename">${esc(group.name)}</button></h1>
          <button class="btn btn-ghost btn-sm" id="rename">✎ Rename</button></div>`
      : `<h1>${esc(group.name)}</h1>`;
    if (!isOwner) return;
    slot.querySelector("#rename").onclick = slot.querySelector("#title-btn").onclick = editTitle;
  };
  const editTitle = () => {
    slot.innerHTML = `<form class="title-edit" id="rename-form"><input name="name" maxlength="80" value="${esc(group.name)}" required>
      <button class="btn btn-primary btn-sm" type="submit">Save</button><button class="btn btn-ghost btn-sm" type="button" id="cancel">Cancel</button></form>`;
    const form = slot.querySelector("#rename-form"), input = form.name;
    input.focus(); input.select();
    form.querySelector("#cancel").onclick = showTitle;
    input.onkeydown = (e) => { if (e.key === "Escape") showTitle(); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name || name === group.name) return showTitle();
      const { error } = await sb.from("groups").update({ name }).eq("id", id);
      if (error) return toast(error.message);
      group.name = name; showTitle(); toast("Group renamed");
    };
  };
  showTitle();

  view.querySelector("#copy-invite").onclick = () => copy(invite, "Invite link copied");
  const del = view.querySelector("#delete-group");
  if (del) del.onclick = async () => {
    if (!confirm(`Delete “${group.name}” and all its events? This can't be undone.`)) return;
    const { error } = await sb.from("groups").delete().eq("id", id);
    if (error) return toast(error.message);
    go("/");
  };
  const leave = view.querySelector("#leave-group");
  if (leave) leave.onclick = async () => {
    if (!confirm(`Leave “${group.name}”?`)) return;
    const { error } = await sb.from("group_members").delete().eq("group_id", id).eq("user_id", session.user.id);
    if (error) return toast(error.message);
    go("/");
  };
}

/* ───────────── new event ───────────── */
async function renderNewEvent(groupId) {
  const { data: group } = await sb.from("groups").select("id, name").eq("id", groupId).maybeSingle();
  if (!group) throw new Error("Group not found.");
  const today = todayNY();
  const selected = new Set();
  let [cy, cm] = today.split("-").map(Number); cm -= 1;

  const timeOpts = (sel) => Array.from({ length: 49 }, (_, i) => i * 30)
    .map((m) => `<option value="${m}" ${m === sel ? "selected" : ""}>${m === 1440 ? "12 AM (midnight)" : fmtTime(m)}</option>`).join("");

  const view = shell(`
    <div class="page-head"><div>
      <div class="crumb"><a href="#/">Dashboard</a> / <a href="#/group/${groupId}">${esc(group.name)}</a> / New event</div>
      <h1>New event</h1></div></div>
    <form id="ev-form" class="grid-2">
      <section class="card">
        <div class="card-head"><h2>Details</h2></div>
        <div class="field"><label>Event name</label><input name="title" required maxlength="120" placeholder="PRISM weekly meeting"></div>
        <div class="row">
          <div class="field"><label>No earlier than</label><select name="start">${timeOpts(540)}</select></div>
          <div class="field"><label>No later than</label><select name="end">${timeOpts(1020)}</select></div>
        </div>
        <div class="field"><label>Slot size</label><select name="slot">
          <option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 hour</option></select></div>
        <p class="muted small">🕒 All times are New York time (ET). Everyone sees the same times, wherever they are.</p>
        <p class="error" id="ev-error"></p>
        <button class="btn btn-violet btn-lg" type="submit">Create event</button>
      </section>
      <section class="card">
        <div class="card-head"><h2>Dates</h2><span class="badge" id="date-count">0 selected</span></div>
        <div class="cal" id="cal"></div>
        <p class="muted small" style="margin:12px 0 0">Click or drag to pick dates (up to 31).</p>
      </section>
    </form>`);

  const cal = view.querySelector("#cal");
  let dragging = false, dragAdd = true;
  const drawCal = () => {
    const first = new Date(Date.UTC(cy, cm, 1));
    const days = new Date(Date.UTC(cy, cm + 1, 0)).getUTCDate();
    const lead = first.getUTCDay();
    let cells = "";
    for (let i = 0; i < lead; i++) cells += `<div class="cal-day blank"></div>`;
    for (let d = 1; d <= days; d++) {
      const ds = `${cy}-${String(cm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells += `<div class="cal-day ${selected.has(ds) ? "sel" : ""} ${ds < today ? "past" : ""} ${ds === today ? "today" : ""}" data-d="${ds}">${d}</div>`;
    }
    cal.innerHTML = `<div class="cal-head"><button type="button" class="btn btn-sm" id="prev">‹</button>
      <span>${first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
      <button type="button" class="btn btn-sm" id="next">›</button></div>
      <div class="cal-grid">${["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((d) => `<div class="cal-dow">${d}</div>`).join("")}${cells}</div>`;
    cal.querySelector("#prev").onclick = () => { if (--cm < 0) { cm = 11; cy--; } drawCal(); };
    cal.querySelector("#next").onclick = () => { if (++cm > 11) { cm = 0; cy++; } drawCal(); };
    view.querySelector("#date-count").textContent = `${selected.size} selected`;
  };
  const applyDay = (el) => {
    const d = el?.dataset?.d;
    if (!d || d < today) return;
    if (dragAdd) { if (selected.size < 31) selected.add(d); } else selected.delete(d);
    el.classList.toggle("sel", selected.has(d));
    view.querySelector("#date-count").textContent = `${selected.size} selected`;
  };
  cal.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(".cal-day[data-d]");
    if (!el) return;
    e.preventDefault();
    dragging = true; dragAdd = !selected.has(el.dataset.d); applyDay(el);
  });
  const onMove = (e) => { if (dragging) applyDay(document.elementFromPoint(e.clientX, e.clientY)?.closest(".cal-day[data-d]")); };
  const onUp = () => { dragging = false; };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  cleanups.push(() => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); });
  drawCal();

  view.querySelector("#ev-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const err = view.querySelector("#ev-error");
    const start = +f.get("start"), end = +f.get("end"), slot = +f.get("slot");
    if (!selected.size) return (err.textContent = "Pick at least one date.");
    if (end <= start) return (err.textContent = "The end time must be after the start time.");
    if ((end - start) % slot) return (err.textContent = "The time range must divide evenly into slots.");
    const { data, error } = await sb.from("events").insert({
      group_id: groupId, title: f.get("title").trim(), dates: [...selected].sort(),
      start_minute: start, end_minute: end, slot_minutes: slot, created_by: session.user.id,
    }).select("id").single();
    if (error) return (err.textContent = error.message);
    go(`/event/${data.id}`);
  };
}

/* ───────────── event ───────────── */
async function renderEvent(id) {
  const { data: ev, error } = await sb.from("events").select("*, groups(id, name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!ev) throw new Error("This event doesn't exist, or you're not in its group. Ask for the group's invite link.");

  const [{ data: members }, { data: rows }] = await Promise.all([
    sb.from("group_members").select("user_id, profiles(display_name)").eq("group_id", ev.group_id),
    sb.from("availability").select("user_id, slots").eq("event_id", id),
  ]);
  const me = session.user.id;
  const names = new Map(members.map((m) => [m.user_id, m.profiles?.display_name || "Member"]));
  const dates = [...ev.dates].sort();
  const times = [];
  for (let t = ev.start_minute; t < ev.end_minute; t += ev.slot_minutes) times.push(t);

  const others = new Map(); // userId → Set
  let mine = new Set();
  const loadRows = (rs) => {
    others.clear();
    for (const r of rs) {
      if (r.user_id === me) continue;
      others.set(r.user_id, new Set(r.slots));
    }
  };
  loadRows(rows);
  mine = new Set(rows.find((r) => r.user_id === me)?.slots || []);
  const responded = () => {
    const s = new Set([...others.keys()].filter((u) => others.get(u).size));
    if (mine.size) s.add(me);
    return s;
  };
  const allAvail = () => { const m = new Map(others); m.set(me, mine); return m; };

  const shareUrl = `${appUrl()}#/event/${id}`;
  const durOpts = [30, 60, 90, 120, 180].filter((d) => d >= ev.slot_minutes && d <= ev.end_minute - ev.start_minute);
  if (!durOpts.length) durOpts.push(ev.slot_minutes);
  const defaultDur = durOpts.includes(60) ? 60 : durOpts[0];

  const view = shell(`
    <div class="page-head">
      <div style="min-width:0">
        <div class="crumb"><a href="#/">Dashboard</a> / <a href="#/group/${ev.group_id}">${esc(ev.groups?.name)}</a> / Event</div>
        <h1>${esc(ev.title)}</h1>
        <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
          <span class="badge">🕒 New York time (ET)</span>
          <span class="save-status" id="save-status"><span class="dot"></span><span>All changes saved</span></span>
        </div>
      </div>
      <div class="row" style="flex:none">
        <button class="btn" id="share">Copy event link</button>
        ${ev.created_by === me ? `<button class="btn btn-danger" id="del-ev">Delete</button>` : ""}
      </div>
    </div>
    <div class="layout-side">
      <div>
        <div class="grid-2">
          <section class="card">
            <div class="card-head"><div><h2>Your availability</h2><div class="muted small">Click and drag. Saves automatically.</div></div>
              <button class="btn btn-ghost btn-sm" id="clear">Clear</button></div>
            <div class="tgrid-wrap"><div class="tgrid mine" id="mine-grid"></div></div>
          </section>
          <section class="card">
            <div class="card-head"><div><h2>Group availability</h2><div class="muted small" id="resp-count"></div></div></div>
            <div class="tgrid-wrap"><div class="tgrid heat" id="heat-grid"></div></div>
            <div class="legend"><span id="leg-min">0/0</span><div class="legend-bar"></div><span id="leg-max">0/0</span></div>
          </section>
        </div>
      </div>
      <aside>
        <section class="card">
          <div class="card-head"><h2>✨ Best times</h2>
            <select id="dur" style="width:auto;height:28px;font-size:12px">${durOpts.map((d) => `<option value="${d}" ${d === defaultDur ? "selected" : ""}>${d < 60 ? d + " min" : d / 60 + (d === 60 ? " hour" : " hours")}</option>`).join("")}</select>
          </div>
          <div id="recs"></div>
        </section>
        <section class="card">
          <div class="card-head"><h2 id="detail-title">Who's free</h2></div>
          <div class="people-list" id="detail"><span class="muted">Hover over a time in the group grid to see who's free.</span></div>
        </section>
      </aside>
    </div>`);

  view.querySelector("#share").onclick = () => copy(shareUrl);
  const delBtn = view.querySelector("#del-ev");
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm("Delete this event for everyone?")) return;
    const { error } = await sb.from("events").delete().eq("id", id);
    if (error) return toast(error.message);
    go(`/group/${ev.group_id}`);
  };

  /* grid markup shared by both grids */
  const gridHtml = (kind) => {
    let h = `<div></div>` + dates.map((d) => {
      const [wd, md] = [fmtDate(d, { weekday: "short" }), fmtDate(d, { month: "short", day: "numeric" })];
      return `<div class="dh">${wd}<b>${md}</b></div>`;
    }).join("");
    times.forEach((t, ti) => {
      h += `<div class="tl">${t % 60 === 0 ? fmtTime(t) : ""}</div>`;
      dates.forEach((d, di) => {
        const cls = ["cell", t % 60 === 0 ? "hour" : "", di === dates.length - 1 ? "lastcol" : "", ti === times.length - 1 ? "lastrow" : ""].join(" ");
        h += `<div class="${cls}" data-k="${slotKey(d, t)}" data-d="${di}" data-t="${ti}"></div>`;
      });
    });
    return h;
  };
  const cols = `56px repeat(${dates.length}, minmax(44px, 1fr))`;
  const mineGrid = view.querySelector("#mine-grid");
  const heatGrid = view.querySelector("#heat-grid");
  mineGrid.style.gridTemplateColumns = heatGrid.style.gridTemplateColumns = cols;
  mineGrid.innerHTML = gridHtml("mine");
  heatGrid.innerHTML = gridHtml("heat");
  const mineCells = [...mineGrid.querySelectorAll(".cell")];
  const heatCells = [...heatGrid.querySelectorAll(".cell")];
  const heatByKey = new Map(heatCells.map((c) => [c.dataset.k, c]));

  const paintMine = () => mineCells.forEach((c) => c.classList.toggle("on", mine.has(c.dataset.k)));

  let highlighted = null;
  const paintHeat = () => {
    const avail = allAvail();
    const total = Math.max(members.length, 1);
    let max = 0;
    const counts = new Map();
    for (const c of heatCells) {
      let n = 0;
      for (const set of avail.values()) if (set.has(c.dataset.k)) n++;
      counts.set(c.dataset.k, n);
      if (n > max) max = n;
    }
    for (const c of heatCells) {
      const n = counts.get(c.dataset.k);
      c.style.setProperty("--a", n ? (0.15 + 0.85 * (n / total)).toFixed(3) : 0);
    }
    view.querySelector("#leg-min").textContent = `0/${total}`;
    view.querySelector("#leg-max").textContent = `${total}/${total} free`;
    const r = responded();
    const waiting = members.filter((m) => !r.has(m.user_id)).map((m) => names.get(m.user_id));
    view.querySelector("#resp-count").textContent =
      `${r.size} of ${members.length} responded` + (waiting.length ? ` · waiting on ${waiting.slice(0, 3).join(", ")}${waiting.length > 3 ? "…" : ""}` : "");
  };

  /* best times */
  const recsEl = view.querySelector("#recs");
  const durSel = view.querySelector("#dur");
  const paintRecs = () => {
    const avail = new Map([...allAvail()].filter(([, s]) => s.size));
    const recs = recommend({
      dates, startMin: ev.start_minute, endMin: ev.end_minute, slotMin: ev.slot_minutes,
      durationMin: +durSel.value, avail, limit: 5,
    });
    if (!recs.length) {
      recsEl.innerHTML = `<div class="empty">No overlap yet. Once people fill in their times, the best options show up here.</div>`;
      return;
    }
    const total = members.length;
    recsEl.innerHTML = recs.map((r, i) => {
      const missing = members.map((m) => m.user_id).filter((u) => !r.people.includes(u)).map((u) => names.get(u));
      return `<div class="rec" data-i="${i}">
        <span class="rank badge ${r.people.length === total ? "green" : "gray"}">${r.people.length === total ? "Everyone" : `${r.people.length}/${total}`}</span>
        <div class="when">${esc(fmtDate(r.date))}</div>
        <div>${fmtTime(r.start)} – ${fmtTime(r.end)} <span class="muted small">ET</span></div>
        <div class="who">${missing.length ? `Can't make it: ${esc(missing.join(", "))}` : "Everyone in the group is free 🎉"}</div>
      </div>`;
    }).join("");
    recsEl.querySelectorAll(".rec").forEach((el) => {
      el.onclick = () => {
        const r = recs[+el.dataset.i];
        const already = el.classList.contains("active");
        recsEl.querySelectorAll(".rec").forEach((x) => x.classList.remove("active"));
        heatCells.forEach((c) => c.classList.remove("hl"));
        highlighted = null;
        if (already) return;
        el.classList.add("active");
        highlighted = r;
        for (let t = r.start; t < r.end; t += ev.slot_minutes) heatByKey.get(slotKey(r.date, t))?.classList.add("hl");
      };
    });
  };
  durSel.onchange = paintRecs;

  /* who's free (hover / tap on the group grid) */
  const detail = view.querySelector("#detail");
  const detailTitle = view.querySelector("#detail-title");
  let hoverCell = null;
  const showDetail = (cell) => {
    if (hoverCell) hoverCell.classList.remove("hover");
    hoverCell = cell;
    if (!cell) return;
    cell.classList.add("hover");
    const k = cell.dataset.k;
    const [d, t] = k.split("_");
    const avail = allAvail();
    const free = members.filter((m) => avail.get(m.user_id)?.has(k)).map((m) => names.get(m.user_id));
    const busy = members.filter((m) => !avail.get(m.user_id)?.has(k)).map((m) => names.get(m.user_id));
    detailTitle.textContent = `${fmtDate(d)} · ${fmtTime(+t)}`;
    detail.innerHTML = `<div class="k" style="margin-top:0">Free (${free.length}/${members.length})</div>
      <div>${free.length ? esc(free.join(", ")) : `<span class="muted">Nobody</span>`}</div>
      <div class="k">Not free</div><div class="muted">${busy.length ? esc(busy.join(", ")) : "—"}</div>`;
  };
  heatGrid.addEventListener("pointerover", (e) => { const c = e.target.closest(".cell"); if (c) showDetail(c); });
  heatGrid.addEventListener("pointerdown", (e) => { const c = e.target.closest(".cell"); if (c) showDetail(c); });

  const refreshAll = () => { paintHeat(); paintRecs(); if (hoverCell) showDetail(hoverCell); };

  /* autosave */
  const status = view.querySelector("#save-status");
  const setStatus = (state, text) => { status.className = "save-status " + state; status.lastElementChild.textContent = text; };
  let saveTimer = null, saving = false, dirty = false;
  const save = async () => {
    if (saving) { dirty = true; return; }
    saving = true; dirty = false;
    setStatus("saving", "Saving…");
    const { error } = await sb.from("availability").upsert(
      { event_id: id, user_id: me, slots: [...mine], updated_at: new Date().toISOString() },
      { onConflict: "event_id,user_id" }
    );
    saving = false;
    if (error) {
      setStatus("error", "Couldn't save. Retrying…");
      saveTimer = setTimeout(save, 3000);
      return;
    }
    if (dirty) return save();
    setStatus("", "All changes saved");
  };
  const scheduleSave = () => {
    setStatus("saving", "Unsaved changes…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  };
  const beforeUnload = (e) => { if (saving || dirty || status.classList.contains("saving")) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", beforeUnload);
  cleanups.push(() => {
    window.removeEventListener("beforeunload", beforeUnload);
    if (status.classList.contains("saving") && !saving) { clearTimeout(saveTimer); save(); } // flush on navigate
  });

  /* drag-to-select (rectangle, like When2meet) */
  let drag = null; // { d0, t0, add, base }
  const applyRect = (d1, t1) => {
    const next = new Set(drag.base);
    const [dl, dh] = [Math.min(drag.d0, d1), Math.max(drag.d0, d1)];
    const [tl, th] = [Math.min(drag.t0, t1), Math.max(drag.t0, t1)];
    for (let di = dl; di <= dh; di++) for (let ti = tl; ti <= th; ti++) {
      const k = slotKey(dates[di], times[ti]);
      drag.add ? next.add(k) : next.delete(k);
    }
    mine = next;
    paintMine();
    paintHeat();
  };
  mineGrid.addEventListener("pointerdown", (e) => {
    const c = e.target.closest(".cell");
    if (!c) return;
    e.preventDefault();
    drag = { d0: +c.dataset.d, t0: +c.dataset.t, add: !mine.has(c.dataset.k), base: new Set(mine) };
    applyRect(drag.d0, drag.t0);
  });
  const onMove = (e) => {
    if (!drag) return;
    const c = document.elementFromPoint(e.clientX, e.clientY)?.closest("#mine-grid .cell");
    if (c) applyRect(+c.dataset.d, +c.dataset.t);
  };
  const onUp = () => {
    if (!drag) return;
    drag = null;
    paintRecs();
    scheduleSave();
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
  cleanups.push(() => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
  });

  view.querySelector("#clear").onclick = () => {
    if (!mine.size) return;
    mine = new Set(); paintMine(); refreshAll(); scheduleSave();
  };

  /* live updates from other people */
  const channel = sb.channel(`avail-${id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "availability", filter: `event_id=eq.${id}` }, async () => {
      const { data } = await sb.from("availability").select("user_id, slots").eq("event_id", id);
      if (data) { loadRows(data); refreshAll(); }
    })
    .subscribe();
  cleanups.push(() => sb.removeChannel(channel));

  paintMine();
  refreshAll();
}

/* ───────────── start ───────────── */
if (SUPABASE_URL.includes("YOUR-PROJECT")) {
  app.innerHTML = `<div class="auth-screen"><div class="aurora"></div><div class="auth-card"><div class="auth-head"><img class="auth-mark" src="logo.png" alt="FIT">
    <div><h1>Almost there</h1><p>Add your Supabase URL and anon key to <code>config.js</code>, then reload.</p></div></div></div></div>`;
} else {
  const { data } = await sb.auth.getSession();
  session = data.session;
  await loadProfile();
  sb.auth.onAuthStateChange((event, s) => {
    const changed = (s?.user?.id || null) !== (session?.user?.id || null);
    session = s;
    // Supabase advises against awaiting its own calls inside this callback, so defer.
    if (changed) setTimeout(async () => { await loadProfile(); route(); }, 0);
  });
  window.addEventListener("hashchange", route);
  route();
}
