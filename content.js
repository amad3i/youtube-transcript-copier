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
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(find() || null);
      }, timeout);
    });
  }

  async function addButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const actionRow = await waitForEl([
      "ytd-watch-metadata #actions-inner",
      "#above-the-fold #actions-inner",
      "#actions ytd-menu-renderer",
      "#actions-inner",
      "#top-row",
    ]);

    if (!actionRow || document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = "yptc-btn";
    btn.title = "Copy transcript";
    btn.setAttribute("aria-label", "Copy transcript");
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    btn.addEventListener("click", handleCopy);

    actionRow.insertBefore(btn, actionRow.firstChild);
  }

  async function openTranscriptPanel() {
    const isOpen = document.querySelector(
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"],' +
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"][state="engagement-panel-state-expanded"]'
    );
    if (isOpen) return true;

    const menuBtn = document.querySelector(
      'ytd-watch-metadata #menu ytd-menu-renderer yt-button-shape button,' +
      'ytd-watch-metadata #menu button[aria-label*="More"],' +
      '#actions #button-shape button[aria-label*="More"],' +
      'ytd-watch-metadata #menu ytd-menu-renderer button'
    );

    if (!menuBtn) return false;

    menuBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    const items = document.querySelectorAll(
      'ytd-menu-popup-renderer tp-yt-paper-item,' +
      'tp-yt-paper-listbox tp-yt-paper-item,' +
      'ytd-popup-container ytd-menu-service-item-renderer'
    );

    let transcriptBtn = null;
    for (const item of items) {
      if (/transcript/i.test(item.textContent || "")) {
        transcriptBtn = item;
        break;
      }
    }

    if (transcriptBtn) {
      transcriptBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      return true;
    }

    const closeBtn = document.querySelector(
      'tp-yt-paper-dialog .yt-spec-touch-feedback-shape--overlay'
    );
    if (closeBtn) closeBtn.click();

    return false;
  }

  async function scrapeTranscript() {
    const segments = document.querySelectorAll(
      "transcript-segment-view-model"
    );

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

    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    btn.classList.add("yptc-loading");

    let text = await scrapeTranscript();

    if (!text) {
      const opened = await openTranscriptPanel();
      if (opened) {
        for (let i = 0; i < 20; i++) {
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
      if (old) old.remove();
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
