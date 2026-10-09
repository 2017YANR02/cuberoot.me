#include "../tool.h"

#define SOL_BUFFER_LEN 10000

int nsol;
char *solver;
int64_t size = 0;
unsigned char *buf;

char *scrambles[] = {
	"U2 D2 F2 B2 L2 R2",
	"R' D R U R' D' R U'", /* Pure 8-move comm */
	"R D' R2 D R U2 R' D' R U2 R D R'", /* 12 mover with sym */
	NULL
};

void run(void) {
	int i;
	int64_t n;
	long long stats[NISSY_SIZE_SOLVE_STATS];
	char sol[SOL_BUFFER_LEN], cube[NISSY_SIZE_CUBE];

	printf("Solved the following scrambles:\n\n");
	for (i = 0; scrambles[i] != NULL; i++) {
		printf("%d. %s\n", i+1, scrambles[i]);
		printf("Solving scramble %s\n", scrambles[i]);
		if (nissy_applymoves(NISSY_SOLVED_CUBE, scrambles[i], cube)
		     != NISSY_OK) {
			printf("Invalid scramble\n");
			continue;
		}
		n = nissy_solve(cube, solver, NISSY_NISSFLAG_NORMAL,
		    0, 20, nsol, -1, 0, size, buf, SOL_BUFFER_LEN, sol, stats,
		    NULL, NULL);
		if (n == 0)
			printf("No solution found\n");
		else
			printf("Solutions:\n%s\n", sol);
	}
}

int main(int argc, char **argv) {
	char filename[7+NISSY_SIZE_DATAID], dataid[NISSY_SIZE_DATAID];

	if (argc < 3) {
		printf("Error: not enough arguments. "
		    "A solver and a number of solutions must be given.\n");
		return 1;
	}

	solver = argv[1];
	nsol = atoi(argv[2]);
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
