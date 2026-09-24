#include "../tool.h"

#define SOL_BUFFER_LEN   1000000
#define MAX_SCR          10000
#define MAX_SCR_LEN      250

char *solver;
int64_t size = 0, N = 0;
unsigned char *buf;
char scrambles[MAX_SCR][MAX_SCR_LEN];
unsigned nsols = 1;
unsigned optimal = 0;

void run(void) {
	int64_t i, solsfound;
	long long stats[NISSY_SIZE_SOLVE_STATS];
	char sol[SOL_BUFFER_LEN], cube[NISSY_SIZE_CUBE];

	printf("Solved the following scrambles:\n\n");
	for (i = 0; i < N; i++) {
		printf("%" PRId64 ". %s\n", i+1, scrambles[i]);
		printf("Solving scramble %s\n", scrambles[i]);
		fflush(stdout);
		if (nissy_applymoves(NISSY_SOLVED_CUBE, scrambles[i], cube)
		     != NISSY_OK) {
			printf("Invalid scramble\n");
			continue;
		}
		solsfound = nissy_solve(cube, solver, NISSY_NISSFLAG_NORMAL,
		    0, 20, nsols, optimal, 0, size, buf, SOL_BUFFER_LEN,
		    sol, stats, NULL, NULL);
		if (solsfound == 0)
			printf("No solution found\n");
		else
			printf("Solutions:\n%s\n", sol);
		fflush(stdout);
	}
}

int main(int argc, char **argv) {
	char filename[7+NISSY_SIZE_DATAID], dataid[NISSY_SIZE_DATAID];
	char *scrfilename;
	FILE *scrfile;

	if (argc < 3) {
		printf("Error: not enough arguments. "
		    "A solver and a scramble file must be given.\n"
		    "Optionally, a maximum number of solutions per scramble "
		    "and a bound for the number of moves above the shortest "
		    "solution can be provided.\n");
		return 1;
	}

	solver = argv[1];
	scrfilename = argv[2];
	if (argc >= 5) {
		nsols = atoi(argv[3]);
		optimal = atoi(argv[4]);
	}

	srand(time(NULL));
	nissy_setlogger(log_stderr, NULL);

	size = nissy_solverinfo(solver, dataid);
	sprintf(filename, "tables/%s", dataid);
	if (getdata(solver, &buf, filename) != 0)
		return 1;

	if ((scrfile = fopen(scrfilename, "r")) == NULL) {
		printf("Error: could not read given file '%s'.\n",
		    scrfilename);
		return 1;
	}

	printf("Reading scrambles from file '%s'.\n", scrfilename);
	for (N = 0; fgets(scrambles[N], MAX_SCR_LEN, scrfile) != NULL; N++) ;
	fclose(scrfile);

	timerun(run);

	free(buf);
	return 0;
}
