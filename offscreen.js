chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "YTTC_DO_COPY") return;
  navigator.clipboard.writeText(msg.text).then(
    function () { sendResponse({ ok: true }); },
    function () { sendResponse({ ok: false }); }
  );
  return true;
});