#ifndef SOLVERS_H48_DISTRIBUTION_H48_H
#define SOLVERS_H48_DISTRIBUTION_H48_H

/*
This file is very similar to ../distibution.h, but some adaptations are
needed for H48 because of the intertwined fallback table, and it is easier
to have some duplication than to make these functions needlessly generic.
*/

STATIC wrapthread_return_t getdistribution_h48_runthread(void *);
STATIC void getdistribution_h48(const unsigned char *,
    uint64_t [SIZE(INFO_DISTRIBUTION_LEN)], const tableinfo_t [NON_NULL]);

STATIC wrapthread_return_t 
getdistribution_h48_runthread(void *arg)
{
	getdistribution_data_t *data = (getdistribution_data_t *)arg;
	const unsigned char *table;
	uint8_t j, k, m;
	uint64_t line, d;
	unsigned char t;

	memset(data->distr, 0, INFO_DISTRIBUTION_LEN * sizeof(uint64_t));

	k = data->bits;
	table = data->table;
	m = TABLE_MASK(0, k);
	for (line = data->min; line < data->max; line++) {
		for (d = 0; d < H48_LINE_BYTES; d++) {
			t = table[d + line * H48_LINE_BYTES];
			for (j = 0; j < ENTRIES_PER_BYTE(k); j++)
				data->distr[(t & (m << (j*k))) >> (j*k)]++;
		}
		t = table[(line+1) * H48_LINE_BYTES - 1];
		data->distr[(t & (m << (2*k))) >> (2*k)]--;
		data->distr[(t & (m << (3*k))) >> (3*k)]--;
#ifdef CUBEROOT_H48_PROGRESS
		if ((line - data->min + 1) % 8192 == 0)
			cuberoot_h48_progress_add(8192);
#endif
	}
#ifdef CUBEROOT_H48_PROGRESS
	cuberoot_h48_progress_add((data->max - data->min) % 8192);
#endif

	return wrapthread_return_val;
}

STATIC void
getdistribution_h48(
	const unsigned char *table,
	uint64_t distr[SIZE(INFO_DISTRIBUTION_LEN)],
	const tableinfo_t info[NON_NULL]
) {
	getdistribution_data_t targ[THREADS];
	wrapthread_define_var_thread_t(thread[THREADS]);
	uint64_t local_distr[THREADS][INFO_DISTRIBUTION_LEN];
	uint64_t i, j, lines, lines_per_thread, c;

	lines = H48_LINES(info->h48h);
	lines_per_thread = DIV_ROUND_UP(lines, THREADS);
#ifdef CUBEROOT_H48_PROGRESS
	cuberoot_h48_progress_distribution(lines);
#endif

	for (i = 0; i < THREADS; i++) {
		targ[i] = (getdistribution_data_t) {
			.min = i * lines_per_thread,
			.max = MIN((i+1) * lines_per_thread, lines),
			.bits = info->bits,
			.distr = local_distr[i],
			.table = table,
		};
		wrapthread_create(&thread[i],
		    getdistribution_h48_runthread, &targ[i]);
	}

	for (i = 0; i < THREADS; i++)
		wrapthread_join(thread[i]);

	memset(distr, 0, INFO_DISTRIBUTION_LEN * sizeof(uint64_t));
	for (i = 0; i < THREADS; i++)
		for (j = 0; j < INFO_DISTRIBUTION_LEN; j++)
			distr[j] += local_distr[i][j];

	/* Clean up excess values */
	c = H48_LINE_EXT(H48_COORDMAX(info->h48h)) % H48_LINE_ALLCOORDS;
	distr[3] -= H48_LINE_COORDS - c;
}

#endif /* SOLVERS_H48_DISTRIBUTION_H48_H */
