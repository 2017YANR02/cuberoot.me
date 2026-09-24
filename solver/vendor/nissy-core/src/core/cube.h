#ifndef CORE_CUBE_H
#define CORE_CUBE_H

STATIC bool cube_true(cube_t);

STATIC cube_t cubefromarray(uint8_t [SIZE(8)], uint8_t [SIZE(12)]);
STATIC bool isconsistent(oriented_cube_t);
STATIC bool issolvable(oriented_cube_t);
STATIC bool issolved(oriented_cube_t);
STATIC bool iserror(oriented_cube_t);
STATIC void getcube_fix(long long *, long long *,
    long long *, long long *, long long *);
STATIC cube_t getcube(uint64_t, uint64_t, uint64_t, uint64_t);

STATIC oriented_cube_t readcube(const char *);
STATIC int64_t writecube(oriented_cube_t, size_t n, char *);
STATIC uint8_t readco(const char *);
STATIC uint8_t readcp(const char *);
STATIC uint8_t readeo(const char *);
STATIC uint8_t readep(const char *);

STATIC uint8_t b32toedge(char);
STATIC uint8_t b32tocorner(char);
STATIC char edgetob32(uint8_t);
STATIC char cornertob32(uint8_t);

/* Used e.g. by the CORNERS coordinate, when a function pointer is needed */
STATIC bool
cube_true(cube_t cube)
{
	return true;
}

STATIC cube_t
cubefromarray(uint8_t c[SIZE(8)], uint8_t e[SIZE(12)])
{
	return STATIC_CUBE(
	    c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7],
	    e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7],
	    e[8], e[9], e[10], e[11]);
}

STATIC bool
isconsistent(oriented_cube_t cube)
{
	uint8_t i, p, e, piece, corner[8], edge[12];
	bool found[12];

	pieces(&cube.cube, corner, edge);

	for (i = 0; i < 12; i++)
		found[i] = false;
	for (i = 0; i < 12; i++) {
		piece = edge[i];
		p = piece & PBITS;
		e = piece & EOBIT;
		if (p >= 12)
			goto inconsistent_ep;
		if (e != 0 && e != EOBIT)
			goto inconsistent_eo;
		found[p] = true;
	}
	for (i = 0; i < 12; i++)
		if (!found[i])
			goto inconsistent_ep;

	for (i = 0; i < 8; i++)
		found[i] = false;
	for (i = 0; i < 8; i++) {
		piece = corner[i];
		p = piece & PBITS;
		e = piece & COBITS;
		if (p >= 8)
			goto inconsistent_cp;
		if (e != 0 && e != CTWIST_CW && e != CTWIST_CCW)
			goto inconsistent_co;
		found[p] = true;
	}
	for (i = 0; i < 8; i++)
		if (!found[i])
			goto inconsistent_cp;

	if (cube.orientation >= 24)
		goto inconsistent_orientation;

	return true;

inconsistent_ep:
inconsistent_cp:
inconsistent_eo:
inconsistent_co:
inconsistent_orientation:
	/* We used to do more logging here, hence the different labels */
	return false;
}

STATIC bool
issolvable(oriented_cube_t cube)
{
	uint8_t i, eo, co, piece, edge[12], corner[8], ep[12], cp[8];

	DBG_ASSERT(isconsistent(cube), "issolvable: cube is inconsistent\n");

	pieces(&cube.cube, corner, edge);
	for (i = 0; i < 12; i++)
		ep[i] = edge[i] & PBITS;
	for (i = 0; i < 8; i++)
		cp[i] = corner[i] & PBITS;

	if (permsign(12, ep) != permsign(8, cp))
		goto issolvable_parity;

	eo = 0;
	for (i = 0; i < 12; i++) {
		piece = edge[i];
		eo += (piece & EOBIT) >> EOSHIFT;
	}
	if (eo % 2 != 0)
		goto issolvable_eo;

	co = 0;
	for (i = 0; i < 8; i++) {
		piece = corner[i];
		co += (piece & COBITS) >> COSHIFT;
	}
	if (co % 3 != 0)
		goto issolvable_co;

	return true;

issolvable_parity:
	LOG("There is parity\n");
	return false;
issolvable_eo:
	LOG("EO is not solvable\n");
	return false;
issolvable_co:
	LOG("CO is not solvable\n");
	return false;
}

bool
issolved(oriented_cube_t cube)
{
	return equal(cube.cube, SOLVED_CUBE);
}

bool
iserror(oriented_cube_t cube)
{
	return equal(cube.cube, ZERO_CUBE);
}

STATIC void
getcube_fix(
	long long *ep,
	long long *eo,
	long long *cp,
	long long *co,
	long long *orien
)
{
	uint8_t e[12], c[8], coarr[8];

	*ep = POSITIVE_MOD(*ep, (long long)FACT_12);
	*eo = POSITIVE_MOD(*eo, (long long)POW_2_11);
	*cp = POSITIVE_MOD(*cp, (long long)FACT_8);
	*co = POSITIVE_MOD(*co, (long long)POW_3_7);
	*orien = POSITIVE_MOD(*orien, 24LL);

	indextoperm((uint64_t)*ep, 12, e);
	indextoperm((uint64_t)*cp, 8, c);
	if (permsign(12, e) != permsign(8, c)) {
		SWAP(c[0], c[1]);
		*cp = (long long)permtoindex(8, c);

		sumzerotodigits((uint64_t)*co, 8, 3, coarr);
		SWAP(coarr[0], coarr[1]);
		*co = (uint64_t)digitstosumzero(8, coarr, 3);
	}
}

STATIC cube_t
getcube(uint64_t ep, uint64_t eo, uint64_t cp, uint64_t co)
{
	uint8_t i, earr[12], carr[8], eoarr[12], coarr[8];

	sumzerotodigits(eo, 12, 2, eoarr);
	DBG_ASSERT(eoarr[0] != UINT8_ERROR, "Error making EO");
	indextoperm(ep, 12, earr);
	DBG_ASSERT(earr[0] != UINT8_ERROR, "Error making EP");
	for (i = 0; i < 12; i++)
		earr[i] |= eoarr[i] << EOSHIFT;

	sumzerotodigits(co, 8, 3, coarr);
	DBG_ASSERT(coarr[0] != UINT8_ERROR, "Error making CO");
	indextoperm(cp, 8, carr);
	DBG_ASSERT(carr[0] != UINT8_ERROR, "Error making CP");
	for (i = 0; i < 8; i++)
		carr[i] |= coarr[i] << COSHIFT;

	return cubefromarray(carr, earr);
}

STATIC uint8_t
readco(const char *str)
{
	if (*str == '0')
		return 0;
	if (*str == '1')
		return CTWIST_CW;
	if (*str == '2')
		return CTWIST_CCW;

	LOG("Error reading CO\n");
	return UINT8_ERROR;
}

STATIC uint8_t
readcp(const char *str)
{
	uint8_t c;

	for (c = 0; c < 8; c++)
		if (!strncmp(str, cornerstr[c], 3) ||
		    !strncmp(str, cornerstralt[c], 3))
			return c;

	LOG("Error reading CP\n");
	return UINT8_ERROR;
}

STATIC uint8_t
readeo(const char *str)
{
	if (*str == '0')
		return 0;
	if (*str == '1')
		return EFLIP;

	LOG("Error reading EO\n");
	return UINT8_ERROR;
}

STATIC uint8_t
readep(const char *str)
{
	uint8_t e;

	for (e = 0; e < 12; e++)
		if (!strncmp(str, edgestr[e], 2))
			return e;

	LOG("Error reading EP\n");
	return UINT8_ERROR;
}

STATIC oriented_cube_t
readcube(const char *buf)
{
	int i;
	uint8_t c[8], e[12], orientation;

	for (i = 0; i < 8; i++) {
		c[i] = b32tocorner(buf[i]);
		if (c[i] == UINT8_ERROR) {
			LOG("Error reading corner %d ", i);
			if (buf[i] == 0) {
				LOG("(string terminated early)\n");
			} else {
				LOG("(char '%c')\n", buf[i]);
			}
			return ZERO_ORIENTED_CUBE;
		}
	}

	if (buf[8] != '=') {
		LOG("Error reading separator: a single '=' "
		    "must be used to separate edges and corners\n");
		return ZERO_ORIENTED_CUBE;
	}

	for (i = 0; i < 12; i++) {
		e[i] = b32toedge(buf[i+9]);
		if (e[i] == UINT8_ERROR) {
			LOG("Error reading edge %d ", i);
			if (buf[i+9] == 0) {
				LOG("(string terminated early)\n");
			} else {
				LOG("(char '%c')\n", buf[i+9]);
			}
			return ZERO_ORIENTED_CUBE;
		}
	}

	orientation = (uint8_t)(buf[22] - 'A');
	if (orientation >= 24) {
		LOG("Error reading orientation: impossible value %" PRIu8
		    " (%c)\n", orientation, buf[22]);
		return ZERO_ORIENTED_CUBE;
	}

	return (oriented_cube_t) {
		.cube = cubefromarray(c, e),
		.orientation = orientation
	};
}

STATIC int64_t
writecube(oriented_cube_t cube, size_t buf_size, char *buf)
{
	int i;
	uint8_t corner[8], edge[12];

	if (buf_size < NISSY_SIZE_CUBE) {
		LOG("Cannot write cube: buffer size must be at least %u "
		    "bytes, but the provided one is %zu bytes.\n",
		    NISSY_SIZE_CUBE, buf_size);
		return NISSY_ERROR_BUFFER_SIZE;
	}

	pieces(&cube.cube, corner, edge);

	for (i = 0; i < 8; i++)
		buf[i] = cornertob32(corner[i]);

	buf[8] = '=';

	for (i = 0; i < 12; i++)
		buf[i+9] = edgetob32(edge[i]);

	buf[21] = '=';
	buf[22] = (char)cube.orientation + 'A';
	buf[23] = '\0';

	return NISSY_OK;
}

STATIC uint8_t
b32toedge(char c)
{
	if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'f')))
		return UINT8_ERROR;

	return c <= 'Z' ? (uint8_t)(c - 'A') : (uint8_t)(c - 'a') + 26;
}

STATIC uint8_t
b32tocorner(char c) {
	uint8_t val;

	if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'f')))
		return UINT8_ERROR;

	val = c <= 'Z' ? (uint8_t)(c - 'A') : (uint8_t)(c - 'a') + 26;

	return (val & 7) | ((val & 24) << 2);
}

STATIC char
edgetob32(uint8_t edge)
{
	return edge < 26 ? 'A' + (char)edge : 'a' + (char)(edge - 26);
}

STATIC char
cornertob32(uint8_t corner)
{
	uint8_t val;

	val = (corner & 7) | ((corner & 96) >> 2);

	return val < 26 ? 'A' + (char)val : 'a' + (char)(val - 26);
}

#endif /* CORE_CUBE_H */
