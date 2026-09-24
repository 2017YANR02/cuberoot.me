#ifndef ARCH_NEON_H
#define ARCH_NEON_H

#define CO2_NEON    vdup_n_u8(0x60)
#define COCW_NEON   vdup_n_u8(0x20)
#define EO_NEON     vdupq_n_u8(0x10)
#define PBITS8_NEON vdup_n_u8(PBITS)

STATIC_INLINE uint8x16_t compose_edges_slim(uint8x16_t, uint8x16_t);
STATIC_INLINE uint8x8_t compose_corners_slim(uint8x8_t, uint8x8_t);

#define STATIC_CUBE( \
    c_ufr, c_ubl, c_dfl, c_dbr, c_ufl, c_ubr, c_dfr, c_dbl, \
    e_uf, e_ub, e_db, e_df, e_ur, e_ul, e_dl, e_dr, e_fr, e_fl, e_bl, e_br) \
	((cube_t){ \
		.corner = { \
			c_ufr, c_ubl, c_dfl, c_dbr, \
			c_ufl, c_ubr, c_dfr, c_dbl \
		}, \
		.edge = { \
			e_uf, e_ub, e_db, e_df, e_ur, e_ul, \
			e_dl, e_dr, e_fr, e_fl, e_bl, e_br, 0, 0, 0, 0 \
		} \
	})
#define ZERO_CUBE \
	((cube_t){ \
		.corner = vdup_n_u8(0), \
		.edge = vdupq_n_u8(0) \
	})
#define SOLVED_CUBE STATIC_CUBE( \
	0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)

const uint8_t SOLVED_L[8] = {0, 1, 2, 3, 4, 5, 6, 7};
const uint8_t SOLVED_H[8] = {8, 9, 10, 11, 0, 0, 0};

STATIC_INLINE uint64_t permtoindex_Nx8(uint64_t, uint8x8_t);
STATIC_INLINE uint8x8_t indextoperm_8x8(uint64_t);
STATIC_INLINE uint8x8_t indextoperm_4x8(uint64_t);

STATIC_INLINE int
popcount_u32(uint32_t x)
{
	/* Same as the portable version */
	x -= (x >> UINT32_C(1)) & UINT32_C(0x55555555);
	x = (x & UINT32_C(0x33333333)) +
	    ((x >> UINT32_C(2)) & UINT32_C(0x33333333));
	x = (x + (x >> UINT32_C(4))) & UINT32_C(0x0F0F0F0F);
	x = (x * UINT32_C(0x01010101)) >> UINT32_C(24);

	return (int)x;
}

STATIC_INLINE int
popcount_u64(uint64_t x)
{
	int top, bottom;

	bottom = popcount_u32((uint32_t)(x & UINT64_C(0xFFFFFFFF)));
	top = popcount_u32((uint32_t)(x >> UINT64_C(32)));

	return top + bottom;
}

STATIC void
pieces(cube_t cube[NON_NULL], uint8_t c[SIZE(8)], uint8_t e[SIZE(12)])
{
	// First 8 bytes of the corner vector are copied from the c array
	vst1_u8(c, cube->corner);

	// 12 bytes of the edge vector are copied from the e array
	// First 8 bytes
	vst1_u8(e, vget_low_u8(cube->edge));
	// Next 4 bytes
	vst1_lane_u32((uint32_t *)(e + 8),
	    vreinterpret_u32_u8(vget_high_u8(cube->edge)), 0);
}

STATIC_INLINE bool
equal(cube_t c1, cube_t c2)
{
	uint8x8_t cmp_corner;
	uint8x16_t cmp_edge;
	uint64x2_t cmp_corner_u64, cmp_edge_u64, cmp_result;

	// compare the corner vectors and the edge vectors
	cmp_corner = vceq_u8(c1.corner, c2.corner);
	cmp_edge = vceqq_u8(c1.edge, c2.edge);

	// convert the comparison vectors to 64-bit vectors and combine them
	cmp_corner_u64 = vreinterpretq_u64_u8(
	    vcombine_u8(cmp_corner, cmp_corner));
	cmp_edge_u64 = vreinterpretq_u64_u8(cmp_edge);
	cmp_result = vandq_u64(cmp_corner_u64, cmp_edge_u64);

	// check if all the bits are set
	return vgetq_lane_u64(cmp_result, 0) == ~0ULL &&
	    vgetq_lane_u64(cmp_result, 1) == ~0ULL;
}

STATIC_INLINE cube_t
invertco(cube_t c)
{
	cube_t ret;
	uint8x8_t co, shleft, shright, summed, newco, cleanco;

	co = vand_u8(c.corner, CO2_NEON);
	shleft = vshl_n_u8(co, 1);
	shright = vshr_n_u8(co, 1);
	summed = vorr_u8(shleft, shright);
	newco = vand_u8(summed, CO2_NEON);
	cleanco = veor_u8(c.corner, co);
	ret.corner = vorr_u8(cleanco, newco);
	ret.edge = c.edge;
	
	return ret;
}

STATIC_INLINE cube_t
compose_edges(cube_t c1, cube_t c2)
{
	cube_t ret = {0};
	ret.edge = compose_edges_slim(c1.edge, c2.edge);
	return ret;
}

STATIC_INLINE cube_t
compose_corners(cube_t c1, cube_t c2)
{
	cube_t ret = {0};
	ret.corner = compose_corners_slim(c1.corner, c2.corner);
	return ret;
}

STATIC_INLINE uint8x16_t
compose_edges_slim(uint8x16_t edge1, uint8x16_t edge2)
{
	// Masks
	uint8x16_t p_bits = vdupq_n_u8(PBITS);
	uint8x16_t eo_bit = vdupq_n_u8(EOBIT);

	// Find the index and permutation
	uint8x16_t p = vandq_u8(edge2, p_bits);
	uint8x16_t piece1 = vqtbl1q_u8(edge1, p);

	// Calculate the orientation through XOR
	uint8x16_t orien = vandq_u8(veorq_u8(edge2, piece1), eo_bit);

	// Combine the results
	uint8x16_t ret = vorrq_u8(vandq_u8(piece1, p_bits), orien);

	// Mask to clear the last 32 bits of the result
	uint32x4_t mask_last_32 =
	    vsetq_lane_u32(0, vreinterpretq_u32_u8(ret), 3);
	ret = vreinterpretq_u8_u32(mask_last_32);

	return ret;
}

STATIC_INLINE uint8x8_t
compose_corners_slim(uint8x8_t corner1, uint8x8_t corner2)
{
	// Masks
	uint8x8_t p_bits = vdup_n_u8(PBITS);
	uint8x8_t cobits = vdup_n_u8(COBITS);
	uint8x8_t cobits2 = vdup_n_u8(COBITS_2);
	uint8x8_t twist_cw = vdup_n_u8(CTWIST_CW);

	// Find the index and permutation
	uint8x8_t p = vand_u8(corner2, p_bits);
	uint8x8_t piece1 = vtbl1_u8(corner1, p);

	// Calculate the orientation
	uint8x8_t aux =
	    vadd_u8(vand_u8(corner2, cobits), vand_u8(piece1, cobits));
	uint8x8_t auy = vshr_n_u8(vadd_u8(aux, twist_cw), 2);
	uint8x8_t orien = vand_u8(vadd_u8(aux, auy), cobits2);

	uint8x8_t ret = vorr_u8(vand_u8(piece1, p_bits), orien);

	return ret;
}

STATIC_INLINE cube_t
compose(cube_t c1, cube_t c2)
{
	cube_t ret = {0};

	ret.edge = compose_edges_slim(c1.edge, c2.edge);
	ret.corner = compose_corners_slim(c1.corner, c2.corner);

	return ret;
}

STATIC_INLINE cube_t
inverse(cube_t cube)
{
	uint8_t i, piece, orien;
	cube_t ret;

	// Temp arrays to store the NEON vectors
	uint8_t edges[16];
	uint8_t corners[8];

	// Copy the NEON vectors to the arrays
	vst1q_u8(edges, cube.edge);
	vst1_u8(corners, cube.corner);

	uint8_t edge_result[16] = {0};
	uint8_t corner_result[8] = {0};

	// Process the edges
	for (i = 0; i < 12; i++)
	{
		piece = edges[i];
		orien = piece & EOBIT;
		edge_result[piece & PBITS] = i | orien;
	}

	// Process the corners
	for (i = 0; i < 8; i++)
	{
		piece = corners[i];
		orien = ((piece << 1) | (piece >> 1)) & COBITS_2;
		corner_result[piece & PBITS] = i | orien;
	}

	// Copy the results back to the NEON vectors
	ret.edge = vld1q_u8(edge_result);
	ret.corner = vld1_u8(corner_result);

	return ret;
}

STATIC_INLINE uint64_t
coord_co(cube_t c)
{
	uint64_t i, p, ret;

	// Temp array to store the NEON vector
	uint8_t mem[8];
	vst1_u8(mem, c.corner);

	for (ret = 0, i = 0, p = 1; i < 7; i++, p *= 3)
		ret += p * (mem[i] >> COSHIFT);

	return ret;
}

STATIC_INLINE void
copy_co(cube_t cube[NON_NULL], cube_t co)
{
	uint8x8_t coclean;

	coclean = vand_u8(co.corner, CO2_NEON);
	cube->corner = vbic_u8(cube->corner, CO2_NEON);
	cube->corner = vorr_u8(cube->corner, coclean);
}

STATIC_INLINE cube_t
invcoord_co(uint64_t coord)
{
	uint64_t co, c, i, p;
	uint8_t mem[8];
	cube_t cube;

	for (i = 0, p = 0, c = coord; i < 8; i++, c /= 3) {
		co = i == 7 ? ((3 - (p % 3)) % 3) : (c % 3);
		p += co;
		mem[i] = i + (co << COSHIFT);
	}

	cube.corner = vld1_u8(mem);
	cube.edge = SOLVED_CUBE.edge;

	return cube;
}

STATIC_INLINE uint64_t
coord_csep(cube_t c)
{
	uint64_t ret, i, p;

	// Temp array to store the NEON vector
	uint8_t mem[8];
	vst1_u8(mem, c.corner);

	for (ret = 0, i = 0, p = 1; i < 7; i++, p *= 2)
		ret += p * ((mem[i] & CSEPBIT) >> 2);

	return ret;
	return 0;
}

STATIC_INLINE uint64_t
coord_cocsep(cube_t c)
{
	return (coord_co(c) << UINT64_C(7)) + coord_csep(c);
}

STATIC_INLINE uint64_t
coord_eo(cube_t c)
{
	uint64_t ret, p;
	int i;

	// Temp array to store the NEON vector
	uint8_t mem[16];
	vst1q_u8(mem, c.edge);

	for (i = 1, ret = 0, p = 1; i < 12; i++, p *= 2)
	{
		ret += p * (mem[i] >> EOSHIFT);
	}

	return ret;
}

STATIC_INLINE uint64_t
coord_esep(cube_t c)
{
	uint64_t i, j, jj, k, l, ret1, ret2, bit1, bit2, is1;

	// Temp array to store the NEON vector
	uint8_t mem[16];
	vst1q_u8(mem, c.edge);

	for (i = 0, j = 0, k = 4, l = 4, ret1 = 0, ret2 = 0; i < 12; i++)
	{
		bit1 = (mem[i] & ESEPBIT_1) >> 2;
		bit2 = (mem[i] & ESEPBIT_2) >> 3;
		is1 = (1 - bit2) * bit1;

		ret1 += bit2 * binomial[11 - i][k];
		k -= bit2;

		jj = j < 8;
		ret2 += jj * is1 * binomial[7 - (j * jj)][l];
		l -= is1;
		j += (1 - bit2);
	}

	return ret1 * 70 + ret2;
}

STATIC_INLINE void
copy_corners(cube_t dst[NON_NULL], cube_t src)
{
	dst->corner = src.corner;
}

STATIC_INLINE void
copy_edges(cube_t dst[NON_NULL], cube_t src)
{
	dst->edge = src.edge;
}

STATIC_INLINE void
set_eo(cube_t cube[NON_NULL], uint64_t eo)
{
	// Temp array to store the NEON vector
	uint8_t mem[16];
	vst1q_u8(mem, cube->edge);
	uint8_t i, sum, flip;

	for (sum = 0, i = 1; i < 12; i++, eo >>= 1)
	{
		flip = eo % 2;
		sum += flip;
		mem[i] = (mem[i] & ~EOBIT) | (EOBIT * flip);
	}
	mem[0] = (mem[0] & ~EOBIT) | (EOBIT * (sum % 2));

	// Copy the results back to the NEON vector
	cube->edge = vld1q_u8(mem);
	return;
}

STATIC_INLINE cube_t
invcoord_esep(uint64_t esep)
{
	cube_t ret;
	uint8_t mem[16] = {0};

	invcoord_esep_array(esep % UINT64_C(70), esep / UINT64_C(70), mem);

	ret = SOLVED_CUBE;
	ret.edge = vld1q_u8(mem);

	return ret;
}

STATIC_INLINE uint64_t
permtoindex_Nx8(uint64_t n, uint8x8_t a)
{
	uint64_t i, c, ret;
	uint8x8_t cmp;
	uint64x1_t anum;
	uint8_t or[8] = {0, 0, 0, 0, 0, 0, 0, 0x0F};

	for (i = 0, ret = 0; i < n; i++) {
		cmp = vdup_lane_u8(a, 0);
		anum = vreinterpret_u64_u8(a);
		anum = vshr_n_u64(anum, 8);
		a = vreinterpret_u8_u64(anum);
		a = vorr_u8(a, vld1_u8(or));
		cmp = vcgt_u8(cmp, a);
		c = vaddv_u8(vshr_n_u8(cmp, 7));
		ret += c * factorial[n-1-i];
	}

	return ret;
}

STATIC_INLINE uint8x8_t
indextoperm_8x8(uint64_t p)
{
	int used;
	uint64_t c, k, i, j;
	uint8_t ret[8];

	for (i = 0, used = 0; i < 8; i++) {
		k = p / factorial[7-i];

		/* Find k-th unused number */
		for (j = 0, c = 0; c <= k; j++)
			c += 1 - ((used & (1 << j)) >> j);

		ret[i] = j-1;
		used |= 1 << (j-1);
		p %= factorial[7-i];
	}

	return vld1_u8(ret);
}

STATIC_INLINE uint8x8_t
indextoperm_4x8(uint64_t p)
{
	static const int64_t A[FACT_4] = {
		[0] = UINT64_C(0x03020100),
		[1] = UINT64_C(0x02030100),
		[2] = UINT64_C(0x03010200),
		[3] = UINT64_C(0x01030200),
		[4] = UINT64_C(0x02010300),
		[5] = UINT64_C(0x01020300),
		[6] = UINT64_C(0x03020001),
		[7] = UINT64_C(0x02030001),
		[8] = UINT64_C(0x03000201),
		[9] = UINT64_C(0x00030201),
		[10] = UINT64_C(0x02000301),
		[11] = UINT64_C(0x00020301),
		[12] = UINT64_C(0x03010002),
		[13] = UINT64_C(0x01030002),
		[14] = UINT64_C(0x03000102),
		[15] = UINT64_C(0x00030102),
		[16] = UINT64_C(0x01000302),
		[17] = UINT64_C(0x00010302),
		[18] = UINT64_C(0x02010003),
		[19] = UINT64_C(0x01020003),
		[20] = UINT64_C(0x02000103),
		[21] = UINT64_C(0x00020103),
		[22] = UINT64_C(0x01000203),
		[23] = UINT64_C(0x00010203),
	};

	return vreinterpret_u8_u64(vdup_n_u64(A[p]));
}

STATIC_INLINE uint64_t
coord_cp(cube_t cube)
{
	return permtoindex_Nx8(8, vand_u8(cube.corner, PBITS8_NEON));
}

STATIC_INLINE cube_t
invcoord_cp(uint64_t i)
{
	return (cube_t) {
		.corner = indextoperm_8x8(i),
		.edge = vcombine_u8(vld1_u8(SOLVED_L), vld1_u8(SOLVED_H))
	};
}

STATIC_INLINE uint64_t
coord_epud(cube_t cube)
{
	uint8x8_t a;

	a = vget_low_u8(cube.edge);
	a = vand_u8(a, PBITS8_NEON);

	return permtoindex_Nx8(8, a);
}

STATIC_INLINE cube_t
invcoord_epud(uint64_t i)
{
	return (cube_t) {
		.corner = vld1_u8(SOLVED_L),
		.edge = vcombine_u8(indextoperm_8x8(i), vld1_u8(SOLVED_H))
	};
}

STATIC_INLINE uint64_t
coord_epe(cube_t cube)
{
	uint8x8_t a;

	a = vget_high_u8(cube.edge);
	a = vand_u8(a, PBITS8_NEON);
	a = veor_u8(a, vdup_n_u8(8));

	return permtoindex_Nx8(4, a);
}

STATIC_INLINE cube_t
invcoord_epe(uint64_t i)
{
	uint8x8_t a;

	a = indextoperm_4x8(i);
	a = vadd_u8(a, vreinterpret_u8_u64(vdup_n_u64(UINT64_C(0x08080808))));

	return (cube_t) {
		.corner = vld1_u8(SOLVED_L),
		.edge = vcombine_u8(vld1_u8(SOLVED_L), a)
	};
}

STATIC_INLINE bool
is_eo_even(cube_t cube)
{
	int8_t count;
	uint8x16_t e;

	e = vandq_u8(cube.edge, EO_NEON);
	e = vshrq_n_u8(e, EOSHIFT);
	count = vaddvq_u8(e);

	return count % 2 == 0;
}

STATIC_INLINE uint64_t
coord_epudsep(cube_t cube)
{
	uint8_t e[8];

	vst1_u8(e, vget_low_u8(cube.edge));
	return coord_epudsep_array(e);
}

STATIC_INLINE cube_t
invcoord_epudsep(uint64_t i)
{
	uint8_t e[8];

	invcoord_epudsep_array(i, e);
	return (cube_t) {
		.corner = vld1_u8(SOLVED_L),
		.edge = vcombine_u8(vld1_u8(e), vld1_u8(SOLVED_H))
	};
}

#endif /* ARCH_NEON_H */
