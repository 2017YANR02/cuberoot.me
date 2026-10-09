#ifndef ARCH_COMMON_H
#define ARCH_COMMON_H

#define EOSHIFT     UINT8_C(4)
#define COSHIFT     UINT8_C(5)

#define PBITS       UINT8_C(0xF)
#define ESEPBIT_1   UINT8_C(0x4)
#define ESEPBIT_2   UINT8_C(0x8)
#define CSEPBIT     UINT8_C(0x4)
#define EOBIT       UINT8_C(0x10)
#define COBITS      UINT8_C(0xF0)
#define COBITS_2    UINT8_C(0x60)
#define CTWIST_CW   UINT8_C(0x20)
#define CTWIST_CCW  UINT8_C(0x40)
#define EFLIP       UINT8_C(0x10)

STATIC_INLINE int popcount_u32(uint32_t);
STATIC_INLINE int popcount_u64(uint64_t);

STATIC void pieces(cube_t [NON_NULL], uint8_t [SIZE(8)], uint8_t [SIZE(12)]);
STATIC_INLINE bool equal(cube_t, cube_t);
STATIC_INLINE cube_t invertco(cube_t);
STATIC_INLINE cube_t compose_edges(cube_t, cube_t);
STATIC_INLINE cube_t compose_corners(cube_t, cube_t);
STATIC_INLINE cube_t compose(cube_t, cube_t);
STATIC_INLINE cube_t inverse(cube_t);

STATIC_INLINE uint64_t coord_co(cube_t);
STATIC_INLINE cube_t invcoord_co(uint64_t);
STATIC_INLINE uint64_t coord_csep(cube_t);
STATIC_INLINE uint64_t coord_cocsep(cube_t);
STATIC_INLINE uint64_t coord_eo(cube_t);
STATIC_INLINE uint64_t coord_esep(cube_t);
STATIC_INLINE cube_t invcoord_esep(uint64_t);
STATIC_INLINE uint64_t coord_epudsep(cube_t);
STATIC_INLINE cube_t invcoord_epudsep(uint64_t);

STATIC_INLINE bool is_eo_even(cube_t);

STATIC_INLINE void copy_corners(cube_t [NON_NULL], cube_t);
STATIC_INLINE void copy_co(cube_t [NON_NULL], cube_t);
STATIC_INLINE void copy_edges(cube_t [NON_NULL], cube_t);
STATIC_INLINE void set_eo(cube_t [NON_NULL], uint64_t);

STATIC_INLINE void invcoord_esep_array(uint64_t, uint64_t, uint8_t[SIZE(12)]);
STATIC_INLINE cube_t invcoord_eoesep(uint64_t);
STATIC_INLINE uint64_t coord_epudsep_array(const uint8_t [8]);
STATIC_INLINE void invcoord_epudsep_array(uint64_t, uint8_t [8]);

STATIC_INLINE uint64_t coord_cp(cube_t);
STATIC_INLINE cube_t invcoord_cp(uint64_t);
STATIC_INLINE uint64_t coord_epud(cube_t);
STATIC_INLINE cube_t invcoord_epud(uint64_t);
STATIC_INLINE uint64_t coord_epe(cube_t);
STATIC_INLINE cube_t invcoord_epe(uint64_t);

STATIC_INLINE void
invcoord_esep_array(uint64_t set1, uint64_t set2, uint8_t mem[SIZE(12)])
{
	uint64_t bit1, bit2, i, j, jj, k, l, s, v, w, is1;
	uint8_t slice[3] = {0};

	for (i = 0, j = 0, k = 4, l = 4; i < 12; i++)
	{
		v = binomial[11 - i][k];
		jj = j < 8;
		w = jj * binomial[7 - (j * jj)][l];
		bit2 = set2 >= v;
		bit1 = set1 >= w;
		is1 = (1 - bit2) * bit1;

		set2 -= bit2 * v;
		k -= bit2;
		set1 -= is1 * w;
		l -= is1;
		j += (1 - bit2);
		s = 2 * bit2 + (1 - bit2) * bit1;

		mem[i] = (slice[s]++) | (uint8_t)(s << 2);
	}
}

STATIC_INLINE cube_t
invcoord_eoesep(uint64_t i)
{
	cube_t c;
	uint64_t esep, eo;

	esep = i >> INT64_C(11);
	eo = i % POW_2_11;
	c = invcoord_esep(esep);
	set_eo(&c, eo);

	return c;
}

STATIC_INLINE uint64_t
coord_epudsep_array(const uint8_t e[8])
{
	uint8_t i, k, is;
	uint64_t ret;

	ret = 0;
	k = 4;
	for (i = 0; i < 8; i++) {
		is = (e[i] & UINT8_C(4)) >> UINT8_C(2);
		ret += is * binomial[7-i][k];
		k -= is;
	}

	return ret;
}

STATIC_INLINE void
invcoord_epudsep_array(uint64_t c, uint8_t ret[8])
{
	uint8_t i, k, is, x, y;

	k = 4;
	x = 0;
	y = 4;
	for (i = 0; i < 8; i++) {
		is = c >= binomial[7-i][k];
		ret[i] = is*y + (1-is)*x;
		y += is;
		x += 1-is;
		c -= is * binomial[7-i][k];
		k -= is;
	}
}

#endif /* ARCH_COMMON_H */
