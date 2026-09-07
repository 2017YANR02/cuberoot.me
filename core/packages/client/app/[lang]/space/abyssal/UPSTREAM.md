Source: https://github.com/Token-Gremlin/natural-disasters
Revision: d2bae38301ff43bc1d43bfdfd9477a552ca5420b

Weather-only port for Cube Space, using the installed Three.js renderer. Public attribution: /about.

Adaptations:
- Per-scene uniforms and explicit GPU disposal; abortable procedural texture baking.
- Omit ocean simulation, spray, foam/ripple baking, director and demo postprocessing.
- Fix 3D noise atlas Y scale: every row must address its own Z slices.
- Reuse upstream full-volume march for half-resolution screen rays and a separate 360-degree reflection probe. Remove temporal tiles; resolve fixed spatial jitter with a tent filter and increase the march budget to avoid truncated horizon bands.
- One color attachment for the existing composer; per-view sky and funnel camera matrices.
- Roof shelter mask for rain; lightning exposure/width and channel subdivision calibrated to architectural lighting, with per-view ribbon cameras for mirrors.
- Land-based funnel placement, softer cloud join and lower direct sun under overcast skies; no land destruction simulation.
- Local snow, hail, dust, mudslide, rainbow and surface wetness remain in space-weather.ts.
