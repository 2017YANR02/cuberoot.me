import { parentPort } from 'node:worker_threads';
import { SOLVED_CLOCK, solveClock } from '@cuberoot/puzzle-solvers/clock';

parentPort.postMessage(solveClock(SOLVED_CLOCK()).length);
