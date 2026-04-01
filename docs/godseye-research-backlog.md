# God's Eye Research Backlog

Updated: 2026-03-30

This backlog captures additional upgrades inspired by real products and official docs (including Prometheus-style operational practices), so we can plan the next implementation wave.

## Implementation Snapshot (2026-03-19)

- Added multi-intel overlays in frontend runtime:
  - Live-or-mock satellite layer (orbit trails + labels)
  - Military track flagging in ADS-B normalization (callsign/type heuristics)
  - Seismic events layer (USGS feed fallback to synthetic events)
  - CCTV projected nodes + FOV rays
  - Street traffic congestion hotspots (API/fallback)
- Added visual skins:
  - `Default`, `CRT`, `Night Vision`, `FLIR`
- Added terrain compatibility config:
  - `REACT_APP_TERRAIN_MODE=google-3d-tiles` with key/url guardrails and analytic fallback message
- Added adaptive polling primitives inspired by Shadowbroker and split cadence for intel overlays.

## Priority Roadmap

### P0 (high impact)

1. **Global Playback Timeline (UTC scrub + speed controls)**
   - Add a timeline to replay 1x-300x traffic and jump to exact UTC timestamps.
   - Why: investigation and after-action analysis becomes much faster.
   - Source: Flightradar24 Playback docs/blog.

2. **Alerting Engine (Prometheus-style rules + severity labels)**
   - Add rule-based alerts like `feed_stale`, `traffic_drop`, `target_off_route`, and `high_vertical_rate`.
   - Why: turns the globe from passive visualization into an active detection system.
   - Source: Prometheus alerting rules (`for`, labels, annotations, `keep_firing_for`).

3. **Recording Rules for Heavy Analytics (Prometheus pattern)**
   - Precompute rolling metrics every N seconds (density per region, descending traffic ratio, tracked-by-type counts).
   - Why: smoother UI and cheaper queries under high aircraft volume.
   - Source: Prometheus recording rules.

4. **Track/Object Linking Graph Layer**
   - Link multiple tracks to the same object and show relationship graph in the target panel.
   - Why: better continuity when a target changes transponder behavior or data source.
   - Source: Palantir Gotham Observation Linking docs.

5. **Sensor Volume Visualization (cones/frustums)**
   - Render camera/radar coverage cones and occlusion-aware sensor footprints for selected regions/assets.
   - Why: operator context for “what can actually be seen” from sensors.
   - Source: Cesium ion SDK `ConicSensor`, `RectangularSensor`, `CustomPatternSensor`.

### P1 (strong value)

6. **Advanced Flight Kinematics Track Mode**
   - Store time-sampled positions and derive orientation from velocity to stabilize chase camera and heading arrows.
   - Why: more realistic movement and cleaner cinematic follow.
   - Source: Cesium `VelocityOrientationProperty`, `PathGraphics` (`trailTime`, `leadTime`).

7. **Multi-View Camera Workspace**
   - Add split views (main + top/side tactical views) with path editing style controls.
   - Why: better operator awareness while keeping cinematic mode.
   - Source: Google Earth Studio Multi-View workflows.

8. **Preset Filter Packs + Incident Templates**
   - One-click filters: `cargo corridor`, `low-altitude`, `military-possible`, `region watch`.
   - Why: faster operational triage.
   - Source: Flightradar filter/preset workflow patterns.

9. **Dual Data Source Strategy (OpenSky + ADS-B Exchange/compatible)**
   - Implement provider abstraction with priority/fallback and field harmonization.
   - Why: resilience, coverage, and lower downtime risk.
   - Source: OpenSky API docs + ADS-B Exchange API docs.

### P2 (polish + operations)

10. **Operational Metrics Endpoint (`/metrics`)**
    - Export backend/frontend metrics: `api_latency_ms`, `flights_tracked`, `render_fps`, `selection_hit_ms`, `density_compute_ms`.
    - Why: measurable SLOs and reliable scale testing.
    - Source: Prometheus ecosystem best practice.

11. **Alert Routing + Notification Integrations**
    - Add channels (Slack/Email/Webhook) with severity routing and quiet hours.
    - Why: actionable alerting beyond dashboard-only visuals.
    - Source: Prometheus + Alertmanager usage model.

12. **Source Governance Layer**
    - Add data-source badges and usage guards per provider license/terms.
    - Why: reduces legal/compliance risk in production deployments.
    - Source: ADS-B Exchange data and API terms pages.

## Competitive Gap Scan (2026-03-30)

These are the strongest feature ideas surfaced by comparing the current build against Palantir-style map workflows, Cesium analytics, flight trackers, and cinematic globe tools.

1. **AOI / Geofence Workbench**
   - Let operators draw circles, polygons, and corridors directly on the globe, save them as named watch zones, and bind alerts to zone entry/exit.
   - Why it matters: this would make the product feel much closer to an analyst workstation than a pure viewer.
   - Inspired by: Palantir Map drawing/search workflows and map actions.

2. **Timeline + After-Action Replay**
   - Extend the current playback into a real UTC timeline with bookmarks, jump-to-event, and linked multi-layer replay for flights, CCTV, seismic, and traffic.
   - Why it matters: Flightradar24-style playback is good for tracks, but a God’s Eye needs cross-layer chronology.
   - Inspired by: Flightradar24 history/playback and Cesium timeline controls.

3. **Weather / Hazard Intelligence Layer**
   - Add live weather, precipitation, cloud, lightning, volcanic ash, wildfire hotspots, and storm-track overlays that can be toggled independently.
   - Why it matters: this adds operational context for route deviations, airport congestion, and disaster response.
   - Inspired by: Flightradar24 weather layers and Zoom Earth weather/fire overlays.

4. **Viewshed / Line-of-Sight Analysis**
   - Add a mode that computes what a selected CCTV node, aircraft, or satellite can actually see across terrain and city geometry.
   - Why it matters: sensor visibility becomes analytical instead of decorative.
   - Inspired by: Cesium ion SDK visibility, viewshed, and sensor geometry tooling.

5. **Annotations, Measurements, and Evidence Capture**
   - Add distance/area measurement, pinned notes, analyst annotations, and screenshot capture with UTC/source metadata burned into the export.
   - Why it matters: this is a practical operator workflow feature and helps turn the app into a reviewable intelligence surface.
   - Inspired by: Palantir Map toolbar actions, Cesium measurement tools, and Zoom Earth measurement modes.

6. **Saved Camera Recipes**
   - Add one-click camera presets such as `zoom-to`, `point-to-point`, `orbit`, `spiral`, and `fly-to-orbit` for selected targets or AOIs.
   - Why it matters: the current modes are useful, but templated camera moves would make the system feel much more cinematic and intentional.
   - Inspired by: Google Earth Studio Quick Start projects.

7. **Relationship Expansion Around Targets**
   - Add "search around" behavior for a selected aircraft/camera/airport to reveal nearby related assets, linked routes, companion flights, and dependent nodes.
   - Why it matters: this would deepen the intelligence workflow beyond single-object inspection.
   - Inspired by: Palantir map search-around and relationship traversal.

## Recommended Next Additions

If we want the highest-value next wave, the best order is:

1. AOI / Geofence Workbench
2. Timeline + After-Action Replay
3. Weather / Hazard Intelligence Layer
4. Viewshed / Line-of-Sight Analysis
5. Annotations, Measurements, and Evidence Capture

## Suggested Implementation Order

1. P0-1 Playback Timeline
2. P0-2 Alerting Engine
3. P0-3 Recording Rules
4. P0-4 Track/Object Linking
5. P0-5 Sensor Volumes
6. P1-6 Kinematics

## Source References

- OpenSky REST API docs: https://openskynetwork.github.io/opensky-api/rest.html
- OpenSky API overview: https://openskynetwork.github.io/opensky-api/
- ADS-B Exchange REST samples: https://www.adsbexchange.com/data/rest-api-samples/
- ADS-B Exchange Enterprise API: https://www.adsbexchange.com/products/enterprise-api/
- ADS-B Exchange data terms: https://www.adsbexchange.com/data/
- Flightradar24 Playback app blog: https://www.flightradar24.com/blog/playback-is-now-available-in-the-flightradar24-app/
- Flightradar24 Playback support: https://support.fr24.com/support/solutions/articles/3000120423-how-to-view-playback-on-the-flightradar24-website-
- Flightradar24 filters: https://support.fr24.com/support/solutions/articles/3000120424-how-to-use-filters
- Flightradar24 product features: https://www.flightradar24.com/blog/product-features/
- Flightradar24 weather layers: https://www.flightradar24.com/blog/inside-flightradar24/welcoming-weather-to-flightradar24/
- Cesium PathGraphics docs: https://cesium.com/learn/cesiumjs/ref-doc/PathGraphics.html
- Cesium VelocityOrientationProperty docs: https://cesium.com/learn/cesiumjs/ref-doc/VelocityOrientationProperty.html
- Cesium Timeline docs: https://cesium.com/downloads/cesiumjs/releases/1.100/Build/Documentation/Timeline.html
- Cesium ion SDK ConicSensor docs: https://cesium.com/learn/ion-sdk/ref-doc/ConicSensor.html
- Cesium ion SDK RectangularSensor docs: https://cesium.com/learn/ion-sdk/ref-doc/RectangularSensor.html
- Cesium ion SDK CustomPatternSensor docs: https://cesium.com/learn/ion-sdk/ref-doc/CustomPatternSensor.html
- Cesium ion SDK features: https://cesium.com/platform/cesiumjs/ion-sdk/
- Palantir Gotham Observation Linking basics: https://www.palantir.com/docs/gotham/api/v1/geotime-resources/observation-linking/observation-linking-basics
- Palantir Map overview: https://www.palantir.com/docs/foundry/map
- Palantir Map interface overview: https://www.palantir.com/docs/foundry/map/map-overview/
- Palantir Map add-to-map/search-around: https://www.palantir.com/docs/foundry/map/add-to-map
- Palantir media sets overview: https://www.palantir.com/docs/foundry/data-integration/media-sets/
- Prometheus alerting rules: https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/
- Prometheus recording rules: https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/
- Google Earth Studio intro: https://earth.google.com/studio/docs/
- Google Earth Studio Quick Starts: https://earth.google.com/studio/docs/the-basics/quick-starts/
- Zoom Earth live weather map: https://zoom.earth/
