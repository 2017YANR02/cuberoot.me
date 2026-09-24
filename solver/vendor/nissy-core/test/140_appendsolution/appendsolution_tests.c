/*
Input format for appendsolution tests:

moves on normal (with NISS notation)
unniss flag (0=false, 1=true)
n = maximum number of moves for transformations + 1 (at most 20)
n times the following:
  number of transformations
  transformations, one per line
the orientation of the cube, as a number from 0 to 23

See below for the output format.
*/

#include "../test.h"

uint8_t readtrans(const char [NISSY_SIZE_TRANSFORMATION]);
int64_t readmoves(const char *, size_t n, size_t m,
    size_t *, size_t *, uint8_t *, uint8_t *);
void solution_moves_reset(solution_moves_t [NON_NULL]);
bool solution_list_init(solution_list_t [NON_NULL], size_t n, char *);
int64_t appendsolution(const solution_moves_t [NON_NULL],
    size_t, const uint64_t *, const solution_settings_t [NON_NULL],
    solution_list_t [NON_NULL]);

void run(void) {
	int i, j, nnt, ntrans;
	int64_t tot;
	uint64_t tmask[20];
	size_t nm, np;
	char str[STRLENMAX], buf[STRLENMAX];
	solution_moves_t moves;
	solution_settings_t settings;
	solution_list_t list;

	solution_moves_reset(&moves);
	solution_list_init(&list, STRLENMAX, buf);
	settings = (solution_settings_t) {
		.unniss = false,
		.maxmoves = 20,
		.maxsolutions = 100,
		.optimal = 0,
	};

	fgets(str, STRLENMAX, stdin);
	tot = readmoves(str, 20, 20, &nm, &np, moves.moves, moves.premoves);
	if (tot < 0) {
		printf("Test error reading moves\n");
		return;
	}
	moves.nmoves = (uint8_t)nm;
	moves.npremoves = (uint8_t)np;
	fgets(str, STRLENMAX, stdin);
	settings.unniss = (bool)atoi(str);

	fgets(str, STRLENMAX, stdin);
	nnt = atoi(str);
	for (j = 0; j < nnt; j++) {
		fgets(str, STRLENMAX, stdin);
		ntrans = atoi(str);
		for (i = 0; i < ntrans; i++) {
			fgets(str, STRLENMAX, stdin);
			tmask[j] |= UINT64_C(1) << (uint64_t)readtrans(str);
		}
	}
	fgets(str, STRLENMAX, stdin);
	settings.orientation = (uint8_t)atoi(str);

	appendsolution(&moves, nnt, tmask, &settings, &list);

	printf("%s", list.buf);
	printf("Number of solutions: %" PRIu64 "\n", list.nsols);
	printf("Shortest solution length: %" PRIu8 "\n", list.shortest_sol);
	printf("Used bytes: %zu\n", list.used);
}
