#ifndef CORE_ORIENTED_CUBE_H
#define CORE_ORIENTED_CUBE_H

STATIC oriented_cube_t solvedcube(void);

STATIC oriented_cube_t move_extended(oriented_cube_t, uint8_t);
STATIC oriented_cube_t applymoves(oriented_cube_t, const char *);

/* This is used only in tests, use SOLVED_ORIENTED_CUBE everywhere else */
STATIC oriented_cube_t
solvedcube(void)
{
	return SOLVED_ORIENTED_CUBE;
}

STATIC oriented_cube_t
compose_oriented(oriented_cube_t c, oriented_cube_t d)
{
	int i;
	cube_t transformed_d;
	oriented_cube_t ret;

	transformed_d = transform(d.cube, orientation_trans[c.orientation]);

	ret.cube = compose(c.cube, transformed_d);
	ret.orientation = c.orientation;

	for (i = 0; orientation_moves[d.orientation][i] != UINT8_MAX; i++)
		ret = move_extended(ret, orientation_moves[d.orientation][i]);

	return ret;
}

STATIC oriented_cube_t
move_extended(oriented_cube_t c, uint8_t m)
{
	int i;
	equivalent_moves_t eqm;
	oriented_cube_t ret;

	eqm = equivalent_moves_table[m];
	ret = c;

	for (i = 0; eqm.move[i] != UINT8_MAX; i++)
		ret.cube = move(
		    ret.cube, reorient_move(eqm.move[i], ret.orientation));

	for (i = 0; eqm.rotation[i] != UINT8_MAX; i++)
		ret.orientation = orientation_transition_table[
		    ret.orientation][eqm.rotation[i]];

	return ret;
}

STATIC oriented_cube_t
applymoves(oriented_cube_t cube, const char *buf)
{
	int count;
	uint8_t m;
	oriented_cube_t c, cinv;

	DBG_ASSERT(isconsistent(cube), "move error: inconsistent cube\n");

	c = cube;
	cinv = SOLVED_ORIENTED_CUBE;
	FOREACH_READMOVE(buf, m, count, -1, ZERO_ORIENTED_CUBE,
		if (!VAR_IN_PARENTHESES)
			c = move_extended(c, m);
		else
			cinv = move_extended(cinv, m);
	)

	if (cinv.orientation != ORIENTATION_UF) {
		LOG("Error applying moves: NISS part must not move centers\n");
		return ZERO_ORIENTED_CUBE;
	}

	cinv.cube = inverse(cinv.cube);
	return compose_oriented(cinv, c);
}

#endif /* CORE_ORIENTED_CUBE_H */
