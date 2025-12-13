var assert = require('assert');
var min2phase = require('../min2phase.js');

const {
	PerformanceObserver,
	performance
} = require('perf_hooks');

var search = new min2phase.Search();
var state = min2phase.randomCube();
var start = performance.now();
console.log('Randomly solve a cube without initialization...');
var solution = search.solution(state, 21, 1e9, 50, min2phase.INVERSE_SOLUTION);
assert(min2phase.fromScramble(solution) == state);
console.log('Done in ', performance.now() - start, 'ms');
