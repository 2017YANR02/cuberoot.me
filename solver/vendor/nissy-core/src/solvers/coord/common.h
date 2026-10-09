#ifndef SOLVERS_COORD_COMMON_H
#define SOLVERS_COORD_COMMON_H

STATIC uint64_t coord_coord_generic(
    const coord_t [NON_NULL], cube_t, const unsigned char *);
STATIC cube_t coord_cube_generic(
    const coord_t [NON_NULL], uint64_t, const unsigned char *);
STATIC bool coord_isnasty_generic(
    const coord_t [NON_NULL], uint64_t, const unsigned char *);
STATIC size_t coord_gendata_generic(const coord_t [NON_NULL], unsigned char *);

STATIC bool solution_lastqt_cw(const solution_moves_t [NON_NULL]);
STATIC bool coord_can_switch(const coord_t [NON_NULL], const unsigned char *,
    size_t, const uint8_t *);
STATIC bool coord_is_solved(
    const coord_t [NON_NULL], uint64_t, const unsigned char *);

STATIC cube_t coordinate_merge_ce(cube_t, cube_t);
STATIC cube_t coordinate_merge_ec(cube_t, cube_t);
STATIC cube_t coordinate_merge_cpco(cube_t, cube_t);

STATIC uint64_t
coord_coord_generic(
	const coord_t coord[NON_NULL],
	cube_t c,
	const unsigned char *data
)
{
	const uint32_t *data32;
	uint32_t d;
	cube_t tr;

	data32 = (const uint32_t *)(data + INFOSIZE);
	d = data32[coord->sym.coord(c)];
	tr = transform(c, COORD_TTREP(d));

	return COORD_CLASS(d) * coord->sym.max2 + coord->sym.coord2(tr);
}

STATIC cube_t
coord_cube_generic(
	const coord_t coord[NON_NULL],
	uint64_t i,
	const unsigned char *data
)
{
	const unsigned char *datanoinfo;
	const uint32_t *rep32;
	cube_t c;

	datanoinfo = data + INFOSIZE;
	rep32 = (const uint32_t *)(datanoinfo + 4 * (size_t)coord->sym.max);
	c = coord->sym.cube(rep32[i / coord->sym.max2]);

	return coord->sym.merge(c, coord->sym.cube2(i % coord->sym.max2));
}

STATIC bool
coord_isnasty_generic(
	const coord_t coord[NON_NULL],
	uint64_t i,
	const unsigned char *data
)
{
	const unsigned char *datanoinfo;
	const uint32_t *classttrep, *rep32;
	uint32_t r;

	datanoinfo = data + INFOSIZE;
	classttrep = (const uint32_t *)datanoinfo;
	rep32 = (const uint32_t *)(datanoinfo + 4 * (size_t)coord->sym.max);
	r = rep32[i / coord->sym.max2];

	return COORD_ISNASTY(classttrep[r]);
}

STATIC size_t
coord_gendata_generic(
	const coord_t coord[NON_NULL],
	unsigned char *data
)
{
	uint64_t i, j, n, nasty;
	uint8_t t;
	unsigned char *datanoinfo;
	uint32_t *classttrep, *rep;
	size_t coord_datasize;
	cube_t c;
	tableinfo_t info;

	coord_datasize = INFOSIZE + 4*(coord->sym.classes + coord->sym.max);

	if (data == NULL)
		return coord_datasize;

	datanoinfo = data + INFOSIZE;
	classttrep = (uint32_t *)datanoinfo;
	rep = classttrep + coord->sym.max;
	memset(data, 0xFF, coord_datasize);

	info = (tableinfo_t) {
		.solver = "coord data for ",
		.type = TABLETYPE_SPECIAL,
		.infosize = INFOSIZE,
		.fullsize = coord_datasize,
		.hash = 0,
		.entries = coord->sym.classes + coord->sym.max,
		.classes = coord->sym.classes,
		.bits = 32,
		.base = 0,
		.maxvalue = 0,
		.next = 0
	};
	append_name(&info, coord->name);

	for (i = 0, n = 0; i < coord->sym.max; i++) {
		if (classttrep[i] != 0xFFFFFFFF)
			continue;

		c = coord->sym.cube(i);
		for (t = 1, nasty = 0; t < NTRANS && !nasty; t++) {
			if (!((UINT64_C(1) << t) & coord->trans_mask))
				continue;

			nasty = i == coord->sym.coord(transform(c, t));
		}

		for (t = 0; t < NTRANS; t++) {
			if (!((UINT64_C(1) << (uint64_t)t) & coord->trans_mask))
				continue;

			j = coord->sym.coord(transform(c, t));
			classttrep[j] = (uint32_t)(
			    (n << COORD_CLASS_SHIFT) |
			    (nasty << COORD_ISNASTY_SHIFT) |
			    (inverse_trans(t) << COORD_TTREP_SHIFT)
			);
		}
		rep[n++] = (uint32_t)i;
	}

	writetableinfo(&info, coord_datasize, data);

	DBG_ASSERT(n == coord->sym.classes,
	    "%s coordinate data: computed %" PRIu64 " classes, "
	    "expected %" PRIu64 "\n", coord->name, n, coord->sym.classes);

	return coord_datasize;
}

STATIC bool
solution_lastqt_cw(const solution_moves_t s[NON_NULL])
{
	return are_lastmoves_singlecw(s->nmoves, s->moves) &&
	    are_lastmoves_singlecw(s->npremoves, s->premoves);
}

STATIC bool
solution_always_valid(const solution_moves_t s[NON_NULL])
{
	return true;
}

STATIC bool
coord_can_switch(
	const coord_t coord[NON_NULL],
	const unsigned char *data,
	size_t n,
	const uint8_t *moves
)
{
	/*
	This function checks that the last move (or two moves, if parallel)
	have a non-trivial effect on the coordinate of the solved cube. This
	works in general for all coordinates that have been used so far, but
	in more general cases that have not been considered yet it may fail.
	*/

	uint64_t i;

	DBG_ASSERT(n > 0, "Error: cannot check if coordinate solver "
	    "can use NISS after 0 moves");

	if (!coord->allow_niss)
		return false;

	i = coord->coord(move(SOLVED_CUBE, moves[n-1]), data);
	if (i == 0)
		return false;

	if (n == 1 || !parallel(moves[n-1], moves[n-2]))
		return true;

	i = coord->coord(move(SOLVED_CUBE, moves[n-1]), data);
	return i != 0;
}

STATIC bool
coord_is_solved(
	const coord_t coord[NON_NULL],
	uint64_t i,
	const unsigned char *data
)
{
	return coord->is_solved == NULL ? i == 0 : coord->is_solved(i, data);
}

STATIC cube_t
coordinate_merge_ce(cube_t corners, cube_t edges)
{
	cube_t merged;

	merged = corners;
	copy_edges(&merged, edges);

	return merged;
}

STATIC cube_t
coordinate_merge_ec(cube_t edges, cube_t corners)
{
	return coordinate_merge_ce(corners, edges);
}

STATIC cube_t
coordinate_merge_cpco(cube_t cp, cube_t co)
{
	cube_t merged;

	merged = cp;
	copy_co(&merged, co);

	return merged;
}

#endif /* SOLVERS_COORD_COMMON_H */
