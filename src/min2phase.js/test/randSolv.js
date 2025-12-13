var assert = require('assert');
var min2phase = require('../min2phase.js');

const {
	PerformanceObserver,
	performance
} = require('perf_hooks');
var start = performance.now();
var search = new min2phase.Search();
start = performance.now();
min2phase.initFull(); // can be ignored
console.log('Initialization Time: ', (performance.now() - start), 'ms');
console.log('Randomly Solving 1000 Cubes: ');
start = performance.now();
var ntest = 1000;
for (var i = 0; i < ntest; i++) {
	var cube = min2phase.randomCube();
	var solution = search.solution(cube, 21, 1e9, 0, min2phase.INVERSE_SOLUTION);
	assert(min2phase.fromScramble(solution) == cube);
}
console.log('Done. Average: ', (performance.now() - start) / ntest, 'ms');
