(function () {
  var WATCH_ID = "yptc-copy-btn";
  var lastUrl = "";
  var cardTimer = null;
  var harvest = null;

  var SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
    "</svg>";

  /* ---------- watch page button ---------- */

  function addWatchButton() {
    if (document.getElementById(WATCH_ID)) return;

    var sub = document.querySelector("ytd-subscribe-button-renderer");
    if (!sub) return;

    var btn = document.createElement("button");
    btn.id = WATCH_ID;
    btn.title = "Copy transcript";
    btn.setAttribute("aria-label", "Copy transcript");
    btn.innerHTML = SVG;

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

  function removeWatchButton() {
    var old = document.getElementById(WATCH_ID);
    if (!old) return;
    var wrap = old.parentElement;
    if (wrap && wrap.style.display === "inline-flex") {
      var sub = wrap.querySelector("ytd-subscribe-button-renderer");
      if (sub) wrap.parentElement.insertBefore(sub, wrap);
      wrap.remove();
    } else {
      old.remove();
    }
  }

  /* ---------- feed / search: three-dot menu item ---------- */

  function cardUrl(card) {
    var a = card.querySelector('a#thumbnail[href], a#video-title-link[href]');
    if (!a) return null;
    var href = a.getAttribute("href");
    if (!href || href.indexOf("/watch") !== 0) return null;
    return href.indexOf("http") === 0 ? href : "https://www.youtube.com" + href;
  }

  function onCardClick(url, el) {
    if (harvest) finishHarvest(false);

    var iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");
    iframe.style.cssText =
      "position:fixed;top:0;left:-10000px;width:1280px;height:900px;border:0;pointer-events:none;";

    harvest = {
      el: el || null,
      iframe: iframe,
      timer: setTimeout(function () { finishHarvest(false); }, 45000),
    };

    if (el) el.classList.add("yptc-loading");

    iframe.addEventListener("load", function () {
      if (!harvest || harvest.iframe !== iframe) return;
      try {
        var host = iframe.contentWindow && iframe.contentWindow.location.hostname;
        if (host && host.indexOf("consent") === 0) finishHarvest(false);
      } catch (e) {}
    });

    document.body.appendChild(iframe);
    var sep = url.indexOf("?") >= 0 ? "&" : "?";
    iframe.src = url + sep + "ytic=2";
  }

  function finishHarvest(ok) {
    if (!harvest) return;
    var h = harvest;
    harvest = null;
    clearTimeout(h.timer);
    if (h.iframe) h.iframe.remove();
    if (h.el) {
      h.el.classList.remove("yptc-loading");
      flash(h.el, ok ? "ok" : "fail");
    }
    toast(ok ? "Transcript copied" : "No transcript", ok);
  }

  function injectMenuItems() {
    var cards = document.querySelectorAll(
      "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer"
    );
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var lb = card.querySelector("tp-yt-paper-listbox");
      if (!lb) continue;
      if (lb.querySelector("[data-yptc-menu]")) continue;

      var url = cardUrl(card);
      if (!url) continue;

      var item = document.createElement("ytd-menu-service-item-renderer");
      item.setAttribute("data-yptc-menu", "1");
      item.style.cursor = "pointer";
      item.innerHTML = "<yt-formatted-string>Copy transcript</yt-formatted-string>";
      item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        onCardClick(url, null);
      });

      lb.insertBefore(item, lb.lastElementChild);
    }
  }

  function scheduleMenuScan() {
    if (cardTimer) return;
    cardTimer = setTimeout(function () {
      cardTimer = null;
      injectMenuItems();
    }, 200);
  }

  /* ---------- transcript ---------- */

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

  function copyText(text) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ type: "YTTC_COPY", text: text }, function (res) {
        if (chrome.runtime.lastError || !res || !res.ok) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(
              function () { resolve(true); },
              function () { resolve(fallbackCopy(text)); }
            );
          } else {
            resolve(fallbackCopy(text));
          }
        } else {
          resolve(true);
        }
      });
    });
  }

  function fallbackCopy(text) {
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
    return ok;
  }

  async function doCopy(btn) {
    if (btn) btn.classList.add("yptc-loading");

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

      if (text) {
        var ok = await copyText(text);
        if (btn) flash(btn, ok ? "ok" : "fail");
        return ok;
      }

      if (btn) {
        flash(btn, "fail");
        setTitle(btn, "No transcript available");
      }
      return false;
    } finally {
      if (btn) btn.classList.remove("yptc-loading");
    }
  }

  function setTitle(btn, text) {
    var t = btn.title;
    btn.title = text;
    setTimeout(function () { btn.title = t; }, 2000);
  }

  function flash(el, type) {
    el.classList.add(type === "ok" ? "yptc-ok" : "yptc-fail");
    setTimeout(function () {
      el.classList.remove("yptc-ok", "yptc-fail");
    }, 2000);
  }

  function toast(text, ok) {
    var t = document.createElement("div");
    t.textContent = text;
    t.style.cssText =
      "position:fixed;left:50%;bottom:80px;transform:translateX(-50%);" +
      "z-index:9999999;padding:10px 16px;border-radius:8px;" +
      "font:500 14px/1.4 Roboto,Noto Sans,sans-serif;color:#fff;" +
      "background:" + (ok ? "rgba(36,161,72,0.96)" : "rgba(220,38,38,0.96)") + ";" +
      "box-shadow:0 2px 12px rgba(0,0,0,0.4);pointer-events:none;";
    document.body.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 2200);
  }

  /* ---------- harvest iframe ---------- */

  function maybeAutoHarvest() {
    if (location.search.indexOf("ytic=2") === -1) return;
    if (window.self === window.top) return;

    setTimeout(function () {
      doCopy(null).then(function (ok) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: "YTTC_HARVEST_DONE", ok: !!ok }, "*");
        }
      });
    }, 2500);
  }

  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "YTTC_HARVEST_DONE") return;
    if (!harvest || !harvest.iframe) return;
    if (e.source !== harvest.iframe.contentWindow) return;
    finishHarvest(!!e.data.ok);
  });

  /* ---------- navigation ---------- */

  function checkUrl() {
    var url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      removeWatchButton();
      if (url.indexOf("/watch") >= 0) {
        setTimeout(addWatchButton, 2000);
        maybeAutoHarvest();
      } else {
        scheduleMenuScan();
      }
    } else if (url.indexOf("/watch") < 0) {
      scheduleMenuScan();
    }
  }

  checkUrl();
  new MutationObserver(checkUrl).observe(document.body, { childList: true, subtree: true });
})();