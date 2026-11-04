# Product recording

[Play or download the MP4](platform-walkthrough.mp4) · [Chaptered player](../demo/index.html) · [Transcript](transcript.md) · [Caption file](platform-walkthrough.vtt)

- **Duration:** 1:51 (111.24 seconds).
- **Format:** H.264 MP4, 1280 × 900, broadly compatible pixel format and fast-start metadata.
- **Size:** 4.25 MiB.
- **Audio:** supplied voiceover, encoded as AAC. Speech speed, pitch and level are unchanged; the screen sections follow locally identified narration boundaries. A short closing pause follows the final sentence. The original source is preserved.
- **Recorded:** November 4, 2026, using the built application in an isolated Docker project.
- **Data:** the assessment's Surfer SEO fixture, persisted through the real API; the fake provider produced 12 scored queries, 3 recommendations and 750 simulated tokens.
- **Isolation:** the documentation stack used its own PostgreSQL volume and explicit empty live-provider keys. The main application data, configuration and live provider were untouched.

## Process and evidence

Discovery inspected the dashboard, profile form, query table, chart, recommendations and populated dashboard before the automation was scripted. A complete unrecorded rehearsal passed, including a real fake-provider run, recheck and CSV download. The final recording repeated that flow, with paced typing/clicks, a visible cursor, captions and architecture views. Page-error collection was empty. Screenshots were captured from the same recorded session, with the recording overlays hidden for the still images.

The browser screen capture was recorded with Playwright and converted with FFmpeg to H.264 MP4. This is an actual screen recording, not a slideshow assembled from screenshots. The architecture segment shows the supplied SVG diagrams. The Director’s supplied voiceover has been added; no new speech was generated. The original silent capture is preserved as [platform-walkthrough-silent.mp4](platform-walkthrough-silent.mp4).

The fixture CSV downloaded successfully with a UTF-8 BOM and five records after the demonstrated score/visibility filters. The recording uses the fake client and does not establish live-provider authentication, current model availability or billed token usage.

Open `docs/demo/index.html` directly, or follow the root README’s read-only nginx command and visit http://localhost:8000/demo/. nginx supports byte-range requests, which the browser needs for reliable chapter seeking. The basic Python HTTP server used during capture does not support that seeking behavior. Direct Markdown viewers can also follow the MP4 link. Some repository hosts do not embed local HTML/video; the direct file and transcript remain available.

## Narration sync

The supplied MP3 is 109.714 seconds long. Nine screen sections were retimed independently to match the spoken topics, producing a 111.24-second MP4 with a brief closing hold. All speech is retained at its original speed and pitch. The MP4 contains nine chapter markers; the HTML player uses the same updated timestamps. The English narration captions are available in [voiceover.vtt](voiceover.vtt); the original short on-screen captions have a separately retimed sidecar.
