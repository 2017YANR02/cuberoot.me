#include "../cpp/nissy.h"
#include "storage.h"
#include "logging.h"

#include <emscripten.h>
#include <emscripten/bind.h>
#include <functional>
#include <map>
#include <set>
#include <string>
#include <vector>

EM_ASYNC_JS(void, fake_async, (), {});

std::map<std::string, nissy::solver> loaded_solvers;

const std::set<std::string> available_solvers
{
	"h48h1",
	"h48h2",
	"h48h3",
	"h48h4",
	"h48h5",
};

bool is_solver_available(const std::string& name)
{
	return available_solvers.contains(name);
}

bool is_solver_loaded(const std::string& name)
{
	return loaded_solvers.contains(name);
}

bool check_data(nissy::solver& solver)
{
	log("Checking data integrity "
	    "(this is done only once per session per solver)...\n");

	if (!solver.check_data().ok()) {
		log("Error! Data is corrupted!\n");
		return false;
	}

	return true;
}

bool read_solver_data(nissy::solver& solver)
{
	solver.data.resize(solver.size);

	bool success = storage::read(solver.id, solver.size,
	    reinterpret_cast<char *>(solver.data.data()));

	if (!success) {
		log("Could not read data for solver " +
		    solver.name + " from storage\n");
		return false;
	}

	if (!check_data(solver)) {
		log("Data for solver " + solver.name + " is corrupt!\n");
		return false;
	}

	log("Data for solver " + solver.name + " read from storage\n");
	loaded_solvers.insert({solver.name, solver});

	return true;
}

bool is_solver_valid(const std::string& name,
    std::variant<nissy::solver, nissy::error>& se)
{
	if (std::holds_alternative<nissy::error>(se)) {
		log("Invalid solver " + name + "\n");
		return false;
	}

	if (!is_solver_available(name)) {
		log("Solver " + name + " is not available in this version\n");
		return false;
	}

	return true;
}

bool init_solver_from_storage(const std::string& name)
{
	if (is_solver_loaded(name))
		return true;
	auto se = nissy::solver::get(name);
	if (!is_solver_valid(name, se))
		return false;
	nissy::solver solver = std::get<nissy::solver>(se);

	return read_solver_data(solver);
}

bool init_solver_download(const std::string& name, const std::string& urlbase)
{
	if (is_solver_loaded(name))
		return true;
	auto se = nissy::solver::get(name);
	if (!is_solver_valid(name, se))
		return false;
	nissy::solver solver = std::get<nissy::solver>(se);

	if (storage::download(solver.id, urlbase + "/" + solver.id)) {
		return read_solver_data(solver);
	} else {
		return false;
	}
}

bool init_solver_generate(const std::string& name)
{
	if (is_solver_loaded(name))
		return true;
	auto se = nissy::solver::get(name);
	if (!is_solver_valid(name, se))
		return false;
	nissy::solver solver = std::get<nissy::solver>(se);

	if (!solver.generate_data().ok()) {
		log("Error generating data for solver " + name + "!\n");
		return false;
	}

	if (!check_data(solver)) {
		log("Data for solver " + name + " generated incorrectly!\n");
		return false;
	}

	if (storage::write(solver.id, solver.size,
	    reinterpret_cast<const char *>(solver.data.data()))) {
		log("Data for solver " + name + " stored\n");
	} else {
		log("Error storing the data (the solver is usable, "
		    "but the data will have to be re-generated next "
		    "time you want to use it)\n");
	}

	return true;
}

int poll_status(void *arg)
{
	if (arg == nullptr)
		return nissy::status::RUN.value;

	std::function<int(void)> poll((int (*)(void))*(int *)arg);
	return poll();
}

// The parameter js_poll_status is of type int here, but actually it is a
// pointer to a JS function. The type will have to be changed to a 64-bit
// integer when we move to WASM64.
int js_poll_status_global = 0;
nissy::solver::solve_result solve(std::string name,
    nissy::cube cube, nissy::nissflag nissflag, unsigned minmoves,
    unsigned maxmoves, unsigned maxsols, unsigned optimal, unsigned threads,
    int js_poll_status)
{
	// Here we use a dirty trick to make this function always return the
	// same kind of JavaScript object. If we did not do this, the returned
	// object would be a Promise on the first run of the solver for each
	// session (because when loading the table some async JS code is
	// called), and a regular object otherwise.
	// TODO figure out if there is a better way to do this.
	fake_async();

	if (!is_solver_loaded(name)) {
		log("Solver " + name + " is invalid or has not been loaded\n");
		return nissy::solver::solve_result
		    {.err = nissy::error::INVALID_SOLVER};
	}

	// TODO: when running multiple solvers at the same time, we could use
	// poll_status_id as intended (i.e. an id of some sort)
	js_poll_status_global = js_poll_status;
	return loaded_solvers.at(name).solve(cube, nissflag, minmoves,
	    maxmoves, maxsols, optimal, threads,
	    poll_status, &js_poll_status_global);
}

EMSCRIPTEN_BINDINGS(Nissy)
{
	emscripten::class_<nissy::nissflag>("NissFlag")
		.class_property("normal", &nissy::nissflag::NORMAL)
		.class_property("inverse", &nissy::nissflag::INVERSE)
		.class_property("mixed", &nissy::nissflag::MIXED)
		.class_property("linear", &nissy::nissflag::LINEAR)
		.class_property("all", &nissy::nissflag::ALL)
		;

	emscripten::class_<nissy::error>("Error")
		.function("ok", &nissy::error::ok)
		.property("value", &nissy::error::value)
		.class_property("unsolvableWarning",
		    &nissy::error::UNSOLVABLE_WARNING)
		.class_property("unsolvableError",
		    &nissy::error::UNSOLVABLE_ERROR)
		.class_property("invalidCube", &nissy::error::INVALID_CUBE)
		.class_property("invalidMoves", &nissy::error::INVALID_MOVES)
		.class_property("invalidTrans", &nissy::error::INVALID_TRANS)
		.class_property("invalidSolver", &nissy::error::INVALID_SOLVER)
		.class_property("nullPointer", &nissy::error::NULL_POINTER)
		.class_property("bufferSize", &nissy::error::BUFFER_SIZE)
		.class_property("data", &nissy::error::DATA)
		.class_property("options", &nissy::error::OPTIONS)
		.class_property("unknown", &nissy::error::UNKNOWN)
		;

	emscripten::constant("statusRUN", nissy::status::RUN.value);
	emscripten::constant("statusSTOP", nissy::status::STOP.value);
	emscripten::constant("statusPAUSE", nissy::status::PAUSE.value);
	emscripten::class_<nissy::status>("Status")
		.class_property("run", &nissy::status::RUN)
		.class_property("stop", &nissy::status::STOP)
		.class_property("pause", &nissy::status::PAUSE)
		;

	emscripten::class_<nissy::cube>("Cube")
		.constructor<>()
		.function("move", &nissy::cube::move)
		.function("transform", &nissy::cube::transform)
		.function("invert", &nissy::cube::invert)
		.function("toString", &nissy::cube::to_string)
		;

	emscripten::class_<nissy::solver::solve_result>("SolveResult")
		.property("err", &nissy::solver::solve_result::err)
		.property("solutions", &nissy::solver::solve_result::solutions)
		;

	emscripten::function("isSolverAvailable", &is_solver_available);
	emscripten::function("isSolverLoaded", &is_solver_loaded);
	emscripten::function("initSolverFromStorage",
	    &init_solver_from_storage);
	emscripten::function("initSolverDownload", &init_solver_download);
	emscripten::function("initSolverGenerate", &init_solver_generate);

	emscripten::function("countMoves", &nissy::count_moves);
	emscripten::function("solve", &solve,
	    emscripten::return_value_policy::take_ownership());
	emscripten::function("setLogger", &set_logger,
	    emscripten::allow_raw_pointers());
}
