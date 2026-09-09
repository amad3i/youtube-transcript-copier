(function () {
  var BID = "yptc-copy-btn";
  var lastUrl = "";

  function addButton() {
    if (document.getElementById(BID)) return;

    var subBtn = document.querySelector(
      'ytd-subscribe-button-renderer button,' +
      'ytd-subscribe-button-renderer yt-button-shape button,' +
      'button[aria-label*="ubscribe"]'
    );
    if (!subBtn) return;

    var btn = document.createElement("button");
    btn.id = BID;
    btn.title = "Copy transcript";
    btn.setAttribute("aria-label", "Copy transcript");
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display:block;margin:auto;">' +
      '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>' +
      "</svg>";

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      doCopy(btn);
    });

    document.body.appendChild(btn);
    positionBtn(btn);
  }

  function positionBtn(btn) {
    var subBtn = document.querySelector(
      'ytd-subscribe-button-renderer button,' +
      'ytd-subscribe-button-renderer yt-button-shape button,' +
      'button[aria-label*="ubscribe"]'
    );
    if (!subBtn) return;
    var r = subBtn.getBoundingClientRect();
    var size = r.height;
    var gap = 12;
    btn.style.width = size + "px";
    btn.style.height = size + "px";
    btn.style.left = (r.right + gap) + "px";
    btn.style.top = r.top + "px";
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
    var segs = document.querySelectorAll("transcript-segment-view-model");
    if (segs.length === 0) return null;
    var lines = [];
    for (var i = 0; i < segs.length; i++) {
      var t = segs[i].querySelector('span[role="text"]');
      if (t) {
        var txt = t.textContent.trim();
        if (txt) lines.push(txt);
      }
    }
    return lines.length > 0 ? lines.join(" ") : null;
  }

  function doCopy(btn) {
    btn.classList.add("yptc-loading");

    var text = scrapeTranscript();
    if (text) {
      finishCopy(btn, text);
      return;
    }

    openTranscript().then(function (opened) {
      if (!opened) { btn.classList.remove("yptc-loading"); fail(btn); return; }
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        text = scrapeTranscript();
        if (text || tries >= 30) {
          clearInterval(iv);
          btn.classList.remove("yptc-loading");
          if (text) finishCopy(btn, text);
          else fail(btn);
        }
      }, 300);
    });
  }

  function finishCopy(btn, text) {
    navigator.clipboard.writeText(text).then(
      function () { flash(btn, "ok"); },
      function () {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        flash(btn, "ok");
      }
    );
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
      if (old) old.remove();
      if (url.includes("/watch")) {
        setTimeout(addButton, 2000);
      }
    }
  }

  window.addEventListener("scroll", function () {
    var btn = document.getElementById(BID);
    if (btn) positionBtn(btn);
  }, { passive: true });

  window.addEventListener("resize", function () {
    var btn = document.getElementById(BID);
    if (btn) positionBtn(btn);
  });

  setInterval(function () {
    var btn = document.getElementById(BID);
    if (btn) positionBtn(btn);
  }, 1000);

  checkUrl();
  new MutationObserver(checkUrl).observe(document.body, { childList: true, subtree: true });
})();
