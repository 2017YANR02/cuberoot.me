// Extracted from roux-trainers src/components/AnalyzerView.tsx (pure, non-React helpers).
// These two memoized functions are used by Solver.test and by the future Analyzer UI.
import { CubieCube, FaceletCube, MoveSeq } from "./CubeLib";
import { Typ } from "./Defs";
import { CachedSolver } from "./CachedSolver";

// Local tiny memoize (original used a local `memoize` in AnalyzerView, not a library).
function memoize<T, R>(fn: (arg: T) => R): (arg: T) => R {
    const cache = new Map<string, R>();

    return (arg: T) => {
        const key = String(arg);
        if (cache.has(key)) {
            return cache.get(key)!;
        }

        const result = fn(arg);
        cache.set(key, result);
        return result;
    };
}

// The actual rotation shortening function without caching logic
function _shorten_rotation(rotation: string): string {
    const rotation_inv = new MoveSeq(rotation).inv();
    const cube = new CubieCube().apply(rotation_inv);
    const solution = CachedSolver.get("center").solve(cube, 0, 3, 1)[0];
    return solution.toString();
}

// Create the memoized version
export const get_shortened_rotation = memoize(_shorten_rotation);

// Modify the _orientation_fb_name function to return colors instead of names
function _orientation_fb_colors(orientation: string): string[] {
    const cube = new CubieCube().apply(orientation)
    const dl_d = FaceletCube.color_of_sticker(cube, [5, 0, Typ.E])
    const dl_l = FaceletCube.color_of_sticker(cube, [5, 1, Typ.E])
    const color_lookup = ["W", "Y", "G", "B", "O", "R"]
    return [color_lookup[dl_d], color_lookup[dl_l]]
}
export const get_orientation_fb_colors = memoize(_orientation_fb_colors);
