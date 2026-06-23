"use strict";

// TokeerDRM — Millennium v3 frontend
// Game properties dialog lives in a popup window (separate document from the
// main SharedJSContext), so we use AddWindowCreateHook + g_PopupManager to
// reach it — same technique as game-engine-info / hltb-for-millennium.

const PLUGIN_NAME = "TokeerDRM";

// ── Backend bridge ────────────────────────────────────────────────────────────

async function callBackend(method, kwargs) {
    if (!window.Millennium || typeof window.Millennium.callServerMethod !== "function") {
        return { success: false, error: "Millennium backend bridge unavailable" };
    }
    try {
        const response = await window.Millennium.callServerMethod(PLUGIN_NAME, method, kwargs || {});
        const raw = typeof response === "string"
            ? response
            : (typeof response?.returnValue === "string" ? response.returnValue : null);
        if (!raw) return { success: false, error: "No response from backend" };
        return JSON.parse(raw);
    } catch (e) {
        return { success: false, error: String(e?.message || e) };
    }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CSS = `
.tdrm-tab-btn {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #8f98a0;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    user-select: none;
}
.tdrm-tab-btn:hover { color: #c6d4df; }
.tdrm-tab-btn.tdrm-active {
    color: #67c1f5;
    border-bottom-color: #67c1f5;
}

.tdrm-panel {
    display: none;
    padding: 32px 36px;
    color: #c7d5e0;
    font-family: "Motiva Sans", "Segoe UI", Arial, sans-serif;
    font-size: 13px;
    overflow-y: auto;
    background:
        radial-gradient(1200px 400px at 100% -10%, rgba(48,131,235,0.10), transparent 60%),
        linear-gradient(180deg, #1b2838 0%, #16202d 100%);
}
.tdrm-panel.tdrm-visible { display: block; animation: tdrm-fade .22s ease; }
@keyframes tdrm-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.tdrm-header { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.tdrm-logo {
    width: 34px; height: 34px; border-radius: 9px; flex: 0 0 auto;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #2a9fff, #1564d6);
    box-shadow: 0 4px 14px rgba(33,124,235,0.45);
    font-weight: 800; font-size: 17px; color: #fff;
}
.tdrm-title { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: .2px; }
.tdrm-subtitle { color: #7a8a99; font-size: 12px; margin: 2px 0 26px 46px; }
.tdrm-engine { background: linear-gradient(135deg, rgba(42,159,255,.12), rgba(111,123,255,.10)); border: 1px solid rgba(120,160,220,.28); border-radius: 12px; padding: 12px 14px; margin: 0 0 18px; }
.tdrm-engine-row { display: flex; align-items: center; gap: 11px; }
.tdrm-engine-ic { font-size: 18px; flex: 0 0 auto; }
.tdrm-engine-text { flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tdrm-engine-text strong { color: #fff; font-size: 13px; }
.tdrm-engine-text span { color: #8696a6; font-size: 11.5px; line-height: 1.4; }
.tdrm-engine .tdrm-btn { flex: 0 0 auto; padding: 8px 14px; font-size: 12px; }

.tdrm-card {
    background: rgba(42,57,73,0.45);
    border: 1px solid rgba(120,160,200,0.12);
    border-radius: 12px;
    padding: 20px 22px;
    margin-bottom: 18px;
    backdrop-filter: blur(2px);
}
.tdrm-card-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 700; color: #dbe6f0; margin-bottom: 4px;
}
.tdrm-card-desc { color: #8696a6; font-size: 12px; margin-bottom: 16px; line-height: 1.5; }

.tdrm-row { display: flex; gap: 10px; align-items: center; }
.tdrm-input {
    flex: 1 1 auto;
    max-width: 220px;
    padding: 11px 14px;
    background: #0e1722;
    border: 1px solid #2f4254;
    border-radius: 9px;
    color: #fff;
    font-size: 20px;
    font-family: "Consolas", "Motiva Sans", monospace;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    outline: none;
    transition: border-color .15s, box-shadow .15s;
}
.tdrm-input::placeholder { color: #3f5061; letter-spacing: 0.34em; }
.tdrm-input:focus { border-color: #2a9fff; box-shadow: 0 0 0 3px rgba(42,159,255,0.18); }

.tdrm-field-row { display: flex; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.tdrm-field { display: flex; flex-direction: column; gap: 7px; }
.tdrm-label {
    font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: #7a8a99;
}
.tdrm-input-sm, .tdrm-select {
    padding: 10px 13px;
    background: #0e1722;
    border: 1px solid #2f4254;
    border-radius: 9px;
    color: #fff;
    font-size: 14px;
    font-family: "Motiva Sans", sans-serif;
    outline: none;
    transition: border-color .15s, box-shadow .15s;
}
.tdrm-input-sm { width: 180px; font-family: "Consolas", monospace; letter-spacing: .04em; }
.tdrm-input-sm::placeholder { color: #3f5061; }
.tdrm-input-sm:focus, .tdrm-select:focus { border-color: #2a9fff; box-shadow: 0 0 0 3px rgba(42,159,255,0.18); }
.tdrm-select { width: 130px; cursor: pointer; }
.tdrm-select option { background: #0e1722; color: #fff; }

.tdrm-btn {
    padding: 11px 22px;
    background: linear-gradient(180deg, #2fa8ff 0%, #1a86f0 100%);
    border: none;
    border-radius: 9px;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: filter .15s, transform .05s, box-shadow .15s;
    box-shadow: 0 4px 14px rgba(26,134,240,0.32);
}
.tdrm-btn:hover { filter: brightness(1.08); box-shadow: 0 6px 18px rgba(26,134,240,0.45); }
.tdrm-btn:active { transform: translateY(1px); }
.tdrm-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; box-shadow: none; }
.tdrm-btn-ghost {
    background: transparent;
    border: 1px solid #34495c;
    color: #b3c2d1;
    box-shadow: none;
}
.tdrm-btn-ghost:hover { border-color: #2a9fff; color: #fff; background: rgba(42,159,255,0.08); box-shadow: none; }

.tdrm-status { margin-top: 14px; font-size: 12px; min-height: 18px; display: flex; align-items: center; gap: 7px; line-height: 1.4; }
.tdrm-status:empty { margin-top: 0; min-height: 0; }
.tdrm-status.ok  { color: #6fe3a0; }
.tdrm-status.err { color: #ff7a7a; }
.tdrm-status.busy { color: #9fb3c6; }
.tdrm-spin {
    width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid rgba(159,179,198,0.3); border-top-color: #2a9fff;
    animation: tdrm-rot .7s linear infinite; flex: 0 0 auto;
}
@keyframes tdrm-rot { to { transform: rotate(360deg); } }

.tdrm-code-display {
    display: inline-flex; align-items: center; gap: 14px;
    padding: 14px 24px;
    background: linear-gradient(135deg, rgba(42,159,255,0.14), rgba(20,100,214,0.06));
    border: 1px solid rgba(42,159,255,0.4);
    border-radius: 12px;
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0.28em;
    color: #8fd0ff;
    font-family: "Consolas", monospace;
    margin: 16px 0 6px;
    text-shadow: 0 0 18px rgba(42,159,255,0.5);
}
.tdrm-copy {
    font-family: "Motiva Sans", sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: .05em; text-transform: uppercase;
    color: #9fc6ef; cursor: pointer; padding: 5px 11px; border-radius: 7px;
    border: 1px solid rgba(42,159,255,0.4); background: rgba(42,159,255,0.08);
    transition: background .15s;
}
.tdrm-copy:hover { background: rgba(42,159,255,0.2); color: #fff; }
.tdrm-hint { color: #5f7283; font-size: 11px; margin-top: 8px; line-height: 1.5; }
`;

// ── Panel HTML ────────────────────────────────────────────────────────────────

function buildPanel(appId, doc) {
    const panel = doc.createElement("div");
    panel.className = "tdrm-panel";
    panel.setAttribute("data-tdrm-appid", String(appId));
    panel.innerHTML = `
<div class="tdrm-header">
  <div class="tdrm-logo">T</div>
  <div class="tdrm-title">TokeerDRM</div>
</div>
<div class="tdrm-subtitle">Apply activation tickets directly from Steam — no launcher needed.</div>

<div class="tdrm-engine" id="tdrm-engine" style="display:none">
  <div class="tdrm-engine-row">
    <span class="tdrm-engine-ic">⚙</span>
    <div class="tdrm-engine-text">
      <strong>One-time setup: OpenSteamTool</strong>
      <span id="tdrm-engine-msg">Denuvo codes need OpenSteamTool active in Steam. Install it once — your games stay put.</span>
    </div>
    <button class="tdrm-btn" id="tdrm-engine-btn">Set it up</button>
  </div>
</div>

<div class="tdrm-card">
  <div class="tdrm-card-title">🔑 Activate with a code</div>
  <div class="tdrm-card-desc">Enter the 6-character code you received, then launch the game normally from Steam.</div>
  <div class="tdrm-row">
    <input  class="tdrm-input" id="tdrm-code-input" maxlength="6" placeholder="——————" spellcheck="false" autocomplete="off" />
    <button class="tdrm-btn"   id="tdrm-apply-btn">Apply</button>
  </div>
  <div class="tdrm-status" id="tdrm-redeem-status"></div>
</div>

<div class="tdrm-card">
  <div class="tdrm-card-title">📤 Generate a code to share</div>
  <div class="tdrm-card-desc">Enter the game's Steam AppID. A ticket is minted from your signed-in Steam account on the spot — no install or launch needed. Codes are <strong>single-use</strong> and expire in <strong>30 minutes</strong>, so share right before the recipient launches.</div>
  <div class="tdrm-field-row">
    <div class="tdrm-field">
      <label class="tdrm-label">App ID</label>
      <input class="tdrm-input-sm" id="tdrm-gen-appid" inputmode="numeric" placeholder="e.g. 2622380" spellcheck="false" autocomplete="off" />
    </div>
  </div>
  <button class="tdrm-btn" id="tdrm-gen-btn">Generate Code</button>
  <div id="tdrm-gen-output"></div>
  <div class="tdrm-status" id="tdrm-gen-status"></div>
</div>
`;
    return panel;
}

// ── Wire panel events ─────────────────────────────────────────────────────────

function wirePanel(panel, appId) {
    const doc          = panel.ownerDocument || document;
    const codeInput    = panel.querySelector("#tdrm-code-input");
    const applyBtn     = panel.querySelector("#tdrm-apply-btn");
    const redeemStatus = panel.querySelector("#tdrm-redeem-status");
    const genBtn       = panel.querySelector("#tdrm-gen-btn");
    const genOutput    = panel.querySelector("#tdrm-gen-output");
    const genStatus    = panel.querySelector("#tdrm-gen-status");
    const genAppid     = panel.querySelector("#tdrm-gen-appid");

    // Engine check — runs ONCE when this panel opens (not during redeem/generate).
    const engineBox = panel.querySelector("#tdrm-engine");
    const engineBtn = panel.querySelector("#tdrm-engine-btn");
    const engineMsg = panel.querySelector("#tdrm-engine-msg");
    if (applyBtn) applyBtn.disabled = true;  // locked until the engine is confirmed present
    (async () => {
        try {
            const es = await callBackend("EngineStatus", {});
            if (es && es.ready) {
                if (applyBtn) applyBtn.disabled = false;          // engine present + configured → allow redeem
            } else {
                if (engineBox) engineBox.style.display = "block"; // not ready → keep redeem locked
                if (es && es.installed && engineMsg) {
                    engineMsg.textContent = "Finish OpenSteamTool setup so it reads your library.";
                }
                if (applyBtn) applyBtn.title = "Set up OpenSteamTool first";
            }
        } catch (_) {
            if (applyBtn) applyBtn.disabled = false;              // detection failed → don't lock out
        }
    })();
    if (engineBtn) engineBtn.addEventListener("click", async () => {
        engineBtn.disabled = true;
        engineMsg.textContent = "Approve the Windows prompt. Steam will restart, then redeem your code.";
        try {
            const r = await callBackend("InstallEngine", {});
            engineMsg.textContent = (r && r.message) || "Setup launched.";
            // Re-check the engine instead of leaving the button greyed forever. A
            // config-only setup (OST already active) doesn't restart Steam, so the panel
            // stays — poll until it's ready and unlock redeem. (A full install restarts
            // Steam → the panel reloads fresh, so this loop simply ends with it.)
            let tries = 0;
            const poll = async () => {
                tries++;
                try {
                    const es = await callBackend("EngineStatus", {});
                    if (es && es.ready) {
                        if (engineBox) engineBox.style.display = "none";
                        if (applyBtn) { applyBtn.disabled = false; applyBtn.title = ""; }
                        engineMsg.textContent = "OpenSteamTool ready — redeem your code.";
                        return;
                    }
                } catch (_) { /* keep trying */ }
                if (tries < 20) { setTimeout(poll, 3000); return; }   // ~60s
                // Didn't come ready - most often Windows Defender (Tamper Protection)
                // blocking the PUA-flagged OST. Point them at LuaTools' unflagged build.
                if (engineMsg) engineMsg.textContent = "If setup failed (often Windows Defender), install OpenSteamTools via LuaTools - Mode > Switch to OpenSteamTools (lua.tools) - then redeem here.";
                if (engineBtn) engineBtn.disabled = false;             // allow a retry
            };
            setTimeout(poll, 4000);
        } catch (e) {
            engineMsg.textContent = "Setup couldn't start: " + e;
            engineBtn.disabled = false;
        }
    });

    // Force-update: if this build is outdated, replace the panel with an update card.
    (async () => {
        try {
            const v = await callBackend("VersionInfo", {});
            if (v && v.update_required) {
                panel.innerHTML = `
<div class="tdrm-header"><div class="tdrm-logo">T</div><div class="tdrm-title">TokeerDRM</div></div>
<div class="tdrm-card" style="text-align:center">
  <div class="tdrm-card-title">⬆ Update required</div>
  <div class="tdrm-card-desc">Version ${v.latest} is out — you're on ${v.current}. Update the plugin to keep using TokeerDRM.</div>
  <button class="tdrm-btn" id="tdrm-update-btn">Update now</button>
  <div class="tdrm-status" id="tdrm-update-status" style="margin-top:10px"></div>
</div>`;
                const ub = panel.querySelector("#tdrm-update-btn");
                const us = panel.querySelector("#tdrm-update-status");
                if (ub) ub.addEventListener("click", async () => {
                    ub.disabled = true;
                    if (us) { us.className = "tdrm-status busy"; us.innerHTML = `<span class="tdrm-spin"></span><span>Updating…</span>`; }
                    try {
                        // In-place update within Steam — downloads + swaps the plugin, restarts Steam.
                        const r = await callBackend("UpdatePlugin", {});
                        if (r && r.success) {
                            if (us) { us.className = "tdrm-status ok"; us.textContent = r.message || "Updating… Steam will restart."; }
                        } else {
                            if (us) { us.className = "tdrm-status err"; us.textContent = (r && r.error) || "Update failed."; }
                            // fall back to the GitHub page so they're never stuck
                            callBackend("OpenUrl", { url: v.url });
                            ub.disabled = false;
                        }
                    } catch (e) {
                        if (us) { us.className = "tdrm-status err"; us.textContent = "Update failed: " + e; }
                        ub.disabled = false;
                    }
                });
            }
        } catch (_) { /* offline → don't block */ }
    })();

    // Pre-fill the AppID field with the game this dialog belongs to (editable).
    if (genAppid && appId) genAppid.value = String(appId);
    if (genAppid) {
        genAppid.addEventListener("input", () => {
            genAppid.value = genAppid.value.replace(/[^0-9]/g, "");
        });
    }

    // status helper — supports a spinner for the "busy" state
    const setStatus = (el, kind, text) => {
        el.className = "tdrm-status " + kind;
        if (kind === "busy") {
            el.innerHTML = `<span class="tdrm-spin"></span><span></span>`;
            el.lastChild.textContent = text;
        } else {
            el.textContent = text;
        }
    };

    codeInput.addEventListener("input", () => {
        const sel = codeInput.selectionStart;
        codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        codeInput.setSelectionRange(sel, sel);
    });
    codeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") applyBtn.click();
    });

    // ── Apply (redeem) ───────────────────────────────────────────────────────
    applyBtn.addEventListener("click", async () => {
        const code = codeInput.value.trim().toUpperCase();
        if (code.length !== 6) {
            setStatus(redeemStatus, "err", "Please enter a 6-character code.");
            return;
        }
        applyBtn.disabled = true;
        setStatus(redeemStatus, "busy", "Applying ticket…");

        // Lua: RedeemCode(app_id, code) — alphabetical: app_id < code
        const result = await callBackend("RedeemCode", { app_id: String(appId), code });
        if (result.success) {
            let msg = result.message || "Ticket applied. Launch the game from Steam.";
            if (result.uses_remaining !== undefined && result.uses_remaining !== null) {
                msg += `  (${result.uses_remaining} uses left)`;
            }
            setStatus(redeemStatus, "ok", "✓ " + msg);
            codeInput.value = "";
        } else {
            setStatus(redeemStatus, "err", result.error || "Unknown error");
            // Engine isn't set up → surface the repair/setup box so they can fix it,
            // and keep redeem locked until they do (the code was NOT consumed).
            if (result.engine_fix) {
                if (engineBox) engineBox.style.display = "block";
                if (engineMsg) engineMsg.textContent = result.error || "Finish OpenSteamTool setup, then redeem.";
                if (engineBtn) engineBtn.disabled = false;
            }
        }
        applyBtn.disabled = false;
    });

    // ── Generate ─────────────────────────────────────────────────────────────
    genBtn.addEventListener("click", async () => {
        const targetAppId = (genAppid?.value || "").trim().replace(/[^0-9]/g, "");
        const maxUses     = 1; // codes are single-use (enforced server-side)

        if (!targetAppId) {
            setStatus(genStatus, "err", "Enter a Steam AppID first.");
            return;
        }

        genBtn.disabled     = true;
        genOutput.innerHTML = "";

        // Extract the real AppTicket + ETicket for this game from the signed-in
        // Steam account (extract_tickets.exe). No launch, no play status.
        setStatus(genStatus, "busy", `Reading tickets for app ${targetAppId} from your Steam account…`);
        const mint = await callBackend("MintTicket", { app_id: targetAppId });

        if (!mint.success || !mint.appticket || !mint.eticket) {
            // No ticket = the account doesn't own this game (Steam won't mint one).
            if (mint.error && /own/i.test(mint.error)) {
                setStatus(genStatus, "err",
                    `This Steam account doesn't own app ${targetAppId}, so no code can be generated.`);
            } else {
                setStatus(genStatus, "err",
                    `Couldn't read the ticket (${mint.error || "unknown"}). Make sure Steam is signed in.`);
            }
            genBtn.disabled = false;
            return;
        }

        const steamId = mint.steam_id || "0";
        setStatus(genStatus, "busy", "Creating shareable code…");

        // Lua: GenerateCode(app_id, appticket, eticket, max_uses, steam_id) — alphabetical
        const genResult = await callBackend("GenerateCode", {
            app_id:    targetAppId,
            appticket: mint.appticket,
            eticket:   mint.eticket,
            max_uses:  maxUses,
            steam_id:  steamId,
        });

        if (!genResult.success) {
            setStatus(genStatus, "err", genResult.error || "Server error");
            genBtn.disabled = false;
            return;
        }

        const code = genResult.code;
        genOutput.innerHTML = `
<div class="tdrm-code-display">
  <span>${code}</span>
  <span class="tdrm-copy" id="tdrm-copy-btn">Copy</span>
</div>`;
        const copyBtn = genOutput.querySelector("#tdrm-copy-btn");
        copyBtn.addEventListener("click", async () => {
            try {
                await (doc.defaultView || window).navigator.clipboard.writeText(code);
                copyBtn.textContent = "Copied!";
                setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
            } catch (_) {
                copyBtn.textContent = "Copy failed";
            }
        });

        setStatus(genStatus, "ok", "Single-use · expires in 30 min — share it now");
        genBtn.disabled = false;
    });
}

// ── AppID extraction ──────────────────────────────────────────────────────────

function getAppIdFromFiber(el) {
    const key = Object.keys(el).find(k =>
        k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
    );
    if (!key) return null;
    let fiber = el[key];
    let depth = 0;
    while (fiber && depth < 150) {
        const p = fiber.memoizedProps || fiber.pendingProps;
        if (p) {
            const id = p.appid || p.appId || p.nAppID || p.m_nAppID;
            if (id && +id > 0) return +id;
        }
        fiber = fiber.return;
        depth++;
    }
    return null;
}

function getAppIdFromContainer(container) {
    let el = container;
    for (let i = 0; i < 25 && el; i++) {
        try {
            const id = getAppIdFromFiber(el);
            if (id) return id;
        } catch (_) {}
        el = el.parentElement;
    }
    // Use the container's own document so we search the popup, not the main window
    const ownerDoc = container.ownerDocument || document;
    const attrEl = container.closest("[data-appid]") || ownerDoc.querySelector("[data-appid]");
    if (attrEl) return +attrEl.getAttribute("data-appid") || null;
    return null;
}

// ── Style injection (per-document) ────────────────────────────────────────────

function ensureStyles(doc) {
    if (doc.getElementById("tdrm-styles")) return;
    const tag = doc.createElement("style");
    tag.id = "tdrm-styles";
    tag.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(tag);
}

// ── Tab injection ─────────────────────────────────────────────────────────────

const INJECTED = new WeakSet();

function injectTokeerTab(tabBar, contentArea, appId) {
    if (tabBar.querySelector("[data-tdrm-tab]")) return;

    const doc = tabBar.ownerDocument || document;
    ensureStyles(doc);

    // Clone Steam's own sidebar item class so we inherit their look automatically
    const existingTab = tabBar.querySelector(":scope > *");
    const tabBtn = doc.createElement("div");
    if (existingTab) {
        tabBtn.className = existingTab.className
            .split(" ")
            .filter(c => !c.toLowerCase().includes("active"))
            .join(" ");
    }
    tabBtn.classList.add("tdrm-tab-btn");
    tabBtn.setAttribute("data-tdrm-tab", "1");
    tabBtn.textContent = "TokeerDRM";
    tabBar.appendChild(tabBtn);

    // Panel overlays the content area by filling it (inset:0) — no fragile pixel math,
    // no fighting React re-renders.
    const panel = buildPanel(appId, doc);
    wirePanel(panel, appId);

    const win = doc.defaultView || window;
    if (win.getComputedStyle(contentArea).position === "static") {
        contentArea.style.position = "relative";
    }

    panel.style.position   = "absolute";
    panel.style.top        = "0";
    panel.style.left       = "0";
    panel.style.right      = "0";
    panel.style.bottom     = "0";
    panel.style.zIndex     = "50";
    panel.style.background = "#1b2838";
    panel.style.boxSizing  = "border-box";

    contentArea.appendChild(panel);

    const showPanel = () => {
        Array.from(tabBar.children).forEach(t => {
            if (t !== tabBtn) {
                t.classList.remove("tdrm-active");
                t.className = t.className.split(" ").filter(c => !c.toLowerCase().includes("active")).join(" ");
            }
        });
        tabBtn.classList.add("tdrm-active");
        panel.classList.add("tdrm-visible");
    };

    const hidePanel = () => {
        tabBtn.classList.remove("tdrm-active");
        panel.classList.remove("tdrm-visible");
    };

    tabBtn.addEventListener("click", showPanel);
    Array.from(tabBar.children).forEach(t => {
        if (t !== tabBtn) t.addEventListener("click", hidePanel);
    });

    console.log("[TokeerDRM] Injected tab for AppID " + appId);
}

// ── Content-pane finder ───────────────────────────────────────────────────────
// The sidebar element (`el`) is the nav-item container. The actual settings
// content ("General", toggles…) lives in a separate WIDE branch of the dialog.
// Walk up from the sidebar and find the widest sibling branch that does NOT
// contain the sidebar — that's the content pane.

function findContentArea(sidebarEl) {
    const sidebarWidth = sidebarEl.getBoundingClientRect().width || 240;
    let node = sidebarEl;
    for (let up = 0; up < 6 && node; up++) {
        const parent = node.parentElement;
        if (!parent) break;
        let best = null;
        let bestWidth = 0;
        for (const child of parent.children) {
            if (child === node || child.contains(sidebarEl)) continue;
            const w = child.getBoundingClientRect().width;
            // Content pane is meaningfully wider than the sidebar
            if (w > bestWidth && w > sidebarWidth + 100) {
                best = child;
                bestWidth = w;
            }
        }
        if (best) return best;
        node = parent;
    }
    return null;
}

// ── Dialog detection ──────────────────────────────────────────────────────────

function tryInjectDialog(root) {
    if (!root || !root.querySelectorAll) return;

    for (const el of root.querySelectorAll("*")) {
        if (INJECTED.has(el)) continue;
        const children = Array.from(el.children || []);
        if (children.length < 3) continue;

        const labels = children.map(c => {
            const text = Array.from(c.childNodes)
                .filter(n => n.nodeType === 3)
                .map(n => n.textContent.trim())
                .join("") || c.textContent.trim();
            return text.toUpperCase();
        });

        const hasGeneral = labels.includes("GENERAL");
        // Matches both old Steam UI (DLC/BETAS as separate tabs) and current sidebar layout
        const hasSteamProp =
            labels.includes("DLC") ||
            labels.includes("BETAS") ||
            labels.includes("BETA") ||
            labels.includes("UPDATES") ||
            labels.includes("CONTROLLER") ||
            labels.includes("INSTALLED FILES");
        if (!hasGeneral || !hasSteamProp) continue;
        if (el.querySelector("[data-tdrm-tab]")) continue;

        const contentArea = findContentArea(el);
        if (!contentArea) {
            console.log("[TokeerDRM] Sidebar found but no content pane");
            continue;
        }

        const appId = getAppIdFromContainer(el);
        if (!appId) {
            console.log("[TokeerDRM] Sidebar found but could not extract AppID");
            continue;
        }

        INJECTED.add(el);
        injectTokeerTab(el, contentArea, appId);
        break;
    }
}

// ── Document observer (works per popup window) ────────────────────────────────

function observeDocument(doc) {
    if (!doc || !doc.body || doc.__tdrmObserving) return;
    doc.__tdrmObserving = true;

    tryInjectDialog(doc.body);

    const obs = new MutationObserver(mutations => {
        for (const mut of mutations) {
            for (const node of mut.addedNodes) {
                if (node.nodeType === 1) tryInjectDialog(node);
            }
        }
    });
    obs.observe(doc.body, { childList: true, subtree: true });
}

// ── Entry point ───────────────────────────────────────────────────────────────

function start() {
    console.log("[TokeerDRM] Plugin loaded");

    // Also observe the main document (fallback / in case dialog is here)
    observeDocument(document);

    // Hook into every popup window Steam creates — game properties is one of them
    try {
        window.Millennium?.AddWindowCreateHook?.(function(windowInfo) {
            const popup = windowInfo?.m_popup;
            if (!popup) return;
            const doc = popup.document;
            if (!doc) return;
            if (doc.readyState === "loading") {
                doc.addEventListener("DOMContentLoaded", () => observeDocument(doc), { once: true });
            } else {
                observeDocument(doc);
            }
        });
    } catch (e) {
        console.warn("[TokeerDRM] AddWindowCreateHook unavailable:", e);
    }

    // Check popup windows that are already open when the plugin loads
    try {
        const mgr = window.g_PopupManager;
        if (mgr) {
            // GetAllPopups or iterate known names
            const tryPopup = (name) => {
                try {
                    const p = mgr.GetExistingPopup?.(name);
                    if (p?.m_popup?.document) observeDocument(p.m_popup.document);
                } catch (_) {}
            };
            tryPopup("SP Desktop_uid0");
            tryPopup("SP Desktop_uid1");
            // Iterate all tracked popups if the API exposes them
            if (typeof mgr.m_mapPopups?.forEach === "function") {
                mgr.m_mapPopups.forEach(p => {
                    if (p?.m_popup?.document) observeDocument(p.m_popup.document);
                });
            }
        }
    } catch (_) {}
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
    start();
}
