#include "tool.h"

#define SOL_BUFFER_LEN   100000
#define MAX_SOLUTIONS    1000
#define MAX_SOLUTION_LEN 1000

char *solver;
int64_t size = 0;
unsigned char *buf;

bool check_one(
	const char *astr,
	const char *aname,
	const char *bstr,
	const char *bname,
	bool *exp
) {
	size_t i, j, nn, lb;
	char b[MAX_SOLUTION_LEN];

	lb = strlen(bstr);
	for (i = 0, j = 0, nn = 0; i < lb; j++, i = ++nn) {
		while (bstr[nn] != '\n') nn++;
		strncpy(b, &bstr[i], nn-i);
		b[nn-i] = '\0';
		if (nissy_comparemoves(astr, b) == NISSY_COMPARE_MOVES_EQUAL) {
			if (exp[j]) {
				printf("%s solution %s found twice\n",
				    aname, b);
				return false;
			}
			exp[j] = true;
			return true;
		}
	}

	printf("%s solution %s not found in %s\n", aname, astr, bname);
	return false;
}

size_t count_lines(const char *str) {
	size_t i, ret;

	for (i = 0, ret = 0; str[i] != '\0'; i++)
		ret += str[i] == '\n';

	return ret;
}

bool find_strlist(
	const char *astr,
	const char *aname,
	const char *bstr,
	const char *bname
)
{
	size_t i, nn, la;
	char a[MAX_SOLUTION_LEN];
	bool exp[MAX_SOLUTIONS];

	memset(exp, false, MAX_SOLUTIONS * sizeof(bool));

	la = strlen(astr);
	for (i = 0, nn = 0; i < la; i = ++nn) {
		while (astr[nn] != '\n') nn++;
		strncpy(a, &astr[i], nn-i);
		a[nn-i] = '\0';
		if (!check_one(a, aname, bstr, bname, exp))
			return false;
	}

	return true;
}

bool check_all(const char *actual, const char *expected) {
	size_t n_actual, n_expected;

	n_actual = count_lines(actual);
	n_expected = count_lines(expected);
	if (n_actual < n_expected)
		printf("Found less solutions than expected\n");
	if (n_actual > n_expected)
		printf("Found more solutions than expected\n");

	return n_actual > n_expected ?
	    find_strlist(actual, "actual", expected, "expected") :
	    find_strlist(expected, "expected", actual, "actual");
}

void run(void) {
	int i;
	long long stats[NISSY_SIZE_SOLVE_STATS];
	char sol[SOL_BUFFER_LEN], cube[NISSY_SIZE_CUBE];

	for (i = 0; s[i].scramble[0]; i++) {
		printf("\n%d. %s\n", i, s[i].scramble);

		if (nissy_applymoves(NISSY_SOLVED_CUBE, s[i].scramble, cube)
		     == NISSY_ERROR_INVALID_MOVES) {
			printf("Invalid scramble\n");
			exit(1);
		}

		nissy_solve(cube, solver,
		    NISSFLAG, MINMOVES, MAXMOVES, MAXSOLUTIONS, OPTIMAL,
		    0, size, buf, SOL_BUFFER_LEN, sol, stats,
		    NULL, NULL);

		if (check_all(sol, s[i].solutions)) {
			printf("All solutions are correct\n");
		} else {
			printf("Error!\n");
			printf("Found solution(s):\n%s", sol);
			printf("Valid solution(s):\n%s", s[i].solutions);
			exit(1);
		}
	}

	printf("\nAll scrambles solved correctly\n");
}

int main(int argc, char **argv) {
	char filename[7+NISSY_SIZE_DATAID], dataid[NISSY_SIZE_DATAID];

	if (argc < 2) {
		solver = SOLVER;
		printf("No solver given, using default %s\n", solver);
	} else {
		solver = argv[1];
		printf("Using user-specified solver %s\n", solver);
	}

	srand((unsigned)time(NULL));
	nissy_setlogger(log_stderr, NULL);

	size = nissy_solverinfo(solver, dataid);
	sprintf(filename, "tables/%s", dataid);
	if (getdata(solver, &buf, filename) != 0)
		return 1;

	timerun(run);

	free(buf);
	return 0;
}
