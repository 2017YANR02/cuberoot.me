#include <inttypes.h>
#include <limits.h>
#include <errno.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "../src/nissy.h"

#define INPUT_BUFFER_SIZE     UINT64_C(1024)
#define PRINTCUBE_BUFFER_SIZE UINT64_C(1024)
#define SOLUTIONS_BUFFER_SIZE UINT64_C(500000)
#define MAX_PATH_LENGTH       UINT64_C(10000)

#if defined(_WIN32)
#define wrap_aligned_alloc(align, size) malloc(size)
#else
#define wrap_aligned_alloc(align, size) \
    (((size) % (align) == 0) ? aligned_alloc((align), (size)) : malloc(size))
#endif

#define FLAG_CUBE         "-cube"
#define FLAG_COMMAND      "-command"
#define FLAG_STR_CUBE     "-cubestr"
#define FLAG_MOVES        "-moves"
#define FLAG_MOVES2       "-moves2"
#define FLAG_TRANS        "-trans"
#define FLAG_SOLVER       "-solver"
#define FLAG_VARIATION    "-variation"
#define FLAG_NISSTYPE     "-nisstype"
#define FLAG_MINMOVES     "-m"
#define FLAG_MAXMOVES     "-M"
#define FLAG_OPTIMAL      "-O"
#define FLAG_MAXSOLUTIONS "-n"
#define FLAG_THREADS      "-t"

#define INFO_MOVESFORMAT "The accepted moves are U, D, R, L, F and B, " \
    "optionally followed by a 2, a ' or a 3."
#define INFO_TRANSFORMAT "The transformation must be given in the format " \
    "(rotation|mirrored) (2 letters), for exmple " \
    "'rotation UF' or 'mirrored BL'."

typedef struct {
	int command_index;
	char cube[NISSY_SIZE_CUBE];
	char *str_command;
	char *str_cube;
	char *str_moves;
	char *str_moves2;
	char *str_trans;
	char *str_solver;
	char *str_variation;
	char *str_nisstype;
	unsigned minmoves;
	unsigned maxmoves;
	unsigned optimal;
	unsigned maxsolutions;
	unsigned threads;
} args_t;

static int64_t inverse_exec(args_t *);
static int64_t applymoves_exec(args_t *);
static int64_t applytrans_exec(args_t *);
static int64_t frommoves_exec(args_t *);
static int64_t randomcube_exec(args_t *);
static int64_t solverinfo_exec(args_t *);
static int64_t gendata_exec(args_t *);
static int64_t solve_exec(args_t *);
static int64_t solve_scramble_exec(args_t *);
static int64_t countmoves_exec(args_t *);
static int64_t comparemoves_exec(args_t *);
static int64_t variation_exec(args_t *);
static int64_t help_exec(args_t *);

static int parse_args(int, char **, args_t *);
static bool parse_uint(const char *, unsigned *);
static uint8_t parse_nisstype(const char *);

static bool set_cube(int, char **, args_t *);
static bool set_str_command(int, char **, args_t *);
static bool set_str_cube(int, char **, args_t *);
static bool set_str_moves(int, char **, args_t *);
static bool set_str_moves2(int, char **, args_t *);
static bool set_str_trans(int, char **, args_t *);
static bool set_str_solver(int, char **, args_t *);
static bool set_str_variation(int, char **, args_t *);
static bool set_str_nisstype(int, char **, args_t *);
static bool set_minmoves(int, char **, args_t *);
static bool set_maxmoves(int, char **, args_t *);
static bool set_optimal(int, char **, args_t *);
static bool set_maxsolutions(int, char **, args_t *);
static bool set_threads(int, char **, args_t *);
static bool set_id(int, char **, args_t *);

static uint64_t rand64(void);

#define OPTION(N, A, S) { .name = N, .nargs = A, .set = S }
struct {
	char *name;
	int nargs;
	bool (*set)(int, char **, args_t *);
} options[] = {
	OPTION(FLAG_CUBE, 1, set_cube),
	OPTION(FLAG_COMMAND, 1, set_str_command),
	OPTION(FLAG_STR_CUBE, 1, set_str_cube),
	OPTION(FLAG_MOVES, 1, set_str_moves),
	OPTION(FLAG_MOVES2, 1, set_str_moves2),
	OPTION(FLAG_TRANS, 1, set_str_trans),
	OPTION(FLAG_SOLVER, 1, set_str_solver),
	OPTION(FLAG_VARIATION, 1, set_str_variation),
	OPTION(FLAG_NISSTYPE, 1, set_str_nisstype),
	OPTION(FLAG_MINMOVES, 1, set_minmoves),
	OPTION(FLAG_MAXMOVES, 1, set_maxmoves),
	OPTION(FLAG_OPTIMAL, 1, set_optimal),
	OPTION(FLAG_MAXSOLUTIONS, 1, set_maxsolutions),
	OPTION(FLAG_THREADS, 1, set_threads),
	OPTION(NULL, 0, NULL)
};
 
#define COMMAND(N, S, D, E) { .name = N, .syn = S, .desc = D, .exec = E }
struct {
	char *name;
	char *syn;
	char *desc;
	int64_t (*exec)(args_t *);
} commands[] = {
	COMMAND(
		"inverse",
		"inverse " FLAG_CUBE " CUBE ",
		"Compute the inverse of the given CUBE.",
		inverse_exec
	),
	COMMAND(
		"applymoves",
		"applymoves " FLAG_CUBE " CUBE " FLAG_MOVES " MOVES",
		"Apply the given MOVES to the given CUBE. "
		INFO_MOVESFORMAT,
		applymoves_exec
	),
	COMMAND(
		"applytrans",
		"applytrans " FLAG_CUBE " CUBE " FLAG_TRANS " TRANS",
		"Apply the single transformation TRANS to the given CUBE. "
		INFO_TRANSFORMAT,
		applytrans_exec
	),
	COMMAND(
		"frommoves",
		"frommoves " FLAG_MOVES " MOVES",
		"Return the cube obtained by applying the given MOVES "
		"to a solved cube. " INFO_MOVESFORMAT,
		frommoves_exec
	),
	COMMAND(
		"randomcube",
		"randomcube",
		"Returns a random.",
		randomcube_exec
	),
	COMMAND(
		"solverinfo",
		"solverinfo " FLAG_SOLVER " SOLVER",
		"Return the size in bytes and the id of the data table "
		"used by SOLVER when called with the given OPTIONS.",
		solverinfo_exec
	),
	COMMAND(
		"gendata",
		"gendata " FLAG_SOLVER " SOLVER",
		"Generate the data table used by "
		"SOLVER when called with the given OPTIONS.",
		gendata_exec
	),
	COMMAND(
		"solve",
		"solve " FLAG_SOLVER " SOLVER"
		"[" FLAG_MINMOVES " n] [" FLAG_MAXMOVES " N] "
		FLAG_CUBE " CUBE"
		FLAG_THREADS " T",
		"Solve the given CUBE using SOLVER, "
		"using at least n and at most N moves, and T threads.",
		solve_exec
	),
	COMMAND(
		"solve_scramble",
		"solve_scramble " FLAG_SOLVER " SOLVER"
		"[" FLAG_MINMOVES " n] [" FLAG_MAXMOVES " N] "
		FLAG_MOVES " MOVES",
		"Solve the given SCRAMBLE using SOLVER, "
		"using at least n and at most N moves. "
		INFO_MOVESFORMAT,
		solve_scramble_exec
	),
	COMMAND(
		"countmoves",
		"countmoves " FLAG_MOVES " MOVES",
		"Count the given MOVES in HTM. "
		INFO_MOVESFORMAT,
		countmoves_exec
	),
	COMMAND(
		"compare",
		"compare " FLAG_MOVES " MOVES " FLAG_MOVES2 " MOVES2",
		"Compare the two move sequences."
		INFO_MOVESFORMAT,
		comparemoves_exec
	),
	COMMAND(
		"variations",
		"variations " FLAG_MOVES " MOVES " FLAG_VARIATION " VARIATION",
		"Find variations of a move sequence."
		INFO_MOVESFORMAT,
		variation_exec
	),
	COMMAND(
		"help",
		"help [" FLAG_COMMAND " COMMAND]",
		"If no COMMAND is specified, prints some generic information "
		"and the list of commands. Otherwise it prints detailed "
		"information about the specified COMMAND.",
		help_exec
	),
	COMMAND(NULL, NULL, NULL, NULL)
};

char *tablepaths[] = {
	"tables/",
	"",
	NULL
};

static uint64_t
rand64(void)
{
	uint64_t i, ret;

	for (i = 0, ret = 0; i < 64; i++)
		ret |= (uint64_t)(rand() % 2) << i;

	return ret;
}

static int64_t
inverse_exec(args_t *args)
{
	char result[NISSY_SIZE_CUBE];
	int64_t ret;

	ret = nissy_inverse(args->cube, result);
	if (ret == NISSY_OK || ret == NISSY_WARNING_UNSOLVABLE)
		printf("%s\n", result);

	return ret;
}

static int64_t
applymoves_exec(args_t *args)
{
	char result[NISSY_SIZE_CUBE];
	int64_t ret;

	ret = nissy_applymoves(args->cube, args->str_moves, result);
	if (ret == NISSY_OK || ret == NISSY_WARNING_UNSOLVABLE)
		printf("%s\n", result);

	return ret;
}

static int64_t
applytrans_exec(args_t *args)
{
	char result[NISSY_SIZE_CUBE];
	int64_t ret;

	ret = nissy_applytrans(args->cube, args->str_trans, result);
	if (ret == NISSY_OK || ret == NISSY_WARNING_UNSOLVABLE)
		printf("%s\n", result);

	return ret;
}

static int64_t
frommoves_exec(args_t *args)
{
	sprintf(args->cube, NISSY_SOLVED_CUBE);
	return applymoves_exec(args);
}

static int64_t
randomcube_exec(args_t *args)
{
	char result[PRINTCUBE_BUFFER_SIZE];
	int64_t ret, ep, eo, cp, co;

	ep = rand64();
	eo = rand64();
	cp = rand64();
	co = rand64();
	ret = nissy_getcube(ep, eo, cp, co, 0, "fix", result);
	if (ret == NISSY_OK || ret == NISSY_WARNING_UNSOLVABLE)
		printf("%s\n", result);

	return ret;
}

static int64_t
solverinfo_exec(args_t *args)
{
	int64_t ret;
	char buf[NISSY_SIZE_DATAID];

	ret = nissy_solverinfo(args->str_solver, buf);
	if (ret < 0) {
		fprintf(stderr, "Unknown error (make sure solver is valid)\n");
	} else {
		printf("%" PRId64 "\n%s\n", ret, buf);
		ret = 0;
	}

	return ret;
}

static int64_t
gendata_exec(args_t *args)
{
	int i;
	FILE *file;
	char path[MAX_PATH_LENGTH], dataid[NISSY_SIZE_DATAID];
	char r[INPUT_BUFFER_SIZE];
	unsigned char *buf;
	int64_t ret, size;
	size_t written;

	size = nissy_solverinfo(args->str_solver, dataid);

	if (size < 0) {
		fprintf(stderr, "gendata: unknown solver %s\n",
		    args->str_solver);
		return -3;
	}

	for (i = 0; tablepaths[i] != NULL; i++) {
		strcpy(path, tablepaths[i]);
		strcat(path, dataid);

		if ((file = fopen(path, "rb")) != NULL) {
			fclose(file);
			fprintf(stderr, "gendata: file %s already exists, "
			    "overwrite? [Y/n] ", path);
			fgets(r, INPUT_BUFFER_SIZE, stdin);
			if (r[0] != '\n' && r[0] != 'Y' && r[0] != 'y') {
				fprintf(stderr, "gendata: aborting.\n");
				return -1;
			}
		}

		file = fopen(path, "wb");
		if (file != NULL)
			break;
	}

	if (tablepaths[i] == NULL) {
		fprintf(stderr, "Cannot write data to file\n");
		fclose(file);
		return -2;
	}

	buf = wrap_aligned_alloc((size_t)64, size);

	ret = nissy_gendata(args->str_solver, size, buf);
	if (ret < 0) {
		fprintf(stderr, "Unknown error in generating data\n");
		fclose(file);
		free(buf);
		return -4;
	}
	if (ret != size) {
		fprintf(stderr, "Unknown error: unexpected data size "
		    "got %" PRId64 ", expected %" PRId64 ")\n", ret, size);
		fclose(file);
		free(buf);
		return -5;
	}

	written = fwrite(buf, size, 1, file);
	fclose(file);
	free(buf);

	if (written != 1) {
		fprintf(stderr,
		    "Error: data was generated correctly, but could not be "
		    "written to file (generated %" PRId64 " bytes, written "
		    "%zu)\n", size, written);
		return -6;
	}

	fprintf(stderr, "Data written to %s\n", path);

	return 0;
}

static int64_t
solve_exec(args_t *args)
{
	int i;
	uint8_t nissflag;
	FILE *file;
	char solutions[SOLUTIONS_BUFFER_SIZE], path[MAX_PATH_LENGTH];
	unsigned char *buf;
	char dataid[NISSY_SIZE_DATAID];
	long long stats[NISSY_SIZE_SOLVE_STATS];
	int64_t ret, gendata_ret, size;
	size_t read;

	nissflag = parse_nisstype(args->str_nisstype);
	if (nissflag == UINT8_MAX) {
		fprintf(stderr, "solve: unknown niss type '%s', use one "
		    "of the following:\nnormal\ninverse\nlinear\nmixed\nall",
		    args->str_nisstype);
		return -1;
	}

	size = nissy_solverinfo(args->str_solver, dataid);

	if (size < 0) {
		fprintf(stderr, "solve: unknown solver '%s'\n",
		    args->str_solver);
		return size;
	}

	for (i = 0; tablepaths[i] != NULL; i++) {
		strcpy(path, tablepaths[i]);
		strcat(path, dataid);
		file = fopen(path, "rb");
		if (file != NULL)
			break;
	}

	if (tablepaths[i] == NULL) {
		fprintf(stderr,
		    "Cannot read data file, "
		    "generating it (this can take a while)\n");
		gendata_ret = gendata_exec(args);
		if (gendata_ret)
			return gendata_ret;
	}

	/* Ugh, this is not elegant TODO */
	if (file == NULL) {
		for (i = 0; tablepaths[i] != NULL; i++) {
			strcpy(path, tablepaths[i]);
			strcat(path, dataid);
			file = fopen(path, "rb");
			if (file != NULL)
				break;
		}
	}

	if (tablepaths[i] == NULL) {
		fprintf(stderr, "Error: data file not found\n");
		fclose(file);
		return -1;
	}

	if (args->maxsolutions == 0)
		args->maxsolutions = args->optimal == 20 ? 1 : UINT_MAX;

	buf = wrap_aligned_alloc((size_t)64, size);
	read = fread(buf, size, 1, file);
	fclose(file);
	if (read != 1) {
  		fprintf(stderr, "Error reading data from file: "
		    "fread() returned %zu instead of 1 when attempting to "
		    "read %" PRId64 " bytes from file %s\n", read, size, path);
		goto solve_exec_error;
	}

	ret = nissy_solve(
	    args->cube, args->str_solver, nissflag, args->minmoves,
	    args->maxmoves, args->maxsolutions, args->optimal, args->threads,
	    size, buf, SOLUTIONS_BUFFER_SIZE, solutions, stats, NULL, NULL);

	free(buf);

	if (ret == NISSY_OK || ret == NISSY_WARNING_UNSOLVABLE)
		fprintf(stderr, "No solutions found\n");
	else
		printf("%s", solutions);

	return 0;

solve_exec_error:
	free(buf);
	return -2;
}

static int64_t
solve_scramble_exec(args_t *args)
{
	nissy_applymoves(NISSY_SOLVED_CUBE, args->str_moves, args->cube);

	return solve_exec(args);
}

static int64_t
countmoves_exec(args_t *args)
{
	long long count;

	count = nissy_countmoves(args->str_moves);

	if (count >= 0)
		printf("%lld\n", count);

	return count >= 0 ? 0 : count;
}

static int64_t
comparemoves_exec(args_t *args)
{
	long long cmp;

	if ((cmp = nissy_comparemoves(args->str_moves, args->str_moves2)) < 0)
		return cmp;

	switch (cmp) {
	case NISSY_COMPARE_MOVES_EQUAL:
		printf("The two move sequences are equal\n");
		break;
	case NISSY_COMPARE_MOVES_DIFFERENT:
		printf("The two move sequences are different\n");
		break;
	default:
		printf("Error: unknown case\n");
		return -1;
	}

	return 0;
}

static int64_t
variation_exec(args_t *args)
{
	long long err;
	char result[SOLUTIONS_BUFFER_SIZE];

	err = nissy_variations(args->str_moves, args->str_variation,
	    SOLUTIONS_BUFFER_SIZE, result);

	if (err < 0)
		return err;
	printf("%s", result);

	return 0;
}

static int64_t
help_exec(args_t *args)
{
	int i;

	if (args->str_command == NULL || args->str_command[0] == '\0') {
		printf("This is a rudimentary shell for the H48 library.\n");
		printf("Available commands and usage:\n\n");
		for (i = 0; commands[i].name != NULL; i++)
			printf("%-15s%s\n", commands[i].name, commands[i].syn);
		printf("\nUse 'help -command COMMAND' for more information.\n");
	} else {
		for (i = 0; commands[i].name != NULL; i++)
			if (!strcmp(args->str_command, commands[i].name))
				break;
		if (commands[i].name == NULL) {
			printf("Unknown command %s\n", args->str_command);
			return 1;
		}
		printf("Command %s\n\n", commands[i].name);
		printf("Synopsis: %s\n\n", commands[i].syn);
		printf("Description: %s\n", commands[i].desc);
	}

	return 0;
}

static int
parse_args(int argc, char **argv, args_t *args)
{
	int i, j, n;

	*args = (args_t) {
		.command_index = -1,
		.cube = "",
		.str_cube = "",
		.str_moves = "",
		.str_moves2 = "",
		.str_trans = "",
		.str_solver = "",
		.str_variation = "",
		.str_nisstype = "",
		.minmoves = 0,
		.maxmoves = 20,
		.optimal = 20,
		.maxsolutions = 0,
		.threads = 0,
	};

	if (argc == 0) {
		printf("No command given\n");
		return 1;
	}

	for (i = 0; commands[i].name != NULL; i++) {
		if (!strcmp(argv[0], commands[i].name)) {
			args->command_index = i;
			break;
		}
	}

	if (commands[i].name == NULL) {
		fprintf(stderr, "Unknown command %s\n", argv[0]);
		return 1;
	}

	for (i = 1; i < argc; i++) {
		for (j = 0; options[j].name != NULL; j++) {
			n = argc - i - 1;
			if (strcmp(argv[i], options[j].name))
				continue;
			if (n < options[j].nargs) {
				fprintf(stderr,
				    "Too few arguments for option %s\n",
				    options[j].name);
				return 1;
			}
			if (!options[j].set(n, argv+i+1, args)) {
				fprintf(stderr,
				    "Error parsing arguments for option %s\n",
				    options[j].name);
				return 1;
			}
			i += options[j].nargs;
			break;
		}
		if (options[j].name == NULL) {
			fprintf(stderr, "Unknown option %s\n", argv[i]);
			return 1;
		}
	}

	return 0;
}

static bool
parse_uint(const char *argv, unsigned *result)
{
	*result = strtol(argv, NULL, 10);

	/* TODO: figure out how errno works and use it */
	return true;
}

static uint8_t
parse_nisstype(const char *arg)
{
	if (!strcmp("normal", arg) || !strcmp("", arg))
		return NISSY_NISSFLAG_NORMAL;

	if (!strcmp("inverse", arg))
		return NISSY_NISSFLAG_INVERSE;

	if (!strcmp("linear", arg))
		return NISSY_NISSFLAG_LINEAR;

	if (!strcmp("mixed", arg))
		return NISSY_NISSFLAG_MIXED;

	if (!strcmp("all", arg))
		return NISSY_NISSFLAG_ALL;

	return UINT8_MAX;
}

static bool
set_cube(int argc, char **argv, args_t *args)
{
	memcpy(args->cube, argv[0], NISSY_SIZE_CUBE);
	args->cube[21] = 0;

	return true;
}

static bool
set_str_command(int argc, char **argv, args_t *args)
{
	args->str_command = argv[0];

	return true;
}

static bool
set_str_cube(int argc, char **argv, args_t *args)
{
	args->str_cube = argv[0];

	return true;
}

static bool
set_str_moves(int argc, char **argv, args_t *args)
{
	args->str_moves = argv[0];

	return true;
}

static bool
set_str_moves2(int argc, char **argv, args_t *args)
{
	args->str_moves2 = argv[0];

	return true;
}

static bool
set_str_trans(int argc, char **argv, args_t *args)
{
	args->str_trans = argv[0];

	return true;
}

static bool
set_str_solver(int argc, char **argv, args_t *args)
{
	args->str_solver = argv[0];

	return true;
}

static bool
set_str_variation(int argc, char **argv, args_t *args)
{
	args->str_variation = argv[0];

	return true;
}

static bool
set_str_nisstype(int argc, char **argv, args_t *args)
{
	args->str_nisstype = argv[0];

	return true;
}

static bool
set_minmoves(int argc, char **argv, args_t *args)
{
	return parse_uint(argv[0], &args->minmoves);
}

static bool
set_maxmoves(int argc, char **argv, args_t *args)
{
	return parse_uint(argv[0], &args->maxmoves);
}

static bool
set_optimal(int argc, char **argv, args_t *args)
{
	return parse_uint(argv[0], &args->optimal);
}

static bool
set_maxsolutions(int argc, char **argv, args_t *args)
{
	return parse_uint(argv[0], &args->maxsolutions);
}

static bool
set_threads(int argc, char **argv, args_t *args)
{
	return parse_uint(argv[0], &args->threads);
}

void
log_stderr(const char *str, void *unused)
{
	fprintf(stderr, "%s", str);
}

int
main(int argc, char **argv)
{
	int parse_error;
	args_t args;

	srand(time(NULL));
	nissy_setlogger(log_stderr, NULL);

	parse_error = parse_args(argc-1, argv+1, &args);
	if (parse_error)
		return parse_error;

	return (int)commands[args.command_index].exec(&args);
}
