#ifndef SOLVERS_COORD_DRFIN_H
#define SOLVERS_COORD_DRFIN_H

STATIC bool is_drfin_solvable(cube_t);

STATIC multicoord_t multicoordinate_drfin = {
	.name = "DRFIN",
	.coordinates = { &coordinate_cpepe, &coordinate_drfinnoe, NULL },
	.moves_mask = MM18_DR,
	.is_solvable = is_drfin_solvable,
};

STATIC bool
is_drfin_solvable(cube_t cube)
{
	return coord_eo(cube) == 0 &&
	       coord_eo(transform_edges(cube, TRANS_URr)) == 0 &&
	       coord_co(cube) == 0 &&
	       issolvable((oriented_cube_t){.cube = cube, .orientation = 0});
}

#endif /* SOLVERS_COORD_DRFIN_H */
