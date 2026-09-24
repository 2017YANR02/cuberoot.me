#include "../tool.h"

/*
This tool starts solving a scramble. It then runs for SOLVE_LEN seconds,
pauses for PAUSE_LEN seconds, runs again for SOLVE_LEN seconds and so on,
until eventually stopping after TOTAL_LEN seconds.
*/

#define SOL_BUFFER_LEN 10000

#define SOLVE_LEN 3000
#define PAUSE_LEN 1500
#define TOTAL_LEN 30000

char *scramble =
    "R' U' F D2 L2 F R2 U2 R2 B D2 L B2 D' B2 L' R' B D2 B U2 L U2 R' U' F";

char *solver;
int64_t size = 0;
unsigned char *buf;

int get_status(void *arg) {
	struct timespec start, now;
	double tdsec, tdnano;
	int tdiff;

	start = *(struct timespec *)arg;
	clock_gettime(CLOCK_MONOTONIC, &now);

	tdsec = now.tv_sec - start.tv_sec;
	tdnano = now.tv_nsec - start.tv_nsec;
	tdiff = 1000 * (tdsec + 1e-9 * tdnano);

	fprintf(stderr, "[tool] Status polled at %dms: ", tdiff);

	if (tdiff > TOTAL_LEN) {
		fprintf(stderr, "Total time elapsed, stopping\n");
		return NISSY_STATUS_STOP;
	}

	if (tdiff % (SOLVE_LEN + PAUSE_LEN) < SOLVE_LEN) {
		fprintf(stderr, "Running\n");
		return NISSY_STATUS_RUN;
	}

	fprintf(stderr, "Pausing\n");
	return NISSY_STATUS_PAUSE;
}

void run(void) {
	int64_t n;
	long long stats[NISSY_SIZE_SOLVE_STATS];
	char sol[SOL_BUFFER_LEN], cube[NISSY_SIZE_CUBE];
	struct timespec starttime;

	nissy_applymoves(NISSY_SOLVED_CUBE, scramble, cube);
	clock_gettime(CLOCK_MONOTONIC, &starttime);
	n = nissy_solve(cube, solver, NISSY_NISSFLAG_NORMAL,
	    0, 20, 100, -1, 0, size, buf, SOL_BUFFER_LEN, sol, stats,
	    get_status, &starttime);
	if (n == 0)
		printf("No solution found\n");
	else
		printf("Solutions:\n%s\n", sol);
}

int main(int argc, char **argv) {
	char filename[7+NISSY_SIZE_DATAID], dataid[NISSY_SIZE_DATAID];

	if (argc < 2) {
		printf("Error: not enough arguments. "
		    "A solver and must be given.\n"); return 1;
	}

	solver = argv[1];
	srand(time(NULL));
	nissy_setlogger(log_stderr, NULL);

	size = nissy_solverinfo(solver, dataid);
	sprintf(filename, "tables/%s", dataid);
	if (getdata(solver, &buf, filename) != 0)
		return 1;

	timerun(run);

	free(buf);
	return 0;
}
