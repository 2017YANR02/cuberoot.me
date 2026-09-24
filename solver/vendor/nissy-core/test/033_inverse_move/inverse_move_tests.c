#include "../test.h"

extern char *movestr[];

int64_t readmoves(const char *, size_t n, size_t m,
    size_t *, size_t *, uint8_t *, uint8_t *);
uint8_t inverse_move(uint8_t);

void run(void) {
	size_t inv, nor;
	int64_t tot;
	uint8_t moves[2];

	char moves_string[STRLENMAX];

	fgets(moves_string, STRLENMAX, stdin);
	tot = readmoves(moves_string, 2, 0, &nor, &inv, moves, NULL);
	if (nor != 1 || tot != 1) {
		printf("Test error reading moves\n");
		return;
	}

fprintf(stderr, "Read move %" PRIu8 " = %s\n", moves[0], movestr[moves[0]]);

	printf("%s\n", movestr[inverse_move(moves[0])]);
}
