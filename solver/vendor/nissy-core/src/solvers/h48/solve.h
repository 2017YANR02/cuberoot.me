#ifndef SOLVERS_H48_SOLVE_H
#define SOLVERS_H48_SOLVE_H

#define H48_STARTING_MOVES 4
#define H48_STARTING_CUBES 43254
#define H48_SORT_TASKS_MIN_DEPTH 16
#define H48_LOG_PROGRESS_MIN_DEPTH 15

typedef struct {
	cube_t cube;
	uint8_t moves[H48_STARTING_MOVES];
	int64_t rank;
	uint64_t tmask[H48_STARTING_MOVES];
	uint8_t pval;
} solve_h48_task_t;

typedef struct {
	cube_t start_cube;
	cube_t cube;
	cube_t inverse;
	int8_t target_depth;
	solution_moves_t *solution_moves;
	solution_settings_t *solution_settings;
	const uint64_t *tmask;
	solution_list_t *solution_list;
	uint8_t lb_normal;
	uint8_t lb_inverse;
	uint8_t h;
	uint8_t base;
	const uint32_t *cocsepdata;
	const unsigned char *h48data;
	const unsigned char *eoesepdata;
	uint64_t movemask_normal;
	uint64_t movemask_inverse;
	uint64_t nodes_visited;
	uint64_t table_fallbacks;
	uint64_t table_lookups;
	int8_t threads;
	int ntasks;
	solve_h48_task_t *tasks;
	int thread_id;
	wrapthread_define_struct_mutex_t(*solutions_mutex);
	wrapthread_atomic int *status;
	wrapthread_atomic bool thread_done;
} dfsarg_solve_h48_t;

typedef struct {
	cube_t cube;
	int8_t nmoves;
	uint8_t moves[H48_STARTING_MOVES];
	int8_t minmoves;
	int8_t maxmoves;
	int8_t *shortest_sol;
	uint64_t tmask[H48_STARTING_MOVES];
} dfsarg_solve_h48_maketasks_t;

typedef struct {
	cube_t cube;
	cube_t inverse;
	uint64_t coord;
	uint8_t m;
	uint8_t pn;
	uint8_t pi;
	uint8_t stop;
} h48_prune_t;

STATIC long long solve_h48_dispatch(oriented_cube_t, const char *, unsigned,
    unsigned, unsigned, unsigned, unsigned, unsigned, unsigned long long,
    const unsigned char *, unsigned, char *,
    long long [SIZE(NISSY_SIZE_SOLVE_STATS)], int (*)(void *), void *);
STATIC_INLINE void h48_prune_pipeline(dfsarg_solve_h48_t [NON_NULL],
    h48_prune_t [SIZE(NMOVES)], uint8_t, bool);
STATIC_INLINE uint8_t h48_prune_lookup(
    uint64_t, cube_t, dfsarg_solve_h48_t [NON_NULL]);
STATIC_INLINE uint8_t h48_prune_lookup_nocoord(
    cube_t, dfsarg_solve_h48_t [NON_NULL]);
STATIC_INLINE void h48_prune_restore_normal(const h48_prune_t [NON_NULL],
    dfsarg_solve_h48_t [NON_NULL], uint8_t);
STATIC_INLINE void h48_prune_restore_inverse(const h48_prune_t [NON_NULL],
    dfsarg_solve_h48_t [NON_NULL], uint8_t);
STATIC int64_t solve_h48_maketasks(
    dfsarg_solve_h48_t [NON_NULL], dfsarg_solve_h48_maketasks_t [NON_NULL],
    solve_h48_task_t [SIZE(H48_STARTING_CUBES)], int [NON_NULL]);
STATIC wrapthread_return_t solve_h48_runthread(void *);
STATIC int64_t solve_h48_dfs(dfsarg_solve_h48_t [NON_NULL]);
STATIC void solve_h48_log_solutions(solution_list_t [NON_NULL], size_t);
STATIC int solve_h48_compare_tasks(const void *, const void *);
STATIC int64_t solve_h48(oriented_cube_t, uint8_t, uint8_t, uint64_t, uint8_t,
    uint8_t, uint64_t, const unsigned char *, size_t, char *,
    long long [SIZE(NISSY_SIZE_SOLVE_STATS)], int (*)(void *), void *);

STATIC long long solve_h48_dispatch(
	oriented_cube_t oc,
        const char *solver,
        unsigned nissflag,
        unsigned minmoves,
        unsigned maxmoves,
        unsigned maxsols,
        unsigned optimal,
        unsigned threads,
        unsigned long long data_size,
        const unsigned char *data,
        unsigned sols_size,
        char *sols,
        long long stats[SIZE(NISSY_SIZE_SOLVE_STATS)],
        int (*poll_status)(void *),
        void *poll_status_data
)
{
	uint8_t h;
	long long err;

	err = parse_h48h(solver, &h);
	if (err != NISSY_OK)
		return err;

	return solve_h48(oc, (uint8_t)minmoves, (uint8_t)maxmoves,
	    (uint8_t)maxsols, (uint8_t)optimal, (uint8_t)threads,
	    data_size, data, sols_size, sols, stats,
	    poll_status, poll_status_data);
}

STATIC_INLINE uint8_t
h48_prune_lookup(
	uint64_t coord,
	cube_t cube,
	dfsarg_solve_h48_t arg[NON_NULL]
)
{
	uint8_t p, pmin, pe;

	arg->table_lookups++;
	p = get_h48_pval_and_min(arg->h48data, coord, &pmin);
	if (p == 0) {
		arg->table_fallbacks++;
		pe = get_eoesep_pval_cube(arg->eoesepdata, cube);
		return MAX(pmin, pe);
	} else {
		return p + arg->base;
	}
}

STATIC_INLINE uint8_t
h48_prune_lookup_nocoord(
	cube_t cube,
	dfsarg_solve_h48_t arg[NON_NULL]
)
{
	uint32_t cdata;
	uint64_t coord;

	get_h48_cdata(cube, arg->cocsepdata, &cdata);
	coord = coord_h48_edges(cube, COCLASS(cdata), TTREP(cdata), arg->h);
	return h48_prune_lookup(coord, cube, arg);
}

STATIC_INLINE void
h48_prune_pipeline(
	dfsarg_solve_h48_t arg[NON_NULL],
	h48_prune_t prune[SIZE(NMOVES)],
	uint8_t target,
	bool normal
)
{
	uint64_t i;
	uint32_t cdata;
	uint8_t m, p;

	/* Stage 0: initialize the neighbors array */
	memset(prune, 0, NMOVES * sizeof(h48_prune_t));
	if (normal) {
		for (m = 0; m < NMOVES; m++) {
			prune[m].pi = m % 3 == 1 ? arg->lb_inverse : 0;
			if (!(arg->movemask_normal & MM_SINGLE(m)) ||
			    prune[m].pi > target) {
				prune[m].stop = 1;
				continue;
			}
			prune[m].cube = move(arg->cube, m);
			prune[m].inverse = premove(arg->inverse, m);
			prune[m].m = m;
			arg->nodes_visited++;
		}
	} else {
		for (m = 0; m < NMOVES; m++) {
			prune[m].pi = m % 3 == 1 ? arg->lb_normal : 0;
			if (!(arg->movemask_inverse & MM_SINGLE(m)) ||
			    prune[m].pi > target) {
				prune[m].stop = 1;
				continue;
			}
			prune[m].cube = move(arg->inverse, m);
			prune[m].inverse = premove(arg->cube, m);
			prune[m].m = m;
			arg->nodes_visited++;
		}
	}

	/* We'll never get a bound higher than base + 3 */
	if (target > arg->base + 3)
		return;

	/* Stage 1: cdata and prefetch inverse */
	for (m = 0; m < NMOVES; m++) {
		if (prune[m].stop)
			continue;

		p = get_h48_cdata(prune[m].inverse, arg->cocsepdata, &cdata);
		if (p > target) {
			prune[m].stop = 1;
			continue;
		}
		if (prune[m].pi == 0) {
			prune[m].coord = coord_h48_edges(prune[m].inverse,
			    COCLASS(cdata), TTREP(cdata), arg->h);
			i = H48_INDEX(H48_LINE_EXT(prune[m].coord));
			prefetch(arg->h48data, i);
		}
	}

	/* Stage 2: get pval from inverse, prefetch normal */
	for (m = 0; m < NMOVES; m++) {
		if (prune[m].stop)
			continue;

		if (prune[m].pi == 0) {
			prune[m].pi = h48_prune_lookup(
			    prune[m].coord, prune[m].inverse, arg);
			if (prune[m].pi > target) {
				prune[m].stop = 1;
				continue;
			}
		}

		p = get_h48_cdata(prune[m].cube, arg->cocsepdata, &cdata);
		if (p > target) {
			prune[m].stop = 1;
			continue;
		}
		prune[m].coord = coord_h48_edges(
		    prune[m].cube, COCLASS(cdata), TTREP(cdata), arg->h);
		i = H48_INDEX(H48_LINE_EXT(prune[m].coord));
		prefetch(arg->h48data, i);
	}

	/* Stage 3: get pval from normal */
	for (m = 0; m < NMOVES; m++) {
		if (prune[m].stop)
			continue;

		prune[m].pn = h48_prune_lookup(
		    prune[m].coord, prune[m].cube, arg);
		prune[m].stop = prune[m].pn > target;
	}
}

STATIC_INLINE void
h48_prune_restore_normal(
	const h48_prune_t prune[NON_NULL],
	dfsarg_solve_h48_t arg[NON_NULL],
	uint8_t target
)
{
	uint8_t nm;

	arg->cube = prune->cube;
	arg->inverse = prune->inverse;
	arg->lb_inverse = prune->pi;
	arg->lb_normal = prune->pn;

	nm = arg->solution_moves->nmoves;
	arg->solution_moves->moves[nm-1] = prune->m;
	arg->movemask_normal = allowedmask[movebase(prune->m)];

	if (arg->lb_inverse == target)
		arg->movemask_normal &= MM18_NOHALFTURNS;
	if (arg->lb_normal == target)
		arg->movemask_inverse &= MM18_NOHALFTURNS;
}

STATIC_INLINE void
h48_prune_restore_inverse(
	const h48_prune_t prune[NON_NULL],
	dfsarg_solve_h48_t arg[NON_NULL],
	uint8_t target
)
{
	uint8_t nm;

	arg->cube = prune->inverse;
	arg->inverse = prune->cube;
	arg->lb_inverse = prune->pn;
	arg->lb_normal = prune->pi;

	nm = arg->solution_moves->npremoves;
	arg->solution_moves->premoves[nm-1] = prune->m;
	arg->movemask_inverse = allowedmask[movebase(prune->m)];

	if (arg->lb_inverse == target)
		arg->movemask_normal &= MM18_NOHALFTURNS;
	if (arg->lb_normal == target)
		arg->movemask_inverse &= MM18_NOHALFTURNS;
}

STATIC int64_t
solve_h48_dfs(dfsarg_solve_h48_t arg[NON_NULL])
{
	int64_t ret, n;
	uint8_t m, nm, nn, ni, target;
	uint64_t mm_normal, mm_inverse;
	cube_t cube, backup_cube, backup_inverse;
	h48_prune_t prune[NMOVES];

	if (equal(arg->cube, SOLVED_CUBE) || /* Solved before target depth */
	    arg->solution_list->nsols >= arg->solution_settings->maxsolutions)
		return 0;

	nn = arg->solution_moves->nmoves;
	ni = arg->solution_moves->npremoves;
	nm = nn + ni;
	target = arg->target_depth - (nm + 1);
	mm_normal = arg->movemask_normal;
	mm_inverse = arg->movemask_inverse;
	if (target == 0) { /* Last move */
		arg->solution_moves->nmoves++;
		for (m = 0; m < NMOVES; m++) {
			if (!(mm_normal & mm_inverse & MM_SINGLE(m)))
				continue;
			cube = move(arg->cube, m);
			arg->solution_moves->moves[nn] = m;
			arg->nodes_visited++;
			if (!equal(cube, SOLVED_CUBE))
				continue;
			wrapthread_mutex_lock(arg->solutions_mutex);
			ret = appendsolution(arg->solution_moves,
			    H48_STARTING_MOVES, arg->tmask,
			    arg->solution_settings, arg->solution_list);
			wrapthread_mutex_unlock(arg->solutions_mutex);
			arg->solution_moves->nmoves--;
			return ret;
		}
		arg->solution_moves->nmoves--;
		return 0;
	}

	backup_cube = arg->cube;
	backup_inverse = arg->inverse;

	ret = 0;
	if (popcount_u64(mm_normal) <= popcount_u64(mm_inverse)) {
		h48_prune_pipeline(arg, prune, target, true);
		arg->solution_moves->nmoves++;
		for (m = 0; m < NMOVES; m++) {
			if (prune[m].stop)
				continue;
			arg->movemask_normal = mm_normal;
			arg->movemask_inverse = mm_inverse;
			h48_prune_restore_normal(&prune[m], arg, target);
			n = solve_h48_dfs(arg);
			if (n < 0)
				return n;
			ret += n;
		}
		arg->solution_moves->nmoves--;
	} else {
		h48_prune_pipeline(arg, prune, target, false);
		arg->solution_moves->npremoves++;
		for (m = 0; m < NMOVES; m++) {
			if (prune[m].stop)
				continue;
			arg->movemask_normal = mm_normal;
			arg->movemask_inverse = mm_inverse;
			h48_prune_restore_inverse(&prune[m], arg, target);
			n = solve_h48_dfs(arg);
			if (n < 0)
				return n;
			ret += n;
		}
		arg->solution_moves->npremoves--;
	}

	arg->cube = backup_cube;
	arg->inverse = backup_inverse;
	arg->movemask_normal = mm_normal;
	arg->movemask_inverse = mm_inverse;

	return ret;
}

STATIC wrapthread_return_t 
solve_h48_runthread(void *arg)
{
	int i, j;
	uint8_t lastmove;
	int64_t d, f, nprev;
	dfsarg_solve_h48_t *dfsarg;

	dfsarg = (dfsarg_solve_h48_t *)arg;

	nprev = 0;
	for (i = dfsarg->thread_id; i < dfsarg->ntasks; i += dfsarg->threads) {
		if (*dfsarg->status == NISSY_STATUS_STOP)
			goto solve_h48_runthread_end;
		while (*dfsarg->status == NISSY_STATUS_PAUSE)
			msleep(BASE_SLEEP_TIME);

		solution_moves_reset(dfsarg->solution_moves);
		memcpy(dfsarg->solution_moves->moves,
		    dfsarg->tasks[i].moves, H48_STARTING_MOVES);
		dfsarg->solution_moves->nmoves = H48_STARTING_MOVES;

		dfsarg->cube = dfsarg->start_cube;
		for (j = 0; j < H48_STARTING_MOVES; j++)
			dfsarg->cube =
			   move(dfsarg->cube, dfsarg->tasks[i].moves[j]);
		dfsarg->inverse = inverse(dfsarg->cube);

		dfsarg->nodes_visited++;
		if (dfsarg->tasks[i].pval + H48_STARTING_MOVES
		    > dfsarg->target_depth)
			continue;

		dfsarg->lb_normal = 0;
		dfsarg->lb_inverse = 0;
		dfsarg->movemask_normal = allowedmask[
		    movebase(dfsarg->tasks[i].moves[H48_STARTING_MOVES-1])];
		dfsarg->movemask_inverse = MM18_ALLMOVES;
		dfsarg->tmask = dfsarg->tasks[i].tmask;

		solve_h48_dfs(dfsarg);

		/*
		We compute the "rank" of each taks, which is used in the next
		step of the IDFS to sort them. This heuristically leads us
		faster to a solution.  The rank is computed by taking the
		number of nodes visited, adjusted by a factor of about
		sqrt(2)/sqrt(3) because there are more sequences starting with
		U, R and F than with D, L and B, as we don't allow e.g. both
		U D and D U, but only U D.
		This trick was suggested by Chen Shuang, the implementation is
		inspired by Andrew Skalski's vcube.
		*/
		lastmove = dfsarg->tasks[i].moves[H48_STARTING_MOVES-1];
		d = (int64_t)dfsarg->nodes_visited - nprev;
		f = movebase(lastmove) % 2 == 0 ? 47525 : 58206;
		dfsarg->tasks[i].rank = d * f;
		nprev = dfsarg->nodes_visited;
	}

solve_h48_runthread_end:
	dfsarg->thread_done = true;
	return wrapthread_return_val;
}

STATIC int64_t
solve_h48_maketasks(
	dfsarg_solve_h48_t solve_arg[NON_NULL],
	dfsarg_solve_h48_maketasks_t mtarg[NON_NULL],
	solve_h48_task_t tasks[SIZE(H48_STARTING_CUBES)],
	int ntasks[NON_NULL]
)
{
	int64_t r, appret;
	uint8_t m, t;
	uint64_t mm;
	cube_t backup_cube;
	solution_moves_t moves;

	if (equal(mtarg->cube, SOLVED_CUBE)) {
		if (mtarg->nmoves > mtarg->maxmoves ||
		    mtarg->nmoves < mtarg->minmoves ||
		    solutions_done(solve_arg->solution_list,
		        solve_arg->solution_settings, mtarg->nmoves))
			return NISSY_OK;

		solution_moves_reset(&moves);
		moves.nmoves = mtarg->nmoves;
		memcpy(moves.moves, mtarg->moves, mtarg->nmoves);

		appret = appendsolution(&moves, mtarg->nmoves, mtarg->tmask,
		    solve_arg->solution_settings, solve_arg->solution_list);
		return appret < 0 ? appret : NISSY_OK;
	}

	if (mtarg->nmoves == H48_STARTING_MOVES) {
		tasks[*ntasks].cube = mtarg->cube;
		tasks[*ntasks].pval =
		    h48_prune_lookup_nocoord(mtarg->cube, solve_arg);
		memcpy(tasks[*ntasks].moves, mtarg->moves,
		    H48_STARTING_MOVES * sizeof(uint8_t));
		memcpy(tasks[*ntasks].tmask, mtarg->tmask,
		    H48_STARTING_MOVES * sizeof(uint64_t));
		(*ntasks)++;
		return NISSY_OK;
	}

	if (mtarg->nmoves == 0) {
		mm = MM18_ALLMOVES;
	} else {
		m = mtarg->moves[mtarg->nmoves-1];
		mm = allowedmask[movebase(m)];
	}

	mtarg->tmask[mtarg->nmoves] = symmetry_mask(mtarg->cube);

	mtarg->nmoves++;
	backup_cube = mtarg->cube;
	for (m = 0; m < NMOVES; m++) {
		if (!(mm & MM_SINGLE(m)))
			continue;

		mtarg->moves[mtarg->nmoves-1] = m;
		mtarg->cube = move(backup_cube, m);
		r = solve_h48_maketasks(solve_arg, mtarg, tasks, ntasks);
		if (r < 0)
			return r;

		/* Avoid symmetry-equivalent moves from the starting cube */
		for (t = 0; t < NTRANS; t++)
			if (mtarg->tmask[mtarg->nmoves-1] & TM_SINGLE(t))
				mm &= ~MM_SINGLE(transform_move(m, t));
	}
	mtarg->nmoves--;
	mtarg->cube = backup_cube;

	return NISSY_OK;
}

STATIC void
solve_h48_log_solutions(solution_list_t s[NON_NULL], size_t e)
{
	size_t i;
	char b;
	while (e != s->used) {
		LOG("[h48 solve] Found solution: ");
		for (i = e; s->buf[i] != '\n' && s->buf[i] != '\0'; i++) ;
		b = s->buf[i];
		s->buf[i] = '\0';
		LOG("%s\n", s->buf + e);
		s->buf[i] = b;
		e = i + 1;
	}
}

STATIC int
solve_h48_compare_tasks(const void *x, const void *y)
{
	int64_t nodes_x = ((solve_h48_task_t *)x)->rank;
	int64_t nodes_y = ((solve_h48_task_t *)y)->rank;

	/* Same as returning nodes_y - nodes_x, but avoids overflow */
	return (nodes_x < nodes_y) - (nodes_x > nodes_y);
}

STATIC int64_t
solve_h48(
	oriented_cube_t oc,
	uint8_t minmoves,
	uint8_t maxmoves,
	uint64_t maxsolutions,
	uint8_t optimal,
	uint8_t threads,
	uint64_t data_size,
	const unsigned char *data,
	size_t solutions_size,
	char *solutions,
	long long stats[SIZE(NISSY_SIZE_SOLVE_STATS)],
	int (*poll_status)(void *),
	void *poll_status_data
)
{
	int i, ntasks;
	bool td;
	wrapthread_atomic int status, prev_status;
	size_t lastused;
	int8_t d;
	dfsarg_solve_h48_t arg[THREADS];
	solve_h48_task_t tasks[H48_STARTING_CUBES];
	dfsarg_solve_h48_maketasks_t mtarg;
	long double fallback_rate, lookups_per_node;
	uint64_t offset;
	uint64_t nodes_visited, table_lookups, table_fallbacks;
	tableinfo_t info, fbinfo2;
	const uint32_t *cocsepdata;
	const unsigned char *h48data;
	const unsigned char *eoesep;
	solution_moves_t solution_moves[THREADS];
	solution_settings_t settings;
	solution_list_t sollist;
	wrapthread_define_var_thread_t(thread[THREADS]);
	wrapthread_define_var_mutex_t(solutions_mutex);

	if (!solution_list_init(&sollist, solutions_size, solutions))
		goto solve_h48_error_solutions_buffer;

	if (readtableinfo_n(data_size, data, 2, &info) != NISSY_OK)
		goto solve_h48_error_data;

	cocsepdata = (uint32_t *)(data + INFOSIZE);
	h48data = data + COCSEP_FULLSIZE + INFOSIZE;

	/* Read additional eoesep table */
	offset = info.next;
	if (readtableinfo_n(data_size, data, 3, &fbinfo2)
	    != NISSY_OK)
		goto solve_h48_error_data;

	/* Some heuristic check to see that it is eoesep */
	if (fbinfo2.bits != 4 || fbinfo2.type != TABLETYPE_SPECIAL)
		goto solve_h48_error_data;
	eoesep = h48data + offset;

	settings = (solution_settings_t) {
		.unniss = true,
		.maxmoves = maxmoves,
		.maxsolutions = maxsolutions,
		.optimal = optimal,
		.orientation = oc.orientation,
	};

	for (i = 0; i < threads; i++) {
		arg[i] = (dfsarg_solve_h48_t) {
			.start_cube = oc.cube,
			.cube = oc.cube,
			.h = info.h48h,
			.base = info.base,
			.cocsepdata = cocsepdata,
			.h48data = h48data,
			.eoesepdata = eoesep,
			.solution_moves = &solution_moves[i],
			.solution_settings = &settings,
			.solution_list = &sollist,
			.nodes_visited = 0,
			.table_fallbacks = 0,
			.table_lookups = 0,
			.threads = threads,
			.thread_id = i,
			.solutions_mutex = &solutions_mutex,
			.status = &status,
		};

	}

	wrapthread_mutex_init(&solutions_mutex);

	mtarg = (dfsarg_solve_h48_maketasks_t) {
		.cube = oc.cube,
		.nmoves = 0,
		.minmoves = minmoves,
		.maxmoves = maxmoves,
	};
	ntasks = 0;
	solve_h48_maketasks(&arg[0], &mtarg, tasks, &ntasks);
	if (ntasks < 0)
		goto solve_h48_error_solutions_buffer;
	if (solutions_done(&sollist, &settings,
	    MAX(minmoves, H48_STARTING_MOVES)))
		goto solve_h48_done;

	for (i = 0; i < threads; i++) {
		arg[i].ntasks = ntasks;
		arg[i].tasks = tasks;
	}

	LOG("[H48 solve] Prepared %d tasks\n", ntasks);

	solve_h48_log_solutions(&sollist, 0);
	lastused = sollist.used;
	status = poll_status == NULL ? NISSY_STATUS_RUN :
	    poll_status(poll_status_data);
	if (!NISSY_CANSLEEP) {
		LOG("[solve h48] Pause / Stop / Resume functionality won't "
		    "be available on this system (can't sleep()).\n");
	}
	for (
	    d = MAX(minmoves, H48_STARTING_MOVES + 1);
	    !(solutions_done(&sollist, &settings, d)) &&
	        status != NISSY_STATUS_STOP;
	    d++
	) {
		if (d >= H48_LOG_PROGRESS_MIN_DEPTH) {
			LOG("[H48 solve] Found %" PRIu64 " solutions, "
			    "searching at depth %" PRId8 "\n",
			    sollist.nsols, d);
		}

		if (d >= H48_SORT_TASKS_MIN_DEPTH)
			qsort(tasks, ntasks, sizeof(solve_h48_task_t),
			    solve_h48_compare_tasks);

		for (i = 0; i < threads; i++) {
			arg[i].target_depth = d;
			arg[i].thread_done = false;
			wrapthread_create(
			    &thread[i], solve_h48_runthread, &arg[i]);
		}

		/* Log solutions and handle pause / stop / resume */
		if (poll_status != NULL && d >= 15 && NISSY_CANSLEEP) {
			td = false;
			while (!td && status != NISSY_STATUS_STOP) {
				msleep(BASE_SLEEP_TIME);

				wrapthread_mutex_lock(&solutions_mutex);
				solve_h48_log_solutions(&sollist, lastused);
				lastused = sollist.used;
				wrapthread_mutex_unlock(&solutions_mutex);

				prev_status = status;
				status = poll_status(poll_status_data);
				if (status != prev_status) {
					if (status == NISSY_STATUS_PAUSE)
						LOG("[H48 solve] Paused\n");
					if (status == NISSY_STATUS_RUN)
						LOG("[H48 solve] Resumed\n");
				}

				for (td = true, i = 0; i < threads; i++)
					td = td && arg[i].thread_done;
			}
		}

		for (i = 0; i < threads; i++)
			wrapthread_join(thread[i]);

		solve_h48_log_solutions(&sollist, lastused);
		lastused = sollist.used;
	}

	if (status == NISSY_STATUS_STOP) {
		LOG("[H48 solve] Received stop request, ending solution "
		    "search early.\n");
	}

solve_h48_done:
	nodes_visited = table_lookups = table_fallbacks = 0;
	for (i = 0; i < threads; i++) {
		nodes_visited += arg[i].nodes_visited;
		table_fallbacks += arg[i].table_fallbacks;
		table_lookups += arg[i].table_lookups;
	}

	stats[0] = nodes_visited;
	stats[1] = table_lookups;
	stats[2] = table_fallbacks;
	lookups_per_node = table_lookups / (long double)nodes_visited;
	fallback_rate = nodes_visited == 0 ? 0.0 :
	    (table_fallbacks * 100) / (long double)table_lookups;
	LOG("[H48 solve] Nodes visited: %" PRId64 "\n", nodes_visited);
	LOG("[H48 solve] Lookups: %" PRId64 " (%.3Lf per node)\n",
	    table_lookups, lookups_per_node);
	LOG("[H48 solve] Table fallbacks: %" PRId64 " (%.3Lf%%)\n",
	    table_fallbacks, fallback_rate);

	return sollist.nsols;

solve_h48_error_data:
	LOG("[H48 solve] Error reading data table\n");
	return NISSY_ERROR_DATA;

solve_h48_error_solutions_buffer:
	return NISSY_ERROR_BUFFER_SIZE;
}

#endif /* SOLVERS_H48_SOLVE_H */
