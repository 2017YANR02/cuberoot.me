#ifndef SOLVERS_H48_COORDINATE_H
#define SOLVERS_H48_COORDINATE_H

STATIC_INLINE uint64_t coord_h48(
    cube_t, const uint32_t [SIZE(COCSEP_TABLESIZE)], uint8_t);
STATIC_INLINE uint64_t coord_h48_edges(cube_t, uint64_t, uint8_t, uint8_t);
STATIC_INLINE cube_t invcoord_h48(
    uint64_t, const cube_t [SIZE(COCSEP_CLASSES)], uint8_t);

STATIC_INLINE uint64_t
coord_h48(
	cube_t c,
	const uint32_t cocsepdata[SIZE(COCSEP_TABLESIZE)],
	uint8_t h
)
{
	uint64_t cocsep, coclass;
	uint32_t data;
	uint8_t ttrep;

	DBG_ASSERT(h <= 11, "coord_h48: h must be between 0 and 11\n");

	cocsep = coord_cocsep(c);
	data = cocsepdata[cocsep];
	coclass = COCLASS(data);
	ttrep = TTREP(data);

	return coord_h48_edges(c, coclass, ttrep, h);
}

STATIC_INLINE uint64_t
coord_h48_edges(cube_t c, uint64_t coclass, uint8_t ttrep, uint8_t h)
{
	cube_t d;
	uint64_t esep, eo, edges;

	d = transform_edges(c, ttrep);
	esep = coord_esep(d);
	eo = coord_eo(d);
	edges = (esep << 11) + eo;

	return (coclass * H48_ESIZE(11) + edges) >> (11 - (uint64_t)h);
}

/*
This function does not necessarily return a cube whose coordinate is
the given value, because it works up to symmetry. This means that the
returned cube is a transformed cube of one that gives the correct value.
*/
STATIC_INLINE cube_t
invcoord_h48(
	uint64_t i,
	const cube_t crep[SIZE(COCSEP_CLASSES)],
	uint8_t h
)
{
	cube_t ret;
	uint64_t hh, coclass, ee, esep, eo;

	DBG_ASSERT(h <= 11, "invcoord_h48: h must be between 0 and 11\n");

	hh = (uint64_t)h;
	coclass = i / H48_ESIZE(h);
	ee = i % H48_ESIZE(h);
	esep = ee >> hh;
	eo = (ee & ((1 << hh) - 1)) << (11 - hh);

	ret = invcoord_esep(esep);
	copy_corners(&ret, crep[coclass]);
	set_eo(&ret, eo);

	return ret;
}

#endif /* SOLVERS_H48_COORDINATE_H */
