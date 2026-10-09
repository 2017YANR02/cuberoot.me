#ifndef SOLVERS_COORD_LIST_H
#define SOLVERS_COORD_LIST_H

coord_t *all_coordinates[] = {
	&coordinate_eo,
	&coordinate_dr,
	&coordinate_dreo,
	&coordinate_drfinnoe,
	&coordinate_drslice,
	&coordinate_cpepe,
	&coordinate_htr,
	&coordinate_corners,
	&coordinate_cornersx,
	NULL
};

multicoord_t *all_multicoordinates[] = {
	&multicoordinate_drfin,
	NULL
};

#endif /* SOLVERS_COORD_LIST_H */
