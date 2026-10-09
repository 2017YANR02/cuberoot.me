/*
C++20 interface for nissy.

TODO: add more documentation (here and in README.md)
*/

#include "./nissy.h"

#include <fstream>

extern "C" {
	long long nissy_inverse(const char *, char *);
	long long nissy_applymoves(const char *, const char *, char *);
	long long nissy_applytrans(const char *, const char *, char *);
	long long nissy_variations(const char *, const char *,
	    unsigned long long, char*);
	long long nissy_getcube(long long, long long, long long, long long,
	    long long, const char *, char *);
	long long nissy_solverinfo(const char *, char *);
	long long nissy_gendata(const char *, unsigned long long,
	    unsigned char *);
	long long nissy_checkdata(const char *, unsigned long long,
	    const unsigned char *);
	long long nissy_solve(const char *, const char *, unsigned, unsigned,
	    unsigned, unsigned, unsigned, unsigned, unsigned long long,
	    const unsigned char *, unsigned, char *, long long *,
	    int (*)(void *), void *);
	long long nissy_countmoves(const char *);
	long long nissy_comparemoves(const char *, const char *);
	long long nissy_setlogger(void (*)(const char *, void *), void *);
}

namespace nissy {

	/* Definition of constants with const qualifier */
	const nissflag nissflag::NORMAL{1};
	const nissflag nissflag::INVERSE{2};
	const nissflag nissflag::MIXED{4};
	const nissflag nissflag::LINEAR{3};
	const nissflag nissflag::ALL{7};

	const error error::OK{0};
	const error error::UNSOLVABLE_WARNING{-1};
	const error error::UNSOLVABLE_ERROR{-11};
	const error error::INVALID_CUBE{-10};
	const error error::INVALID_MOVES{-20};
	const error error::INVALID_TRANS{-30};
	const error error::INVALID_SOLVER{-50};
	const error error::INVALID_VARIATION{-51};
	const error error::NULL_POINTER{-60};
	const error error::BUFFER_SIZE{-61};
	const error error::DATA{-70};
	const error error::OPTIONS{-80};
	const error error::UNKNOWN{-999};

	const status status::RUN{0};
	const status status::STOP{1};
	const status status::PAUSE{2};

	const compare_result compare_result::EQUAL{0};
	const compare_result compare_result::DIFFERENT{99};

	namespace size {
		constexpr size_t CUBE = 24;
		constexpr size_t TRANSFORMATION = 12;
		constexpr size_t SOLVE_STATS = 10;
		constexpr size_t DATAID = 255;
		constexpr size_t MOVES = 1000;
	}

	bool error::ok() const { return value >= 0; }

	variation::variation(const std::string& str) : name{str} {}

	variation::variations_result
	variation::find_variations(const std::string& moves)
	{
		variation::variations_result result;

		const size_t len = 3 * size::MOVES * 16;
		result.solutions.resize(len);

		auto err = nissy_variations(moves.c_str(), name.c_str(), len,
		    result.solutions.data());

		int size = result.solutions.find_first_of('\0');
		result.solutions.resize(size);
		result.err = error{err};

		return result;
	}

	std::variant<variation, error>
	variation::get(const std::string& name) {
		char result[10];
		variation s(name);

		if (nissy_variations("", name.c_str(), 10, result) < 0)
			return error::INVALID_VARIATION;
		else
			return s;
	}

	cube::cube() {}

	error cube::move(const std::string& moves)
	{
		char result[size::CUBE];
		long long err = nissy_applymoves(
		    m_str.c_str(), moves.c_str(), result);
		if (err < 0)
			return error{err};
		m_str = result;
		return error::OK;
	}

	error cube::transform(const std::string& trans)
	{
		char result[size::CUBE];
		long long err = nissy_applytrans(
		    m_str.c_str(), trans.c_str(), result);
		if (err < 0)
			return error{err};
		m_str = result;
		return error::OK;
	}

	void cube::invert()
	{
		char result[size::CUBE];
		nissy_inverse(m_str.c_str(), result);
		m_str = result;
	}

	std::string cube::to_string() const { return m_str; }

	std::variant<cube, error>
	cube::from_string(const std::string& str)
	{
		/* Check that the cube is valid by making a single move */
		char result[size::CUBE];
		auto err = nissy_applymoves(str.c_str(), "U", result);
		if (err < 0)
			return error{err};

		cube c;
		c.m_str = str;
		return c;
	}

	std::variant<cube, error>
	cube::get(long long ep, long long eo,
	    long long cp, long long co, long long orien)
	{
		return get(ep, eo, cp, co, orien, "fix");
	}

	std::variant<cube, error>
	cube::get(long long ep, long long eo, long long cp, long long co,
	    long long orient, const std::string& options)
	{
		char result[size::CUBE];
		cube c;
		auto err = nissy_getcube(ep, eo, cp, co, orient,
		    options.c_str(), result);
		if (err < 0)
			return error{err};
		c.m_str = result;
		return c;
	}

	error solver::generate_data()
	{
		data.resize(size);
		auto err = nissy_gendata(name.c_str(),
		    size, reinterpret_cast<unsigned char *>(data.data()));
		return error{err};
	}

	void solver::read_data(std::ifstream& ifs)
	{
		data.resize(size);
		ifs.read(reinterpret_cast<char *>(data.data()), size);
	}

	error solver::check_data()
	{
		auto err_value = nissy_checkdata(name.c_str(), data.size(),
		    reinterpret_cast<const unsigned char *>(data.data()));
		error err{err_value};
		data_checked = err.ok();
		return err;
	}

	void solver::unload_data()
	{
		data.resize(0);
	}

	solver::solve_result
	solver::solve(const cube& cube, nissflag niss, unsigned minmoves,
	    unsigned maxmoves, unsigned maxsols, unsigned optimal,
	    unsigned threads, int (*poll_status)(void *),
	    void *poll_status_data) const
	{
		long long stats[size::SOLVE_STATS];
		solver::solve_result result;

		if (maxsols == 0) {
			result.solutions = "";
			result.err = error::OK;
			return result;
		}

		const size_t len = 3 * (maxmoves+1) * maxsols;
		result.solutions.resize(len);

		auto err = nissy_solve(cube.to_string().c_str(),
		    name.c_str(), niss.value, minmoves, maxmoves, maxsols,
		    optimal, threads, data.size(),
		    reinterpret_cast<const unsigned char *>(data.data()), len,
		    result.solutions.data(), stats,
		    poll_status, poll_status_data);

		int size = result.solutions.find_first_of('\0');
		result.solutions.resize(size);
		result.err = error{err};

		return result;
	}

	std::variant<solver, error> solver::get(const std::string& name)
	{
		char dataid[size::DATAID];
		auto err = nissy_solverinfo(name.c_str(), dataid);
		if (err < 0)
			return error{err};
		solver s(name);
		s.size = (unsigned)err;
		s.id = std::string{dataid};
		return s;
	}

	solver::solver(const std::string& str) : name{str} {}

	error count_moves(const std::string& moves)
	{
		auto err = nissy_countmoves(moves.c_str());
		return error{err};
	}

	std::variant<error, compare_result>
	compare_moves(const std::string& m1, const std::string& m2)
	{
		auto cmp = nissy_comparemoves(m1.c_str(), m2.c_str());
		if (cmp < 0)
			return error{cmp};
		else
			return compare_result{cmp};
	}

	void set_logger(void (*log)(const char *, void *), void *data)
	{
		nissy_setlogger(log, data);
	}
}
