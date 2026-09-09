(function () {
  const BUTTON_ID = "yptc-copy-btn";
  let lastUrl = "";

  function injectScript() {
    if (!document.getElementById("__yptc_inject")) {
      const script = document.createElement("script");
      script.id = "__yptc_inject";
      script.src = chrome.runtime.getURL("inject.js");
      (document.head || document.documentElement).appendChild(script);
    }
  }

  function waitForButtonTarget() {
    return new Promise((resolve) => {
      const selectors = [
        "#above-the-fold #top-row",
        "#above-the-fold ytd-watch-metadata #actions-inner",
        "ytd-watch-metadata #actions ytd-menu-renderer #button-container",
        "#actions ytd-menu-renderer",
        "#actions-inner",
        "#top-row",
      ];

      function tryFind() {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el;
        }
        return null;
      }

      const found = tryFind();
      if (found) return resolve(found);

      const observer = new MutationObserver(() => {
        const el = tryFind();
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(tryFind() || document.body);
      }, 10000);
    });
  }

  async function addCopyButton() {
    if (document.getElementById(BUTTON_ID)) return;

    injectScript();

    const target = await waitForButtonTarget();
    if (document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.className = "yptc-copy-btn";
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
      <span>Copy Transcript</span>
    `;

    btn.addEventListener("click", handleCopy);
    target.appendChild(btn);
  }

  async function handleCopy(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    btn.classList.add("yptc-loading");
    btn.querySelector("span").textContent = "Loading...";

    window.dispatchEvent(new CustomEvent("__YTTC_GET_TRANSCRIPT"));

    window.addEventListener(
      "__YTTC_TRANSCRIPT_RESULT",
      function onResult(event) {
        window.removeEventListener("__YTTC_TRANSCRIPT_RESULT", onResult);
        btn.classList.remove("yptc-loading");

        const result = event.detail;

        if (result && result.error) {
          btn.querySelector("span").textContent = "No transcript";
          btn.classList.add("yptc-error");
          setTimeout(() => {
            btn.querySelector("span").textContent = "Copy Transcript";
            btn.classList.remove("yptc-error");
          }, 2000);
          return;
        }

        if (result && result.text) {
          navigator.clipboard.writeText(result.text).then(
            () => {
              btn.querySelector("span").textContent = "Copied!";
              btn.classList.add("yptc-success");
              setTimeout(() => {
                btn.querySelector("span").textContent = "Copy Transcript";
                btn.classList.remove("yptc-success");
              }, 2000);
            },
            () => {
              fallbackCopy(result.text);
            }
          );
        }
      }
    );
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      const btn = document.getElementById(BUTTON_ID);
      if (btn) {
        btn.querySelector("span").textContent = "Copied!";
        btn.classList.add("yptc-success");
        setTimeout(() => {
          btn.querySelector("span").textContent = "Copy Transcript";
          btn.classList.remove("yptc-success");
        }, 2000);
      }
    } catch (err) {
      const btn = document.getElementById(BUTTON_ID);
      if (btn) {
        btn.querySelector("span").textContent = "Failed";
        btn.classList.add("yptc-error");
        setTimeout(() => {
          btn.querySelector("span").textContent = "Copy Transcript";
          btn.classList.remove("yptc-error");
        }, 2000);
      }
    }
    document.body.removeChild(ta);
  }

  function checkUrl() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      const existing = document.getElementById(BUTTON_ID);
      if (existing) existing.remove();

      if (currentUrl.includes("/watch")) {
        setTimeout(addCopyButton, 1500);
      }
    }
  }

  checkUrl();

  const observer = new MutationObserver(checkUrl);
  observer.observe(document.body, { childList: true, subtree: true });
})();
