import java.util.Random;
import org.teavm.jso.JSExport;
import org.worldcubeassociation.tnoodle.scrambles.Puzzle;
import org.worldcubeassociation.tnoodle.puzzle.*;
public class WatchTNoodle {
  // TeaVM uses RandomGenerator's low-bit rejection for bounded integers.
  // Match java.util.Random.nextInt(bound) so a seed reproduces the JVM state.
  private static final class WatchRandom extends Random {
    WatchRandom(long seed) { super(seed); }
    @Override public int nextInt(int bound) {
      if (bound <= 0) throw new IllegalArgumentException("bound");
      int mask = bound - 1, bits = next(31);
      if ((bound & mask) == 0) return (int) ((bound * (long) bits) >> 31);
      int value = bits % bound;
      while (bits - value + mask < 0) {
        bits = next(31);
        value = bits % bound;
      }
      return value;
    }
  }
  private static Puzzle puzzle;
  private static String current;
  @JSExport public static String generate(String event, int seedHi, int seedLo) {
    if (!event.equals(current)) {
      puzzle = switch(event) {
        case "222" -> new TwoByTwoCubePuzzle();
        case "333" -> new ThreeByThreeCubePuzzle();
        case "pyra" -> new PyraminxPuzzle();
        case "skewb" -> new SkewbPuzzle();
        default -> throw new IllegalArgumentException(event);
      };
      current = event;
    }
    return puzzle.generateWcaScramble(new WatchRandom(((long) seedHi << 32) | Integer.toUnsignedLong(seedLo)));
  }
  @JSExport public static String correction(String relativeFacelets) {
    // INVERSE_SOLUTION returns the path from solved to the relative target.
    return new cs.min2phase.Search().solution(relativeFacelets, 21, 100000, 0, 2).trim();
  }
  public static void main(String[] args) {}
}
