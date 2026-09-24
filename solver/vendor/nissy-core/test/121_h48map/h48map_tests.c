#include "../test.h"

#define MAXPOS 1000

void h48map_create(h48map_t [NON_NULL], uint64_t, uint64_t);
void h48map_destroy(h48map_t [NON_NULL]);
void h48map_insertmin(h48map_t [NON_NULL], uint64_t, uint64_t);
uint64_t h48map_value(h48map_t [NON_NULL], uint64_t);
kvpair_t h48map_nextkvpair(h48map_t [NON_NULL], uint64_t [NON_NULL]);

char str[STRLENMAX];

int compare(const void *x, const void *y) {
	uint64_t a = ((kvpair_t *)x)->key;
	uint64_t b = ((kvpair_t *)y)->key;

	if (a > b) return 1;
	if (a == b) return 0;
	return -1;
}

uint64_t readl(void) {
	fgets(str, STRLENMAX, stdin);
	return atoll(str);
}

void run(void) {
	h48map_t map;
	uint64_t n, i, j, capacity, randomizer, x, y, v;
	kvpair_t kv, a[MAXPOS], b[MAXPOS];

	capacity = readl();
	randomizer = readl();
	n = readl();

	for (i = 0; i < n; i++) {
		x = readl();
		y = readl();
		a[i] = (kvpair_t) { .key = x, .val = y };
	}

	h48map_create(&map, capacity, randomizer);
	for (i = 0; i < n; i++)
		h48map_insertmin(&map, a[i].key, a[i].val);

	i = 0;
	for (kv = h48map_nextkvpair(&map, &i), j = 0;
	     i != map.capacity && j < MAXPOS;
	     kv = h48map_nextkvpair(&map, &i)
	) {
		b[j++] = kv;
	}
	qsort(b, j, sizeof(kvpair_t), compare);

	printf("%" PRIu64 "\n", map.n);
	for (i = 0; i < j; i++)
		printf("%" PRIu64 " %" PRIu64 "\n", b[i].key, b[i].val);
	if (map.n != j)
		printf("Wrong number of elements: map->n = %" PRIu64 ", "
		    "but scan returns %" PRIu64 "\n", map.n, j);
	for (i = 0; i < n; i++) {
		v = h48map_value(&map, a[i].key);
		if (v > a[i].val)
			printf("Value for key %" PRId64 " is larger than "
			    "expected (%" PRIu64 " > %" PRIu64 ")\n",
			    a[i].key, v, a[i].val);
	}

	h48map_destroy(&map);
}
