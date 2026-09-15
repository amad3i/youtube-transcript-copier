(function () {
  var BID = "yptc-copy-btn";
  var lastUrl = "";

  function addButton() {
    if (document.getElementById(BID)) return;

    var sub = document.querySelector("ytd-subscribe-button-renderer");
    if (!sub) return;

    var btn = document.createElement("button");
    btn.id = BID;
    btn.title = "Copy transcript";
    btn.setAttribute("aria-label", "Copy transcript");
    btn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
      '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
      "</svg>";

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      doCopy(btn);
    });

    var wrap = document.createElement("div");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:8px;vertical-align:middle;";
    sub.parentElement.insertBefore(wrap, sub);
    wrap.appendChild(sub);
    wrap.appendChild(btn);
  }

  function openTranscript() {
    return new Promise(function (res) {
      var expanded = document.querySelector(
        'ytd-engagement-panel-section-list-renderer' +
          '[target-id="engagement-panel-searchable-transcript"]' +
          '[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]'
      );
      if (expanded) return res(true);

      var showBtn = document.querySelector(
        'button[aria-label="Show transcript"],button[aria-label="show transcript"]'
      );
      if (showBtn) {
        showBtn.click();
        return setTimeout(function () { res(true); }, 1500);
      }

      var expandBtn =
        document.querySelector("tp-yt-paper-button#expand") ||
        document.querySelector("#description-inline-expander tp-yt-paper-button#expand") ||
        document.querySelector("ytd-text-inline-expander #expand");
      if (expandBtn) {
        expandBtn.click();
        setTimeout(function () {
          var btn2 = document.querySelector(
            'button[aria-label="Show transcript"],button[aria-label="show transcript"]'
          );
          if (btn2) {
            btn2.click();
            setTimeout(function () { res(true); }, 1500);
          } else {
            res(false);
          }
        }, 600);
      } else {
        res(false);
      }
    });
  }

  function scrapeTranscript() {
    var root =
      document.querySelector("#segments-container") ||
      document.querySelector("ytd-transcript-segment-list-renderer") ||
      document.querySelector("ytd-transcript-renderer") ||
      document.body;

    var out = [];
    var push = function (el) {
      if (!el) return;
      var t = el.textContent.trim();
      if (t && t !== out[out.length - 1]) out.push(t);
    };

    var blocks = root.querySelectorAll(
      "transcript-segment-view-model," +
        "ytd-transcript-segment-renderer," +
        "transcript-section-header," +
        "transcript-section-header-renderer," +
        "ytd-transcript-section-header-renderer"
    );

    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      if (
        el.tagName === "transcript-segment-view-model" ||
        el.tagName === "ytd-transcript-segment-renderer"
      ) {
        var s = el.querySelector('span[role="text"]') ||
                el.querySelector(".segment-text");
        push(s);
      } else {
        var title = el.querySelector('span[role="text"]');
        push(title || el);
      }
    }

    return out.length > 0 ? out.join(" ") : null;
  }

  async function doCopy(btn) {
    btn.classList.add("yptc-loading");

    try {
      var text = scrapeTranscript();
      if (!text) {
        var opened = await openTranscript();
        if (opened) {
          for (var i = 0; i < 30; i++) {
            await new Promise(function (r) { setTimeout(r, 300); });
            text = scrapeTranscript();
            if (text) break;
          }
        }
      }

      if (text) finishCopy(btn, text);
      else fail(btn);
    } finally {
      btn.classList.remove("yptc-loading");
    }
  }

  function finishCopy(btn, text) {
    chrome.runtime.sendMessage({ type: "YTTC_COPY", text: text }, function (res) {
      if (chrome.runtime.lastError || !res || !res.ok) {
        fallbackCopy(btn, text);
      } else {
        flash(btn, "ok");
      }
    });
  }

  function fallbackCopy(btn, text) {
    var ok = false;
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText =
      "position:fixed;top:0;left:0;width:2px;height:2px;opacity:0.01;z-index:999999;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    if (ok) flash(btn, "ok");
    else flash(btn, "fail");
  }

  function fail(btn) {
    flash(btn, "fail");
    btn.title = "No transcript available";
    setTimeout(function () { btn.title = "Copy transcript"; }, 2000);
  }

  function flash(btn, type) {
    btn.classList.add(type === "ok" ? "yptc-ok" : "yptc-fail");
    setTimeout(function () {
      btn.classList.remove("yptc-ok", "yptc-fail");
    }, 2000);
  }

  function checkUrl() {
    var url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      var old = document.getElementById(BID);
      if (old) {
        var wrap = old.parentElement;
        if (wrap && wrap.style.display === "inline-flex") {
          var sub = wrap.querySelector("ytd-subscribe-button-renderer");
          if (sub) wrap.parentElement.insertBefore(sub, wrap);
          wrap.remove();
        } else {
          old.remove();
        }
      }
      if (url.includes("/watch")) {
        setTimeout(addButton, 2000);
      }
    }
  }

  checkUrl();
  new MutationObserver(checkUrl).observe(document.body, { childList: true, subtree: true });
})();
