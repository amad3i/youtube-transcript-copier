(function () {
  const BUTTON_ID = "yptc-copy-btn";
  let lastUrl = "";

  function waitForEl(selectors, timeout = 8000) {
    return new Promise((resolve) => {
      function find() {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el;
        }
        return null;
      }
      const found = find();
      if (found) return resolve(found);
      const observer = new MutationObserver(() => {
        const el = find();
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(find() || null); }, timeout);
    });
  }

  function findMenuRenderer() {
    return document.querySelector(
      "ytd-watch-metadata ytd-menu-renderer," +
      "#above-the-fold ytd-menu-renderer"
    );
  }

  async function addButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const menuRenderer = await waitForEl([
      "ytd-watch-metadata ytd-menu-renderer",
      "#above-the-fold ytd-menu-renderer",
    ]);

    if (!menuRenderer || document.getElementById(BUTTON_ID)) return;

    const shape = document.createElement("yt-button-shape");
    shape.setAttribute("role", "button");
    shape.setAttribute("aria-label", "Copy transcript");

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = "yptc-btn yt-spec-button-shape-next yt-spec-button-shape-next--icon-button yt-spec-button-shape-next--size-m";
    btn.title = "Copy transcript";
    btn.setAttribute("aria-label", "Copy transcript");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;

    const touch = document.createElement("yt-touch-feedback-shape");
    touch.setAttribute("aria-hidden", "true");
    touch.className = "yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--overlay";
    const stroke = document.createElement("div");
    stroke.className = "yt-spec-touch-feedback-shape--stroke";
    const fill = document.createElement("div");
    fill.className = "yt-spec-touch-feedback-shape--fill";
    touch.appendChild(stroke);
    touch.appendChild(fill);
    shape.appendChild(btn);
    shape.appendChild(touch);

    btn.addEventListener("click", handleCopy, true);

    menuRenderer.parentElement.insertBefore(shape, menuRenderer);
  }

  async function openTranscriptPanel() {
    const expanded = document.querySelector(
      'ytd-engagement-panel-section-list-renderer' +
      '[target-id="engagement-panel-searchable-transcript"]' +
      '[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]'
    );
    if (expanded) return true;

    const menuBtn = document.querySelector(
      "ytd-watch-metadata #menu ytd-menu-renderer yt-button-shape button," +
      "ytd-watch-metadata #menu button[aria-label*='More']," +
      "ytd-watch-metadata #menu ytd-menu-renderer button"
    );

    if (!menuBtn) return false;

    menuBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    const items = document.querySelectorAll(
      "ytd-menu-popup-renderer tp-yt-paper-item," +
      "tp-yt-paper-listbox tp-yt-paper-item," +
      "ytd-popup-container ytd-menu-service-item-renderer"
    );

    for (const item of items) {
      if (/transcript/i.test(item.textContent || "")) {
        item.click();
        await new Promise((r) => setTimeout(r, 1200));
        return true;
      }
    }

    document.body.click();
    return false;
  }

  async function scrapeTranscript() {
    const segments = document.querySelectorAll("transcript-segment-view-model");
    if (segments.length === 0) return null;

    const lines = [];
    for (const seg of segments) {
      const textEl = seg.querySelector('span[role="text"]');
      if (textEl) {
        const text = textEl.textContent.trim();
        if (text) lines.push(text);
      }
    }
    return lines.length > 0 ? lines.join(" ") : null;
  }

  async function handleCopy(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    btn.classList.add("yptc-loading");

    let text = await scrapeTranscript();

    if (!text) {
      const opened = await openTranscriptPanel();
      if (opened) {
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 300));
          text = await scrapeTranscript();
          if (text) break;
        }
      }
    }

    btn.classList.remove("yptc-loading");

    if (text) {
      navigator.clipboard.writeText(text).then(
        () => showFeedback(btn, "ok"),
        () => fallbackCopy(btn, text)
      );
    } else {
      showFeedback(btn, "fail");
    }
  }

  function fallbackCopy(btn, text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showFeedback(btn, "ok");
    } catch {
      showFeedback(btn, "fail");
    }
    document.body.removeChild(ta);
  }

  function showFeedback(btn, type) {
    if (type === "ok") {
      btn.classList.add("yptc-ok");
      setTimeout(() => btn.classList.remove("yptc-ok"), 2000);
    } else {
      btn.classList.add("yptc-fail");
      btn.title = "No transcript available";
      setTimeout(() => {
        btn.classList.remove("yptc-fail");
        btn.title = "Copy transcript";
      }, 2000);
    }
  }

  function checkUrl() {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      const old = document.getElementById(BUTTON_ID);
      if (old) {
        const shape = old.closest("yt-button-shape");
        if (shape) shape.remove();
        else old.remove();
      }
      if (url.includes("/watch")) {
        setTimeout(addButton, 1500);
      }
    }
  }

  checkUrl();
  new MutationObserver(checkUrl).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
