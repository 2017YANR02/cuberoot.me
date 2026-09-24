#ifndef SOLVERS_COORD_CHECKDATA_H
#define SOLVERS_COORD_CHECKDATA_H

STATIC long long checkdata_coord_dispatch(
    const char *, unsigned long long, const unsigned char *);
STATIC long long checkdata_coord(
    const coord_t *, unsigned long long, const unsigned char *);
STATIC long long checkdata_multicoord(
    const multicoord_t *, unsigned long long, const unsigned char *);

STATIC long long
checkdata_coord_dispatch(
	const char *solver,
	unsigned long long data_size,
	const unsigned char *data
)
{
	coord_t *c;
	multicoord_t *mc;

	parse_coord_and_trans(solver, &c, &mc, NULL);

	if (c != NULL)
		return checkdata_coord(c, data_size, data);

	if (mc != NULL)
		return checkdata_multicoord(mc, data_size, data);

	LOG("[cehckdata] Unknown coordinate solver '%s'\n", solver);
	return NISSY_ERROR_DATA;
}

STATIC long long
checkdata_coord(
	const coord_t *coord,
	unsigned long long data_size,
	const unsigned char *data
)
{
	const unsigned char *table;
	tableinfo_t info;
	int64_t err;
	uint64_t actual_distribution[INFO_DISTRIBUTION_LEN];

	if ((size_t)data % 8 != 0) {
		LOG("[checkdata] Error: buffer is not 8-byte aligned\n");
		return NISSY_ERROR_DATA;
	}

	table = data + INFOSIZE;
	err = readtableinfo(data_size, data, &info);
	if (err != NISSY_OK) {
		LOG("[checkdata] Data is corrupt\n");
		return err;
	}

	if (info.type != TABLETYPE_PRUNING) {
		LOG("[checkdata] Skipping '%s'\n", info.solver);
		table += info.next;
		err = readtableinfo_n(data_size, data, 2, &info);
		if (err != NISSY_OK) {
			LOG("[checkdata] Data is corrupt\n");
			return err;
		}
	}
	
	LOG("[checkdata] Checking distribution for '%s' from "
	    "table preamble\n", info.solver);
	if (!distribution_equal(coord->pruning_distribution,
	    info.distribution, coord->pruning_max)) {
		LOG("[checkdata] Distribution from the table preamble does "
		    "not match the expected one\n");
		return NISSY_ERROR_DATA;
	}

	LOG("\n[checkdata] Checking distribution for '%s' from "
	    "actual table\n", info.solver);
	getdistribution(table, actual_distribution, &info);
	if (!distribution_equal(coord->pruning_distribution,
	    actual_distribution, coord->pruning_max)) {
		LOG("[checkdata] Distribution from the actual table does "
		    "not match the expected one\n");
		return NISSY_ERROR_DATA;
	}

	return NISSY_OK;
}

STATIC long long
checkdata_multicoord(
	const multicoord_t *mcoord,
	unsigned long long data_size,
	const unsigned char *data
)
{
	long long r;
	size_t i, of, s;

	for (of = INFOSIZE, i = 0; mcoord->coordinates[i] != NULL; i++) {
		LOG("[checkdata] %s: checking data for %s\n", mcoord->name,
		    mcoord->coordinates[i]->name);
		s = gendata_coord(mcoord->coordinates[i], NULL);
		if (s > data_size-of)
			return NISSY_ERROR_DATA;

		r = checkdata_coord(mcoord->coordinates[i], s, data + of);
		if (r != NISSY_OK)
			return r;

		LOG("[checkdata] Ok\n");

		of += s;

		/* Skip padding */
		while (of % 8 != 0) {
			if (data[of] != 0)
				LOG("[checkdata] Warning: some unused bytes "
				    "are not set to zero. Please report this "
				    "bug.\n");
			of++;
		}
	}

	return NISSY_OK;
}

#endif /* SOLVERS_COORD_CHECKDATA_H */
