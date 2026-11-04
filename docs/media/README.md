# Product recording

[Play or download the MP4](platform-walkthrough.mp4) · [Chaptered player](../demo/index.html) · [Transcript](transcript.md) · [Caption file](platform-walkthrough.vtt)

- **Duration:** 2:17 (137.36 seconds).
- **Format:** H.264 MP4, 1280 × 900, broadly compatible pixel format and fast-start metadata.
- **Size:** 1.86 MiB.
- **Audio:** none. Captions are included in the video picture; a text transcript and WebVTT file are supplied separately.
- **Recorded:** November 4, 2026, using the built application in an isolated Docker project.
- **Data:** the assessment's Surfer SEO fixture, persisted through the real API; the fake provider produced 12 scored queries, 3 recommendations and 750 simulated tokens.
- **Isolation:** the documentation stack used its own PostgreSQL volume and explicit empty live-provider keys. The main application data, configuration and live provider were untouched.

## Process and evidence

Discovery inspected the dashboard, profile form, query table, chart, recommendations and populated dashboard before the automation was scripted. A complete unrecorded rehearsal passed, including a real fake-provider run, recheck and CSV download. The final recording repeated that flow, with paced typing/clicks, a visible cursor, captions and architecture views. Page-error collection was empty. Screenshots were captured from the same recorded session, with the recording overlays hidden for the still images.

The browser screen capture was recorded with Playwright and converted with FFmpeg to H.264 MP4. This is an actual screen recording, not a slideshow assembled from screenshots. The architecture segment shows the supplied SVG diagrams. No synthetic voice or audio is included.

The fixture CSV downloaded successfully with a UTF-8 BOM and five records after the demonstrated score/visibility filters. The recording uses the fake client and does not establish live-provider authentication, current model availability or billed token usage.

Open `docs/demo/index.html` directly, or follow the root README’s read-only nginx command and visit http://localhost:8000/demo/. nginx supports byte-range requests, which the browser needs for reliable chapter seeking. The basic Python HTTP server used during capture does not support that seeking behavior. Direct Markdown viewers can also follow the MP4 link. Some repository hosts do not embed local HTML/video; the direct file and transcript remain available.
