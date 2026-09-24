#ifndef SOLVERS_H48_MAP_H
#define SOLVERS_H48_MAP_H

STATIC void h48map_create(h48map_t [NON_NULL], uint64_t, uint64_t);
STATIC void h48map_clear(h48map_t [NON_NULL]);
STATIC void h48map_destroy(h48map_t [NON_NULL]);
STATIC uint64_t h48map_lookup(h48map_t [NON_NULL], uint64_t);
STATIC void h48map_insertmin(h48map_t [NON_NULL], uint64_t, uint64_t);
STATIC uint64_t h48map_value(h48map_t [NON_NULL], uint64_t);
STATIC kvpair_t h48map_nextkvpair(h48map_t [NON_NULL], uint64_t [NON_NULL]);

STATIC void
h48map_create(h48map_t map[NON_NULL], uint64_t capacity, uint64_t randomizer)
{
	map->capacity = capacity;
	map->randomizer = randomizer;

	map->table = malloc(map->capacity * sizeof(uint64_t));
	h48map_clear(map);
}

STATIC void
h48map_clear(h48map_t map[NON_NULL])
{
	memset(map->table, 0xFF, map->capacity * sizeof(uint64_t));
	map->n = 0;
}

STATIC void
h48map_destroy(h48map_t map[NON_NULL])
{
	free(map->table);
}

STATIC_INLINE uint64_t
h48map_lookup(h48map_t map[NON_NULL], uint64_t x)
{
	uint64_t hash, i;

	hash = ((x % map->capacity) * map->randomizer) % map->capacity;
	for (i = hash;
	     map->table[i] != MAP_UNSET && (map->table[i] & MAP_KEYMASK) != x;
	     i = (i+1) % map->capacity
	) ;

	return i;
}

STATIC_INLINE void
h48map_insertmin(h48map_t map[NON_NULL], uint64_t key, uint64_t val)
{
	uint64_t i, oldval, min;

	i = h48map_lookup(map, key);
	oldval = map->table[i] >> MAP_KEYSHIFT;
	min = MIN(val, oldval);

	map->n += map->table[i] == MAP_UNSET;
	map->table[i] = (key & MAP_KEYMASK) | (min << MAP_KEYSHIFT);
}

STATIC_INLINE uint64_t
h48map_value(h48map_t map[NON_NULL], uint64_t key)
{
	return map->table[h48map_lookup(map, key)] >> MAP_KEYSHIFT;
}

STATIC kvpair_t
h48map_nextkvpair(h48map_t map[NON_NULL], uint64_t p[NON_NULL])
{
	kvpair_t kv;
	uint64_t pair;

	kv.key = MAP_KEYMASK;
	kv.val = MAP_UNSET_VAL;

	for ( ; *p < map->capacity; (*p)++) {
		if (map->table[*p] != MAP_UNSET) {
			pair = map->table[(*p)++];
			kv.key = pair & MAP_KEYMASK;
			kv.val = pair >> MAP_KEYSHIFT;
			return kv;
		}
	}

	return kv;
}

#endif /* SOLVERS_H48_MAP_H */
