(function () {
  function injectMainWorld() {
    if (document.getElementById("__yptc_main")) return;
    const s = document.createElement("script");
    s.id = "__yptc_main";
    s.textContent = `(${mainWorldCode})();`;
    (document.head || document.documentElement).appendChild(s);
  }

  function mainWorldCode() {
    const BID = "yptc-copy-btn";
    let lastUrl = "";

    function waitForEl(sels, ms) {
      ms = ms || 8000;
      return new Promise(function (res) {
        function find() {
          for (var i = 0; i < sels.length; i++) {
            var el = document.querySelector(sels[i]);
            if (el) return el;
          }
          return null;
        }
        var f = find();
        if (f) return res(f);
        var obs = new MutationObserver(function () {
          var el = find();
          if (el) { obs.disconnect(); res(el); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { obs.disconnect(); res(find() || null); }, ms);
      });
    }

    function addButton() {
      if (document.getElementById(BID)) return;
      waitForEl([
        'ytd-menu-renderer yt-button-shape#button-shape',
      ]).then(function (moreShape) {
        if (!moreShape || document.getElementById(BID)) return;
        var container = moreShape.closest("#top-level-buttons-computed");
        if (!container) return;

        var shape = document.createElement("yt-button-shape");
        shape.setAttribute("role", "button");
        shape.setAttribute("aria-label", "Copy transcript");

        var btn = document.createElement("button");
        btn.id = BID;
        var ref = moreShape.querySelector("button");
        btn.className = ref ? ref.className : "";
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

        var touch = document.createElement("yt-touch-feedback-shape");
        touch.setAttribute("aria-hidden", "true");
        touch.className = "ytSpecTouchFeedbackShapeHost ytSpecTouchFeedbackShapeTouchResponse";
        touch.innerHTML = '<div class="ytSpecTouchFeedbackShapeStroke"></div><div class="ytSpecTouchFeedbackShapeFill"></div>';
        shape.appendChild(btn);
        shape.appendChild(touch);

        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          doCopy(btn);
        }, true);

        container.insertBefore(shape, moreShape);
      });
    }

    function openTranscript() {
      return new Promise(function (res) {
        var expanded = document.querySelector(
          'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"][visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]'
        );
        if (expanded) return res(true);

        var showBtn = document.querySelector('button[aria-label="Show transcript"],button[aria-label="show transcript"]');
        if (showBtn) {
          showBtn.click();
          return setTimeout(function () { res(true); }, 1500);
        }

        var expandBtn = document.querySelector("tp-yt-paper-button#expand") ||
          document.querySelector("#description-inline-expander tp-yt-paper-button#expand") ||
          document.querySelector("ytd-text-inline-expander #expand");
        if (expandBtn) {
          expandBtn.click();
          setTimeout(function () {
            var btn2 = document.querySelector('button[aria-label="Show transcript"],button[aria-label="show transcript"]');
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
            if (text) {
              finishCopy(btn, text);
            } else {
              fail(btn);
            }
          }
        }, 300);
      });
    }

    function finishCopy(btn, text) {
      window.postMessage({ __yptc_copy: text }, "*");
      btn.classList.add("yptc-ok");
      setTimeout(function () { btn.classList.remove("yptc-ok"); }, 2000);
    }

    function fail(btn) {
      btn.classList.add("yptc-fail");
      btn.title = "No transcript available";
      setTimeout(function () {
        btn.classList.remove("yptc-fail");
        btn.title = "Copy transcript";
      }, 2000);
    }

    function checkUrl() {
      var url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        var old = document.getElementById(BID);
        if (old) {
          var s = old.closest("yt-button-shape");
          if (s) s.remove(); else old.remove();
        }
        if (url.includes("/watch")) {
          setTimeout(addButton, 1500);
        }
      }
    }

    checkUrl();
    new MutationObserver(checkUrl).observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window) return;
    if (e.data && e.data.__yptc_copy) {
      navigator.clipboard.writeText(e.data.__yptc_copy).catch(function () {
        var ta = document.createElement("textarea");
        ta.value = e.data.__yptc_copy;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      });
    }
  });

  injectMainWorld();
})();
