(function () {
  if (!document.getElementById("__yptc_page")) {
    var s = document.createElement("script");
    s.id = "__yptc_page";
    s.src = chrome.runtime.getURL("page.js");
    (document.head || document.documentElement).appendChild(s);
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
})();
