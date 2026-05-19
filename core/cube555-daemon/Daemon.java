/**
 * cube555 random-state 5x5 scramble daemon (cuberoot.me).
 *
 * Long-lived JVM child process spawned by Hono (packages/server) to serve
 * /v1/scramble/555-rs. Talks line-based stdin/stdout protocol — we picked
 * stdio over a local HTTP server because (a) cube555's solver has no
 * built-in concurrency safety beyond per-Search instances, so we manage
 * the worker pool ourselves anyway, (b) Hono's child_process spawn pipes
 * are already zero-network-cost.
 *
 * Lives in `cs.cube555` package to access package-private CubieCube /
 * CornerCube / Util constants needed by the post-solve self-verify step.
 *
 * Build: ship this file to <CUBE555_HOME>/example/Daemon.java, then
 *   cd <CUBE555_HOME> && javac -d dist -cp 'dist:lib/twophase.jar' example/Daemon.java
 *
 * Run: cd <CUBE555_HOME> && java -cp 'dist:lib/twophase.jar' cs.cube555.Daemon
 *
 * Protocol:
 *   ↑ On boot, Search.init() builds / loads pruning tables (~230 MB resident,
 *     5 min cold build then ~3s reload from disk every subsequent start)
 *   ↑ Emits one "READY\t<workers>" line when warm
 *   ↓ Each stdin line  = one request id (any opaque string, echoed back)
 *   ↑ Each response    = "<id>\t<scramble>\t<source_state>\tOK"
 *                      | "<id>\t<scramble>\t<source_state>\tFAIL"
 *                      | "<id>\tERROR\t<ExceptionName>:<message>"
 *
 * <scramble> is in WCA wide notation (e.g. "Rw U2 Lw' Fw2 R") — applied to
 * a solved 5x5, yields <source_state>. Responses may arrive out of order
 * because workers solve in parallel; pair them by id on the consumer side.
 *
 * Send "QUIT\n" on stdin for clean shutdown.
 */
package cs.cube555;

import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class Daemon {
	private static final int WORKERS = Integer.parseInt(
	    System.getenv().getOrDefault("CUBE555_WORKERS", "4"));
	private static final Object OUT_LOCK = new Object();
	/**
	 * cube555 internals (Util, Logger, Search) pepper System.out with pruning-table
	 * build progress + ANSI-colored cube diagrams. We hijack the original stdout fd
	 * before Search.init() runs, then redirect System.out to stderr so the noise is
	 * discardable / observable on the parent's stderr without polluting the
	 * line-based protocol channel.
	 */
	private static final PrintWriter OUT = new PrintWriter(
	    new OutputStreamWriter(new FileOutputStream(FileDescriptor.out)));

	static { System.setOut(System.err); }

	/** Each worker owns its own solver pair so threads never share mutable solver state. */
	static class Worker {
		final Search reducer = new Search();
		final cs.min2phase.Search solver333 = new cs.min2phase.Search();
		final Random rng = new Random();
	}

	private static final ArrayBlockingQueue<Worker> POOL =
	    new ArrayBlockingQueue<>(Math.max(1, WORKERS));

	/**
	 * Beam widths for cube555's 5-phase reduction. Upstream defaults are
	 * 200/500/500/500/1; we widen phase 5 to 8 so we can pick the shortest among
	 * several final candidates instead of trusting whatever Phase5Search emitted
	 * first. Empirically: P5=8 saves ~1.2 moves at ~+16% latency vs upstream
	 * (n=30: 70.80→69.63 moves, 1.46→1.70s avg). Larger P5 / wider earlier phases
	 * / multi-seed (CUBE555_SEEDS) explored but yield diminishing returns — see
	 * BENCHMARKS.md "Local solve-length optimization (2026-05-18)" for full log.
	 */
	private static final int P1_SOLS = Integer.parseInt(System.getenv().getOrDefault("CUBE555_P1", "200"));
	private static final int P2_SOLS = Integer.parseInt(System.getenv().getOrDefault("CUBE555_P2", "500"));
	private static final int P3_SOLS = Integer.parseInt(System.getenv().getOrDefault("CUBE555_P3", "500"));
	private static final int P4_SOLS = Integer.parseInt(System.getenv().getOrDefault("CUBE555_P4", "500"));
	private static final int P5_SOLS = Integer.parseInt(System.getenv().getOrDefault("CUBE555_P5", "8"));
	/**
	 * Multi-seed: per request, generate K random states and return the shortest solve. K=1 disables.
	 * NOTE on uniformity: with K>1 the resulting state distribution is biased toward "easier"
	 * (shorter-to-solve) states, breaking the uniform-random-state guarantee. K=1 preserves it
	 * since cube555 Tools.randomCube samples uniformly on its own.
	 */
	private static final int SEEDS = Integer.parseInt(System.getenv().getOrDefault("CUBE555_SEEDS", "1"));
	/** Kociemba probeMin — min phase-2 probes spent looking for a shorter solution after the first hit. */
	private static final long KOC_PROBE_MIN = Long.parseLong(System.getenv().getOrDefault("CUBE555_KOC_PROBE_MIN", "500"));
	/** Kociemba verbose flags. 0x8 = OPTIMAL_SOLUTION (guaranteed optimal, exponentially slower — unusable for our latency budget). */
	private static final int KOC_FLAGS = Integer.parseInt(System.getenv().getOrDefault("CUBE555_KOC_FLAGS", "0"));
	/**
	 * Bidirectional solve: for each random state S, also solve S⁻¹ and pick whichever gives the shorter
	 * scramble. By group identity L*(S) = L*(S⁻¹), but cube555's reducer is heuristic so the two paths
	 * give different lengths in practice. Unlike multi-seed (CUBE555_SEEDS), this preserves the uniform
	 * random-state guarantee — we're picking the better of two estimates of the SAME L*(S), not the
	 * better of two different states. Doubles latency. Default off.
	 *
	 * NOTE: the backward path produces a facelet that's in the same coset as S (same physical state)
	 * but may differ at within-face center positions due to 4!^6 indistinguishable-center labelings.
	 * We replay the chosen scramble to derive expectedState so verify() compares against the right
	 * facelet. Consumer sees the canonical-relabeling state (visually identical to original).
	 */
	private static final boolean BIDIR =
	    !"0".equals(System.getenv().getOrDefault("CUBE555_BIDIR", "0"));

	public static void main(String[] args) throws Exception {
		Search.phase1SolsSize = P1_SOLS;
		Search.phase2SolsSize = P2_SOLS;
		Search.phase3SolsSize = P3_SOLS;
		Search.phase4SolsSize = P4_SOLS;
		Search.phase5SolsSize = P5_SOLS;
		Search.init();
		try { cs.min2phase.Search.init(); } catch (Throwable ignored) { /* lazy-init fallback */ }
		for (int i = 0; i < WORKERS; i++) POOL.offer(new Worker());
		emit("READY\t" + WORKERS);

		ExecutorService exec = Executors.newFixedThreadPool(WORKERS);
		BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
		String line;
		while ((line = in.readLine()) != null) {
			final String id = line.trim();
			if (id.isEmpty()) continue;
			if ("QUIT".equals(id)) break;
			exec.submit(() -> handle(id));
		}
		exec.shutdown();
		exec.awaitTermination(60, TimeUnit.SECONDS);
	}

	static void handle(String id) {
		Worker w = null;
		try {
			w = POOL.take();
			String bestState = null;
			String bestScramble = null;
			int bestTotal = Integer.MAX_VALUE;
			for (int seed = 0; seed < SEEDS; seed++) {
				String state = Tools.randomCube(w.rng);
				String[] solved = solvePicked(w, state);
				if (solved == null) continue;
				int total = countTokens(solved[0]);
				if (total < bestTotal) {
					bestTotal = total;
					bestState = solved[1];
					bestScramble = solved[0];
				}
			}
			if (bestScramble == null) throw new RuntimeException("all seeds failed");
			String tag = verify(bestScramble, bestState) ? "OK" : "FAIL";
			emit(id + "\t" + bestScramble + "\t" + bestState + "\t" + tag);
		} catch (Throwable t) {
			emit(id + "\tERROR\t" + t.getClass().getSimpleName() + ":" + t.getMessage());
		} finally {
			if (w != null) POOL.offer(w);
		}
	}

	/**
	 * Reduce + Kociemba for one state, picking the shortest combined solve across all phase-5
	 * reduction candidates. Upstream's solveReduction always uses p5sols.get(0), leaving moves on
	 * the table when phase5SolsSize > 1. We re-evaluate every p5sol: rebuild the post-reduction
	 * 3x3 facelet, run Kociemba, keep the (reduction + Kociemba) pair with smallest total.
	 *
	 * Returns raw [bestRed, bestKoc] strings (no inversion / no scramble assembly), or null.
	 */
	static String[] solveCore(Worker w, String state) {
		String[] firstRet = w.reducer.solveReduction(state, 0);
		if (firstRet == null || firstRet[0] == null) return null;
		String bestRed = null;
		String bestKoc = null;
		int bestTotal = Integer.MAX_VALUE;
		{
			String koc = w.solver333.solution(firstRet[1], 21, Integer.MAX_VALUE, KOC_PROBE_MIN, KOC_FLAGS);
			if (koc != null && !koc.startsWith("Error")) {
				bestTotal = countTokens(firstRet[0]) + countTokens(koc);
				bestRed = firstRet[0];
				bestKoc = koc;
			}
		}
		ArrayList<SolvingCube> pool = w.reducer.p5sols;
		int candidates = Math.min(pool.size(), P5_SOLS);
		for (int i = 1; i < candidates; i++) {
			SolvingCube sc = pool.get(i);
			String red = sc.toSolutionString(0);
			int redLen = countTokens(red);
			if (redLen + 17 >= bestTotal) continue;
			CubieCube cc = new CubieCube();
			if (cc.fromFacelet(state) != 0) continue;
			cc.doMove(sc.getSolution());
			cc.doCornerMove(sc.getSolution());
			String facelet333 = CubieCube.to333Facelet(cc.toFacelet());
			String koc = w.solver333.solution(facelet333, 21, Integer.MAX_VALUE, KOC_PROBE_MIN, KOC_FLAGS);
			if (koc == null || koc.startsWith("Error")) continue;
			int total = redLen + countTokens(koc);
			if (total < bestTotal) {
				bestTotal = total;
				bestRed = red;
				bestKoc = koc;
			}
		}
		if (bestRed == null) return null;
		return new String[] { bestRed, bestKoc };
	}

	/**
	 * Forward path (always) + backward path (BIDIR=1). Returns [scramble, expectedState] for
	 * verify; expectedState is the original state in forward case, or the replayed state in
	 * backward case (within-face center labeling may differ from original but group element matches).
	 */
	static String[] solvePicked(Worker w, String state) {
		String[] fwd = solveCore(w, state);
		String fwdScramble = (fwd != null) ? invertAndConvert(fwd[0] + " " + fwd[1]) : null;
		int fwdTokens = (fwdScramble != null) ? countTokens(fwdScramble) : Integer.MAX_VALUE;

		String bwdScramble = null;
		int bwdTokens = Integer.MAX_VALUE;
		String bwdState = null;
		if (BIDIR) {
			try {
				CubieCube cc = new CubieCube();
				if (cc.fromFacelet(state) == 0) {
					CubieCube ccInv = invertCubieCube(cc);
					String stateInv = ccInv.toFacelet();
					String[] bwd = solveCore(w, stateInv);
					if (bwd != null) {
						// Backward: solver returns word W such that W·stateInv = solved → [W] = stateInv⁻¹ = S.
						// W applied to solved produces a facelet in the [S] coset; we use it directly as the scramble.
						// Normalize cube555's lowercase-wide tokens to WCA Xw notation so parseMove accepts them.
						bwdScramble = convertOnly(bwd[0] + " " + bwd[1]);
						bwdTokens = countTokens(bwdScramble);
						bwdState = replay(bwdScramble);
					}
				}
			} catch (Throwable t) {
				// fall through to forward
			}
		}

		if (fwdScramble == null && bwdScramble == null) return null;
		boolean useBwd = (bwdScramble != null) && (fwdScramble == null || bwdTokens < fwdTokens);
		if (useBwd) return new String[] { bwdScramble, bwdState };
		return new String[] { fwdScramble, state };
	}

	/** Apply a scramble token sequence to a solved cube; return resulting facelet. */
	static String replay(String scramble) {
		CubieCube cc = new CubieCube();
		for (String tok : scramble.split("\\s+")) {
			if (tok.isEmpty()) continue;
			int m = parseMove(tok);
			cc.doMove(m);
			cc.doCornerMove(m);
		}
		return cc.toFacelet();
	}

	// Home-face lookup for the 24 T/X-center cubicles. Both arrays share layout: cubicle i is on
	// face HOME_FACE[i] (= TCENTER[i]/25); cubicles 0-3 on U, 4-7 D, 8-11 F, 12-15 B, 16-19 R, 20-23 L.
	private static final int[] HOME_FACE = new int[24];
	static {
		for (int i = 0; i < 24; i++) HOME_FACE[i] = CubieCube.TCENTER[i] / 25;
	}

	/**
	 * Inverse of a CubieCube. Pieces with cubie identity (mEdge, wEdge, corner) invert via the
	 * standard permutation-inverse formula. Centers (tCenter, xCenter) store only face indices —
	 * within-face cubie identity is lost — so the inverse is multi-valued; we pick a canonical
	 * representative by pairing home cubicles to occupied cubicles in index order per face. Any
	 * pairing yields a facelet in the correct coset of S⁻¹; the chosen pairing affects which
	 * within-face labeling the solver receives, but the resulting scramble is valid for S either way.
	 */
	static CubieCube invertCubieCube(CubieCube src) {
		CubieCube dst = new CubieCube();
		// wEdge: pure perm. dst[src[i]] = i.
		for (int i = 0; i < 24; i++) dst.wEdge[src.wEdge[i]] = i;
		// mEdge: perm + Z2 orient (self-inverse: flipping twice cancels).
		for (int i = 0; i < 12; i++) {
			int piece = src.mEdge[i] >> 1;
			int orient = src.mEdge[i] & 1;
			dst.mEdge[piece] = (i << 1) | orient;
		}
		// corner: perm + Z3 orient (orient negated mod 3).
		for (int i = 0; i < 8; i++) {
			int piece = src.corner.cp[i];
			int orient = src.corner.co[i];
			dst.corner.cp[piece] = i;
			dst.corner.co[piece] = (3 - orient) % 3;
		}
		invertCenters(src.tCenter, dst.tCenter);
		invertCenters(src.xCenter, dst.xCenter);
		return dst;
	}

	static void invertCenters(int[] src, int[] dst) {
		// For each face f (0..5), collect cubicles where src has color f.
		int[][] occupied = new int[6][4];
		int[] occCnt = new int[6];
		for (int i = 0; i < 24; i++) {
			int f = src[i];
			occupied[f][occCnt[f]++] = i;
		}
		// Pair home cubicles of face f with occupied cubicles in index order.
		// dst[home_cubicle] = HOME_FACE[paired occupied cubicle] = the physical face of the cubicle
		// that received face-f color in src.
		int[] homeCnt = new int[6];
		for (int i = 0; i < 24; i++) {
			int f = HOME_FACE[i];
			int k = homeCnt[f]++;
			int j = occupied[f][k];
			dst[i] = HOME_FACE[j];
		}
	}

	/** Count whitespace-separated tokens, ignoring //(...) annotations and empties. */
	static int countTokens(String raw) {
		if (raw == null) return 0;
		String stripped = raw.replaceAll("//\\([^)]*\\)", " ").trim();
		if (stripped.isEmpty()) return 0;
		int n = 0;
		for (String t : stripped.split("\\s+")) if (!t.isEmpty()) n++;
		return n;
	}

	/** Strip //(...) annotations, tokenize, reverse + invert each move, lowercase→Xw. */
	static String invertAndConvert(String raw) {
		String stripped = raw.replaceAll("//\\([^)]*\\)", " ");
		String[] tokens = stripped.trim().split("\\s+");
		StringBuilder sb = new StringBuilder(tokens.length * 4);
		boolean first = true;
		for (int i = tokens.length - 1; i >= 0; i--) {
			String t = tokens[i];
			if (t.isEmpty()) continue;
			if (!first) sb.append(' ');
			sb.append(invertToken(t));
			first = false;
		}
		return sb.toString();
	}

	static String invertToken(String t) {
		char c0 = t.charAt(0);
		boolean wide = c0 >= 'a' && c0 <= 'z';
		char face = wide ? Character.toUpperCase(c0) : c0;
		String suffix = t.substring(1);
		String invSuffix;
		if (suffix.endsWith("2")) invSuffix = "2";
		else if (suffix.endsWith("'")) invSuffix = "";
		else invSuffix = "'";
		return wide ? (face + "w" + invSuffix) : (face + invSuffix);
	}

	/** Normalize cube555 reducer lowercase-wide notation (r, r2, r') to WCA Xw notation. Same suffix preserved. */
	static String convertOnly(String raw) {
		String stripped = raw.replaceAll("//\\([^)]*\\)", " ");
		String[] tokens = stripped.trim().split("\\s+");
		StringBuilder sb = new StringBuilder(tokens.length * 4);
		boolean first = true;
		for (String t : tokens) {
			if (t.isEmpty()) continue;
			if (!first) sb.append(' ');
			char c0 = t.charAt(0);
			boolean wide = c0 >= 'a' && c0 <= 'z';
			char face = wide ? Character.toUpperCase(c0) : c0;
			String suffix = t.substring(1);
			sb.append(wide ? (face + "w" + suffix) : (face + suffix));
			first = false;
		}
		return sb.toString();
	}

	/** Apply scramble to a solved CubieCube, compare facelet with expected.
	 *  Note: CubieCube.doMove() updates centers + edges only; corner cubie state
	 *  lives in its own CornerCube and must be advanced via doCornerMove(). */
	static boolean verify(String scramble, String expectedState) {
		try {
			CubieCube cc = new CubieCube();
			for (String tok : scramble.split("\\s+")) {
				if (tok.isEmpty()) continue;
				int m = parseMove(tok);
				cc.doMove(m);
				cc.doCornerMove(m);
			}
			String got = cc.toFacelet();
			boolean ok = got.equals(expectedState);
			if (!ok) {
				int diffCount = 0, firstDiff = -1;
				for (int i = 0; i < Math.min(got.length(), expectedState.length()); i++) {
					if (got.charAt(i) != expectedState.charAt(i)) {
						if (firstDiff < 0) firstDiff = i;
						diffCount++;
					}
				}
				System.err.println("[VERIFY-FAIL] diffStickers=" + diffCount + "/" + got.length() +
				    " firstDiffIdx=" + firstDiff);
			}
			return ok;
		} catch (Throwable t) {
			System.err.println("[VERIFY-EX] " + t);
			return false;
		}
	}

	/** Parse one WCA wide-notation move token → cube555 internal move int (0-35). */
	static int parseMove(String tok) {
		int i = 0;
		char face = tok.charAt(i++);
		boolean wide = false;
		if (i < tok.length() && tok.charAt(i) == 'w') {
			wide = true;
			i++;
		}
		int faceIdx;
		switch (face) {
			case 'U': faceIdx = 0; break;
			case 'R': faceIdx = 1; break;
			case 'F': faceIdx = 2; break;
			case 'D': faceIdx = 3; break;
			case 'L': faceIdx = 4; break;
			case 'B': faceIdx = 5; break;
			default: throw new RuntimeException("bad face: " + tok);
		}
		int amount = 0;
		if (i < tok.length()) {
			char m = tok.charAt(i);
			if (m == '\'') amount = 2;
			else if (m == '2') amount = 1;
			else throw new RuntimeException("bad suffix: " + tok);
		}
		return (wide ? 18 : 0) + faceIdx * 3 + amount;
	}

	static void emit(String line) {
		synchronized (OUT_LOCK) {
			OUT.println(line);
			OUT.flush();
		}
	}
}
