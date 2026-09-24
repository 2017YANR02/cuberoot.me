#include "../test.h"

#define BOUND   100000
#define TGROUP  UINT64_C(4278190335)

cube_t transform(cube_t, uint8_t);
uint64_t coordinate_drfinnoe_coord(cube_t, const unsigned char *);
cube_t coordinate_drfinnoe_cube(uint64_t, const unsigned char *);
size_t coordinate_drfinnoe_gendata(unsigned char *);

void run(void) {
	bool found;
	uint8_t t;
	char str[STRLENMAX];
	unsigned char *data;
	size_t size;
	cube_t cube;
	oriented_cube_t oc;
	uint64_t coord, coord2;

	size = coordinate_drfinnoe_gendata(NULL);
	data = malloc(size);
	coordinate_drfinnoe_gendata(data);

	for (coord = 0; coord < BOUND; coord++) {
		cube = coordinate_drfinnoe_cube(coord, data);

		oc = (oriented_cube_t) { .cube = cube, .orientation = 0 };
		if (!isconsistent(oc)) {
			printf("Error: invcoord of %" PRId64
			    " is not consistent\n", coord);
			goto cleanup;
		}

		for (t = 0, found = false, coord2 = UINT64_MAX; t < 48; t++) {
			if (!((UINT64_C(1) << (uint64_t)t) & TGROUP))
				continue;

			coord2 = coordinate_drfinnoe_coord(transform(cube, t), data);
			if (coord == coord2) {
				found = true;
				break;
			}
		}

		if (!found) {
			oc = (oriented_cube_t){.cube = cube, .orientation = 0};
			printf("Error: invcoord of %" PRId64 " returns %"
			    PRId64 " with cube:\n", coord, coord2);
			writecube(oc, STRLENMAX, str);
			printf("%s\n", str);
			goto cleanup;
		}
	}

	printf("All good\n");

cleanup:
	free(data);
}
