#include "../tool.h"

char *solver, *filename;

static void
run(void) {
	bool result;
	long long int size, sizeread;
	char dataid[NISSY_SIZE_DATAID];
	unsigned char *buf;
	FILE *f;
	
	size = nissy_solverinfo(solver, dataid);

	if (size <= 0) {
		printf("Error in solverinfo\n");
		return;
	}

	if ((f = fopen(filename, "rb")) == NULL) {
		printf("Error reading file %s\n", filename);
		return;
	}

	buf = malloc(size);
	sizeread = fread(buf, size, 1, f);
	fclose(f);
	if (sizeread != 1)
		printf("File has unexpected size\n");
	result = sizeread == 1 && nissy_checkdata(solver, size, buf) == NISSY_OK;
	free(buf);

	printf("checkdata %s\n", result ? "succeeded" : "failed");

	/* TODO: cross-check with expected distributions? */
}

int main(int argc, char **argv) {
	if (argc < 3) {
		printf("Error: not enough arguments. "
		    "A solver and a file name must be given.\n");
		return 1;
	}

	solver = argv[1];
	filename = argv[2];
	nissy_setlogger(log_stderr, NULL);

	timerun(run);

	return 0;
}
