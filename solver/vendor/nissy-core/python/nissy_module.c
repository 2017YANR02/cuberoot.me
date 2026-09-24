#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <stdbool.h>

#include "../src/nissy.h"

#define MAX_SOLUTIONS_SIZE 250000

static bool
check_error(long long err)
{
	char err_string[255];

	/* A positive value always denotes a success */
	if (err > 0)
		return true;

	switch (err) {
	case NISSY_OK: /* Fallthrough */
	case NISSY_WARNING_UNSOLVABLE:
		return true;
	case NISSY_ERROR_INVALID_CUBE:
	case NISSY_ERROR_UNSOLVABLE_CUBE: /* Fallthrough */
	case NISSY_ERROR_INVALID_MOVES:
	case NISSY_ERROR_INVALID_TRANS:
	case NISSY_ERROR_INVALID_SOLVER:
	case NISSY_ERROR_NULL_POINTER:
	case NISSY_ERROR_BUFFER_SIZE:
	case NISSY_ERROR_DATA:
	case NISSY_ERROR_OPTIONS:
	case NISSY_ERROR_UNKNOWN:
	default:
		sprintf(err_string, "Error from libnissy (%lld)", err);
		PyErr_SetString(PyExc_Exception, err_string);
		return false;
	}

}

static PyObject *
string_result(long long err, const char *result)
{
	return check_error(err) ? PyUnicode_FromString(result) : NULL;
}

static PyObject *
stringlist_result(long long err, char *result)
{
	int i, j, k;
	PyObject *list, *item;

	if(!check_error(err)) {
		return NULL;
	} else {
		list = PyList_New(err);
		for (i = 0, j = 0, k = 0; result[i] != 0; i++) {
			if (result[i] != '\n')
				continue;
			result[i] = 0;
			item = PyUnicode_FromString(&result[k]);
			PyList_SetItem(list, j, item);
			j++;
			k = i+1;
		}
		return list;
	}
}

static PyObject *
string_result_free(long long err, char *result)
{
	PyObject *ret;

	ret = PyUnicode_FromString(result);
	free(result);

	return check_error(err) ? ret : NULL;
}

static PyObject *
long_result(long long result)
{
	check_error(result);
	return PyLong_FromLong(result);
}

PyDoc_STRVAR(inverse_doc,
"inverse(cube)\n"
"--\n\n"
"Invert 'cube'.\n"
"\n"
"Parameters:\n"
"  - cube: a cube in\n"
"\n"
"Returns: the inverse cube\n"
);
static PyObject *
inverse(PyObject *self, PyObject *args)
{
	long long err;
	const char *cube;
	char result[NISSY_SIZE_CUBE];

	if (!PyArg_ParseTuple(args, "s", &cube))
		return NULL;

	err = nissy_inverse(cube, result);
	return string_result(err, result);
}

PyDoc_STRVAR(applymoves_doc,
"applymoves(cube, moves)\n"
"--\n\n"
"Apply 'moves' to 'cube'.\n"
"\n"
"Parameters:\n"
"  - cube: a cube in\n"
"  - moves: the moves to apply on the cube\n"
"\n"
"Returns: the resulting cube\n"
);
static PyObject *
applymoves(PyObject *self, PyObject *args)
{
	long long err;
	const char *cube, *moves;
	char result[NISSY_SIZE_CUBE];

	if (!PyArg_ParseTuple(args, "ss", &cube, &moves))
		return NULL;

	err = nissy_applymoves(cube, moves, result);
	return string_result(err, result);
}

PyDoc_STRVAR(applytrans_doc,
"applytrans(cube, transformation)\n"
"--\n\n"
"Apply 'transformation' to 'cube'.\n"
"\n"
"Parameters:\n"
"  - cube: a cube\n"
"  - transformation: the transformation to apply on the cube, formatted as\n"
"    (rotation|mirrored) (2 letters)\n"
"    for example 'mirrored ur' or 'rotation lf'\n"
"\n"
"Returns: the resulting cube\n"
);
static PyObject *
applytrans(PyObject *self, PyObject *args)
{
	long long err;
	const char *cube, *trans;
	char result[NISSY_SIZE_CUBE];

	if (!PyArg_ParseTuple(args, "ss", &cube, &trans))
		return NULL;

	err = nissy_applytrans(cube, trans, result);
	return string_result(err, result);
}

PyDoc_STRVAR(getcube_doc,
"getcube(ep, eo, cp, co, orientation, options)\n"
"--\n\n"
"Constructs the cube from the given coordinates and options\n"
"\n"
"Parameters:\n"
"  - ep: the edge permutation coordinate\n"
"  - eo: the edge orientation coordinate\n"
"  - cp: the corner permutation coordinate\n"
"  - co: the corner orientation coordinate\n"
"  - orientation: the orientation of the cube\n"
"  - options: a string, for example \"fix\"\n"
"\n"
"Returns: the cube constructed from the given coordinates\n"
);
static PyObject *
getcube(PyObject *self, PyObject *args)
{
	long long ep, eo, cp, co, or, err;
	const char *options;
	char result[NISSY_SIZE_CUBE];

	if (!PyArg_ParseTuple(
	    args, "LLLLLs", &ep, &eo, &cp, &co, &or, &options))
		return NULL;

	err = nissy_getcube(ep, eo, cp, co, or, options, result);
	return string_result(err, result);
}

PyDoc_STRVAR(solverinfo_doc,
"solverinfo(solver)\n"
"--\n\n"
"Returns the size and the short name of the data for the given solver\n"
"\n"
"Parameters:\n"
"  - solver: the name of the solver\n"
"\n"
"Returns: a pair containing the size and the short name "
"of the data for the solver, in bytes\n"
);
static PyObject *
solverinfo(PyObject *self, PyObject *args)
{
	long long result;
	const char *solver;
	char buf[NISSY_SIZE_DATAID];
	PyObject *py_result, *py_buf;

	if (!PyArg_ParseTuple(args, "s", &solver))
		return NULL;

	result = nissy_solverinfo(solver, buf);
	
	py_result = PyLong_FromLong(result);
	py_buf = PyUnicode_FromString(buf);
	return PyTuple_Pack(2, py_result, py_buf);
}

PyDoc_STRVAR(gendata_doc,
"gendata(solver)\n"
"--\n\n"
"Generates the data (pruning table) for the given solver\n"
"\n"
"Parameters:\n"
"  - solver: the name of the solver\n"
"\n"
"Returns: a bytearray containing the data for the solver\n"
);
static PyObject *
gendata(PyObject *self, PyObject *args)
{
	long long size, err;
	const char *solver;
	char dataid[NISSY_SIZE_DATAID];
	unsigned char *buf;

	if (!PyArg_ParseTuple(args, "s", &solver))
		return NULL;

	size = nissy_solverinfo(solver, dataid);
	if (!check_error(size))
		return NULL;

	buf = PyMem_Malloc(size);

	Py_BEGIN_ALLOW_THREADS
	err = nissy_gendata(solver, size, buf);
	Py_END_ALLOW_THREADS

	if (check_error(err))
		return PyByteArray_FromStringAndSize((char *)buf, size);
	else
		return NULL;
}

PyDoc_STRVAR(checkdata_doc,
"checkdata(data)\n"
"--\n\n"
"Checks if the data (pruning table) given is valid or not\n"
"\n"
"Parameters:\n"
"  - solver: the name of the solver\n"
"  - data: a bytearray containing the data for a solver\n"
"\n"
"Returns: true if the data is valid, false otherwise\n"
);
PyObject *
checkdata(PyObject *self, PyObject *args)
{
	const char *solver;
	long long result;
	PyByteArrayObject *data;

	if (!PyArg_ParseTuple(args, "sY", &solver, &data))
		return NULL;

	result = nissy_checkdata(
	    solver, data->ob_alloc, (unsigned char *)data->ob_bytes);

	if (check_error(result))
		return Py_True;
	else
		return Py_False;
}

PyDoc_STRVAR(solve_doc,
"solve(cube, solver, nissflag, minmoves, maxmoves, maxsolutions,"
" optimal, threads, data)\n"
"--\n\n"
"Solves the given 'cube' with the given 'solver' and other parameters."
"See the documentation for libnissy (in nissy.h) for details.\n"
"\n"
"Parameters:\n"
"  - cube: a cube\n"
"  - solver: the solver to use\n"
"  - minmoves: the minimum number of moves to use\n"
"  - maxmoves: the maximum number of moves to use\n"
"  - maxsolution: the maximum number of solutions to return\n"
"  - optimal: the largest number of moves from the shortest solution\n"
"  - threads: the number of threads to use (0 for default)\n"
"  - data: a bytearray containing the data for the solver\n"
"\n"
"Returns: a list with the solutions found\n"
);
PyObject *
solve(PyObject *self, PyObject *args)
{
	long long result;
	unsigned nissflag, minmoves, maxmoves, maxsolutions;
	int optimal, threads;
	const char *cube, *solver;
	char solutions[MAX_SOLUTIONS_SIZE];
	long long stats[NISSY_SIZE_SOLVE_STATS];
	PyByteArrayObject *data;

	if (!PyArg_ParseTuple(args, "ssIIIIIIY", &cube, &solver, &nissflag,
	     &minmoves, &maxmoves, &maxsolutions, &optimal, &threads, &data))
		return NULL;

	Py_BEGIN_ALLOW_THREADS
	result = nissy_solve(cube, solver, nissflag, minmoves, maxmoves,
	    maxsolutions, optimal, threads, data->ob_alloc,
	    (unsigned char *)data->ob_bytes, MAX_SOLUTIONS_SIZE, solutions,
	    stats, NULL, NULL);
	Py_END_ALLOW_THREADS

	return stringlist_result(result, solutions);
}

PyDoc_STRVAR(countmoves_doc,
"countmoves(moves)\n"
"--\n\n"
"Count the moves\n"
"\n"
"Parameters:\n"
"  - moves: the moves to be counted\n"
"\n"
"Returns: the number of moves in HTM metric\n"
);
PyObject *
countmoves(PyObject *self, PyObject *args)
{
	long long count;
	const char *moves;

	if (!PyArg_ParseTuple(args, "s", &moves))
		return NULL;

	count = nissy_countmoves(moves);
	return long_result(count);
}

PyDoc_STRVAR(comparemoves_doc,
"comparemoves(moves1, moves2)\n"
"--\n\n"
"Compare the two move sequences\n"
"\n"
"Parameters:\n"
"  - moves1: the first sequence of moves\n"
"  - moves2: the second sequence of moves\n"
"\n"
"Returns: a string describing how the two moves sequences compare. "
"This can be one of:\n"
"\"EQUAL\"      - The two sequences are equal up to swapping parallel moves\n"
"\"DIFFERENT\"  - The two sequences are different\n"
);
PyObject *
comparemoves(PyObject *self, PyObject *args)
{
	long long cmp;
	const char *m1, *m2;

	if (!PyArg_ParseTuple(args, "ss", &m1, &m2))
		return NULL;

	cmp = nissy_comparemoves(m1, m2);
	if (!check_error(cmp))
		return NULL;

	switch (cmp) {
	case NISSY_COMPARE_MOVES_EQUAL:
		return string_result(cmp, "EQUAL");
	case NISSY_COMPARE_MOVES_DIFFERENT:
		return string_result(cmp, "DIFFERENT");
	default:
		return long_result(cmp);
	}
}

PyDoc_STRVAR(variations_doc,
"variations(moves, variation)\n"
"--\n\n"
"Find variations of a given move sequence\n"
"\n"
"Parameters:\n"
"  - moves: the moves\n"
"  - variation: the variation to apply, such as 'unniss' or 'lastqt'\n"
"\n"
"Returns: a list of move sequences, the variation of the given moves.\n"
);
PyObject *
variations(PyObject *self, PyObject *args)
{
	long long err;
	const char *m, *v;
	char result[MAX_SOLUTIONS_SIZE];

	if (!PyArg_ParseTuple(args, "ss", &m, &v))
		return NULL;

	err = nissy_variations(m, v, MAX_SOLUTIONS_SIZE, result);

	return stringlist_result(err, result);
}

static PyMethodDef nissy_methods[] = {
	{ "inverse", inverse, METH_VARARGS, inverse_doc },
	{ "applymoves", applymoves, METH_VARARGS, applymoves_doc },
	{ "applytrans", applytrans, METH_VARARGS, applytrans_doc },
	{ "getcube", getcube, METH_VARARGS, getcube_doc },
	{ "solverinfo", solverinfo, METH_VARARGS, solverinfo_doc },
	{ "gendata", gendata, METH_VARARGS, gendata_doc },
	{ "checkdata", checkdata, METH_VARARGS, checkdata_doc },
	{ "solve", solve, METH_VARARGS, solve_doc },
	{ "countmoves", countmoves, METH_VARARGS, countmoves_doc },
	{ "comparemoves", comparemoves, METH_VARARGS, comparemoves_doc },
	{ "variations", variations, METH_VARARGS, variations_doc },
	{ NULL, NULL, 0, NULL }
};

static struct PyModuleDef nissy = {
	.m_base = PyModuleDef_HEAD_INIT,
	.m_name = "nissy",
	.m_doc = "python module for libnissy",
	.m_size = -1,
	.m_methods = nissy_methods,
	.m_slots = NULL,
	.m_traverse = NULL,
	.m_clear = NULL,
	.m_free = NULL
};

static void
log_stdout(const char *str, void *unused)
{
	fprintf(stderr, "%s", str);
}

PyMODINIT_FUNC PyInit_nissy(void) {
	PyObject *module;

	nissy_setlogger(log_stdout, NULL);
	module = PyModule_Create(&nissy);

	PyModule_AddStringConstant(module, "solved_cube", NISSY_SOLVED_CUBE);
	PyModule_AddIntConstant(module, "nissflag_normal", NISSY_NISSFLAG_NORMAL);
	PyModule_AddIntConstant(module, "nissflag_inverse", NISSY_NISSFLAG_INVERSE);
	PyModule_AddIntConstant(module, "nissflag_mixed", NISSY_NISSFLAG_MIXED);
	PyModule_AddIntConstant(module, "nissflag_linear", NISSY_NISSFLAG_LINEAR);
	PyModule_AddIntConstant(module, "nissflag_all", NISSY_NISSFLAG_ALL);

	return module;
}
