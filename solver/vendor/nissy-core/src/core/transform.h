#ifndef CORE_TRANSFORM_H
#define CORE_TRANSFORM_H

#define TRANS_EDGES_ROTATION(T, c) \
        compose_edges(compose_edges(TRANS_CUBE_ ## T, c), \
        TRANS_CUBE_ ## T ## _INVERSE)
#define TRANS_EDGES_MIRRORED(T, c) TRANS_EDGES_ROTATION(T, c)

#define TRANS_CORNERS_ROTATION(T, c) \
        compose_corners(compose_corners(TRANS_CUBE_ ## T, c), \
        TRANS_CUBE_ ## T ## _INVERSE)
#define TRANS_CORNERS_MIRRORED(T, c) \
        invertco(compose_corners( \
	compose_corners(TRANS_CUBE_ ## T, c), TRANS_CUBE_ ## T ## _INVERSE))

#define TRANS_ROTATION(T, c) \
        compose(compose(TRANS_CUBE_ ## T, c), \
        TRANS_CUBE_ ## T ## _INVERSE)
#define TRANS_MIRRORED(T, c) \
        invertco(compose(compose(TRANS_CUBE_ ## T, c), \
        TRANS_CUBE_ ## T ## _INVERSE))

STATIC uint8_t readtrans(const char [SIZE(NISSY_SIZE_TRANSFORMATION)]);
STATIC uint8_t readrotation(const char [SIZE(2)]);
STATIC void writetrans(uint8_t, char [SIZE(NISSY_SIZE_TRANSFORMATION)]);

STATIC cube_t transform_edges(cube_t, uint8_t);
STATIC cube_t transform_corners(cube_t, uint8_t);
STATIC cube_t transform(cube_t, uint8_t);
STATIC oriented_cube_t applytrans(oriented_cube_t, const char *);
STATIC_INLINE uint8_t inverse_trans(uint8_t);
STATIC uint64_t symmetry_mask(cube_t);

STATIC uint8_t
readtrans(const char buf[SIZE(NISSY_SIZE_TRANSFORMATION)])
{
	uint8_t t;

	for (t = 0; t < NTRANS; t++)
		if (!strncmp(buf, transstr[t], 11))
			return t;

	return UINT8_ERROR;
}

STATIC uint8_t
readrotation(const char buf[SIZE(2)])
{
	char trans_str[NISSY_SIZE_TRANSFORMATION];

	strcpy(trans_str, "rotation xx");
	trans_str[9] = buf[0];
	trans_str[10] = buf[1];

	return readtrans(trans_str);
}

STATIC void
writetrans(uint8_t t, char buf[SIZE(NISSY_SIZE_TRANSFORMATION)])
{
	if (t >= 48)
		memcpy(buf, "error trans", 11);
	else
		memcpy(buf, transstr[t], 11);
	buf[11] = '\0';
}

STATIC cube_t
transform_edges(cube_t c, uint8_t t)
{
	switch (t) {
	case TRANS_UFr:
		return c;
	case TRANS_ULr:
		return TRANS_EDGES_ROTATION(ULr, c);
	case TRANS_UBr:
		return TRANS_EDGES_ROTATION(UBr, c);
	case TRANS_URr:
		return TRANS_EDGES_ROTATION(URr, c);
	case TRANS_DFr:
		return TRANS_EDGES_ROTATION(DFr, c);
	case TRANS_DLr:
		return TRANS_EDGES_ROTATION(DLr, c);
	case TRANS_DBr:
		return TRANS_EDGES_ROTATION(DBr, c);
	case TRANS_DRr:
		return TRANS_EDGES_ROTATION(DRr, c);
	case TRANS_RUr:
		return TRANS_EDGES_ROTATION(RUr, c);
	case TRANS_RFr:
		return TRANS_EDGES_ROTATION(RFr, c);
	case TRANS_RDr:
		return TRANS_EDGES_ROTATION(RDr, c);
	case TRANS_RBr:
		return TRANS_EDGES_ROTATION(RBr, c);
	case TRANS_LUr:
		return TRANS_EDGES_ROTATION(LUr, c);
	case TRANS_LFr:
		return TRANS_EDGES_ROTATION(LFr, c);
	case TRANS_LDr:
		return TRANS_EDGES_ROTATION(LDr, c);
	case TRANS_LBr:
		return TRANS_EDGES_ROTATION(LBr, c);
	case TRANS_FUr:
		return TRANS_EDGES_ROTATION(FUr, c);
	case TRANS_FRr:
		return TRANS_EDGES_ROTATION(FRr, c);
	case TRANS_FDr:
		return TRANS_EDGES_ROTATION(FDr, c);
	case TRANS_FLr:
		return TRANS_EDGES_ROTATION(FLr, c);
	case TRANS_BUr:
		return TRANS_EDGES_ROTATION(BUr, c);
	case TRANS_BRr:
		return TRANS_EDGES_ROTATION(BRr, c);
	case TRANS_BDr:
		return TRANS_EDGES_ROTATION(BDr, c);
	case TRANS_BLr:
		return TRANS_EDGES_ROTATION(BLr, c);
	case TRANS_UFm:
		return TRANS_EDGES_MIRRORED(UFm, c);
	case TRANS_ULm:
		return TRANS_EDGES_MIRRORED(ULm, c);
	case TRANS_UBm:
		return TRANS_EDGES_MIRRORED(UBm, c);
	case TRANS_URm:
		return TRANS_EDGES_MIRRORED(URm, c);
	case TRANS_DFm:
		return TRANS_EDGES_MIRRORED(DFm, c);
	case TRANS_DLm:
		return TRANS_EDGES_MIRRORED(DLm, c);
	case TRANS_DBm:
		return TRANS_EDGES_MIRRORED(DBm, c);
	case TRANS_DRm:
		return TRANS_EDGES_MIRRORED(DRm, c);
	case TRANS_RUm:
		return TRANS_EDGES_MIRRORED(RUm, c);
	case TRANS_RFm:
		return TRANS_EDGES_MIRRORED(RFm, c);
	case TRANS_RDm:
		return TRANS_EDGES_MIRRORED(RDm, c);
	case TRANS_RBm:
		return TRANS_EDGES_MIRRORED(RBm, c);
	case TRANS_LUm:
		return TRANS_EDGES_MIRRORED(LUm, c);
	case TRANS_LFm:
		return TRANS_EDGES_MIRRORED(LFm, c);
	case TRANS_LDm:
		return TRANS_EDGES_MIRRORED(LDm, c);
	case TRANS_LBm:
		return TRANS_EDGES_MIRRORED(LBm, c);
	case TRANS_FUm:
		return TRANS_EDGES_MIRRORED(FUm, c);
	case TRANS_FRm:
		return TRANS_EDGES_MIRRORED(FRm, c);
	case TRANS_FDm:
		return TRANS_EDGES_MIRRORED(FDm, c);
	case TRANS_FLm:
		return TRANS_EDGES_MIRRORED(FLm, c);
	case TRANS_BUm:
		return TRANS_EDGES_MIRRORED(BUm, c);
	case TRANS_BRm:
		return TRANS_EDGES_MIRRORED(BRm, c);
	case TRANS_BDm:
		return TRANS_EDGES_MIRRORED(BDm, c);
	case TRANS_BLm:
		return TRANS_EDGES_MIRRORED(BLm, c);
	default:
		LOG("transform error: unknown transformation %" PRIu8 "\n", t);
		return ZERO_CUBE;
	}
}

STATIC cube_t
transform_corners(cube_t c, uint8_t t)
{
	switch (t) {
	case TRANS_UFr:
		return c;
	case TRANS_ULr:
		return TRANS_CORNERS_ROTATION(ULr, c);
	case TRANS_UBr:
		return TRANS_CORNERS_ROTATION(UBr, c);
	case TRANS_URr:
		return TRANS_CORNERS_ROTATION(URr, c);
	case TRANS_DFr:
		return TRANS_CORNERS_ROTATION(DFr, c);
	case TRANS_DLr:
		return TRANS_CORNERS_ROTATION(DLr, c);
	case TRANS_DBr:
		return TRANS_CORNERS_ROTATION(DBr, c);
	case TRANS_DRr:
		return TRANS_CORNERS_ROTATION(DRr, c);
	case TRANS_RUr:
		return TRANS_CORNERS_ROTATION(RUr, c);
	case TRANS_RFr:
		return TRANS_CORNERS_ROTATION(RFr, c);
	case TRANS_RDr:
		return TRANS_CORNERS_ROTATION(RDr, c);
	case TRANS_RBr:
		return TRANS_CORNERS_ROTATION(RBr, c);
	case TRANS_LUr:
		return TRANS_CORNERS_ROTATION(LUr, c);
	case TRANS_LFr:
		return TRANS_CORNERS_ROTATION(LFr, c);
	case TRANS_LDr:
		return TRANS_CORNERS_ROTATION(LDr, c);
	case TRANS_LBr:
		return TRANS_CORNERS_ROTATION(LBr, c);
	case TRANS_FUr:
		return TRANS_CORNERS_ROTATION(FUr, c);
	case TRANS_FRr:
		return TRANS_CORNERS_ROTATION(FRr, c);
	case TRANS_FDr:
		return TRANS_CORNERS_ROTATION(FDr, c);
	case TRANS_FLr:
		return TRANS_CORNERS_ROTATION(FLr, c);
	case TRANS_BUr:
		return TRANS_CORNERS_ROTATION(BUr, c);
	case TRANS_BRr:
		return TRANS_CORNERS_ROTATION(BRr, c);
	case TRANS_BDr:
		return TRANS_CORNERS_ROTATION(BDr, c);
	case TRANS_BLr:
		return TRANS_CORNERS_ROTATION(BLr, c);
	case TRANS_UFm:
		return TRANS_CORNERS_MIRRORED(UFm, c);
	case TRANS_ULm:
		return TRANS_CORNERS_MIRRORED(ULm, c);
	case TRANS_UBm:
		return TRANS_CORNERS_MIRRORED(UBm, c);
	case TRANS_URm:
		return TRANS_CORNERS_MIRRORED(URm, c);
	case TRANS_DFm:
		return TRANS_CORNERS_MIRRORED(DFm, c);
	case TRANS_DLm:
		return TRANS_CORNERS_MIRRORED(DLm, c);
	case TRANS_DBm:
		return TRANS_CORNERS_MIRRORED(DBm, c);
	case TRANS_DRm:
		return TRANS_CORNERS_MIRRORED(DRm, c);
	case TRANS_RUm:
		return TRANS_CORNERS_MIRRORED(RUm, c);
	case TRANS_RFm:
		return TRANS_CORNERS_MIRRORED(RFm, c);
	case TRANS_RDm:
		return TRANS_CORNERS_MIRRORED(RDm, c);
	case TRANS_RBm:
		return TRANS_CORNERS_MIRRORED(RBm, c);
	case TRANS_LUm:
		return TRANS_CORNERS_MIRRORED(LUm, c);
	case TRANS_LFm:
		return TRANS_CORNERS_MIRRORED(LFm, c);
	case TRANS_LDm:
		return TRANS_CORNERS_MIRRORED(LDm, c);
	case TRANS_LBm:
		return TRANS_CORNERS_MIRRORED(LBm, c);
	case TRANS_FUm:
		return TRANS_CORNERS_MIRRORED(FUm, c);
	case TRANS_FRm:
		return TRANS_CORNERS_MIRRORED(FRm, c);
	case TRANS_FDm:
		return TRANS_CORNERS_MIRRORED(FDm, c);
	case TRANS_FLm:
		return TRANS_CORNERS_MIRRORED(FLm, c);
	case TRANS_BUm:
		return TRANS_CORNERS_MIRRORED(BUm, c);
	case TRANS_BRm:
		return TRANS_CORNERS_MIRRORED(BRm, c);
	case TRANS_BDm:
		return TRANS_CORNERS_MIRRORED(BDm, c);
	case TRANS_BLm:
		return TRANS_CORNERS_MIRRORED(BLm, c);
	default:
		LOG("transform error: unknown transformation %" PRIu8 "\n", t);
		return ZERO_CUBE;
	}
}

STATIC cube_t
transform(cube_t c, uint8_t t)
{
	switch (t) {
	case TRANS_UFr:
		return c;
	case TRANS_ULr:
		return TRANS_ROTATION(ULr, c);
	case TRANS_UBr:
		return TRANS_ROTATION(UBr, c);
	case TRANS_URr:
		return TRANS_ROTATION(URr, c);
	case TRANS_DFr:
		return TRANS_ROTATION(DFr, c);
	case TRANS_DLr:
		return TRANS_ROTATION(DLr, c);
	case TRANS_DBr:
		return TRANS_ROTATION(DBr, c);
	case TRANS_DRr:
		return TRANS_ROTATION(DRr, c);
	case TRANS_RUr:
		return TRANS_ROTATION(RUr, c);
	case TRANS_RFr:
		return TRANS_ROTATION(RFr, c);
	case TRANS_RDr:
		return TRANS_ROTATION(RDr, c);
	case TRANS_RBr:
		return TRANS_ROTATION(RBr, c);
	case TRANS_LUr:
		return TRANS_ROTATION(LUr, c);
	case TRANS_LFr:
		return TRANS_ROTATION(LFr, c);
	case TRANS_LDr:
		return TRANS_ROTATION(LDr, c);
	case TRANS_LBr:
		return TRANS_ROTATION(LBr, c);
	case TRANS_FUr:
		return TRANS_ROTATION(FUr, c);
	case TRANS_FRr:
		return TRANS_ROTATION(FRr, c);
	case TRANS_FDr:
		return TRANS_ROTATION(FDr, c);
	case TRANS_FLr:
		return TRANS_ROTATION(FLr, c);
	case TRANS_BUr:
		return TRANS_ROTATION(BUr, c);
	case TRANS_BRr:
		return TRANS_ROTATION(BRr, c);
	case TRANS_BDr:
		return TRANS_ROTATION(BDr, c);
	case TRANS_BLr:
		return TRANS_ROTATION(BLr, c);
	case TRANS_UFm:
		return TRANS_MIRRORED(UFm, c);
	case TRANS_ULm:
		return TRANS_MIRRORED(ULm, c);
	case TRANS_UBm:
		return TRANS_MIRRORED(UBm, c);
	case TRANS_URm:
		return TRANS_MIRRORED(URm, c);
	case TRANS_DFm:
		return TRANS_MIRRORED(DFm, c);
	case TRANS_DLm:
		return TRANS_MIRRORED(DLm, c);
	case TRANS_DBm:
		return TRANS_MIRRORED(DBm, c);
	case TRANS_DRm:
		return TRANS_MIRRORED(DRm, c);
	case TRANS_RUm:
		return TRANS_MIRRORED(RUm, c);
	case TRANS_RFm:
		return TRANS_MIRRORED(RFm, c);
	case TRANS_RDm:
		return TRANS_MIRRORED(RDm, c);
	case TRANS_RBm:
		return TRANS_MIRRORED(RBm, c);
	case TRANS_LUm:
		return TRANS_MIRRORED(LUm, c);
	case TRANS_LFm:
		return TRANS_MIRRORED(LFm, c);
	case TRANS_LDm:
		return TRANS_MIRRORED(LDm, c);
	case TRANS_LBm:
		return TRANS_MIRRORED(LBm, c);
	case TRANS_FUm:
		return TRANS_MIRRORED(FUm, c);
	case TRANS_FRm:
		return TRANS_MIRRORED(FRm, c);
	case TRANS_FDm:
		return TRANS_MIRRORED(FDm, c);
	case TRANS_FLm:
		return TRANS_MIRRORED(FLm, c);
	case TRANS_BUm:
		return TRANS_MIRRORED(BUm, c);
	case TRANS_BRm:
		return TRANS_MIRRORED(BRm, c);
	case TRANS_BDm:
		return TRANS_MIRRORED(BDm, c);
	case TRANS_BLm:
		return TRANS_MIRRORED(BLm, c);
	default:
		return ZERO_CUBE;
	}
}

STATIC oriented_cube_t
applytrans(oriented_cube_t cube, const char *buf)
{
	uint8_t t;

	DBG_ASSERT(isconsistent(cube),
	    "transformation error: inconsistent cube\n");

	t = readtrans(buf);

	if (t == UINT8_ERROR)
		LOG("Unknown transformation: %s\n", buf);

	return (oriented_cube_t){
		.cube = transform(cube.cube, t),
		.orientation = cube.orientation
	};
}

STATIC_INLINE uint8_t
inverse_trans(uint8_t t)
{
	return inverse_trans_table[t];
}

STATIC uint64_t
symmetry_mask(cube_t cube)
{
	uint64_t ret;
	uint8_t t;
	cube_t transformed;

	for (t = 0, ret = 0; t < NTRANS; t++) {
		transformed = transform(cube, t);
		ret |= ((uint64_t)equal(cube, transformed)) << (uint64_t)t;
	}

	return ret;
}

#endif /* CORE_TRANSFORM_H */
