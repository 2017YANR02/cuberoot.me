#ifndef SOLVERS_DISPATCH_H
#define SOLVERS_DISPATCH_H

typedef struct {
	const char *solvername;
	const char *prefix;
	long long (*dataid)(const char *, char [SIZE(NISSY_SIZE_DATAID)]);
	long long (*gendata)(
	    const char *, unsigned long long, unsigned char *);
	long long (*checkdata)(
	    const char *, unsigned long long, const unsigned char *);
	long long (*solve)(oriented_cube_t, const char *, unsigned, unsigned,
	    unsigned, unsigned, unsigned, unsigned, unsigned long long,
	    const unsigned char *, unsigned, char *,
	    long long [SIZE(NISSY_SIZE_SOLVE_STATS)],
	    int (*)(void *), void *);
} solver_dispatch_t;

STATIC solver_dispatch_t match_solver(const char *);

solver_dispatch_t solver_dispatchers[] = {
{
	.prefix = "h48",
	.dataid = dataid_h48,
	.gendata = gendata_h48_dispatch,
	.checkdata = checkdata_h48,
	.solve = solve_h48_dispatch,
},
{
	.prefix = "coord_",
	.dataid = dataid_coord,
	.gendata = gendata_coord_dispatch,
	.checkdata = checkdata_coord_dispatch,
	.solve = solve_coord_dispatch,
},
{
	.prefix = "mcoord_",
	.dataid = dataid_coord,
	.gendata = gendata_coord_dispatch,
	.checkdata = checkdata_coord_dispatch,
	.solve = solve_multicoord_dispatch,
},
{
	.prefix = NULL
}
};

const char *solver_aliases[][2] = {
	{ "optimal", "h48h7" },
	{ "eofb", "coord_EO_UF" },
	{ "eorl", "coord_EO_UR" },
	{ "eoud", "coord_EO_FD" },
	{ "drud", "coord_DR_UF" },
	{ "drrl", "coord_DR_RF" },
	{ "drfb", "coord_DR_FD" },
	{ "drudslice", "coord_DRSLICE_UF" },
	{ "drrlslice", "coord_DRSLICE_LF" },
	{ "drfbslice", "coord_DRSLICE_BU" },
	{ "drud-eofb", "coord_DREO_UF" },
	{ "drrl-eofb", "coord_DREO_RF" },
	{ "drud-eorl", "coord_DREO_UR" },
	{ "drfb-eorl", "coord_DREO_RU" },
	{ "drrl-eoud", "coord_DREO_FR" },
	{ "drfb-eoud", "coord_DREO_FD" },
	{ "drudfin", "mcoord_DRFIN_UF" },
	{ "drrlfin", "mcoord_DRFIN_LF" },
	{ "drfbfin", "mcoord_DRFIN_BU" },
	{ "htr-drud", "coord_HTR_UF" },
	{ "htr-drrl", "coord_HTR_LF" },
	{ "htr-drfb", "coord_HTR_BU" },
	{ "corners", "coord_CORNERS_UF" },
	{ "cornersx", "coord_CORNERSX_UF" },
	{ NULL, NULL }
};

STATIC solver_dispatch_t
match_solver(const char *name)
{
	const char *prefix;
	solver_dispatch_t ret;
	int i;

	for (i = 0; solver_aliases[i][0] != NULL; i++)
		if (!strcmp(name, solver_aliases[i][0]))
			return match_solver(solver_aliases[i][1]);

	for (i = 0; solver_dispatchers[i].prefix != NULL; i++) {
		prefix = solver_dispatchers[i].prefix;
		if (!strncmp(name, prefix, strlen(prefix))) {
			ret = solver_dispatchers[i];
			ret.solvername = name;
			return ret;
		}
	}

	return solver_dispatchers[i];
}

#endif /* SOLVERS_DISPATCH_H */
