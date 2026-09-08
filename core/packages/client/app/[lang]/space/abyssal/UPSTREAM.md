Source: https://github.com/Token-Gremlin/natural-disasters
Revision: d2bae38301ff43bc1d43bfdfd9477a552ca5420b

Weather and optional island ocean port for Cube Space, using the installed Three.js renderer. Public attribution: /about.

Adaptations:
- Per-scene uniforms and explicit GPU disposal; abortable procedural texture baking.
- OceanFFT, OceanMesh and OceanSampleGLSL provide the island's three-cascade spectral ocean, projected grid, water shading and foam. Restore upstream Weather wind/swell/whitecap coupling and local foam/ripple baking; port airborne GPU spray from Precipitation. Omit director, event simulation and demo postprocessing.
- Fix 3D noise atlas Y scale: every row must address its own Z slices.
- Reuse upstream full-volume march for half-resolution screen rays and a separate 360-degree reflection probe. Remove temporal tiles; resolve fixed spatial jitter with a tent filter and increase the march budget to avoid truncated horizon bands.
- One color attachment for the existing composer; per-view sky and funnel camera matrices.
- Roof shelter mask for rain; lightning exposure/width and channel subdivision calibrated to architectural lighting, with per-view ribbon cameras for mirrors.
- Land-based funnel placement, softer cloud join and lower direct sun under overcast skies; no land destruction simulation.
- Local snow, hail, dust, mudslide, rainbow and surface wetness remain in space-weather.ts.
- Ocean resources are lazy, reused across styles, hidden and stopped outside the island environment, and disposed with the scene. FFT resolution is 256 on desktop / 64 on narrow screens; projected grids are 320 x 224 / 128 x 96, baked textures 1024 / 512 and spray budgets 16384 / 4096.
- Adapt the ocean to one composer color attachment and each mirror camera; share the local island profile between terrain, shallow-water attenuation and shore foam. The island and shoreline are local visual additions, not upstream fluid simulation.
- Fix render-target mipmap setup before baking foam, ripples and the weather map. Preserve upper-sky detail in ocean diffuse irradiance sampling; tune wave choppiness, short-wave gain, rain ripples and foam coverage for architectural scale.
- Bake foam, ripples, weather and curl using lattice coordinates spanning complete fBm periods. The tiled fBm helper expects lattice coordinates, unlike tiled Worley noise's normalized UVs; correct each 2D caller to remove repeat-boundary seams.
- Reuse saved environment/weather state, pause/reduced-motion scheduling and existing room/cube interactions. Island overview and shoreline views are local camera presets.
- Normalize the diffuse directional lobe and one-sided spectrum variance; choose cascade cutoffs from the actual FFT resolution. Replace reversed-edge smoothstep and recalibrate the visual breaker gate for the corrected wave amplitude.
- Share inward-moving shore waves between displacement, normals, residual foam and spray collision, with porous wind-stretched foam patches and depth-dependent sand transmission. Disable curl-noise coordinate warping, which produced visible folds inconsistent with FFT derivatives.
- Spray uses two floating-point ping-pong attachments for position/age and velocity/seed, crest and shoreline births, gravity and wind drag. Adapt ribbon winding, separate droplets and mist, premultiplied blending, finite-value guards and renderer-state restoration; reset and freeze obey the existing weather contract. Surface collision inverts horizontal chop before sampling FFT height.
- Correct the projected grid to counterclockwise screen winding. Only geometric back faces use submerged shading; ripple normals are constrained to the visible hemisphere, preventing dark grazing-angle stripes. FFT displacement outputs retain mipmaps and anisotropic filtering; particle collision samples full-resolution level zero.
- Separate fresh breaking caps from porous residual foam. Rain uses physical droplet widths, coverage-corrected subpixel alpha and a 22 ms visual shutter; spray stays a separate droplet/mist system.
- Shanghai reuses weather with camera-relative distant lightning and funnel anchors, a restrained urban night glow in both sky views, and lower city-scale fog. River water is a separate bounded Three.js Water surface, without ocean swell or shore breakers.
- A saved 00:00–23:59 scene clock supplies sun elevation/azimuth, stars and city night glow independently of room style and weather. Time changes preserve weather/ocean simulation state; solar direction uses a local fixed-equinox approximation referenced in docs/space-sources.md, not a calendar ephemeris supplied by upstream.
- These remain real-time surface and particle approximations: overturning sheets, volumetric breaking water and fully resolved aeration are not implemented, and cinematic close-up quality has not passed review.
