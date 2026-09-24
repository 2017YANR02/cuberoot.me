#ifndef SOLVERS_COORD_SOLVE_H
#define SOLVERS_COORD_SOLVE_H

typedef struct {
	cube_t cube;
	cube_t inverse;
	uint8_t target_depth;
	solution_moves_t *solution_moves;
	uint64_t tmask;
	solution_settings_t *solution_settings;
	solution_list_t *solution_list;
	uint8_t nissflag;
	bool lastisnormal;
	coord_t *coord;
	const unsigned char *coord_data;
	const unsigned char *ptable;
} dfsarg_solve_coord_t;

STATIC int64_t solve_coord(oriented_cube_t, coord_t [NON_NULL], uint8_t,
    uint8_t, uint8_t, uint8_t, uint64_t, uint8_t, uint8_t, uint64_t,
    const unsigned char *, size_t, char *, int (*)(void *), void *);
STATIC long long solve_coord_dispatch(oriented_cube_t, const char *, unsigned,
    unsigned, unsigned, unsigned, unsigned, unsigned, unsigned long long,
    const unsigned char *, unsigned, char *,
    long long [SIZE(NISSY_SIZE_SOLVE_STATS)], int (*)(void *), void *);
STATIC bool coord_solution_admissible(const dfsarg_solve_coord_t [NON_NULL]);
STATIC bool coord_continue_onnormal(const dfsarg_solve_coord_t [NON_NULL]);
STATIC bool coord_continue_oninverse(const dfsarg_solve_coord_t [NON_NULL]);
STATIC int64_t solve_coord_dfs(dfsarg_solve_coord_t [NON_NULL]);

STATIC bool
coord_solution_admissible(const dfsarg_solve_coord_t arg[NON_NULL])
{
	uint8_t n;

	n = arg->solution_moves->nmoves + arg->solution_moves->npremoves;
	if (arg->target_depth != n)
		return false;

	return arg->coord->is_admissible == NULL ||
	    arg->coord->is_admissible(arg->solution_moves);
}

STATIC bool
coord_continue_onnormal(const dfsarg_solve_coord_t arg[NON_NULL])
{
	uint8_t flag, nn, ni, swbound_n, swbound_i, pval;
	uint64_t coord;

	flag = arg->nissflag;
	nn = arg->solution_moves->nmoves;
	ni = arg->solution_moves->npremoves;
	swbound_n = arg->target_depth / 2;
	swbound_i = DIV_ROUND_UP(arg->target_depth, 2) - 1;

	/* If only inverse moves are allowed */
	if (flag == NISSY_NISSFLAG_INVERSE)
		return false;

	/* Pruning table check */
	if (!(flag & NISSY_NISSFLAG_MIXED) || ni != 0) {
		coord = arg->coord->coord(arg->cube, arg->coord_data);
		pval = get_coord_pval(arg->coord, arg->ptable, coord);
		if (nn + ni + pval > arg->target_depth)
			return false;
	}
	
	/* It's the first move */
	if (nn + ni == 0)
		return true;

	if (arg->lastisnormal) {
		/* Can continue if we have already switched */
		if (ni > 0)
			return true;

		/* Check that we have enough moves left to switch */
		return flag & NISSY_NISSFLAG_NORMAL || nn < swbound_n;
	} else {
		/* Don't switch if not allowed */
		if (!(flag & NISSY_NISSFLAG_MIXED))
			return false;

		/* Forbid switching multiple times */
		if (nn > 0)
			return false;

		/* Some coordinates are not allowed to switch */
		if (!coord_can_switch(arg->coord, arg->coord_data,
		    ni, arg->solution_moves->premoves))
			return false;

		/* Only switch before half solution is found */
		return ni <= swbound_i;
	}
}

STATIC bool
coord_continue_oninverse(const dfsarg_solve_coord_t arg[NON_NULL])
{
	uint8_t flag, nn, ni, swbound_n, swbound_i, pval;
	uint64_t coord;

	flag = arg->nissflag;
	nn = arg->solution_moves->nmoves;
	ni = arg->solution_moves->npremoves;
	swbound_n = arg->target_depth / 2;
	swbound_i = DIV_ROUND_UP(arg->target_depth, 2) - 1;

	/* If only normal moves are allowed */
	if (flag == NISSY_NISSFLAG_NORMAL)
		return false;

	/* Pruning table check */
	if (!(flag & NISSY_NISSFLAG_MIXED) || nn != 0) {
		coord = arg->coord->coord(arg->inverse, arg->coord_data);
		pval = get_coord_pval(arg->coord, arg->ptable, coord);
		if (nn + ni + pval > arg->target_depth)
			return false;
	}
	
	/* It's the first move */
	if (nn + ni == 0)
		return true;

	if (!arg->lastisnormal) {
		/* Can continue if we have already switched */
		if (nn > 0)
			return true;

		/* Check that we have enough moves left to switch */
		return flag & NISSY_NISSFLAG_INVERSE || ni < swbound_i;
	} else {
		/* Don't switch if not allowed */
		if (!(flag & NISSY_NISSFLAG_MIXED))
			return false;

		/* Forbid switching multiple times */
		if (ni > 0)
			return false;

		/* Some coordinates are not allowed to switch */
		if (!coord_can_switch(arg->coord, arg->coord_data,
		    nn, arg->solution_moves->moves))
			return false;

		/* Only switch before half solution is found */
		return nn <= swbound_n;
	}
}

STATIC int64_t
solve_coord_dfs(dfsarg_solve_coord_t arg[NON_NULL])
{
	bool lastbackup;
	uint8_t m, l, nnbackup, nibackup, nmoves;
	uint64_t mm, coord;
	int64_t n, ret;
	cube_t backup_cube, backup_inverse;

	if (arg->coord->solution_prune != NULL &&
	    arg->coord->solution_prune(arg->solution_moves))
		return 0;

	coord = arg->coord->coord(arg->cube, arg->coord_data);
	if (coord_is_solved(arg->coord, coord, arg->coord_data)) {
		if (!coord_solution_admissible(arg))
			return 0;
		return appendsolution(arg->solution_moves, 1, &arg->tmask,
		    arg->solution_settings, arg->solution_list);
	}

	backup_cube = arg->cube;
	backup_inverse = arg->inverse;
	lastbackup = arg->lastisnormal;
	nnbackup = arg->solution_moves->nmoves;
	nibackup = arg->solution_moves->npremoves;
	nmoves = nnbackup + nibackup;

	if (nmoves >= arg->target_depth)
		return 0;

	ret = 0;
	if (coord_continue_onnormal(arg)) {
		l = arg->solution_moves->nmoves;
		mm = arg->coord->moves_mask_solve;
		if (l != 0) {
			m = arg->solution_moves->moves[l-1];
			mm &= allowedmask[movebase(m)];
		}
		arg->solution_moves->nmoves++;
		arg->lastisnormal = true;

		for (m = 0; m < NMOVES; m++) {
			if (!(mm & (UINT64_C(1) << (uint64_t)m)))
				continue;

			arg->solution_moves->moves[l] = m;
			arg->cube = move(backup_cube, m);
			arg->inverse = premove(backup_inverse, m);
			n = solve_coord_dfs(arg);
			if (n < 0)
				return n;
			ret += n;
			arg->solution_moves->npremoves = nibackup;
		}

		arg->solution_moves->nmoves--;
	}

	arg->cube = backup_cube;
	arg->inverse = backup_inverse;
	arg->lastisnormal = lastbackup;

	if (coord_continue_oninverse(arg)) {
		l = arg->solution_moves->npremoves;
		mm = arg->coord->moves_mask_solve;
		if (l != 0) {
			m = arg->solution_moves->premoves[l-1];
			mm &= allowedmask[movebase(m)];
		}
		arg->solution_moves->npremoves++;
		arg->lastisnormal = false;
		
		for (m = 0; m < NMOVES; m++) {
			if (!(mm & (UINT64_C(1) << (uint64_t)m)))
				continue;

			arg->solution_moves->premoves[l] = m;
			arg->inverse = move(backup_inverse, m);
			arg->cube = premove(backup_cube, m);
			n = solve_coord_dfs(arg);
			if (n < 0)
				return n;
			ret += n;
			arg->solution_moves->nmoves = nnbackup;
		}

		arg->solution_moves->npremoves--;
	}

	arg->cube = backup_cube;
	arg->inverse = backup_inverse;
	arg->lastisnormal = lastbackup;

	return ret;
}

STATIC long long
solve_coord_dispatch(
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
	coord_t *coord;
	uint8_t trans;

	parse_coord_and_trans(coord_and_trans, &coord, NULL, &trans);

	if (coord == NULL) {
		LOG("Error: could not parse coordinate from '%s'\n",
		    coord_and_trans);
		return NISSY_ERROR_INVALID_SOLVER;
	}

	if (trans == UINT8_ERROR) {
		LOG("Error: could not parse transformation from '%s'\n",
		    coord_and_trans);
		return NISSY_ERROR_INVALID_SOLVER;
	}

	return solve_coord(oc, coord, trans, (uint8_t)nissflag,
	    (uint8_t)minmoves, (uint8_t)maxmoves, (uint8_t)maxsolutions,
		(uint8_t)optimal, (uint8_t)threads, data_size, data,
	    solutions_size, sols, poll_status, poll_status_data);
}

STATIC int64_t
solve_coord(
	oriented_cube_t oc,
	coord_t coord [NON_NULL],
	uint8_t trans,
	uint8_t nissflag,
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
	uint64_t i;
	int64_t err;
	cube_t c;
	const unsigned char *coord_data;
	const unsigned char *ptable;
	dfsarg_solve_coord_t arg;
	tableinfo_t info;
	solution_moves_t solution_moves;
	solution_settings_t solution_settings;
	solution_list_t solution_list;

	c = transform(oc.cube, trans);

	if (!coord->is_solvable(c))
		goto solve_coord_error_unsolvable;

	if (!solution_list_init(&solution_list, solutions_size, sols))
		goto solve_coord_error_buffer;

	if (readtableinfo(data_size, data, &info) != NISSY_OK)
		goto solve_coord_error_data;

	if (info.type == TABLETYPE_PRUNING) {
		/* Only the pruning table */
		coord_data = NULL;
		ptable = data + INFOSIZE;
	} else {
		/* Coordinate has extra data */
		coord_data = data + INFOSIZE;
		ptable = data + info.next + INFOSIZE;
	}

	solution_moves_reset(&solution_moves);

	solution_settings = (solution_settings_t) {
		.unniss = false,
		.maxmoves = maxmoves,
		.maxsolutions = maxsolutions,
		.optimal = optimal,
		.orientation = oc.orientation,
	};

	arg = (dfsarg_solve_coord_t) {
		.cube = c,
		.inverse = inverse(c),
		.coord = coord,
		.coord_data = coord_data,
		.ptable = ptable,
		.solution_moves = &solution_moves,
		.solution_settings = &solution_settings,
		.tmask = TM_SINGLE(inverse_trans(trans)),
		.solution_list = &solution_list,
		.nissflag = nissflag,
	};

	i = coord->coord(c, coord_data);
	if (coord_is_solved(coord, i, coord_data)) {
		if (minmoves == 0 && !appendsolution(&solution_moves, 1,
		    &arg.tmask, &solution_settings, &solution_list))
				goto solve_coord_error_buffer;
		goto solve_coord_done;
	}

	for (
	    d = MAX(minmoves, 1);
	    !solutions_done(&solution_list, &solution_settings, d);
	    d++
	) {
		if (d >= 12)
			LOG("[%s solve] Found %" PRIu64 " solutions, "
			    "searching at depth %" PRId8 "\n",
			    coord->name, solution_list.nsols, d);

		arg.target_depth = d;
		solution_moves_reset(arg.solution_moves);
		if ((err = solve_coord_dfs(&arg)) < 0)
			return err;
	}

solve_coord_done:
	return (int64_t)solution_list.nsols;

solve_coord_error_data:
	LOG("[%s solve] Error reading table\n", coord->name);
	return NISSY_ERROR_DATA;

solve_coord_error_buffer:
	LOG("[%s solve] Error appending solution to buffer: size too small\n",
	    coord->name);
	return NISSY_ERROR_BUFFER_SIZE;

solve_coord_error_unsolvable:
	LOG("[%s solve] Error: cube not ready\n", coord->name);
	return NISSY_ERROR_UNSOLVABLE_CUBE;
}

#endif /* SOLVERS_COORD_SOLVE_H */
