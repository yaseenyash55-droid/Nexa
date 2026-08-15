# Nexa Music Rights & Provider Boundaries

> Policy target only. The current catalog is development data and is not proof of provider licensing or production music rights.

## 1. Executive Licensing Rule
Nexa strictly enforces Creative Commons & Jamendo licensing checks prior to attaching music tracks to Stories or Reels.

## 2. Provider Capabilities Matrix
- **`LicensedEditorCatalogProvider`**: Serves tracks with explicit `allowDerivatives: true` and `allowCommercial: true` flags.
- **Fail-Closed Policy**: Rejects No-Derivatives (`CC-BY-ND`) tracks and Non-Commercial (`CC-BY-NC`) tracks in commercial deployments.
- **Spotify & Subscription Streams**: Used strictly for official embeds and playback references; subscription tracks are **never** downloaded, trimmed, or synchronized into video files.

## 3. Server Validation Endpoint
- Endpoint: `POST /api/music/validate`
- Request: `{ trackId: string, isCommercial?: boolean }`
- Response: Returns `allowed: true` with track metadata or HTTP 403 `LICENSE_REJECTED`.
