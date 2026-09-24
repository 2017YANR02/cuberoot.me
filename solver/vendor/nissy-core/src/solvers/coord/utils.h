#ifndef SOLVERS_COORD_UTILS_H
#define SOLVERS_COORD_UTILS_H

STATIC coord_t *parse_coord(size_t, const char *);
STATIC multicoord_t *parse_multicoord(size_t, const char *);
STATIC void parse_coord_and_trans(
    const char *, coord_t **, multicoord_t **, uint8_t *);
STATIC long long dataid_coord(const char *, char [SIZE(NISSY_SIZE_DATAID)]);

STATIC coord_t *
parse_coord(size_t n, const char *coord)
{
	int i;
	const char *name;

	for (i = 0; all_coordinates[i] != NULL; i++) {
		name = all_coordinates[i]->name;
		if (n == strlen(name) && !strncmp(name, coord, n))
			return all_coordinates[i];
	}

	return NULL;
}

STATIC multicoord_t *
parse_multicoord(size_t n, const char *coord)
{
	int i;
	const char *name;

	for (i = 0; all_multicoordinates[i] != NULL; i++) {
		name = all_multicoordinates[i]->name;
		if (n == strlen(name) && !strncmp(name, coord, n))
			return all_multicoordinates[i];
	}

	return NULL;
}

STATIC void
parse_coord_and_trans(
	const char *str,
	coord_t **coord,
	multicoord_t **mcoord,
	uint8_t *trans
)
{
	size_t i;

	for (i = 7; i < strlen(str); i++)
		if (str[i] == '_')
			break;

	if (coord != NULL)
		*coord = parse_coord(i-6, str+6);

	if (mcoord != NULL)
		*mcoord = parse_multicoord(i-7, str+7);

	if (trans != NULL)
		*trans = i == strlen(str) ?
		    UINT8_ERROR : readrotation(str+i+1);
}

STATIC long long
dataid_coord(const char *ca, char dataid[SIZE(NISSY_SIZE_DATAID)])
{
	coord_t *c;
	multicoord_t *mc;

	parse_coord_and_trans(ca, &c, &mc, NULL);

	if (c != NULL) {
		strcpy(dataid, c->name);
		return NISSY_OK;
	}

	if (mc != NULL) {
		strcpy(dataid, mc->name);
		return NISSY_OK;
	}

	LOG("Error: cannot parse coordinate from '%s'\n", ca);
	return NISSY_ERROR_INVALID_SOLVER;
}

#endif /* SOLVERS_COORD_UTILS_H */
