#ifndef SOLVERS_COORD_DRFINNOE_H
#define SOLVERS_COORD_DRFINNOE_H

/*
TODO

The pruning table for this coordinate shows some odd behavior, which
is actually also present in nissy-classic: after completing depth 14,
if the search is let run for higher depth, no more positions are found.
This could be as simple as a small bug in the logic of the pruning table
calculations - I may be assuming somewhere that I am never going to search
for depths >= 15, since they are the highest possible value anyway -
or some reason related to symmetry - are some cases actually impossible?
In the worst case, it is a bug to be fixed, but I find it unlikely.
*/

#define CLASSES_CP_16 2768

STATIC uint64_t coordinate_drfinnoe_coord(cube_t, const unsigned char *);
STATIC cube_t coordinate_drfinnoe_cube(uint64_t, const unsigned char *);
STATIC bool coordinate_drfinnoe_isnasty(uint64_t, const unsigned char *);
STATIC size_t coordinate_drfinnoe_gendata(unsigned char *);

STATIC bool is_drfinnoe_solvable(cube_t);

STATIC coord_t coordinate_drfinnoe = {
	.name = "DRFINNOE",
	.coord = &coordinate_drfinnoe_coord,
	.cube = &coordinate_drfinnoe_cube,
	.isnasty = &coordinate_drfinnoe_isnasty,
	.gendata = coordinate_drfinnoe_gendata,
	.max = CLASSES_CP_16 * FACT_8,
	.trans_mask = TM_UDFIX,
	.moves_mask_gendata = MM18_DR,
	.moves_mask_solve = MM18_DR,
	.is_admissible = &solution_always_valid,
	.solution_prune = NULL,
	.is_solvable = &is_drfinnoe_solvable,
	.is_solved = NULL,
	.allow_niss = false,
	.pruning_distribution = {
 		[0] = 1,
		[1] = 3,
		[2] = 10,
		[3] = 52,
		[4] = 285,
		[5] = 1318,
		[6] = 5671,
		[7] = 26502,
		[8] = 115467,
		[9] = 470846,
		[10] = 1853056,
		[11] = 6535823,
		[12] = 18349792,
		[13] = 32843350,
		[14] = 34118883,
		[15] = 17284701
	},
	.pruning_max = 15,
	.sym = {
		.classes = CLASSES_CP_16,
		.max = FACT_8,
		.coord = &coord_cp,
		.cube = &invcoord_cp,
		.max2 = FACT_8,
		.coord2 = &coord_epud,
		.cube2 = &invcoord_epud,
		.merge = &coordinate_merge_ce,
	},
};

STATIC uint64_t
coordinate_drfinnoe_coord(cube_t cube, const unsigned char *data)
{
	return coord_coord_generic(&coordinate_drfinnoe, cube, data);
}

STATIC cube_t
coordinate_drfinnoe_cube(uint64_t i, const unsigned char *data)
{
	return coord_cube_generic(&coordinate_drfinnoe, i, data);
}

STATIC bool
coordinate_drfinnoe_isnasty(uint64_t i, const unsigned char *data)
{
	return coord_isnasty_generic(&coordinate_drfinnoe, i, data);
}

STATIC size_t
coordinate_drfinnoe_gendata(unsigned char *data)
{
	return coord_gendata_generic(&coordinate_drfinnoe, data);
}

STATIC bool
is_drfinnoe_solvable(cube_t cube) {
	return coord_eo(cube) == 0 &&
	       coord_eo(transform_edges(cube, TRANS_URr)) == 0 &&
	       coord_co(cube) == 0;
}

#endif /* SOLVERS_COORD_DRFINNOE_H */
