#ifndef SOLVERS_H48_GENDATA_H48_H
#define SOLVERS_H48_GENDATA_H48_H

STATIC long long gendata_h48_dispatch(
    const char *, unsigned long long, unsigned char *);
STATIC uint64_t gendata_h48short(gendata_h48short_arg_t [NON_NULL]);
STATIC int64_t gendata_h48(gendata_h48_arg_t [NON_NULL]);
STATIC void gendata_h48_maintable(gendata_h48_arg_t [NON_NULL]);
STATIC wrapthread_return_t gendata_h48_runthread(void *);
#ifdef CUBEROOT_H48_BENCH_LIMIT
STATIC wrapthread_atomic uint64_t cuberoot_h48_bench_claimed;
#endif

STATIC_INLINE void gendata_h48_mark(gendata_h48_mark_t [NON_NULL]);
STATIC_INLINE bool gendata_h48_dfs_stop(
    cube_t, int8_t, h48_dfs_arg_t [NON_NULL]);
STATIC void gendata_h48_dfs(h48_dfs_arg_t [NON_NULL]);
STATIC tableinfo_t makeinfo_h48(gendata_h48_arg_t [NON_NULL]);

STATIC const uint32_t *get_cocsepdata_constptr(const unsigned char *);
STATIC const unsigned char *get_h48data_constptr(const unsigned char *);

STATIC_INLINE uint8_t get_h48_pval(const unsigned char *, uint64_t);
STATIC_INLINE void set_h48_pval(unsigned char *, uint64_t, uint8_t);
STATIC_INLINE uint8_t get_h48_pvalmin(const unsigned char *, uint64_t);
STATIC_INLINE void set_h48_pvalmin(unsigned char *, uint64_t, uint8_t);
STATIC_INLINE uint8_t get_h48_pval_and_min(
    const unsigned char *, uint64_t, uint8_t [NON_NULL]);

STATIC long long
gendata_h48_dispatch(
	const char *solver,
	unsigned long long data_size,
	unsigned char *data
)
{
	long long err;
	gendata_h48_arg_t arg;

	err = parse_h48h(solver, &arg.h);
	if (err != NISSY_OK)
		return err;

	arg.buf_size = data_size;
	arg.buf = data;
	arg.maxdepth = 20;

	return gendata_h48(&arg);
}

STATIC uint64_t
gendata_h48short(gendata_h48short_arg_t arg[NON_NULL])
{
	uint8_t i, m;
	uint64_t coord;
	uint64_t j;
	kvpair_t kv;
	cube_t cube, d;

	cube = SOLVED_CUBE;
	coord = coord_h48(cube, arg->cocsepdata, 11);
	h48map_insertmin(arg->map, coord, 0);
	for (i = 0; i < arg->maxdepth; i++) {
#ifdef CUBEROOT_H48_PROGRESS
		cuberoot_h48_progress_stage(H48_SHORT_ENUM, arg->map->n, 0, i);
#endif
		j = 0;
		for (kv = h48map_nextkvpair(arg->map, &j);
		     j != arg->map->capacity;
		     kv = h48map_nextkvpair(arg->map, &j)
		) {
			if (kv.val != i)
				continue;
			cube = invcoord_h48(kv.key, arg->crep, 11);
			for (m = 0; m < 18; m++) {
				d = move(cube, m);
				FOREACH_H48SIM(d, arg->cocsepdata, arg->selfsim,
					coord = coord_h48(d, arg->cocsepdata, 11);
					h48map_insertmin(arg->map, coord, i+1);
				)
			}
		}
	}

	return arg->map->n;
}

STATIC int64_t
gendata_h48(gendata_h48_arg_t arg[NON_NULL])
{
	uint64_t size, cocsepsize, h48size, eoesepsize;
	long long r;
	unsigned char *cocsepdata_offset;
	tableinfo_t cocsepinfo, h48info;

	cocsepsize = COCSEP_FULLSIZE;
	h48size = INFOSIZE + H48_TABLESIZE(arg->h);
	eoesepsize = EOESEP_FULLSIZE;

	size = cocsepsize + h48size + eoesepsize;

	if (arg->buf == NULL)
		return size; /* Dry-run */

	if (arg->buf_size < size) {
		LOG("[H48 gendata] Error: buffer is too small "
		    "(needed %" PRId64 " bytes but received %" PRIu64 ")\n",
		    size, arg->buf_size);
		return NISSY_ERROR_BUFFER_SIZE;
	}

#ifdef CUBEROOT_H48_PROGRESS
	cuberoot_h48_progress_stage(H48_COCSEP, 0, 0, 0);
#endif
	gendata_cocsep(arg->buf, arg->selfsim, arg->crep);

	cocsepdata_offset = arg->buf + INFOSIZE;
	arg->cocsepdata = (uint32_t *)cocsepdata_offset;
	arg->h48buf = (wrapthread_atomic unsigned char*)arg->buf + cocsepsize;

	/* Compute the main H48 table with two bits per entry */
	gendata_h48_maintable(arg);
#ifdef CUBEROOT_H48_BENCH_LIMIT
	return size; /* A bounded workload is never a valid table. */
#endif

	r = readtableinfo(arg->buf_size, arg->buf, &cocsepinfo);
	if (r != NISSY_OK) {
		LOG("[H48 gendata] Error: could not read info "
		    "for cocsep table\n");
		return NISSY_ERROR_UNKNOWN;
	}

	cocsepinfo.next = cocsepsize;
	r = writetableinfo(&cocsepinfo, arg->buf_size, arg->buf);
	if (r != NISSY_OK) {
		LOG("[H48 gendata] Error: could not write info for "
		    "cocsep table with updated 'next' value\n");
		return NISSY_ERROR_UNKNOWN;
	}

	/* Add eoesep fallback table */

#ifdef CUBEROOT_H48_PROGRESS
	cuberoot_h48_progress_stage(H48_EOESEP, 0, 0, 0);
#endif
	gendata_eoesep(arg->buf + (size - eoesepsize), 20);

	/* Update tableinfo with correct next values */

	r = readtableinfo_n(arg->buf_size, arg->buf, 2, &h48info);
	if (r != NISSY_OK) {
		LOG("[H48 gendata] Error: could not read info "
		    "for h48 table\n");
		return NISSY_ERROR_UNKNOWN;
	}
	h48info.next = h48size;
	r = writetableinfo(&h48info,
	     arg->buf_size - cocsepsize, arg->buf + cocsepsize);
	if (r != NISSY_OK) {
		LOG("[H48 gendata] Error: could not write info "
		    "for h48 table\n");
		return NISSY_ERROR_UNKNOWN;
	}

	return size;
}

STATIC void
gendata_h48_maintable(gendata_h48_arg_t arg[NON_NULL])
{
	/*
	 * A good base value for the h48 tables have few positions with value
	 * 0, because those are treated as lower bound 0 and require a second
	 * lookup in another table, and at the same time not too many positions
	 * with value 3, because some of those are under-estimates.
	 *
	 * The following values for the base have been hand-picked. I first
	 * performed some statistics on the frequency of these values, but
	 * they turned out to be unreliable. In the end I generated the same
	 * table with multiple base value and see what was best.
	 *
	 * A curious case is h3, which has this distribution for base 8:
	 *   [0] = 6686828
	 *   [1] = 63867852
	 *   [2] = 392789689
	 *   [3] = 477195231
	 *
	 * and this for base 9:
	 *   [0] = 70554680
	 *   [1] = 392789689
	 *   [2] = 462294676
	 *   [3] = 14900555
	 *
	 * Experimentally, the table with base 8 is much faster. Intuitively,
	 * this is because it has a much lower count of elements  with value 0,
         * at the cost of a less precise estimate for the higher values.
	 */
	 
	static const uint8_t base[] = {
		[0]  = 8,
		[1]  = 8,
		[2]  = 8,
		[3]  = 8,
		[4]  = 9,
		[5]  = 9,
		[6]  = 9,
		[7]  = 9,
		[8]  = 10,
		[9]  = 10,
		[10] = 10,
		[11] = 10
	};

	static const uint8_t shortdepth = 8;
	static const uint64_t capacity = 10000019;
	static const uint64_t randomizer = 10000079;

	unsigned char *table;
	wrapthread_atomic uint64_t count;
	uint64_t i, ii, inext, bufsize, nshort, work_total;
	h48map_t shortcubes;
	gendata_h48short_arg_t shortarg;
	h48_dfs_arg_t dfsarg[THREADS];
	wrapthread_define_var_thread_t(thread[THREADS]);
	wrapthread_define_var_mutex_t(shortcubes_mutex);
	wrapthread_define_var_mutex_t(table_mutex[CHUNKS]);

	table = (unsigned char *)arg->h48buf + INFOSIZE;
#ifdef CUBEROOT_H48_PROGRESS
	uint64_t clear_size = H48_TABLESIZE(arg->h);
	cuberoot_h48_progress_stage(H48_CLEAR, 0, clear_size, 0);
	for (uint64_t offset = 0; offset < clear_size; ) {
		uint64_t bytes = MIN(UINT64_C(64) * 1024 * 1024, clear_size - offset);
		memset(table + offset, 0xFF, bytes);
		offset += bytes;
		cuberoot_h48_progress_done(offset);
	}
#else
	memset(table, 0xFF, H48_TABLESIZE(arg->h));
#endif

	LOG("[H48 gendata] Computing depth <=%" PRIu8 "\n", shortdepth)
#ifdef CUBEROOT_H48_PROGRESS
	cuberoot_h48_progress_stage(H48_SHORT_ENUM, 0, 0, 0);
#endif
	h48map_create(&shortcubes, capacity, randomizer);
	shortarg = (gendata_h48short_arg_t) {
		.maxdepth = shortdepth,
		.cocsepdata = arg->cocsepdata,
		.crep = arg->crep,
		.selfsim = arg->selfsim,
		.map = &shortcubes
	};
	gendata_h48short(&shortarg);
	nshort = shortarg.map->n;
	/* Match the vendored upstream's iteration boundary exactly. Its loop
	 * discards an occupied final hash slot after advancing the cursor to
	 * capacity. The reference distribution was generated with that boundary.
	 * Count only entries the workers will actually process so progress ends. */
	work_total = nshort - (shortcubes.table[shortcubes.capacity - 1] != MAP_UNSET);
#ifdef CUBEROOT_H48_BENCH_LIMIT
	work_total = MIN(work_total, CUBEROOT_H48_BENCH_LIMIT);
	cuberoot_h48_bench_claimed = 0;
#endif
	LOG("[H48 gendata] Computed %" PRIu64 " positions\n", nshort);

	arg->base = base[arg->h];
	arg->info = makeinfo_h48(arg);

	inext = 0;
	count = 0;
	wrapthread_mutex_init(&shortcubes_mutex);
	for (i = 0; i < CHUNKS; i++)
		wrapthread_mutex_init(&table_mutex[i]);
#ifdef CUBEROOT_H48_PROGRESS
	cuberoot_h48_progress_stage(H48_SHORT_PROCESS, 0, work_total, 0);
#endif
	for (i = 0; i < THREADS; i++) {
		dfsarg[i] = (h48_dfs_arg_t){
			.h = arg->h,
			.base = arg->base,
			.shortdepth = shortdepth,
			.cocsepdata = arg->cocsepdata,
			.table = table,
			.selfsim = arg->selfsim,
			.crep = arg->crep,
			.shortcubes = &shortcubes,
			.shortcubes_mutex = &shortcubes_mutex,
			.next = &inext,
			.count = &count,
		};
		for (ii = 0; ii < CHUNKS; ii++)
			dfsarg[i].table_mutex[ii] = &table_mutex[ii];

		wrapthread_create(
		    &thread[i], gendata_h48_runthread, &dfsarg[i]);
	}

	if (NISSY_CANSLEEP) {
		LOG("[H48 gendata] Processing 'short cubes'. "
		    "This will take a while.\n");
	} else {
		LOG("Status updates won't be available because the sleep() "
		    "functionality is not available on this platform.\n");
	}

	for (i = 0; i < THREADS; i++)
		wrapthread_join(thread[i]);
	if (count != work_total) {
		LOG("[H48 gendata] Error: short-state work count mismatch\n");
		exit(EXIT_FAILURE);
	}

#ifdef CUBEROOT_H48_PROGRESS
	cuberoot_h48_progress_done(work_total);
#endif

	h48map_destroy(&shortcubes);

#ifdef CUBEROOT_H48_BENCH_LIMIT
	return;
#endif

	LOG("[H48 gendata] Counting main-table distribution\n");
	getdistribution_h48(table, arg->info.distribution, &arg->info);

	bufsize = arg->buf_size - COCSEP_FULLSIZE;
	writetableinfo(&arg->info, bufsize, (unsigned char *)arg->h48buf);
}

STATIC wrapthread_return_t 
gendata_h48_runthread(void *arg)
{
	uint64_t coord, coordext, coordmin;
	kvpair_t kv;
	h48_dfs_arg_t *dfsarg;
	wrapthread_define_if_threads(uint64_t, mutex);

	dfsarg = (h48_dfs_arg_t *)arg;

	while (true) {
		wrapthread_mutex_lock(dfsarg->shortcubes_mutex);
#ifdef CUBEROOT_H48_BENCH_LIMIT
		if (cuberoot_h48_bench_claimed >= CUBEROOT_H48_BENCH_LIMIT) {
			wrapthread_mutex_unlock(dfsarg->shortcubes_mutex);
			break;
		}
#endif

		kv = h48map_nextkvpair(dfsarg->shortcubes, dfsarg->next);
		if (*dfsarg->next == dfsarg->shortcubes->capacity) {
			wrapthread_mutex_unlock(dfsarg->shortcubes_mutex);
			break;
		}
#ifdef CUBEROOT_H48_BENCH_LIMIT
		cuberoot_h48_bench_claimed++;
#endif
		wrapthread_mutex_unlock(dfsarg->shortcubes_mutex);

		if (kv.val < dfsarg->shortdepth) {
			coord = kv.key >> (uint64_t)(11 - dfsarg->h);
			coordext = H48_LINE_EXT(coord);
			coordmin = H48_LINE_MIN(coord);
			mutex = H48_LINE(coord) % CHUNKS;
			wrapthread_mutex_lock(dfsarg->table_mutex[mutex]);
			set_h48_pval(dfsarg->table, coordext, 0);
			set_h48_pvalmin(dfsarg->table, coordmin, (uint8_t)kv.val);
			wrapthread_mutex_unlock(dfsarg->table_mutex[mutex]);
		} else {
			dfsarg->cube = invcoord_h48(kv.key, dfsarg->crep, 11);
			gendata_h48_dfs(dfsarg);
		}
		(*dfsarg->count)++;
#ifdef CUBEROOT_H48_PROGRESS
		cuberoot_h48_progress_add(1);
#endif
	}

	return wrapthread_return_val;
}

STATIC void
gendata_h48_dfs(h48_dfs_arg_t arg[NON_NULL])
{
	int8_t d;
	uint8_t m[4];
	cube_t cube[4];
	gendata_h48_mark_t markarg;

	markarg = (gendata_h48_mark_t) {
		.h = arg->h,
		.base = arg->base,
		.cocsepdata = arg->cocsepdata,
		.selfsim = arg->selfsim,
		.table = arg->table,
		.table_mutex = arg->table_mutex,
	};

	d = (int8_t)arg->shortdepth - (int8_t)arg->base;

	/* Depth d+0 (shortcubes) */
	markarg.depth = d;
	markarg.cube = arg->cube;
	gendata_h48_mark(&markarg);

	/* Depth d+1 */
	for (m[0] = 0; m[0] < 18; m[0]++) {
		markarg.depth = d+1;
		cube[0] = move(arg->cube, m[0]);
		if (gendata_h48_dfs_stop(cube[0], d+1, arg))
			continue;
		markarg.cube = cube[0];
		gendata_h48_mark(&markarg);

		/* Depth d+2 */
		for (m[1] = 0; m[1] < 18; m[1]++) {
			markarg.depth = d+2;
			if (m[0] / 3 == m[1] / 3) {
				m[1] += 2;
				continue;
			}
			cube[1] = move(cube[0], m[1]);
			if (gendata_h48_dfs_stop(cube[1], d+2, arg))
				continue;
			markarg.cube = cube[1];
			gendata_h48_mark(&markarg);
			if (d >= 0)
				continue;

			/* Depth d+3 */
			for (m[2] = 0; m[2] < 18; m[2]++) {
				markarg.depth = d+3;
				if (!allowednextmove(m[1], m[2])) {
					m[2] += 2;
					continue;
				}
				cube[2] = move(cube[1], m[2]);
				if (gendata_h48_dfs_stop(cube[2], d+3, arg))
					continue;
				markarg.cube = cube[2];
				gendata_h48_mark(&markarg);
				if (d >= -1)
					continue;

				/* Depth d+4 */
				for (m[3] = 0; m[3] < 18; m[3]++) {
					markarg.depth = d+4;
					if (!allowednextmove(m[2], m[3])) {
						m[3] += 2;
						continue;
					}
					cube[3] = move(cube[2], m[3]);
					markarg.cube = cube[3];
					gendata_h48_mark(&markarg);
				}
			}
		}
	}
}

STATIC_INLINE void
gendata_h48_mark(gendata_h48_mark_t arg[NON_NULL])
{
	uint8_t oldval, newval, v;
	uint64_t coord, coordext, coordmin;
	wrapthread_define_if_threads(uint64_t, mutex);

	FOREACH_H48SIM(arg->cube, arg->cocsepdata, arg->selfsim,
		coord = coord_h48(arg->cube, arg->cocsepdata, arg->h);
		coordext = H48_LINE_EXT(coord);
		coordmin = H48_LINE_MIN(coord);

		newval = (uint8_t)MAX(arg->depth, 0);
		v = arg->depth + arg->base;
		mutex = H48_LINE(coord) % CHUNKS;
		wrapthread_mutex_lock(arg->table_mutex[mutex]);
		oldval = get_h48_pval(arg->table, coordext);
		set_h48_pval(arg->table, coordext, MIN(newval, oldval));
		set_h48_pvalmin(arg->table, coordmin, v);
		wrapthread_mutex_unlock(arg->table_mutex[mutex]);
	)
}

STATIC_INLINE bool
gendata_h48_dfs_stop(cube_t cube, int8_t d, h48_dfs_arg_t arg[NON_NULL])
{
	uint64_t val;
	uint64_t coord, coordext;
	wrapthread_define_if_threads(uint64_t, mutex);
	int8_t oldval;

	if (arg->h == 0 || arg->h == 11) {
		/* We are in the "real coordinate" case, we can stop
		   if this coordinate has already been visited */
		coord = coord_h48(cube, arg->cocsepdata, arg->h);
		coordext = H48_LINE_EXT(coord);
		mutex = H48_LINE(coord) % CHUNKS;
		wrapthread_mutex_lock(arg->table_mutex[mutex]);
		oldval = get_h48_pval(arg->table, coordext);
		wrapthread_mutex_unlock(arg->table_mutex[mutex]);
		return oldval <= d;
	} else {
		/* With 0 < h < 11 we do not have a "real coordinate".
		   The best we can do is checking if we backtracked to
		   one of the "short cubes". */
		coord = coord_h48(cube, arg->cocsepdata, 11);
		val = h48map_value(arg->shortcubes, coord);
		return val <= arg->shortdepth;
	}
}

STATIC tableinfo_t
makeinfo_h48(gendata_h48_arg_t arg[NON_NULL])
{
	tableinfo_t info;

	info = (tableinfo_t) {
		.solver = "h48 solver h =  ",
		.type = TABLETYPE_PRUNING,
		.infosize = INFOSIZE,
		.fullsize = H48_TABLESIZE(arg->h) + INFOSIZE,
		.hash = 0,
		.entries = H48_COORDMAX(arg->h) + 2 * H48_LINES(arg->h),
		.classes = 0,
		.h48h = arg->h,
		.bits = 2,
		.base = arg->base,
		.maxvalue = 3,
		.next = 0,
	};
	info.solver[15] = (arg->h % 10) + '0';
	if (arg->h >= 10)
		info.solver[14] = (arg->h / 10) + '0';

	return info;
}

STATIC const uint32_t *
get_cocsepdata_constptr(const unsigned char *data)
{
	return (uint32_t *)(data + INFOSIZE);
}

STATIC const unsigned char *
get_h48data_constptr(const unsigned char *data)
{
	return data + COCSEP_FULLSIZE + INFOSIZE;
}

STATIC_INLINE uint8_t
get_h48_pval(const unsigned char *table, uint64_t i)
{
	return (table[H48_INDEX(i)] & H48_MASK(i)) >> H48_SHIFT(i);
}

STATIC_INLINE uint8_t
get_h48_pvalmin(const unsigned char *table, uint64_t i)
{
	return table[H48_INDEX(i)] >> UINT8_C(4);
}

STATIC_INLINE void
set_h48_pval(unsigned char *table, uint64_t i, uint8_t val)
{
	table[H48_INDEX(i)] = (table[H48_INDEX(i)] & (~H48_MASK(i)))
	    | (val << H48_SHIFT(i));
}

STATIC_INLINE void
set_h48_pvalmin(unsigned char *table, uint64_t i, uint8_t val)
{
	uint8_t t, v;

	v = MIN(val, get_h48_pvalmin(table, i));
	t = table[H48_INDEX(i)];
	table[H48_INDEX(i)] = (t & UINT8_C(0xF)) | (v << UINT8_C(4));
}

STATIC_INLINE uint8_t
get_h48_pval_and_min(
	const unsigned char *table,
	uint64_t coord_noext,
	uint8_t pval_min[NON_NULL]
)
{
	uint64_t iext, imin;
	uint8_t t, tmin;

	iext = H48_LINE_EXT(coord_noext);
	imin = H48_LINE_MIN(coord_noext);
	t = table[H48_INDEX(iext)];
	tmin = table[H48_INDEX(imin)];

	*pval_min = tmin >> UINT8_C(4);
	return (t & H48_MASK(iext)) >> H48_SHIFT(iext);
}

#endif /* SOLVERS_H48_GENDATA_H48_H */
