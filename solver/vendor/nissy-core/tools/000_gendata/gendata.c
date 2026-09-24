#include "../tool.h"

char *solver;

static void
run(void) {
	int64_t size;
	char filename[1024], dataid[NISSY_SIZE_DATAID];
	unsigned char *buf;
	
	size = generatetable(solver, &buf, dataid);
	switch (size) {
	case -1:
		return;
	case -2:
		goto gendata_run_finish;
	default:
		if (nissy_checkdata(solver, size, buf) == NISSY_OK) {
			printf("\n");
			printf("Generated %" PRId64 " bytes.\n", size);
			sprintf(filename, "tables/%s", dataid);
			writetable(buf, size, filename);
		} else {
			printf("Error: table for %s generated incorrectly!\n",
			    solver);
		}
		break;
	}

gendata_run_finish:
	free(buf);
}

int main(int argc, char **argv) {
	if (argc < 2) {
		printf("Error: not enough arguments. "
		    "A solver must be given.\n");
		return 1;
	}

	solver = argv[1];
	nissy_setlogger(log_stderr, NULL);
	timerun(run);

	return 0;
}
