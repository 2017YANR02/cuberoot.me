#ifndef SOLVERS_COORD_GENDATA_H
#define SOLVERS_COORD_GENDATA_H

STATIC size_t gendata_coord(const coord_t [NON_NULL], unsigned char *);
STATIC size_t gendata_multicoord(
    const multicoord_t [NON_NULL], unsigned char *);
STATIC long long gendata_coord_dispatch(const char *, unsigned long long,
    unsigned char *);
STATIC tableinfo_t genptable_coord(
    const coord_t [NON_NULL], const unsigned char *, unsigned char *);
STATIC uint64_t genptable_coord_init_solved(
    const coord_t [NON_NULL], const unsigned char *, unsigned char *);
STATIC bool switch_to_fromnew(uint64_t, uint64_t, uint64_t);
STATIC uint64_t genptable_coord_fillneighbors(const coord_t [NON_NULL],
    const unsigned char *, uint64_t, uint8_t, unsigned char *);
STATIC uint64_t genptable_coord_fillfromnew(const coord_t [NON_NULL],
    const unsigned char *, uint64_t, uint8_t, unsigned char *);
STATIC uint8_t get_coord_pval(
    const coord_t [NON_NULL], const unsigned char *, uint64_t);
STATIC void set_coord_pval(
    const coord_t [NON_NULL], unsigned char *, uint64_t, uint8_t);

STATIC long long
gendata_coord_dispatch(
	const char *coordstr,
	unsigned long long bufsize,
	unsigned char *buf
)
{
	coord_t *coord;
	multicoord_t *mcoord;

	parse_coord_and_trans(coordstr, &coord, &mcoord, NULL);

	if (coord != NULL)
		return gendata_coord(coord, buf);

	if (mcoord != NULL)
		return gendata_multicoord(mcoord, buf);

	LOG("Error: could not parse coordinate '%s'\n", coordstr);
	return NISSY_ERROR_INVALID_SOLVER;
}

STATIC size_t
gendata_coord(const coord_t coord[NON_NULL], unsigned char *buf)
{
	uint64_t coord_dsize, tablesize, ninfo;
	unsigned char *pruningbuf, *coord_data;
	unsigned char *table;
	tableinfo_t coord_data_info, pruning_info;

	coord_data = buf == NULL ? NULL : buf + INFOSIZE;
	coord_dsize = coord->gendata(coord_data);
	if (coord_dsize == SIZE_MAX)
		goto gendata_coord_error;

	ninfo = coord_dsize == 0 ? 1 : 2;
	tablesize = DIV_ROUND_UP(coord->max, 2);

	if (buf == NULL)
		goto gendata_coord_return_size;

	if (ninfo == 2) {
		coord_data_info = (tableinfo_t) {
			.solver = "coord helper table for ",
			.type = TABLETYPE_SPECIAL,
			.infosize = INFOSIZE,
			.fullsize = INFOSIZE + coord_dsize,
			.hash = 0,
			.next = INFOSIZE + coord_dsize,

			/* Unknown / non-applicable values */
			.entries = 0,
			.classes = 0,
			.bits = 0,
			.base = 0,
			.maxvalue = 0,
		};

		append_name(&coord_data_info, coord->name);
		writetableinfo(&coord_data_info, INFOSIZE + coord_dsize, buf);

		pruningbuf = buf + INFOSIZE + coord_dsize;
	} else {
		pruningbuf = buf;
	}

	table = pruningbuf + INFOSIZE;
	pruning_info = genptable_coord(coord, coord_data, table);
	writetableinfo(&pruning_info, INFOSIZE + tablesize, pruningbuf);

gendata_coord_return_size:
	return ninfo * INFOSIZE + coord_dsize + tablesize;

gendata_coord_error:
	LOG("Unexpected error generating coordinate data\n");
	return 0;
}

STATIC size_t
gendata_multicoord(const multicoord_t mcoord[NON_NULL], unsigned char *buf)
{
	unsigned char *b;
	size_t i, s, ret;
	tableinfo_t info;

	info = (tableinfo_t) {
		.solver = "multicoordinate table for ",
		.type = TABLETYPE_MULTI,
		.infosize = INFOSIZE,
		.fullsize = INFOSIZE,
		.hash = 0,
		.next = INFOSIZE,

		/* Unknown / non-applicable values */
		.entries = 0,
		.classes = 0,
		.bits = 0,
		.base = 0,
		.maxvalue = 0,
	};

	append_name(&info, mcoord->name);
	if (buf != NULL)
		writetableinfo(&info, INFOSIZE, buf);
	ret = INFOSIZE;

	for (i = 0; mcoord->coordinates[i] != NULL; i++) {
		b = buf == NULL ? NULL : buf + ret;
		s = gendata_coord(mcoord->coordinates[i], b);
		if (s == 0)
			return 0;

		ret += s;

		/* Pad so that each coordinate's table is 8-byte aligned */
		while (ret % 8 != 0)
			buf[ret++] = 0;
	}

	return ret;
}

STATIC tableinfo_t
genptable_coord(
	const coord_t coord[NON_NULL],
	const unsigned char *data,
	unsigned char *table
)
{
	uint64_t tablesize, i, tot, t, nm;
	uint8_t d;
	tableinfo_t info;

	tablesize = DIV_ROUND_UP(coord->max, 2);
	info = (tableinfo_t) {
		.solver = "coordinate solver for ",
		.type = TABLETYPE_PRUNING,
		.infosize = INFOSIZE,
		.fullsize = INFOSIZE + tablesize,
		.hash = 0,
		.entries = coord->max,
		.classes = 0,
		.bits = 4,
		.base = 0,
		.maxvalue = 0,
		.next = 0
	};

	memset(table, 0xFF, tablesize);
	memset(info.distribution, 0, INFO_DISTRIBUTION_LEN * sizeof(uint64_t));
	append_name(&info, coord->name);

	tot = info.distribution[0] =
	    genptable_coord_init_solved(coord, data, table);
	nm = popcount_u64(coord->moves_mask_gendata);
	for (d = 1; tot < coord->max && d < 15; d++) {
		t = 0;
		if (switch_to_fromnew(tot, coord->max, nm)) {
			for (i = 0; i < coord->max; i++)
				if (get_coord_pval(coord, table, i) > d)
					t += genptable_coord_fillfromnew(
					    coord, data, i, d, table);
		} else {
			for (i = 0; i < coord->max; i++)
				if (get_coord_pval(coord, table, i) == d-1)
					t += genptable_coord_fillneighbors(
					    coord, data, i, d, table);
		}
		tot += t;
		info.distribution[d] = t;
		LOG("[%s gendata] Depth %" PRIu64 ": found %" PRIu64 " (%"
		    PRIu64 " of %" PRIu64 ")\n",
		    coord->name, d, t, tot, coord->max);
	}
	if (tot == coord->max) {
		info.maxvalue = d-1;
	} else {
		LOG("[%s gendata] Depth >= 15: %" PRIu64 " remaining\n",
		    coord->name, coord->max - tot);
		info.distribution[d] = coord->max - tot;
		info.maxvalue = 15;
	}

	return info;
}

STATIC uint64_t
genptable_coord_init_solved(
	const coord_t coord[NON_NULL],
	const unsigned char *coord_data,
	unsigned char *table
)
{
	uint64_t i, max_solved, ret;

	max_solved = coord->is_solved == NULL ? 1 : coord->max;

	for (i = 0, ret = 0; i < max_solved; i++) {
		if (coord_is_solved(coord, i, coord_data)) {
			set_coord_pval(coord, table, i, 0);
			ret++;
		}
	}

	return ret;
}

STATIC bool
switch_to_fromnew(uint64_t done, uint64_t max, uint64_t nm)
{
	/*
	Heuristic to determine if it is more conveniente to loop over
      	done coordinates and fill the new discovered, or to loop from new
	coordinates and fill them if they have a done neighbor.
	*/

	double r = (double)done / (double)max;
	return 1.0 - intpow(1.0-r, nm) > nm * (1.0-r);
}

STATIC uint64_t
genptable_coord_fillneighbors(
	const coord_t coord[NON_NULL],
	const unsigned char *data,
	uint64_t i, 
	uint8_t d,
	unsigned char *table
)
{
	bool isnasty;
	uint8_t m;
	uint64_t ii, j, tot;
	uint8_t t;
	cube_t c, moved;

	c = coord->cube(i, data);
	tot = 0;
	for (m = 0; m < NMOVES; m++) {
		if (!((UINT64_C(1) << (uint64_t)m) &
		    coord->moves_mask_gendata))
			continue;
		moved = move(c, m);
		ii = coord->coord(moved, data);
		isnasty = coord->isnasty(ii, data);
		for (t = 0; t < NTRANS && (t == 0 || isnasty); t++) {
			if (!((UINT64_C(1) << (uint64_t)t) & coord->trans_mask))
				continue;

			j = coord->coord(transform(moved, t), data);
			if (get_coord_pval(coord, table, j) > d) {
				set_coord_pval(coord, table, j, d);
				tot++;
			}
		}
	}

	return tot;
}

STATIC uint64_t
genptable_coord_fillfromnew(
	const coord_t coord[NON_NULL],
	const unsigned char *data,
	uint64_t i,
	uint8_t d,
	unsigned char *table
)
{
	bool found;
	uint8_t m;
	uint64_t tot, j, ii, nsim, sim[NTRANS];
	uint8_t t;
	cube_t c;

	tot = 0;
	c = coord->cube(i, data);

	for (t = 0, nsim = 0; t < NTRANS; t++) {
		if (!((UINT64_C(1) << (uint64_t)t) & coord->trans_mask))
			continue;

		ii = coord->coord(transform(c, t), data);
		for (j = 0, found = false; j < nsim && !found; j++)
			found = sim[j] == ii;
		if (!found)
			sim[nsim++] = ii;
	}

	for (j = 0, found = false; j < nsim && !found; j++) {
		c = coord->cube(sim[j], data);
		for (m = 0; m < NMOVES; m++) {
			if (!((UINT64_C(1) << (uint64_t)m) &
			    coord->moves_mask_gendata))
				continue;
			ii = coord->coord(move(c, m), data);
			if (get_coord_pval(coord, table, ii) < d) {
				found = true;
				break;
			}
		}
	}

	tot = 0;
	if (found) {
		for (j = 0; j < nsim; j++) {
			if (get_coord_pval(coord, table, sim[j]) > d) {
				set_coord_pval(coord, table, sim[j], d);
				tot++;
			}
		}
	}

	return tot;
}

STATIC uint8_t
get_coord_pval(
	const coord_t coord[NON_NULL],
	const unsigned char *table,
	uint64_t i
)
{
	return (table[COORD_INDEX(i)] & COORD_MASK(i)) >> COORD_SHIFT(i);
}

STATIC void
set_coord_pval(
	const coord_t coord[NON_NULL],
	unsigned char *table,
	uint64_t i,
	uint8_t val
)
{
	table[COORD_INDEX(i)] = (table[COORD_INDEX(i)] & (~COORD_MASK(i)))
	    | (val << COORD_SHIFT(i));
}

#endif /* SOLVERS_COORD_GENDATA_H */
