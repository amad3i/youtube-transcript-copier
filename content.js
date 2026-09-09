(function () {
  const BUTTON_ID = "yptc-copy-btn";
  let lastUrl = "";
  let guardActive = false;

  function injectPageGuard() {
    if (document.getElementById("__yptc_guard")) return;
    const s = document.createElement("script");
    s.id = "__yptc_guard";
    s.textContent = `
      document.addEventListener("click", function(e) {
        if (e.target.closest && e.target.closest("#${BUTTON_ID}")) {
          e.stopPropagation();
        }
      }, true);
    `;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  }

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

  function findMoreBtnShape() {
    return document.querySelector(
      "ytd-menu-renderer yt-button-shape#button-shape"
    );
  }

  async function addButton() {
    if (document.getElementById(BUTTON_ID)) return;

    injectPageGuard();

    const moreShape = await waitForEl([
      "ytd-menu-renderer yt-button-shape#button-shape",
    ]);

    if (!moreShape || document.getElementById(BUTTON_ID)) return;

    const container = moreShape.closest("#top-level-buttons-computed");
    if (!container) return;

    const refBtn = moreShape.querySelector("button");
    const shape = document.createElement("yt-button-shape");
    shape.setAttribute("role", "button");
    shape.setAttribute("aria-label", "Copy transcript");

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = refBtn
      ? refBtn.className
      : "ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeM ytSpecButtonShapeNextIconButton ytSpecButtonShapeNextEnableBackdropFilterExperiment ytSpecButtonShapeNextMainstageIconSize ytSpecButtonShapeNextMainstagePadding";
    btn.title = "Copy transcript";
    btn.setAttribute("aria-label", "Copy transcript");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-disabled", "false");
    btn.innerHTML =
      '<div aria-hidden="true" class="ytSpecButtonShapeNextIcon ytSpecButtonShapeNextElevatedContent">' +
        '<span class="ytIconWrapperHost" style="width:24px;height:24px;">' +
          '<span class="yt-icon-shape ytSpecIconShapeHost">' +
            '<div style="width:100%;height:100%;display:block;fill:currentColor;">' +
              '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" aria-hidden="true" style="pointer-events:none;display:inherit;width:100%;height:100%;">' +
                '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path>' +
              '</svg>' +
            '</div>' +
          '</span>' +
        '</span>' +
      '</div>';

    const touch = document.createElement("yt-touch-feedback-shape");
    touch.setAttribute("aria-hidden", "true");
    touch.className =
      "ytSpecTouchFeedbackShapeHost ytSpecTouchFeedbackShapeTouchResponse";
    touch.innerHTML =
      '<div class="ytSpecTouchFeedbackShapeStroke"></div>' +
      '<div class="ytSpecTouchFeedbackShapeFill"></div>';
    shape.appendChild(btn);
    shape.appendChild(touch);

    btn.addEventListener("click", handleCopy, true);

    container.insertBefore(shape, moreShape);
  }

  async function openTranscript() {
    const expanded = document.querySelector(
      'ytd-engagement-panel-section-list-renderer' +
        '[target-id="engagement-panel-searchable-transcript"]' +
        '[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]'
    );
    if (expanded) return true;

    let showBtn = document.querySelector(
      'button[aria-label="Show transcript"],' +
        'button[aria-label="show transcript"]'
    );

    if (!showBtn) {
      const expandBtn =
        document.querySelector("tp-yt-paper-button#expand") ||
        document.querySelector(
          "#description-inline-expander tp-yt-paper-button#expand"
        ) ||
        document.querySelector('ytd-text-inline-expander #expand');
      if (expandBtn) {
        expandBtn.click();
        await new Promise((r) => setTimeout(r, 600));
      }
      showBtn = document.querySelector(
        'button[aria-label="Show transcript"],' +
          'button[aria-label="show transcript"]'
      );
    }

    if (showBtn) {
      showBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
      return true;
    }

    return false;
  }

  async function scrapeTranscript() {
    const segments =
      document.querySelectorAll("transcript-segment-view-model");
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
      const opened = await openTranscript();
      if (opened) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 300));
          text = await scrapeTranscript();
          if (text) break;
        }
      }
    }

    btn.classList.remove("yptc-loading");

    if (text) {
      navigator.clipboard
        .writeText(text)
        .then(
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
