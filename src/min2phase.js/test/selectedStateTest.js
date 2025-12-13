var assert = require('assert');
var min2phase = require('../min2phase.js');

const {
	PerformanceObserver,
	performance
} = require('perf_hooks');

var search = new min2phase.Search();
var start = performance.now();
min2phase.initFull(); // can be ignored
console.log('Initialization Time: ', (performance.now() - start), 'ms');

function testCanonicalMoves(maxl, prevMoves, lm, search) {
	if (maxl == 0) {
		var state = min2phase.fromScramble(prevMoves);
		var solution = search.solution(state, 21, 1e9, 0, min2phase.INVERSE_SOLUTION);
		assert(min2phase.fromScramble(solution) == state);
		while (solution.length > prevMoves.length) { // continue search until the optimal solution is found
			solution = search.next(1e9, 0, min2phase.INVERSE_SOLUTION);
			assert(min2phase.fromScramble(solution) == state);
		}
		return 1;
	}
	var n_solved = 0;
	for (var axis = 0; axis < 18; axis += 3) {
		if (axis == lm || axis == lm - 9) {
			continue;
		}
		for (var pow = 0; pow < 3; pow++) {
			n_solved += testCanonicalMoves(maxl - 1, prevMoves + "URFDLB" [axis / 3] + " 2'" [pow] + " ", axis, search);
		}
	}
	return n_solved;
}

start = performance.now();
for (var len = 0; len < 5; len++) {
	console.log('Solve all ' + len + '-move scrambles');
	start = performance.now();
	var nsolved = testCanonicalMoves(len, "", -1, search);
	console.log(nsolved + ' scrambles solved in ' + (performance.now() - start) + 'ms');
}
