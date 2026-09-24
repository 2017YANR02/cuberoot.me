#include "../test.h"

bool allowedmoves(size_t n, const uint8_t *);

static char *moves[] = {
	"U", "U2", "U'",
	"D", "D2", "D'",
	"R", "R2", "R'",
	"L", "L2", "L'",
	"F", "F2", "F'",
	"B", "B2", "B'",
};

void run(void) {
	char movestr[STRLENMAX];
	uint8_t j, m[100];
	int n, i;

	fgets(movestr, STRLENMAX, stdin);
	n = atoi(movestr);

	for (i = 0; i < n; i++) {
		fgets(movestr, STRLENMAX, stdin);
		movestr[strcspn(movestr, "\n")] = 0;
		for (j = 0; j < 18; j++)
			if (!strcmp(movestr, moves[j]))
				m[i] = j;
	}

	printf("%s\n", allowedmoves(n, m) ? "true" : "false");
}
