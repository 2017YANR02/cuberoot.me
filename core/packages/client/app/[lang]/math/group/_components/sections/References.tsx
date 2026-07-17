'use client';

import Link from '@/components/AppLink';
import { GTSec, L, TeX } from '../primitives';

// §REF References. Self-contained prose section (no demos), lazy-loaded per slug
// from page.tsx's EXT_COMPONENTS map — see the section-extraction note there.
export default function References() {
  return (
    <GTSec id="refs" className="gt-sec">
      <div className="gt-sec-num">REF</div>
      <h2 className="gt-sec-title">
        <L zh="参考文献" en="References" />
      </h2>
      <div className="gt-refs">
        <ol>
          <li id="ref-singmaster" className="gt-ref-cite">
            D. Singmaster, <em>Notes on Rubik's "Magic Cube"</em>, Enslow Publishers, 1981. The book that named the canonical move notation U, D, L, R, F, B and laid out the first algebraic study of the cube.
          </li>
          <li id="ref-cubic-circular">
            D. Singmaster (ed.), <em>Cubic Circular</em>, issues 1–8, 1981–1985. The first international puzzle newsletter; scans hosted at <a href="https://www.jaapsch.net/puzzles/cubic1.htm" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/cubic{`{1..8}`}.htm</a>. Issue 3/4 in particular contains the pretty-pattern catalog that seeded §13.
          </li>
          <li id="ref-jaapsch">
            J. Scherphuis, <em>Jaap's Puzzle Page</em>. <a href="https://www.jaapsch.net/puzzles/" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/</a>. Source for §27 (lights.htm/lomath.htm), §28 (pegsolit.htm), §29 (hamilton.htm), §30 (pgl25.htm), §31 (graphpuzz.htm) and the Cayley-graph catalogue in §14.
          </li>
          <li id="ref-circle-manual">
            J. Slocum, J. Botermans, <em>Circle Puzzler's Manual</em>, 1986. Reference for rotational sliding puzzles (Hungarian Rings family) — generalises §31's two-face classification to multi-region overlap.
          </li>
          <li id="ref-anderson-feil">
            M. Anderson, T. Feil, <em>Turning Lights Out with Linear Algebra</em>, Mathematics Magazine 71(4):300–303, 1998. The reference proof that 5×5 Lights Out has <TeX src={`\\dim \\ker A = 2`} /> (§27).
          </li>
          <li id="ref-conway-beasley">
            J. H. Conway, E. R. Berlekamp, R. K. Guy, <em>Winning Ways for your Mathematical Plays</em>, Vol. 4, A K Peters, 2nd ed., 2004. Chapter on peg solitaire formalises the 3-colouring (§28) and pagoda functions.
          </li>
          <li id="ref-lovasz">
            L. Lovász, <em>Problem 11</em>, in Combinatorial structures and their applications, Gordon and Breach, 1970. The original statement of the Hamiltonian-path conjecture (§29).
          </li>
          <li id="ref-wilson-1974">
            R. M. Wilson, <em>Graph Puzzles, Homotopy, and the Alternating Group</em>, J. Combinatorial Theory B 16:86–96, 1974. Sliding-puzzle counterpart of §31; combined with Jaap's result gives a clean dichotomy.
          </li>
          <li id="ref-cmetrick">
            "Cmetrick Too" Contest, 2001–2003. An early online Rubik's-cube speed-solving contest with full result archive at <a href="https://www.jaapsch.net/puzzles/cmetrick.htm" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/cmetrick.htm</a> — historical seed of WCA-style standardized competition.
          </li>
          <li id="ref-puzzle-patents">
            <em>Puzzle Patents</em>, indexed at <a href="https://www.jaapsch.net/puzzles/patents.htm" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/patents.htm</a>. The intellectual-property timeline complementing this page's algebraic timeline (Rubik 1975, Nichols 1972, Ishigi 1976, …).
          </li>
          <li id="ref-chen">
            J. Chen, <em>Group Theory and the Rubik's Cube</em>, Harvard lecture notes, 2004. <a href="https://people.math.harvard.edu/~jjchen/docs/Group%20Theory%20and%20the%20Rubik's%20Cube.pdf" target="_blank" rel="noopener noreferrer">people.math.harvard.edu/~jjchen</a>
          </li>
          <li id="ref-provenza">
            H. Provenza, <em>Group Theory and the Rubik's Cube</em>, REU paper, U. Chicago, 2009. <a href="https://www.math.uchicago.edu/~may/VIGRE/VIGRE2009/REUPapers/Provenza.pdf" target="_blank" rel="noopener noreferrer">math.uchicago.edu/Provenza.pdf</a>
          </li>
          <li id="ref-travis">
            M. Travis, <em>The Mathematics of the Rubik's Cube</em>, REU paper, U. Chicago, 2007. <a href="https://www.math.uchicago.edu/~may/VIGRE/VIGRE2007/REUPapers/FINALAPP/Travis.pdf" target="_blank" rel="noopener noreferrer">math.uchicago.edu/Travis.pdf</a>
          </li>
          <li id="ref-thistlethwaite">
            M. Thistlethwaite, <em>The 45 move algorithm</em>, unpublished, 1981. Reproduced in Jaap's puzzle page: <a href="https://www.jaapsch.net/puzzles/thistle.htm" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/thistle.htm</a>
          </li>
          <li id="ref-rokicki">
            T. Rokicki, H. Kociemba, M. Davidson, J. Dethridge, <em>The diameter of the Rubik's cube group is twenty</em>, SIAM J. Discrete Math. 27(2):1082–1105, 2013. <a href="https://tomas.rokicki.com/rubik20.pdf" target="_blank" rel="noopener noreferrer">tomas.rokicki.com/rubik20.pdf</a> · <a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a>
          </li>
          <li id="ref-kociemba">
            H. Kociemba, <em>The two-phase algorithm</em>, technical notes, 1992–present. <a href="https://kociemba.org/" target="_blank" rel="noopener noreferrer">kociemba.org</a>
          </li>
          <li id="ref-joyner">
            D. Joyner, <em>Adventures in Group Theory: Rubik's Cube, Merlin's Machine, and Other Mathematical Toys</em>, 2nd ed., Johns Hopkins University Press, 2008. The definitive textbook on cube algebra.
          </li>
          <li id="ref-bandelow">
            C. Bandelow, <em>Inside Rubik's Cube and Beyond</em>, Birkhäuser, 1982. The earliest dedicated mathematical treatment.
          </li>
          <li id="ref-wiki">
            Wikipedia, <em>Rubik's Cube group</em>. <a href="https://en.wikipedia.org/wiki/Rubik's_Cube_group" target="_blank" rel="noopener noreferrer">en.wikipedia.org/wiki/Rubik's_Cube_group</a>
          </li>
          <li id="ref-daniels">
            L. Daniels, <em>Group Theory and the Rubik's Cube</em>, Senior thesis, 2013. <a href="http://math.fon.rs/files/DanielsProject58.pdf" target="_blank" rel="noopener noreferrer">math.fon.rs/files/DanielsProject58.pdf</a>
          </li>
          <li id="ref-minrep">
            <em>The Rubik's Cube and Minimal Representations of Split Group Extensions</em>, arXiv:2508.00687, 2025. <a href="https://arxiv.org/pdf/2508.00687" target="_blank" rel="noopener noreferrer">arxiv.org/pdf/2508.00687</a>
          </li>
          <li id="ref-mulhol">
            J. Mulholland, <em>Math 302: Rubik's Cube — Cubology</em>, Simon Fraser University course notes. <a href="https://www.sfu.ca/~jtmulhol/math302/puzzles-rc-cubology.html" target="_blank" rel="noopener noreferrer">sfu.ca/~jtmulhol/math302</a>
          </li>
          <li id="ref-demaine">
            E. Demaine, M. Demaine, S. Eisenstat, A. Lubiw, A. Winslow, <em>Algorithms for Solving Rubik's Cubes</em>, Algorithmica 80(8): 2229–2295, 2018. (Proves n×n×n Rubik's cube optimal solving is NP-complete and gives Θ(n²/log n) bounds.)
          </li>
          <li id="ref-demigod">
            R. Stein et al., <em>A Demigod's Number for the Rubik's Cube</em>, arXiv:2501.00144, 2025. <a href="https://arxiv.org/pdf/2501.00144" target="_blank" rel="noopener noreferrer">arxiv.org/pdf/2501.00144</a>
          </li>
          <li id="ref-rokicki-blog">
            T. Rokicki, <em>Twenty-Five Moves Suffice for Rubik's Cube</em>, technical report, 2008. Precursor to the 20-move final proof.
          </li>
          <li id="ref-mathworld">
            Wolfram MathWorld, <em>God's Number</em>. <a href="https://mathworld.wolfram.com/GodsNumber.html" target="_blank" rel="noopener noreferrer">mathworld.wolfram.com/GodsNumber</a>
          </li>
          <li id="ref-cube20">
            Cube20 project page. <a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a> &nbsp;— official reference page for the 2010 result, with downloads of all source code and tables.
          </li>
          <li id="ref-jaap">
            Jaap Scherphuis, <em>Thistlethwaite's 52-move algorithm</em>. <a href="https://www.jaapsch.net/puzzles/thistle.htm" target="_blank" rel="noopener noreferrer">jaapsch.net/puzzles/thistle.htm</a>
          </li>
          <li id="ref-speedsolving">
            Speedsolving.com wiki, <em>Thistlethwaite's algorithm</em>. <a href="https://www.speedsolving.com/wiki/index.php?title=Thistlethwaite%27s_algorithm" target="_blank" rel="noopener noreferrer">speedsolving.com/wiki</a>
          </li>
          <li id="ref-frey-singmaster">
            A. Frey, D. Singmaster, <em>Handbook of Cubik Math</em>, Enslow Publishers, 1982. Companion to Singmaster's notes, with worked exercises.
          </li>
          <li id="ref-korf">
            R. Korf, <em>Finding optimal solutions to Rubik's Cube using pattern databases</em>, AAAI 1997. The original IDA* approach.
          </li>
          <li id="ref-diaconis">
            P. Diaconis & M. Shahshahani, <em>Generating a random permutation with random transpositions</em>, Z. Wahrscheinlichkeitstheorie verw. Geb. 57:159–179, 1981. The seminal paper introducing Fourier analysis on finite groups for random-walk mixing-time bounds.
          </li>
          <li id="ref-bayer-diaconis">
            D. Bayer & P. Diaconis, <em>Trailing the dovetail shuffle to its lair</em>, Ann. Appl. Probab. 2(2):294–313, 1992. The "seven shuffles suffice" theorem; framework directly applicable to random walks on the cube group.
          </li>
          <li id="ref-sims">
            C. C. Sims, <em>Computational methods in the study of permutation groups</em>, in Computational Problems in Abstract Algebra, Pergamon, 1970. The original Schreier–Sims algorithm; foundation of BSGS-based CAS work.
          </li>
          <li id="ref-bjorner">
            A. Björner & F. Brenti, <em>Combinatorics of Coxeter Groups</em>, Springer GTM 231, 2005. Modern reference for random-walk and length-function theory on groups generated by reflections — applicable framework for cube QTM analysis.
          </li>
          <li id="ref-galois">
            É. Galois, <em>Mémoire sur les conditions de résolubilité des équations par radicaux</em>, 1830 (posthumous). The original proof of A_n simplicity for n ≥ 5 and its application to the unsolvability of the quintic.
          </li>
          <li id="ref-gap">
            The GAP Group, <em>GAP — Groups, Algorithms, and Programming</em>, version 4.x. <a href="https://www.gap-system.org/" target="_blank" rel="noopener noreferrer">gap-system.org</a> — open-source CAS used to verify |G|, structure descriptions, and conjugacy classes.
          </li>
          <li id="ref-rokicki-qtm">
            T. Rokicki, H. Kociemba, M. Davidson, J. Dethridge, <em>God's Number is 26 in the Quarter-Turn Metric</em>, 2014. <a href="https://www.cube20.org/qtm/" target="_blank" rel="noopener noreferrer">cube20.org/qtm</a>
          </li>
          <li id="ref-reid-superflip">
            M. Reid, <em>Superflip requires 20 face turns</em>, online note, 1995. The first proof that the superflip pattern has Cayley-distance exactly 20.
          </li>
          <li id="ref-lagrange">
            J.-L. Lagrange, <em>Réflexions sur la résolution algébrique des équations</em>, 1771. Source of the original divisibility theorem (though stated in pre-group language; modern statement crystallized later by Cauchy, Cayley).
          </li>
          <li id="ref-frobenius">
            G. Frobenius, <em>Über Gruppencharaktere</em>, Sitzungsber. Berlin Akad. 985–1021, 1896. The founding paper of group representation theory (characters).
          </li>
          <li id="ref-serre">
            J.-P. Serre, <em>Linear Representations of Finite Groups</em>, Springer GTM 42, 1977. The canonical undergraduate-to-graduate text on character theory and Maschke's theorem — direct background for §26.
          </li>
          <li id="ref-isaacs">
            I. M. Isaacs, <em>Character Theory of Finite Groups</em>, Academic Press, 1976. Deeper reference for orthogonality and characters used in §26.
          </li>
          <li id="ref-rotman">
            J. Rotman, <em>An Introduction to the Theory of Groups</em>, 4th ed., Springer GTM 148, 1995. Standard graduate reference covering Lagrange, Sylow, composition series, and computational group theory in one volume.
          </li>
          <li id="ref-aschbacher">
            M. Aschbacher, <em>Finite Group Theory</em>, 2nd ed., Cambridge Studies in Advanced Mathematics 10, 2000. Reference for the classification of finite simple groups, into which A_8 and A_12 fit as members of the alternating family.
          </li>
          <li id="ref-saloff-coste">
            L. Saloff-Coste, <em>Random walks on finite groups</em>, in Probability on Discrete Structures, Springer, 263–346, 2004. A modern survey of mixing-time techniques for §24's framework.
          </li>
          <li id="ref-tnoodle">
            WCA Software Team, <em>TNoodle</em>: WCA's official scramble generator. <a href="https://github.com/thewca/tnoodle" target="_blank" rel="noopener noreferrer">github.com/thewca/tnoodle</a> — implements random-state scrambles and the 25-move HTM length used at competitions.
          </li>
        </ol>
        <div className="gt-aside" style={{ marginTop: 24 }}>
          <L
            zh={<>本网站还有几个具体工具供深入探索:<Link href="/scramble/solver">最短解求解器</Link>、<Link href="/alg/commutator">换位子分解工具</Link>、<Link href="/scramble/analyzer">分析器</Link>。学魔方的群论, 没有比拿真物试一试更直观的了。</>}
            en={<>Within this site, dig deeper with the <Link href="/scramble/solver">optimal solver</Link>, the <Link href="/alg/commutator">commutator decomposer</Link>, and the <Link href="/scramble/analyzer">scramble analyzer</Link>. Nothing teaches cube group theory faster than handling a real cube.</>}
          />
        </div>
      </div>
    </GTSec>
  );
}
