#ifndef SOLVERS_SOLUTIONS_TYPES_MACROS_H
#define SOLVERS_SOLUTIONS_TYPES_MACROS_H

#define SOLUTION_MAXLEN 20

typedef struct {
	uint8_t nmoves;
	uint8_t moves[SOLUTION_MAXLEN];
	uint8_t npremoves;
	uint8_t premoves[SOLUTION_MAXLEN];
} solution_moves_t;

typedef struct {
	bool unniss;
	uint8_t maxmoves;
	uint64_t maxsolutions;
	uint8_t optimal;
	uint8_t orientation;
} solution_settings_t;

typedef struct {
	wrapthread_atomic uint64_t nsols;
	uint8_t shortest_sol;
	size_t size;
	size_t used;
	char *buf;
} solution_list_t;

#endif /* SOLVERS_SOLUTIONS_TYPES_MACROS_H */
