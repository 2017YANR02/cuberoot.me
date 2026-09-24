/*
C++20 header file for nissy.
*/

#ifndef NISSY_H
#define NISSY_H

#include <array>
#include <functional>
#include <optional>
#include <ranges>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace nissy {

	class nissflag {
	public:
		unsigned value;

		static const nissflag NORMAL;
		static const nissflag INVERSE;
		static const nissflag MIXED;
		static const nissflag LINEAR;
		static const nissflag ALL;
	};

	class error {
	public:
		long long value;
		bool ok() const;

		static const error OK;
		static const error UNSOLVABLE_WARNING;
		static const error UNSOLVABLE_ERROR;
		static const error INVALID_CUBE;
		static const error INVALID_MOVES;
		static const error INVALID_TRANS;
		static const error INVALID_SOLVER;
		static const error INVALID_VARIATION;
		static const error NULL_POINTER;
		static const error BUFFER_SIZE;
		static const error DATA;
		static const error OPTIONS;
		static const error UNKNOWN;
	};

	class status {
	public:
		int value;

		static const status RUN;
		static const status STOP;
		static const status PAUSE;
	};

	class compare_result {
	public:
		long long value;

		static const compare_result EQUAL;
		static const compare_result DIFFERENT;
	};

	class variation {
	public:
		struct variations_result {
			error err;
			std::string solutions;
		};

		const std::string name;

		variations_result find_variations(const std::string&);
		static std::variant<variation, error> get(const std::string&);
	private:
		variation(const std::string&);
	};

	class cube {
	public:
		cube();
		error move(const std::string&);
		error transform(const std::string&);
		void invert();
		std::string to_string() const;

		static std::variant<cube, error> from_string(
		    const std::string&);
		static std::variant<cube, error> get(long long ep,
		    long long eo, long long cp, long long co, long long orien);
		static std::variant<cube, error> get(long long ep,
		    long long eo, long long cp, long long co, long long orien,
		    const std::string& options);

	private:
		std::string m_str{"ABCDEFGH=ABCDEFGHIJKL=A"};
	};

	class solver {
	public:
		struct solve_result {
			error err;
			std::string solutions;
		};

		const std::string name;
		size_t size;
		std::string id;
		std::vector<std::byte> data;
		bool data_checked{false};

		error generate_data();
		void read_data(std::ifstream&);
		error check_data();
		void unload_data();
		solve_result solve(const cube&, nissflag, unsigned minmoves,
		    unsigned maxmoves, unsigned maxsols, unsigned optimal,
		    unsigned threads, int (*poll_status)(void *),
		    void *poll_status_data) const;

		static std::variant<solver, error> get(const std::string&);
	private:
		solver(const std::string& name);
	};

	error count_moves(const std::string&);
	std::variant<error, compare_result> compare_moves(
	    const std::string&, const std::string&);
	void set_logger(void (*)(const char *, void *), void *);
}

#endif
