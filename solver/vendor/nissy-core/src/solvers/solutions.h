#ifndef SOLVERS_SOLUTIONS_H
#define SOLVERS_SOLUTIONS_H

STATIC void solution_moves_reset(solution_moves_t [NON_NULL]);
STATIC void solution_moves_transform(solution_moves_t [NON_NULL], size_t,
    uint8_t);
STATIC void solution_moves_reorient(solution_moves_t [NON_NULL], uint8_t);
STATIC bool solution_list_init(solution_list_t [NON_NULL], size_t, char *);
STATIC bool solution_moves_equal(
    const solution_moves_t [NON_NULL], const solution_moves_t [NON_NULL]);
STATIC bool last_solution_is_duplicate(const solution_list_t [NON_NULL]);
STATIC bool appendchar(solution_list_t [NON_NULL], char);
STATIC bool appendnormal(
    const solution_moves_t [NON_NULL], solution_list_t [NON_NULL]);
STATIC bool appendinverse(
    const solution_moves_t [NON_NULL], solution_list_t [NON_NULL]);
STATIC void appendsolution_dfs(const solution_moves_t [NON_NULL], size_t,
    const uint64_t *, size_t, uint8_t *, const solution_settings_t [NON_NULL],
    solution_list_t [NON_NULL],
    solution_moves_t [SIZE(NTRANS * SOLUTION_MAXLEN)], int64_t [NON_NULL]);
STATIC int64_t appendsolution(const solution_moves_t [NON_NULL],
    size_t, const uint64_t *, const solution_settings_t [NON_NULL],
    solution_list_t [NON_NULL]);
STATIC bool solutions_done(const solution_list_t [NON_NULL],
    const solution_settings_t [NON_NULL], int8_t depth);

STATIC void
solution_moves_reset(solution_moves_t sol[NON_NULL])
{
	sol->nmoves = 0;
	sol->npremoves = 0;
}

STATIC void
solution_moves_transform(solution_moves_t moves[NON_NULL], size_t z, uint8_t t)
{
	uint8_t i;

	for (i = (uint8_t)z; i < moves->nmoves; i++)
		moves->moves[i] = transform_move(moves->moves[i], t);

	for (i = 0; i < moves->npremoves; i++)
		moves->premoves[i] = transform_move(moves->premoves[i], t);
}

STATIC void
solution_moves_reorient(solution_moves_t moves[NON_NULL], uint8_t or)
{
	uint8_t i;

	for (i = 0; i < moves->nmoves; i++)
		moves->moves[i] =
		    inverse_reorient_move(moves->moves[i], or);

	for (i = 0; i < moves->npremoves; i++)
		moves->premoves[i] =
		    inverse_reorient_move(moves->premoves[i], or);
}

STATIC bool
solution_list_init(solution_list_t sols[NON_NULL], size_t n, char *buf)
{
	if (n == 0)
		return false;

	sols->nsols = 0;
	sols->shortest_sol = SOLUTION_MAXLEN + 1;
	sols->size = n;
	sols->used = 0;
	sols->buf = buf;
	sols->buf[0] = '\0';

	return true;
}

STATIC bool
solution_moves_equal(
	const solution_moves_t a[NON_NULL],
	const solution_moves_t b[NON_NULL]
)
{
	uint8_t i;

	if (a->nmoves != b->nmoves || a->npremoves != b->npremoves)
		return false;

	for (i = 0; i < a->nmoves; i++)
		if (a->moves[i] != b->moves[i])
			return false;

	for (i = 0; i < a->npremoves; i++)
		if (a->premoves[i] != b->premoves[i])
			return false;

	return true;
}

STATIC bool
last_solution_is_duplicate(const solution_list_t l[NON_NULL])
{
	size_t i, j;

	if (l->nsols == 1)
		return false;

	/* We assume the list is newline-terminated */
	j = l->used-2;
	while (true) {
		for ( ; l->buf[j] != '\n'; j--)
			if (j == 0) return false;
		j--;
		for (i = l->used-2; l->buf[i] == l->buf[j]; i--, j--) {
			if (l->buf[i-1] == '\n') {
				if (j == 0 || l->buf[j-1] == '\n')
					return true;
				else break;
			}
		}
	}

	return false;
}

STATIC bool
appendchar(solution_list_t solutions[NON_NULL], char c)
{
	if (solutions->size <= solutions->used)
		return false;

	solutions->buf[solutions->used++] = c;

	return true;
}

STATIC bool
appendnormal(
	const solution_moves_t moves[NON_NULL],
	solution_list_t list[NON_NULL]
)
{
	int64_t strl;

	if (moves->nmoves == 0)
		return true;

	if ((strl = writemoves(moves->nmoves, moves->moves,
	    list->size - list->used, list->buf + list->used)) < 0)
		return false;
	list->used += strl;

	return true;
}

STATIC bool
appendinverse(
	const solution_moves_t moves[NON_NULL],
	solution_list_t list[NON_NULL]
)
{
	int64_t strl;

	if (moves->npremoves == 0)
		return true;

	if (!appendchar(list, '('))
		return false;

	if ((strl = writemoves(moves->npremoves, moves->premoves,
	    list->size - list->used, list->buf + list->used)) < 0)
		return false;
	list->used += strl;

	return appendchar(list, ')');
}

STATIC void
appendsolution_dfs(
	const solution_moves_t moves[NON_NULL],
	size_t ntmask,
	const uint64_t *tmask,
	size_t itm,
	uint8_t *tt,
	const solution_settings_t settings[NON_NULL],
	solution_list_t list[NON_NULL],
	solution_moves_t tsol[SIZE(NTRANS * SOLUTION_MAXLEN)],
	int64_t r[NON_NULL]
)
{
	/*
	The logic here is quit complex because we have to address H48
	solutions that may be reduced by symmetry in the first few moves.
	*/

	size_t i, last_start;
	uint8_t t;
	solution_moves_t moves_copy;

	if (list->nsols >= settings->maxsolutions)
		return;

	if (ntmask == itm) {
		tsol[*r] = *moves;

		for (i = ntmask; i > 0; i--)
			solution_moves_transform(&tsol[*r], i-1, tt[i-1]);

		solution_moves_reorient(&tsol[*r], settings->orientation);
		sortparallel_moves(tsol[*r].nmoves, tsol[*r].moves);
		sortparallel_moves(tsol[*r].npremoves, tsol[*r].premoves);

		last_start = list->used;

		/* Append first the moves on the side that has more */
		/* E.g. write (U L F) B instead of B (U L F) */
		if (tsol[*r].nmoves >= tsol[*r].npremoves) {
			if (!appendnormal(&tsol[*r], list))
				goto appendsolution_dfs_error_buffer;

			if (tsol[*r].nmoves > 0 && tsol[*r].npremoves > 0)
				if (!appendchar(list, ' '))
					goto appendsolution_dfs_error_buffer;

			if (!appendinverse(&tsol[*r], list))
				goto appendsolution_dfs_error_buffer;
		} else {
			if (!appendinverse(&tsol[*r], list))
				goto appendsolution_dfs_error_buffer;

			if (tsol[*r].nmoves > 0 && tsol[*r].npremoves > 0)
				if (!appendchar(list, ' '))
					goto appendsolution_dfs_error_buffer;

			if (!appendnormal(&tsol[*r], list))
				goto appendsolution_dfs_error_buffer;
		}

		if (!appendchar(list, '\n'))
			goto appendsolution_dfs_error_buffer;
		++list->nsols;

		/*
		Normaly, it would be enough to check for duplicates in the
		current "pack" of transformation-equivalent solutions.
		However, in rare cases, the H48 solver may produce equivalent
		"packs" of solutions. It would be more elegant to filter out
		the corresponding tasks in solve_h48_maketasks(), but doing so
		is not trivial. In the end, duplicate solutions are never
		desirable, so we might as well do this clean up here.
		*/
		if (last_solution_is_duplicate(list)) {
			--list->nsols;
			list->used = last_start;
			return;
		}

		list->shortest_sol = MIN(
		    list->shortest_sol, tsol[*r].nmoves + tsol[*r].npremoves);
		(*r)++;
	} else {
		for (t = 0; t < NTRANS; t++) {
			if (!(tmask[itm] & TM_SINGLE(t)))
				continue;
			moves_copy = *moves;
			tt[itm] = t;
			appendsolution_dfs(&moves_copy, ntmask, tmask,
			    itm+1, tt, settings, list, tsol, r);
			if (*r < 0)
				return;
		}
	}

	return;

appendsolution_dfs_error_buffer:
	list->buf[0] = '\0';
	*r = NISSY_ERROR_BUFFER_SIZE;
	return;
}

STATIC int64_t
appendsolution(
	const solution_moves_t moves[NON_NULL],
	size_t ntmask,
	const uint64_t *tmask,
	const solution_settings_t settings[NON_NULL],
	solution_list_t list[NON_NULL]
)
{
	int64_t r;
	int i;
	uint8_t tt[SOLUTION_MAXLEN];
	solution_moves_t moves_copy, tsol[NTRANS * SOLUTION_MAXLEN];

	if (moves->nmoves + moves->npremoves > SOLUTION_MAXLEN)
		goto appendsolution_error_solution_length;

	moves_copy = *moves;
	if (settings->unniss) {
		moves_copy.nmoves += moves->npremoves;
		moves_copy.npremoves = 0;
		for (i = moves->npremoves-1; i >= 0; i--)
			moves_copy.moves[moves_copy.nmoves - i - 1] =
			    inverse_move(moves->premoves[i]);

		/*
		This is a bit ugly: we have to sort now and then again
		later, because the allowedmoves check would fail with
		improperly sorted parallel moves, but then transforming
		could swap the pairs the wrong way around.
		*/
		sortparallel_moves(moves_copy.nmoves, moves_copy.moves);

		/* Check if unnissed premoves cancel with normal. */
		if (!allowedmoves(moves_copy.nmoves, moves_copy.moves))
			return 0;
	}

	r = 0;
	memset(tt, TRANS_UFr, SOLUTION_MAXLEN);
	appendsolution_dfs(
	    &moves_copy, ntmask, tmask, 0, tt, settings, list, tsol, &r);
	if (r < 0)
		return r;

	list->buf[list->used] = '\0';
	return r;

appendsolution_error_solution_length:
	list->buf[0] = '\0';
	return NISSY_ERROR_UNKNOWN;
}

STATIC bool
solutions_done(
	const solution_list_t list[NON_NULL],
	const solution_settings_t settings[NON_NULL],
	int8_t depth
)
{
	return depth > settings->maxmoves ||
	    depth > list->shortest_sol + settings->optimal ||
	    list->nsols >= settings->maxsolutions;
}

#endif /* SOLVERS_SOLUTIONS_H */
