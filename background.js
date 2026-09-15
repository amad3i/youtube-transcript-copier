chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "YTTC_COPY") return;

  chrome.offscreen
    .hasDocument()
    .then(function (has) {
      var p = has
        ? Promise.resolve()
        : chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: ["CLIPBOARD"],
            justification: "Copy YouTube transcript to the clipboard"
          });
      return p;
    })
    .then(function () {
      chrome.runtime.sendMessage(
        { type: "YTTC_DO_COPY", text: msg.text },
        function (res) {
          sendResponse(res || { ok: false });
        }
      );
    })
    .catch(function () {
      sendResponse({ ok: false });
    });

  return true;
});