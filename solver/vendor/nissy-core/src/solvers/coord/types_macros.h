#ifndef SOLVERS_COORD_TYPES_MACROS_H
#define SOLVERS_COORD_TYPES_MACROS_H

#define COORD_INDEX(i)      ((i)/2)
#define COORD_SHIFT(i)      (UINT8_C(4) * (uint8_t)((i) % 2))
#define COORD_MASK(i)       (UINT8_C(0xF) << COORD_SHIFT(i))

#define COORD_CLASS_SHIFT   UINT32_C(16)
#define COORD_CLASS_MASK    (UINT32_C(0xFFFF) << COORD_CLASS_SHIFT)
#define COORD_CLASS(d)      (((d) & COORD_CLASS_MASK) >> COORD_CLASS_SHIFT)

#define COORD_TTREP_SHIFT   UINT32_C(0)
#define COORD_TTREP_MASK    (UINT32_C(0xFF) << COORD_TTREP_SHIFT)
#define COORD_TTREP(d)      (((d) & COORD_TTREP_MASK) >> COORD_TTREP_SHIFT)

#define COORD_ISNASTY_SHIFT UINT32_C(8)
#define COORD_ISNASTY_MASK  (UINT32_C(0xFF) << COORD_ISNASTY_SHIFT)
#define COORD_ISNASTY(d)    (((d) & COORD_ISNASTY_MASK) >> COORD_ISNASTY_SHIFT)

#define MAX_MULTICOORD_NCOORDS 4

typedef struct {
	const char name[255];
	uint64_t (*coord)(cube_t, const unsigned char *);
	cube_t (*cube)(uint64_t, const unsigned char *);
	bool (*isnasty)(uint64_t, const unsigned char *);
	size_t (*gendata)(unsigned char *);
	uint64_t max;
	/* moves_mask_gendata must be invariant under trans_mask */
	uint64_t moves_mask_gendata;
	uint64_t moves_mask_solve;
	uint64_t trans_mask;
	bool (*is_admissible)(const solution_moves_t[NON_NULL]);
	bool (*solution_prune)(const solution_moves_t[NON_NULL]);
	bool (*is_solvable)(cube_t);
	/* if is_solved is null, coord == 0 is used */
	bool (*is_solved)(uint64_t, const unsigned char *);
	uint64_t pruning_distribution[INFO_DISTRIBUTION_LEN];
	uint8_t pruning_max;
	bool allow_niss;
	struct {
		size_t classes;
		uint64_t max;
		uint64_t (*coord)(cube_t);
		cube_t (*cube)(uint64_t);
		uint64_t max2;
		uint64_t (*coord2)(cube_t);
		cube_t (*cube2)(uint64_t);
		cube_t (*merge)(cube_t, cube_t);
	} sym;
} coord_t;

typedef struct {
	const char name[255];
	coord_t *coordinates[MAX_MULTICOORD_NCOORDS];
	uint64_t moves_mask;
	bool (*is_solvable)(cube_t);
} multicoord_t;

#endif /* SOLVERS_COORD_TYPES_MACROS_H */
