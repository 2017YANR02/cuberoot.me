#ifndef ARCH_AVX2_H
#define ARCH_AVX2_H

#define CO2_AVX2 _mm256_set_epi64x(0, 0, 0, INT64_C(0x6060606060606060))
#define COCW_AVX2 _mm256_set_epi64x(0, 0, 0, INT64_C(0x2020202020202020))
#define CP_AVX2 _mm256_set_epi64x(0, 0, 0, INT64_C(0x0707070707070707))
#define EP_AVX2 _mm256_set_epi64x(\
    INT64_C(0x0F0F0F0F), INT64_C(0x0F0F0F0F0F0F0F0F), 0, 0)
#define EO_AVX2 _mm256_set_epi64x(\
    INT64_C(0x10101010), INT64_C(0x1010101010101010), 0, 0)
#define ORIENT_AVX2 _mm256_set_epi64x(INT64_C(0x10101010), \
    INT64_C(0x1010101010101010), 0, INT64_C(0x6060606060606060))
#define USED_AVX2 _mm256_set_epi64x(INT64_C(0x00000000FFFFFFFF), \
    INT64_C(0xFFFFFFFFFFFFFFFF), 0, INT64_C(0xFFFFFFFFFFFFFFFF))
#define CARRY_AVX2 _mm256_set_epi64x(INT64_C(0x20202020), \
    INT64_C(0x2020202020202020), 0, INT64_C(0x6060606060606060))

#define SOLVED_L INT64_C(0x0706050403020100)
#define SOLVED_H INT64_C(0x0B0A0908)

#define STATIC_CUBE(c_ufr, c_ubl, c_dfl, c_dbr, c_ufl, c_ubr, c_dfr, c_dbl, \
    e_uf, e_ub, e_db, e_df, e_ur, e_ul, e_dl, e_dr, e_fr, e_fl, e_bl, e_br) \
    _mm256_set_epi8(0, 0, 0, 0, e_br, e_bl, e_fl, e_fr, \
        e_dr, e_dl, e_ul, e_ur, e_df, e_db, e_ub, e_uf, \
        0, 0, 0, 0, 0, 0, 0, 0, \
        c_dbl, c_dfr, c_ubr, c_ufl, c_dbr, c_dfl, c_ubl, c_ufr)
#define ZERO_CUBE _mm256_set_epi64x(0, 0, 0, 0)
#define SOLVED_CUBE _mm256_set_epi64x(SOLVED_H, SOLVED_L, 0, SOLVED_L)

STATIC_INLINE uint64_t permtoindex_Nx8(uint64_t, int64_t);
STATIC_INLINE int64_t indextoperm_8x8(uint64_t);
STATIC_INLINE int64_t indextoperm_4x8(uint64_t);

STATIC_INLINE int
popcount_u32(uint32_t x)
{
	return _mm_popcnt_u32(x);
}

STATIC_INLINE int
popcount_u64(uint64_t x)
{
	return (int)_mm_popcnt_u64(x);
}

STATIC void
pieces(cube_t cube[NON_NULL], uint8_t c[SIZE(8)], uint8_t e[SIZE(12)])
{
	uint8_t aux[32];

	_mm256_storeu_si256((__m256i *)aux, *cube);
	memcpy(c, aux, 8);
	memcpy(e, aux+16, 12);
}

STATIC_INLINE bool
equal(cube_t c1, cube_t c2)
{
	int32_t mask;
	__m256i cmp;

	cmp = _mm256_cmpeq_epi8(c1, c2);
	mask = _mm256_movemask_epi8(cmp);

	return mask == ~0;
}

STATIC_INLINE cube_t
invertco(cube_t c)
{
        cube_t co, shleft, shright, summed, newco, cleanco, ret;

        co = _mm256_and_si256(c, CO2_AVX2);
        shleft = _mm256_slli_epi32(co, 1);
        shright = _mm256_srli_epi32(co, 1);
        summed = _mm256_or_si256(shleft, shright);
        newco = _mm256_and_si256(summed, CO2_AVX2);
        cleanco = _mm256_xor_si256(c, co);
        ret = _mm256_or_si256(cleanco, newco);

        return ret;
}

STATIC_INLINE cube_t
compose_edges(cube_t c1, cube_t c2)
{
	return compose(c1, c2);
}

STATIC_INLINE cube_t
compose_corners(cube_t c1, cube_t c2)
{
	return compose(c1, c2);
}

STATIC_INLINE cube_t
compose(cube_t c1, cube_t c2)
{
	/*
	 * Method taken from Andrew Skalski's vcube (thanks to Arhan Chaudhary
	 * for pointing this out)
	 */
	cube_t ss, so, su;

	/* Permute */
	ss = _mm256_shuffle_epi8(c1, c2);

	/* Orient */
	so = _mm256_and_si256(c2, ORIENT_AVX2);
	ss = _mm256_add_epi8(ss, so);
	su = _mm256_sub_epi8(ss, CARRY_AVX2);
	ss = _mm256_min_epu8(ss, su);

	return _mm256_and_si256(ss, USED_AVX2);
}

STATIC_INLINE cube_t
inverse(cube_t c)
{
	/* Method taken from Andrew Skalski's vcube[1]. The addition sequence
	 * was generated using [2].
	 * [1] https://github.com/Voltara/vcube
	 * [2] http://wwwhomes.uni-bielefeld.de/achim/addition_chain.html
	 */
	cube_t v3, vi, vo, vp, ret;

	v3 = _mm256_shuffle_epi8(c, c);
	v3 = _mm256_shuffle_epi8(v3, c);
	vi = _mm256_shuffle_epi8(v3, v3);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, v3);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, c);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, v3);
	vi = _mm256_shuffle_epi8(vi, vi);
	vi = _mm256_shuffle_epi8(vi, c);

	vo = _mm256_and_si256(c, ORIENT_AVX2);
	vo = _mm256_shuffle_epi8(vo, vi);
	vp = _mm256_andnot_si256(ORIENT_AVX2, vi);
	ret = _mm256_or_si256(vp, vo);
	ret = _mm256_and_si256(ret, USED_AVX2);

	return invertco(ret);
}

STATIC_INLINE uint64_t
coord_co(cube_t c)
{
	cube_t co;
	uint64_t mem[4], ret, i, p;

	co = _mm256_and_si256(c, CO2_AVX2);
	_mm256_storeu_si256((__m256i *)mem, co);

	mem[0] >>= 5;
	for (i = 0, ret = 0, p = 1; i < 7; i++, mem[0] >>= 8, p *= 3)
		ret += (mem[0] & 3) * p;

	return ret;
}

STATIC_INLINE void
copy_co(cube_t cube[NON_NULL], cube_t co)
{
	cube_t coclean;

	coclean = _mm256_and_si256(co, CO2_AVX2);
	*cube = _mm256_andnot_si256(CO2_AVX2, *cube);
	*cube = _mm256_or_si256(*cube, coclean);
}

STATIC_INLINE cube_t
invcoord_co(uint64_t coord)
{
	uint64_t i, c, p, co, mem[4] = {0};
	cube_t cube, cc;

	for (i = 0, p = 0, c = coord; i < 8; i++, c /= 3) {
		co = i == 7 ? ((3 - (p % 3)) % 3) : (c % 3);
		p += co;
		mem[0] |= (uint64_t)(i + (co << COSHIFT)) << (uint64_t)(8 * i);
	}

	cc = _mm256_loadu_si256((__m256i *)mem);
	cube = SOLVED_CUBE;
	copy_co(&cube, cc);

	return cube;
}

STATIC_INLINE uint64_t
coord_csep(cube_t c)
{
	cube_t cp, shifted;
	int mask;

	cp = _mm256_and_si256(c, CP_AVX2);
	shifted = _mm256_slli_epi32(cp, 5);
	mask = _mm256_movemask_epi8(shifted);

	return (uint64_t)(mask & 0x7F);
}

STATIC_INLINE uint64_t
coord_cocsep(cube_t c)
{
	return (coord_co(c) << UINT8_C(7)) + coord_csep(c);
}

STATIC_INLINE uint64_t
coord_eo(cube_t c)
{
	cube_t eo, shifted;
	int mask;

	eo = _mm256_and_si256(c, EO_AVX2);
	shifted = _mm256_slli_epi32(eo, 3);
	mask = _mm256_movemask_epi8(shifted);

	return (uint64_t)(mask >> 17);
}

STATIC_INLINE uint64_t
coord_esep(cube_t c)
{
	cube_t ep;
	uint64_t e, mem[4], i, j, jj, k, l, ret1, ret2, bit1, bit2, is1;

	ep = _mm256_and_si256(c, EP_AVX2);
	_mm256_storeu_si256((__m256i *)mem, ep);

	mem[3] <<= 8;
	ret1 = ret2 = 0;
	k = l = 4;
	for (i = 0, j = 0; i < 12; i++, mem[i/8 + 2] >>= 8) {
		e = mem[i/8 + 2];

		bit1 = (e & ESEPBIT_1) >> 2;
		bit2 = (e & ESEPBIT_2) >> 3;
		is1 = (1 - bit2) * bit1;

		ret1 += bit2 * binomial[11-i][k];
		k -= bit2;

		jj = j < 8;
		ret2 += jj * is1 * binomial[7-(j*jj)][l];
		l -= is1;
		j += (1-bit2);
	}

	return ret1 * 70 + ret2;
}

STATIC_INLINE cube_t
invcoord_esep(uint64_t esep)
{
	cube_t eee, ret;
	uint8_t mem[32] = {0};

	invcoord_esep_array(esep % UINT64_C(70), esep / UINT64_C(70), mem+16);

	ret = SOLVED_CUBE;
	eee = _mm256_loadu_si256((__m256i *)mem);
	copy_edges(&ret, eee);

	return ret;
}

STATIC_INLINE void
copy_corners(cube_t dest[NON_NULL], cube_t src)
{
	*dest = _mm256_blend_epi32(*dest, src, 0x0F);
}

STATIC_INLINE void
copy_edges(cube_t dest[NON_NULL], cube_t src)
{
	*dest = _mm256_blend_epi32(*dest, src, 0xF0);
}

STATIC_INLINE void
set_eo(cube_t cube[NON_NULL], uint64_t eo)
{
	uint64_t eo12, eotop, eobot;
	__m256i veo;

	eo12 = (eo << 1) + (_mm_popcnt_u64(eo) % 2);
	eotop = (eo12 & (1 << 11)) << 17 |
		(eo12 & (1 << 10)) << 10 |
		(eo12 & (1 << 9)) << 3 |
		(eo12 & (1 << 8)) >> 4;
	eobot = (eo12 & (1 << 7)) << 53 |
		(eo12 & (1 << 6)) << 46 |
		(eo12 & (1 << 5)) << 39 |
		(eo12 & (1 << 4)) << 32 |
		(eo12 & (1 << 3)) << 25 |
		(eo12 & (1 << 2)) << 18 |
		(eo12 & (1 << 1)) << 11 |
		(eo12 & 1) << 4;
	veo = _mm256_set_epi64x(eotop, eobot, 0, 0);

	*cube = _mm256_andnot_si256(EO_AVX2, *cube);
	*cube = _mm256_or_si256(*cube, veo);
}

STATIC_INLINE uint64_t
permtoindex_Nx8(uint64_t n, int64_t a)
{
	uint64_t i, c, ret;
	__m256i cmp;

	for (i = 0, ret = 0; i < n; i++) {
		cmp = _mm256_set1_epi8((char)(a & INT64_C(0xFF)));
		a = (a >> INT64_C(8)) | INT64_C(0x0F00000000000000);
		cmp = _mm256_cmpgt_epi8(cmp, _mm256_set1_epi64x(a));
		c = _mm_popcnt_u32(_mm256_movemask_epi8(cmp)) >> 2;
		ret += c * factorial[n-1-i];
	}

	return ret;
}

STATIC_INLINE int64_t
indextoperm_8x8(uint64_t p)
{
	int used;
	uint64_t c, k, i, j, ret;

	for (i = 0, ret = 0, used = 0; i < 8; i++) {
		k = p / factorial[7-i];

		/* Find k-th unused number */
		for (j = 0, c = 0; c <= k; j++)
			c += 1 - ((used & (1 << j)) >> j);

		ret |= (j-1) << (8*i);
		used |= 1 << (j-1);
		p %= factorial[7-i];
	}

	return ret;
}

STATIC_INLINE int64_t
indextoperm_4x8(uint64_t p)
{
	static const int64_t A[FACT_4] = {
		[0] = INT64_C(0x03020100),
		[1] = INT64_C(0x02030100),
		[2] = INT64_C(0x03010200),
		[3] = INT64_C(0x01030200),
		[4] = INT64_C(0x02010300),
		[5] = INT64_C(0x01020300),
		[6] = INT64_C(0x03020001),
		[7] = INT64_C(0x02030001),
		[8] = INT64_C(0x03000201),
		[9] = INT64_C(0x00030201),
		[10] = INT64_C(0x02000301),
		[11] = INT64_C(0x00020301),
		[12] = INT64_C(0x03010002),
		[13] = INT64_C(0x01030002),
		[14] = INT64_C(0x03000102),
		[15] = INT64_C(0x00030102),
		[16] = INT64_C(0x01000302),
		[17] = INT64_C(0x00010302),
		[18] = INT64_C(0x02010003),
		[19] = INT64_C(0x01020003),
		[20] = INT64_C(0x02000103),
		[21] = INT64_C(0x00020103),
		[22] = INT64_C(0x01000203),
		[23] = INT64_C(0x00010203),
	};

	return A[p];
}

STATIC_INLINE uint64_t
coord_cp(cube_t cube)
{
	cube_t cp;
	int64_t aux[4];

	cp = _mm256_and_si256(cube, CP_AVX2);
	_mm256_storeu_si256((__m256i *)aux, cp);

	return permtoindex_Nx8(8, aux[0]);
}

STATIC_INLINE cube_t
invcoord_cp(uint64_t i)
{
	return _mm256_set_epi64x(SOLVED_H, SOLVED_L, 0, indextoperm_8x8(i));
}

STATIC_INLINE uint64_t
coord_epud(cube_t cube)
{
	cube_t ep;
	int64_t aux[4];

	ep = _mm256_and_si256(cube, EP_AVX2);
	_mm256_storeu_si256((__m256i *)aux, ep);

	return permtoindex_Nx8(8, aux[2]);
}

STATIC_INLINE cube_t
invcoord_epud(uint64_t i)
{
	return _mm256_set_epi64x(SOLVED_H, indextoperm_8x8(i), 0, SOLVED_L);
}

STATIC_INLINE uint64_t
coord_epe(cube_t cube)
{
	cube_t ep;
	int64_t aux[4];

	ep = _mm256_and_si256(cube, EP_AVX2);
	ep = _mm256_xor_si256(ep, _mm256_set1_epi8(8));
	_mm256_storeu_si256((__m256i *)aux, ep);

	return permtoindex_Nx8(4, aux[3]);
}

STATIC_INLINE cube_t
invcoord_epe(uint64_t i)
{
	int64_t a;
	__m256i b, r;

	a = indextoperm_4x8(i);
	b = _mm256_set1_epi64x(INT64_C(0x08080808));
	r = _mm256_add_epi8(_mm256_set1_epi64x(a), b);
	a = _mm256_extract_epi64(r, 0);

	return _mm256_set_epi64x(a, SOLVED_L, 0, SOLVED_L);
}

STATIC_INLINE bool
is_eo_even(cube_t cube)
{
	uint32_t mask;
	__m256i e;

	e = _mm256_and_si256(cube, EO_AVX2);
	e = _mm256_slli_epi16(e, 7-EOSHIFT);
	mask = _mm256_movemask_epi8(e);

	return popcount_u32(mask) % 2 == 0;
}

STATIC_INLINE uint64_t
coord_epudsep(cube_t cube)
{
	uint8_t aux[32];

	_mm256_storeu_si256((__m256i *)aux, cube);
	return coord_epudsep_array(aux + 16);
}

STATIC_INLINE cube_t
invcoord_epudsep(uint64_t i)
{
	cube_t cube, elow;
	uint8_t e[32] = {0};

	invcoord_epudsep_array(i, e+16);
	elow = _mm256_loadu_si256((__m256i *)e);
	cube = _mm256_set_epi64x(SOLVED_H, 0, 0, SOLVED_L);

	return _mm256_or_si256(elow, cube);
}

#endif /* ARCH_AVX2_H */
