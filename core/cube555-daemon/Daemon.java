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

	public static void main(String[] args) throws Exception {
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
			String state = Tools.randomCube(w.rng);
			String[] ret = w.reducer.solveReduction(state, 0);
			if (ret == null || ret[0] == null)
				throw new RuntimeException("solveReduction returned null");
			String solve333 = w.solver333.solution(ret[1], 21, Integer.MAX_VALUE, 500, 0);
			if (solve333 == null) throw new RuntimeException("min2phase returned null");
			String scramble = invertAndConvert(ret[0] + " " + solve333);
			String tag = verify(scramble, state) ? "OK" : "FAIL";
			emit(id + "\t" + scramble + "\t" + state + "\t" + tag);
		} catch (Throwable t) {
			emit(id + "\tERROR\t" + t.getClass().getSimpleName() + ":" + t.getMessage());
		} finally {
			if (w != null) POOL.offer(w);
		}
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
