#include "../test.h"

int64_t countmoves(const char *);

void run(void) {
	char movestr[STRLENMAX];

	fgets(movestr, STRLENMAX, stdin);

	printf("%" PRId64 "\n", countmoves(movestr));
}
