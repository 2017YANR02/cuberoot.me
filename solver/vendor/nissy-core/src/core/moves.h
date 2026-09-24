#ifndef CORE_MOVES_H
#define CORE_MOVES_H

#define MOVE(M, c) compose(c, MOVE_CUBE_ ## M)
#define PREMOVE(M, c) compose(MOVE_CUBE_ ## M, c)

STATIC uint8_t readmove(char);
STATIC int64_t readmoves(const char *,
    size_t, size_t, size_t *, size_t *, uint8_t *, uint8_t *);
STATIC int64_t readmoves_struct(const char *, moves_struct_t [NON_NULL]);
STATIC int64_t countmoves(const char *);
STATIC bool moves_struct_equal(
    const moves_struct_t [NON_NULL], const moves_struct_t [NON_NULL]);
STATIC long long comparemoves(const char *, const char *);
STATIC uint8_t readmodifier(char);
STATIC int64_t writemoves(size_t, const uint8_t *, size_t, char *);
STATIC int64_t writemoves_struct(
    const moves_struct_t [NON_NULL], size_t, char *);

STATIC_INLINE bool allowednextmove(uint8_t, uint8_t);
STATIC bool allowedmoves(size_t, const uint8_t *);

STATIC_INLINE uint8_t movebase(uint8_t);
STATIC_INLINE uint8_t moveaxis(uint8_t);
STATIC_INLINE bool isbase(uint8_t);
STATIC_INLINE bool parallel(uint8_t, uint8_t);
STATIC_INLINE uint8_t moveopposite(uint8_t);
STATIC_INLINE uint8_t reorient_move(uint8_t, uint8_t);
STATIC_INLINE uint8_t inverse_reorient_move(uint8_t, uint8_t);
STATIC_INLINE uint8_t movefollow(uint8_t);
STATIC uint8_t transform_move_basic(uint8_t, uint8_t);
STATIC uint8_t transform_move(uint8_t, uint8_t);

STATIC cube_t move(cube_t, uint8_t);
STATIC cube_t premove(cube_t, uint8_t);
STATIC uint8_t inverse_move(uint8_t);
STATIC void sortparallel_moves(size_t, uint8_t*);
STATIC bool are_lastmoves_singlecw(size_t, const uint8_t*);

STATIC int64_t move_variations(const char *, const char *, size_t, char *);
STATIC int64_t move_variations_lastqt(
    const moves_struct_t [NON_NULL], size_t, char *);
STATIC int64_t move_variations_unniss(
    const moves_struct_t [NON_NULL], size_t, char *);

#define FOREACH_READMOVE(ARG_BUF, ARG_MOVE, ARG_C, ARG_MAX, \
	RET_ERROR, ARG_ACTION) \
	const char *VAR_B; \
	uint8_t VAR_MOVE_NOMOD, VAR_MOD; \
	bool VAR_IN_PARENTHESES = false; \
	for (VAR_B = ARG_BUF, ARG_C = 0; *VAR_B != '\0'; VAR_B++, ARG_C++) { \
		while (*VAR_B == ' ' || *VAR_B == '\t' || *VAR_B == '\n') \
			VAR_B++; \
		if (*VAR_B == '\0' || ARG_C == ARG_MAX) \
			break; \
		if (*VAR_B == '(') { \
			if (VAR_IN_PARENTHESES) { \
				LOG("Nested parentheses in move sequence\n"); \
				return RET_ERROR; \
			} \
			VAR_IN_PARENTHESES = true; \
			continue; \
		} \
		if (*VAR_B == ')') { \
			if (!VAR_IN_PARENTHESES) { \
				LOG("Mismatched ')' in move sequence\n"); \
				return RET_ERROR; \
			} \
			VAR_IN_PARENTHESES = false; \
			continue; \
		} \
		if ((VAR_MOVE_NOMOD = readmove(*VAR_B)) == UINT8_ERROR) { \
			LOG("Unknown move: %c\n", *VAR_B); \
			return RET_ERROR; \
		} \
		if (*(VAR_B+1) == 'w') { \
			VAR_MOVE_NOMOD += 18; \
			VAR_B++; \
		} \
		if ((VAR_MOD = readmodifier(*(VAR_B+1))) != 0) \
			VAR_B++; \
		ARG_MOVE = VAR_MOVE_NOMOD + VAR_MOD; \
		ARG_ACTION \
	} \
	if (VAR_IN_PARENTHESES) { \
		LOG("Mismatched '(' in move sequence\n"); \
		return RET_ERROR; \
	}

STATIC uint8_t
readmove(char c)
{
	switch (c) {
	case 'U':
		return MOVE_U;
	case 'D':
		return MOVE_D;
	case 'R':
		return MOVE_R;
	case 'L':
		return MOVE_L;
	case 'F':
		return MOVE_F;
	case 'B':
		return MOVE_B;
	case 'M':
		return MOVE_M;
	case 'S':
		return MOVE_S;
	case 'E':
		return MOVE_E;
	case 'x':
		return MOVE_x;
	case 'y':
		return MOVE_y;
	case 'z':
		return MOVE_z;
	default:
		return UINT8_ERROR;
	}
}

STATIC uint8_t
readmodifier(char c)
{
	switch (c) {
	case '1': /* Fallthrough */
	case '2': /* Fallthrough */
	case '3':
		return c - '0' - 1;
	case '\'':
		return 2;
	default:
		return 0;
	}
}

STATIC int64_t
readmoves(
	const char *buf,
	size_t nsize,
	size_t invsize,
	size_t *n,
	size_t *i,
	uint8_t *normal,
	uint8_t *inverse
)
{
	uint8_t m;
	uint64_t c;

	*n = *i = 0;
	FOREACH_READMOVE(buf, m, c, nsize+invsize, NISSY_ERROR_INVALID_MOVES,
		if (!VAR_IN_PARENTHESES) {
			if (*n >= nsize-1) {
				LOG("Error in readmoves: normal buffer\n");
				return NISSY_ERROR_BUFFER_SIZE;
			}
			normal[(*n)++] = m;
		} else {
			if (*i >= invsize-1) {
				LOG("Error in readmoves: inverse buffer\n");
				return NISSY_ERROR_BUFFER_SIZE;
			}
			inverse[(*i)++] = m;
		}
	)

	return (int64_t)c;
}

STATIC int64_t
readmoves_struct(const char *moves, moves_struct_t ret[NON_NULL])
{
	return readmoves(moves, NISSY_SIZE_MOVES, NISSY_SIZE_MOVES,
	    &ret->nnormal, &ret->ninverse, ret->normal, ret->inverse);
}

STATIC int64_t
countmoves(const char *buf)
{
	uint8_t m;
	uint64_t c;
	int64_t count;

	count = 0;
	FOREACH_READMOVE(buf, m, c, INT_MAX, NISSY_ERROR_INVALID_MOVES,
		count += m <= MOVE_Bw3 ? 1 : (m <= MOVE_E3 ? 2 : 0);
	)

	return count;
}

STATIC bool
moves_struct_equal(
	const moves_struct_t ms1[NON_NULL],
	const moves_struct_t ms2[NON_NULL]
)
{
	size_t i;

	if (ms1->nnormal != ms2->nnormal || ms1->ninverse != ms2->ninverse)
		return false;

	for (i = 0; i < ms1->nnormal; i++)
		if (ms1->normal[i] != ms2->normal[i])
			return false;

	for (i = 0; i < ms1->ninverse; i++)
		if (ms1->inverse[i] != ms2->inverse[i])
			return false;

	return true;
}

STATIC long long
comparemoves(const char *moves1, const char *moves2)
{
	int64_t err;
	moves_struct_t ms1, ms2;

	if ((err = readmoves_struct(moves1, &ms1)) < 0)
		return err;
	sortparallel_moves(ms1.nnormal, ms1.normal);
	sortparallel_moves(ms1.ninverse, ms1.inverse);

	if ((err = readmoves_struct(moves2, &ms2)) < 0)
		return err;
	sortparallel_moves(ms2.nnormal, ms2.normal);
	sortparallel_moves(ms2.ninverse, ms2.inverse);

	if (moves_struct_equal(&ms1, &ms2))
		return NISSY_COMPARE_MOVES_EQUAL;

	/*
	TODO: more types of move comparison
	      - up to moving rotations around
	      - up to rotation
	      - up transformation (including mirror or not including it)
	      - ...
	*/

	return NISSY_COMPARE_MOVES_DIFFERENT;
}

STATIC int64_t
writemoves(
	size_t nmoves,
	const uint8_t *m,
	size_t buf_size,
	char *buf
)
{
	size_t i, len, w;
	const char *s;

	if (buf_size == 0) {
		LOG("Error: cannot write moves to buffer of size 0.\n");
		return NISSY_ERROR_BUFFER_SIZE;
	}

	for (i = 0, w = 0; i < nmoves; i++, w++) {
		s = movestr[m[i]];
		len = strlen(s);
		if (len + w >= buf_size) {
			LOG("Error: the given buffer is too small for "
			     "writing the given moves.\n");
			goto writemoves_error;
		}
		memcpy(buf+w, s, len);
		w += len;
		buf[w] = ' ';
	}

	if (w > 0) w--; /* Remove last space */
	buf[w] = '\0';

	return (int64_t)w;

writemoves_error:
	*buf = '\0';
	return NISSY_ERROR_BUFFER_SIZE;
}

STATIC int64_t
writemoves_struct(
	const moves_struct_t moves[NON_NULL],
	size_t buf_size,
	char *buf
)
{
	int64_t w, u;

	w = 0;
	if (moves->nnormal > 0) {
		w = writemoves(moves->nnormal, moves->normal, buf_size, buf);
		if (w < 0)
			goto writemoves_struct_error;
	}

	u = 0;
	if (moves->ninverse > 0) {
		if (moves->nnormal > 0) {
			if ((size_t)w >= buf_size)
				goto writemoves_struct_error;
			buf[w++] = ' ';
		}
		if ((size_t)w >= buf_size)
			goto writemoves_struct_error;
		buf[w++] = '(';

		u = writemoves(moves->ninverse, moves->inverse,
		    buf_size-w, buf+w);
		if (u < 0)
			goto writemoves_struct_error;

		if ((size_t)w >= buf_size)
			goto writemoves_struct_error;
		buf[w + (u++)] = ')';
	}

	buf[u+w] = '\0';
	return u+w;

writemoves_struct_error:
	buf[w] = '\0';
	return NISSY_ERROR_BUFFER_SIZE;
}

STATIC_INLINE bool
allowednextmove(uint8_t m1, uint8_t m2)
{
	return allowedmask[movebase(m1)] & MM_SINGLE(m2);
}

STATIC bool
allowedmoves(size_t n, const uint8_t *m)
{
	uint8_t j;

	for (j = 1; j < n; j++)
		if (!allowednextmove(m[j-1], m[j]))
			return false;

	return true;
}

STATIC_INLINE uint8_t
movebase(uint8_t move)
{
	return move / 3;
}

STATIC_INLINE uint8_t
moveaxis(uint8_t move)
{
	return move / 6;
}

STATIC_INLINE bool
isbase(uint8_t move)
{
	return move == 3 * movebase(move);
}

STATIC_INLINE bool
parallel(uint8_t m1, uint8_t m2)
{
	return moveaxis(movefollow(m1)) == moveaxis(movefollow(m2));
}

STATIC_INLINE uint8_t
moveopposite(uint8_t move)
{
	return movebase(move) == 2 * moveaxis(move) ? move + 3 : move - 3;
}

STATIC_INLINE uint8_t
reorient_move(uint8_t m, uint8_t or)
{
	return transform_move(m, orientation_trans[or]);
}

STATIC_INLINE uint8_t
inverse_reorient_move(uint8_t m, uint8_t or)
{
	return transform_move(m, inverse_trans_table[orientation_trans[or]]);
}

STATIC_INLINE uint8_t
movefollow(uint8_t move)
{
	uint8_t b, m;

	if (move <= MOVE_B3)
		return move;

	if (move <= MOVE_Bw3)
		return move - MOVE_Uw;

	b = UINT8_C(3) * (move / UINT8_C(3));
	m = move - b;
	switch (b) {
	case MOVE_M:
		return MOVE_L + m;
	case MOVE_S:
		return MOVE_F + m;
	case MOVE_E:
		return MOVE_D + m;
	case MOVE_x:
		return MOVE_R + m;
	case MOVE_y:
		return MOVE_U + m;
	case MOVE_z:
		return MOVE_F + m;
	default:
		return UINT8_ERROR;
	}
}

STATIC cube_t
move(cube_t c, uint8_t m)
{
	switch (m) {
	case MOVE_U:
		return MOVE(U, c);
	case MOVE_U2:
		return MOVE(U2, c);
	case MOVE_U3:
		return MOVE(U3, c);
	case MOVE_D:
		return MOVE(D, c);
	case MOVE_D2:
		return MOVE(D2, c);
	case MOVE_D3:
		return MOVE(D3, c);
	case MOVE_R:
		return MOVE(R, c);
	case MOVE_R2:
		return MOVE(R2, c);
	case MOVE_R3:
		return MOVE(R3, c);
	case MOVE_L:
		return MOVE(L, c);
	case MOVE_L2:
		return MOVE(L2, c);
	case MOVE_L3:
		return MOVE(L3, c);
	case MOVE_F:
		return MOVE(F, c);
	case MOVE_F2:
		return MOVE(F2, c);
	case MOVE_F3:
		return MOVE(F3, c);
	case MOVE_B:
		return MOVE(B, c);
	case MOVE_B2:
		return MOVE(B2, c);
	case MOVE_B3:
		return MOVE(B3, c);
	default:
		LOG("move error: %" PRIu8 " is not a basic move\n", m);
		return ZERO_CUBE;
	}
}

STATIC uint8_t
transform_move_basic(uint8_t m, uint8_t t)
{
	uint8_t a, base, modifier;

	if (t > 47) {
		LOG("transform_move: invalid trans %" PRIu8 "\n", t);
		return UINT8_ERROR;
	}

	a = moveaxis(m);
	base = trans_move_table[t][a];
	if (movebase(m) != 2 * a)
		base = moveopposite(base);

	modifier = m % 3;
	if (t >= TRANS_UFm)
		modifier = 2 - modifier;

	return base + modifier;
}

STATIC uint8_t
transform_move(uint8_t m, uint8_t t)
{
	if (m <= MOVE_B3)
		return transform_move_basic(m, t);

	if (m >= MOVE_Uw && m <= MOVE_Bw3)
		return 18+transform_move_basic(m-18, t);

	if (m >= MOVE_M && m <= MOVE_E3)
		return basic_to_slice[
		    transform_move_basic(slice_to_basic[m], t)];

	if (m >= MOVE_x && m <= MOVE_z3)
		return basic_to_rotation[
		    transform_move_basic(rotation_to_basic[m], t)];

	LOG("transform_move: invalid move %" PRIu8 "\n", m);
	return UINT8_ERROR;
}

/* Applies the INVERSE of m BEFORE the scramble corresponding to c */
STATIC cube_t
premove(cube_t c, uint8_t m)
{
	switch (m) {
	case MOVE_U:
		return PREMOVE(U3, c);
	case MOVE_U2:
		return PREMOVE(U2, c);
	case MOVE_U3:
		return PREMOVE(U, c);
	case MOVE_D:
		return PREMOVE(D3, c);
	case MOVE_D2:
		return PREMOVE(D2, c);
	case MOVE_D3:
		return PREMOVE(D, c);
	case MOVE_R:
		return PREMOVE(R3, c);
	case MOVE_R2:
		return PREMOVE(R2, c);
	case MOVE_R3:
		return PREMOVE(R, c);
	case MOVE_L:
		return PREMOVE(L3, c);
	case MOVE_L2:
		return PREMOVE(L2, c);
	case MOVE_L3:
		return PREMOVE(L, c);
	case MOVE_F:
		return PREMOVE(F3, c);
	case MOVE_F2:
		return PREMOVE(F2, c);
	case MOVE_F3:
		return PREMOVE(F, c);
	case MOVE_B:
		return PREMOVE(B3, c);
	case MOVE_B2:
		return PREMOVE(B2, c);
	case MOVE_B3:
		return PREMOVE(B, c);
	default:
		LOG("premove error: unknown move %" PRIu8 "\n", m);
		return ZERO_CUBE;
	}
}

STATIC uint8_t
inverse_move(uint8_t m)
{
	return m - 2 * (m % 3) + 2;	
}

STATIC void
sortparallel_moves(size_t n, uint8_t *moves)
{
	uint8_t i;

	if (n < 2)
		return;

	for (i = 0; i < n-1; i++)
		if (parallel(moves[i], moves[i+1]) && moves[i] > moves[i+1])
			SWAP(moves[i], moves[i+1]);
}

STATIC bool
are_lastmoves_singlecw(size_t n, const uint8_t *moves)
{
	bool two;

	if (n == 0)
		return true;

	two = n > 1 && parallel(moves[n-1], moves[n-2]);

	return isbase(moves[n-1]) && (!two || isbase(moves[n-2]));
}

STATIC int64_t
move_variations(
	const char *moves,
	const char *variation,
	size_t result_size,
	char *result
)
{
	moves_struct_t m;
	int64_t err;

	err = readmoves_struct(moves, &m);
	if (err < 0) {
		LOG("[variations] Error reading moves.\n");
		return err;
	}

	if (!strcmp(variation, "lastqt")) {
		return move_variations_lastqt(&m, result_size, result);
	} else if (!strcmp(variation, "unniss")) {
		return move_variations_unniss(&m, result_size, result);
	} else {
		LOG("[variations] Error: unknown variation '%s'\n", variation);
		return NISSY_ERROR_INVALID_VARIATION;
	}
}

STATIC int64_t
move_variations_lastqt(
	const moves_struct_t s[NON_NULL],
	size_t result_size,
	char *result
)
{
	uint8_t n1, n2, i1, i2, swapn1, swapn2, swapi1, swapi2, i, j, k, l;
	int8_t in1, in2, ii1, ii2;
	int64_t err, count;
	size_t u;
	moves_struct_t ss;

	in1 = (uint8_t)(s->nnormal-1);
	in2 = (uint8_t)(s->nnormal-2);
	ii1 = (uint8_t)(s->ninverse-1);
	ii2 = (uint8_t)(s->ninverse-2);

	n1 = in1 >= 0 ? s->normal[in1] : UINT8_ERROR;
	n2 = in2 >= 0 ? s->normal[in2] : UINT8_ERROR;
	i1 = ii1 >= 0 ? s->inverse[ii1] : UINT8_ERROR;
	i2 = ii2 >= 0 ? s->inverse[ii2] : UINT8_ERROR;

	swapn1 = in1 >= 0 && n1 % 3 != 1 ? 1 : 0;
	swapn2 = swapn1 && in2 >= 0 && n2 % 3 != 1 && parallel(n1, n2) ? 1 : 0;
	swapi1 = ii1 >= 0 && i1 % 3 != 1 ? 1 : 0;
	swapi2 = swapi1 && ii2 >= 0 && i2 % 3 != 1 && parallel(i1, i2) ? 1 : 0;

	/* Reset ending qt to base so that they are sorted */
	ss = *s;
	if (swapn1 == 1) ss.normal[in1] = 3*movebase(n1);
	if (swapn2 == 1) ss.normal[in2] = 3*movebase(n2);
	if (swapi1 == 1) ss.inverse[ii1] = 3*movebase(i1);
	if (swapi2 == 1) ss.inverse[ii2] = 3*movebase(i2);

	u = 0;
	count = 0;
	for (i = 0; i <= swapn2; i++) {
		if (i == 1) ss.normal[in2] += 2;
		for (j = 0; j <= swapn1; j++) {
			if (j == 1) ss.normal[in1] += 2;
			for (k = 0; k <= swapi2; k++) {
				if (k == 1) ss.inverse[ii2] += 2;
				for (l = 0; l <= swapi1; l++) {
					if (l == 1) ss.inverse[ii1] += 2;

					err = writemoves_struct(
					    &ss, result_size-u, result+u);
					if (err < 0)
						goto lastqt_error;
					u += err;
					count++;

					if (u >= result_size)
						goto lastqt_error;
					result[u++] = '\n';
					result[u] = '\0';

					if (l == 1) ss.inverse[ii1] -= 2;
				}
				if (k == 1) ss.inverse[ii2] -= 2;
			}
			if (j == 1) ss.normal[in1] -= 2;
		}
		if (i == 1) ss.normal[in2] -= 2;
	}

	return count;

lastqt_error:
	LOG("[variations] Error writing result.\n");
	return NISSY_ERROR_BUFFER_SIZE;
}

STATIC int64_t
move_variations_unniss(
	const moves_struct_t s[NON_NULL],
	size_t result_size,
	char *result
)
{
	size_t i, tot;
	uint8_t res[NISSY_SIZE_MOVES];
	int64_t err;

	tot = s->nnormal + s->ninverse;
	if (tot > NISSY_SIZE_MOVES) {
		LOG("[variations] Error: %zu total moves, more than maximum "
		    "allowed %zu", tot, NISSY_SIZE_MOVES);
		return NISSY_ERROR_BUFFER_SIZE;
	}

	for (i = 0; i < s->nnormal; i++)
		res[i] = s->normal[i];
	for (i = 0; i < s->ninverse; i++)
		res[i+s->nnormal] = inverse_move(s->inverse[s->ninverse-i-1]);

	err = writemoves(tot, res, result_size, result);
	if (err < 0 || (size_t)err > result_size)
		goto unniss_error;

	result[err++] = '\n';
	result[err] = '\0';
	return 1;

unniss_error:
	LOG("[variations] Error writing result.\n");
	return NISSY_ERROR_BUFFER_SIZE;
}

#endif /* CORE_MOVES_H */
