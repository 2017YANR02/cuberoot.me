#include <time.h>
#include <stdarg.h>
#include <stdbool.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../src/nissy.h"

#if defined(_WIN32)
#define wrap_aligned_alloc(align, size) malloc(size)
#else
#define wrap_aligned_alloc(align, size) \
    (((size) % (align) == 0) ? aligned_alloc((align), (size)) : malloc(size))
#endif

static void log_stderr(const char *, void *);
static double timerun(void (*)(void));
static void writetable(const unsigned char *, int64_t, const char *);
static long long int generatetable(const char *, unsigned char **, char *);
static int getdata(const char *, unsigned char **, const char *);
static void gendata_run(const char *, uint64_t *);

static void
log_stderr(const char *str, void *unused)
{
	fprintf(stderr, "%s", str);
}

#ifdef _WIN32

#include <windows.h>

static double
timerun(void (*run)(void))
{
	LARGE_INTEGER freq, start, end;
	double tdiff;
	
	fflush(stdout);
	
	if (run == NULL) {
		printf("nothing to run!\n");
		fflush(stdout);
		return -1.0;
	}

	QueryPerformanceFrequency(&freq);
	QueryPerformanceCounter(&start);
	run();
	QueryPerformanceCounter(&end);
	
	tdiff = (double)(end.QuadPart - start.QuadPart) / freq.QuadPart;

	printf("---------\n");
	printf("\nTotal time: %.4fs\n", tdiff);
	fflush(stdout);

	return tdiff;
}

#else

static double
timerun(void (*run)(void))
{
	struct timespec start, end;
	double tdiff, tdsec, tdnano;

	fflush(stdout);

	if (run == NULL) {
		printf("nothing to run!\n");
		fflush(stdout);
		return -1.0;
	}

	clock_gettime(CLOCK_MONOTONIC, &start);
	run();
	clock_gettime(CLOCK_MONOTONIC, &end);

	tdsec = end.tv_sec - start.tv_sec;
	tdnano = end.tv_nsec - start.tv_nsec;
	tdiff = tdsec + 1e-9 * tdnano;

	printf("---------\n");
	printf("\nTotal time: %.4fs\n", tdiff);
	fflush(stdout);

	return tdiff;
}

#endif

static void
writetable(const unsigned char *buf, int64_t size, const char *filename)
{
	FILE *f;

	if ((f = fopen(filename, "wb")) == NULL) {
		printf("Could not write tables to file %s"
		    ", will be regenerated next time.\n", filename);
	} else {
		fwrite(buf, size, 1, f);
		fclose(f);
		printf("Table written to %s.\n", filename);
	}
}

static long long int
generatetable(
	const char *solver,
	unsigned char **buf,
	char *dataid
)
{
	long long int size, gensize;

	size = nissy_solverinfo(solver, dataid);
	if (size < 0) {
		printf("Error getting table size.\n");
		return -1;
	}

	*buf = wrap_aligned_alloc((size_t)64, size);
	gensize = nissy_gendata(solver, size, *buf);

	if (gensize != size) {
		printf("Error generating table");
		if (gensize == NISSY_OK)
			printf(" (got %lld bytes)", gensize);
		printf("\n");
		return -2;
	}

	return gensize;
}

static int
getdata(
	const char *solver,
	unsigned char **buf,
	const char *filename
) {
	long long int size, sizeread;
	FILE *f;
	char dataid[NISSY_SIZE_DATAID];

	if ((f = fopen(filename, "rb")) == NULL) {
		printf("Table file not found, generating it.\n");
		size = generatetable(solver, buf, dataid);
		switch (size) {
		case -1:
			goto getdata_error_nofree;
		case -2:
			goto getdata_error;
		default:
			writetable(*buf, size, filename);
			break;
		}
	} else {
		printf("Reading tables from file %s\n", filename);
		size = nissy_solverinfo(solver, dataid);
		*buf = wrap_aligned_alloc((size_t)64, size);
		sizeread = fread(*buf, size, 1, f);
		fclose(f);
		if (sizeread != 1) {
			printf("Error reading table, stopping\n");
			goto getdata_error;
		}
	}

	return 0;

getdata_error:
	free(*buf);
getdata_error_nofree:
	return 1;
}

static void
gendata_run(
	const char *solver,
	uint64_t *expected
) {
	long long int size;
	char filename[1024], dataid[NISSY_SIZE_DATAID];
	unsigned char *buf;

	size = generatetable(solver, &buf, dataid);
	sprintf(filename, "tables/%s", dataid);
	switch (size) {
	case -1:
		return;
	case -2:
		goto gendata_run_finish;
	default:
		printf("Succesfully generated %lld bytes. "
		       "See above for details on the tables.\n", size);

		writetable(buf, size, filename);
		break;
	}

gendata_run_finish:
	free(buf);
}
