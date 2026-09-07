Source: https://github.com/Token-Gremlin/natural-disasters
Revision: d2bae38301ff43bc1d43bfdfd9477a552ca5420b

Weather and optional island ocean port for Cube Space, using the installed Three.js renderer. Public attribution: /about.

Adaptations:
- Per-scene uniforms and explicit GPU disposal; abortable procedural texture baking.
- OceanFFT, OceanMesh and OceanSampleGLSL now provide the island's three-cascade spectral ocean, projected grid, water shading and foam. Restore upstream Weather wind/swell/whitecap coupling and local foam/ripple baking; omit airborne spray, director, event simulation and demo postprocessing.
- Fix 3D noise atlas Y scale: every row must address its own Z slices.
- Reuse upstream full-volume march for half-resolution screen rays and a separate 360-degree reflection probe. Remove temporal tiles; resolve fixed spatial jitter with a tent filter and increase the march budget to avoid truncated horizon bands.
- One color attachment for the existing composer; per-view sky and funnel camera matrices.
- Roof shelter mask for rain; lightning exposure/width and channel subdivision calibrated to architectural lighting, with per-view ribbon cameras for mirrors.
- Land-based funnel placement, softer cloud join and lower direct sun under overcast skies; no land destruction simulation.
- Local snow, hail, dust, mudslide, rainbow and surface wetness remain in space-weather.ts.
- Ocean resources are lazy, reused across styles, hidden and stopped in the original environment, and disposed with the scene. FFT resolution is 128 on desktop / 64 on narrow screens; projected grids are 256 x 180 / 128 x 96 and baked textures 1024 / 512.
- Adapt the ocean to one composer color attachment and each mirror camera; share the local island profile between terrain, shallow-water attenuation and shore foam. The island and shoreline are local visual additions, not upstream fluid simulation.
- Fix render-target mipmap setup before baking foam, ripples and the weather map. Preserve upper-sky detail in ocean diffuse irradiance sampling; tune wave choppiness, short-wave gain, rain ripples and foam coverage for architectural scale.
- Reuse saved environment/weather state, pause/reduced-motion scheduling and existing room/cube interactions. Island overview and shoreline views are local camera presets.
- Normalize the diffuse directional lobe and one-sided spectrum variance; choose cascade cutoffs from the actual FFT resolution. Replace reversed-edge smoothstep and recalibrate the visual breaker gate for the corrected wave amplitude.
- Share inward-moving shore waves between displacement, normals and residual foam, with porous foam patches and depth-dependent sand transmission. Disable curl-noise coordinate warping, which produced visible folds inconsistent with FFT derivatives; breaking waves and spray remain visual-quality gaps.
