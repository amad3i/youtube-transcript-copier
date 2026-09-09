(function () {
  window.addEventListener("__YTTC_GET_TRANSCRIPT", async function () {
    const result = await extractTranscript();
    window.dispatchEvent(
      new CustomEvent("__YTTC_TRANSCRIPT_RESULT", { detail: result })
    );
  });

  async function extractTranscript() {
    try {
      const captionTracks = getCaptionTracks();
      if (!captionTracks || captionTracks.length === 0) {
        return { error: "no_captions" };
      }

      const track =
        captionTracks.find((t) => t.languageCode === "en" && !t.kind) ||
        captionTracks.find((t) => t.languageCode === "en") ||
        captionTracks.find((t) => t.kind !== "asr") ||
        captionTracks[0];

      const url = new URL(track.baseUrl);
      url.searchParams.set("fmt", "json3");

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.events) {
        const segments = data.events
          .filter((e) => e.segs)
          .map((e) => ({
            text: e.segs
              .map((s) => s.utf8)
              .join("")
              .trim(),
            start: e.tStartMs / 1000,
          }))
          .filter((s) => s.text && s.text !== "\n");

        const fullText = segments.map((s) => s.text).join(" ");
        return { text: fullText, segments };
      }

      return await fetchXmlTranscript(track.baseUrl);
    } catch (err) {
      return { error: err.message };
    }
  }

  function getCaptionTracks() {
    if (
      window.ytInitialPlayerResponse &&
      window.ytInitialPlayerResponse.captions
    ) {
      return window.ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer
        .captionTracks;
    }

    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const content = script.textContent;
      if (content.includes("captionTracks")) {
        const match = content.match(/"captionTracks":(\[.*?\])/);
        if (match) {
          return JSON.parse(match[1]);
        }
      }
    }

    try {
      const player = document.getElementById("movie_player");
      if (player && player.getPlayerResponse) {
        const resp = player.getPlayerResponse();
        if (resp && resp.captions) {
          return resp.captions.playerCaptionsTracklistRenderer.captionTracks;
        }
      }
    } catch (e) {}

    return null;
  }

  async function fetchXmlTranscript(baseUrl) {
    const response = await fetch(baseUrl);
    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const texts = doc.querySelectorAll("text");

    const segments = Array.from(texts).map((node) => ({
      text: decodeHtmlEntities(node.textContent),
      start: parseFloat(node.getAttribute("start")),
    }));

    const fullText = segments.map((s) => s.text).join(" ");
    return { text: fullText, segments };
  }

  function decodeHtmlEntities(str) {
    const el = document.createElement("textarea");
    el.innerHTML = str;
    return el.value;
  }
})();
