#ifndef SOLVERS_COORD_MULTISOLVE_H
#define SOLVERS_COORD_MULTISOLVE_H

/*
For now the only multicoordinate is DRFIN, and this solver reflects this.
For example, NISS is not available.
*/

typedef struct {
	cube_t cube;
	cube_t inverse;
	uint8_t target_depth;
	solution_moves_t *solution_moves;
	solution_settings_t *solution_settings;
	uint64_t tmask;
	solution_list_t *solution_list;
	multicoord_t *mcoord;
	const unsigned char *coord_data[MAX_MULTICOORD_NCOORDS];
	const unsigned char *ptable[MAX_MULTICOORD_NCOORDS];
} dfsarg_solve_multicoord_t;

STATIC int64_t solve_multicoord(oriented_cube_t, multicoord_t [NON_NULL],
    uint8_t, uint8_t, uint8_t, uint64_t, uint8_t, uint8_t, uint64_t,
    const unsigned char *, size_t, char *, int (*)(void *), void *);
STATIC long long solve_multicoord_dispatch(oriented_cube_t, const char *,
    unsigned, unsigned, unsigned, unsigned, unsigned, unsigned,
    unsigned long long, const unsigned char *, unsigned, char *,
    long long [SIZE(NISSY_SIZE_SOLVE_STATS)], int (*)(void *), void *);
STATIC bool multicoord_solution_admissible(
    const dfsarg_solve_multicoord_t [NON_NULL]);
STATIC bool multicoord_dfs_stop(const dfsarg_solve_multicoord_t [NON_NULL]);
STATIC int64_t solve_multicoord_dfs(dfsarg_solve_multicoord_t [NON_NULL]);

STATIC bool
multicoord_solution_admissible(const dfsarg_solve_multicoord_t arg[NON_NULL])
{
	uint8_t n, i;
	const coord_t *c;

	n = arg->solution_moves->nmoves + arg->solution_moves->npremoves;
	if (arg->target_depth != n)
		return false;

	for (i = 0; arg->mcoord->coordinates[i] != NULL; i++) {
		c = arg->mcoord->coordinates[i];
		if (c->is_admissible != NULL &&
		    !c->is_admissible(arg->solution_moves))
			return false;
	}

	return true;
}

STATIC bool
multicoord_dfs_stop(const dfsarg_solve_multicoord_t arg[NON_NULL])
{
	uint8_t pval, i;
	uint64_t cval;
	const coord_t *c;

	for (i = 0, pval = 0; arg->mcoord->coordinates[i] != NULL; i++) {
		c = arg->mcoord->coordinates[i];

		cval = c->coord(arg->cube, arg->coord_data[i]);
		pval = MAX(pval, get_coord_pval(c, arg->ptable[i], cval));

		cval = c->coord(arg->inverse, arg->coord_data[i]);
		pval = MAX(pval, get_coord_pval(c, arg->ptable[i], cval));
	}

	return arg->solution_moves->nmoves + pval > arg->target_depth;
}

STATIC int64_t
solve_multicoord_dfs(dfsarg_solve_multicoord_t arg[NON_NULL])
{
	uint8_t m, l, i;
	uint64_t mm, coord;
	int64_t n, ret;
	const coord_t *c;
	cube_t backup_cube, backup_inverse;

	for (i = 0; arg->mcoord->coordinates[i] != NULL; i++) {
		c = arg->mcoord->coordinates[i];
		coord = c->coord(arg->cube, arg->coord_data[i]);
		if (!coord_is_solved(c, coord, arg->coord_data[i]))
			goto solve_multicoord_dfs_notsolved;
	}

	/* All coordinates are solved */
	if (!multicoord_solution_admissible(arg))
		return 0;
	return appendsolution(arg->solution_moves, 1, &arg->tmask,
	    arg->solution_settings, arg->solution_list);

solve_multicoord_dfs_notsolved:
	if (multicoord_dfs_stop(arg))
		return 0;

	backup_cube = arg->cube;
	backup_inverse = arg->inverse;
	ret = 0;

	l = arg->solution_moves->nmoves;
	mm = arg->mcoord->moves_mask;
	if (l != 0) {
		m = arg->solution_moves->moves[l-1];
		mm &= allowedmask[movebase(m)];
	}
	arg->solution_moves->nmoves++;

	for (m = 0; m < NMOVES; m++) {
		if (!(mm & (UINT64_C(1) << (uint64_t)m)))
			continue;

		arg->solution_moves->moves[l] = m;
		arg->cube = move(backup_cube, m);
		arg->inverse = premove(backup_inverse, m);
		n = solve_multicoord_dfs(arg);
		if (n < 0)
			return n;
		ret += n;
	}

	arg->solution_moves->nmoves--;
	arg->cube = backup_cube;
	arg->inverse = backup_inverse;

	return ret;
}

STATIC long long
solve_multicoord_dispatch(
	oriented_cube_t oc,
	const char *coord_and_trans,
	unsigned nissflag,
	unsigned minmoves,
	unsigned maxmoves,
	unsigned maxsolutions,
	unsigned optimal,
	unsigned threads,
	unsigned long long data_size,
	const unsigned char *data,
	unsigned solutions_size,
	char *sols,
	long long stats[SIZE(NISSY_SIZE_SOLVE_STATS)],
	int (*poll_status)(void *),
	void *poll_status_data
)
{
	multicoord_t *mcoord;
	uint8_t trans;

	parse_coord_and_trans(coord_and_trans, NULL, &mcoord, &trans);

	if (mcoord == NULL) {
		LOG("Error: could not parse coordinate from '%s'\n",
		    coord_and_trans);
		return NISSY_ERROR_INVALID_SOLVER;
	}

	if (trans == UINT8_ERROR) {
		LOG("Error: could not parse transformation from '%s'\n",
		    coord_and_trans);
		return NISSY_ERROR_INVALID_SOLVER;
	}

	return solve_multicoord(oc, mcoord, trans, (uint8_t)minmoves,
	    (uint8_t)maxmoves, (uint8_t)maxsolutions, (uint8_t)optimal,
		(uint8_t)threads, data_size, data, solutions_size, sols,
		poll_status, poll_status_data);
}

STATIC int64_t
solve_multicoord(
	oriented_cube_t oc,
	multicoord_t mcoord [NON_NULL],
	uint8_t trans,
	uint8_t minmoves,
	uint8_t maxmoves,
	uint64_t maxsolutions,
	uint8_t optimal,
	uint8_t threads,
	uint64_t data_size,
	const unsigned char *data,
	size_t solutions_size,
	char *sols,
	int (*poll_status)(void *),
	void *poll_status_data
)
{
	int8_t d;
	size_t j, of;
	uint64_t i;
	int64_t err;
	cube_t c;
	const coord_t *coord;
	dfsarg_solve_multicoord_t arg;
	tableinfo_t info;
	solution_moves_t solution_moves;
	solution_settings_t solution_settings;
	solution_list_t solution_list;

	c = transform(oc.cube, trans);

	if (!mcoord->is_solvable(c))
		goto solve_multicoord_error_unsolvable;

	if (!solution_list_init(&solution_list, solutions_size, sols))
		goto solve_multicoord_error_buffer;

	solution_moves_reset(&solution_moves);

	solution_settings = (solution_settings_t) {
		.unniss = false,
		.maxmoves = maxmoves,
		.maxsolutions = maxsolutions,
		.optimal = optimal,
		.orientation = oc.orientation,
	};

	arg = (dfsarg_solve_multicoord_t) {
		.cube = c,
		.inverse = inverse(c),
		.mcoord = mcoord,
		.solution_moves = &solution_moves,
		.solution_settings = &solution_settings,
		.tmask = TM_SINGLE(inverse_trans(trans)),
		.solution_list = &solution_list,
	};

	for (j = 0, of = INFOSIZE; mcoord->coordinates[j] != NULL; j++) {
		if (readtableinfo(data_size-of, data+of, &info) != NISSY_OK)
			goto solve_multicoord_error_data;

		if (info.type == TABLETYPE_PRUNING) {
			/* Only the pruning table */
			arg.coord_data[j] = NULL;
			arg.ptable[j] = data + of + INFOSIZE;
			of += info.fullsize;
		} else {
			/* Coordinate has extra data */
			arg.coord_data[j] = data + of + INFOSIZE;
			arg.ptable[j] = data + of + info.next + INFOSIZE;
			of += info.fullsize;
			if (readtableinfo(data_size-of, data+of, &info)
			    != NISSY_OK)
				goto solve_multicoord_error_data;
			of += info.fullsize;
		}

		/* Skip padding */
		while (of % 8 != 0)
			of++;
	}

	for (j = 0; mcoord->coordinates[j] != NULL; j++) {
		coord = mcoord->coordinates[j];
		i = coord->coord(c, arg.coord_data[j]);
		if (!coord_is_solved(coord, i, arg.coord_data[j]))
			goto solve_multicoord_notsolved;
	}

	/* All coordinates are solved */
	if (minmoves == 0 && !appendsolution(&solution_moves, 1,
	    &arg.tmask, &solution_settings, &solution_list))
		goto solve_multicoord_error_buffer;
	goto solve_multicoord_done;

solve_multicoord_notsolved:
	for (
	    d = MAX(minmoves, 1);
	    !solutions_done(&solution_list, &solution_settings, d);
	    d++
	) {
		if (d >= 12)
			LOG("[%s solve] Found %" PRIu64 " solutions, "
			    "searching at depth %" PRId8 "\n",
			    mcoord->name, solution_list.nsols, d);

		arg.target_depth = d;
		solution_moves_reset(arg.solution_moves);
		if ((err = solve_multicoord_dfs(&arg)) < 0)
			return err;
	}

solve_multicoord_done:
	return (int64_t)solution_list.nsols;

solve_multicoord_error_data:
	LOG("[%s solve] Error reading table\n", mcoord->name);
	return NISSY_ERROR_DATA;

solve_multicoord_error_buffer:
	LOG("[%s solve] Error appending solution to buffer: size too small\n",
	    mcoord->name);
	return NISSY_ERROR_BUFFER_SIZE;

solve_multicoord_error_unsolvable:
	LOG("[%s solve] Error: cube not ready\n", mcoord->name);
	return NISSY_ERROR_UNSOLVABLE_CUBE;
}

#endif /* SOLVERS_COORD_MULTISOLVE_H */
