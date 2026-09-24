#ifndef SOLVERS_H48_MAP_TYPES_MACROS_H
#define SOLVERS_H48_MAP_TYPES_MACROS_H

#define MAP_UNSET             UINT64_C(0xFFFFFFFFFFFFFFFF)
#define MAP_KEYMASK           UINT64_C(0xFFFFFFFFFF)
#define MAP_KEYSHIFT          UINT64_C(40)
#define MAP_UNSET_VAL         (MAP_UNSET >> MAP_KEYSHIFT)

typedef struct {
	uint64_t n;
	uint64_t capacity;
	uint64_t randomizer;
	uint64_t *table;
} h48map_t;

typedef struct {
	uint64_t key;
	uint64_t val;
} kvpair_t;

#endif /* SOLVERS_H48_MAP_TYPES_MACROS_H */
