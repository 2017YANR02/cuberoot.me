/* Simple demo for an H48 solver */

#include "../nissy.h"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

int main() {
	// Get verbose output
	nissy::set_logger([](const char* s, void *u) { std::cout << s; }, NULL);

	// Get the scramble from the user
	std::cout << "Enter scramble: ";
	std::string scramble;
	std::getline(std::cin, scramble);

	// Apply scramble to a solved cube
	nissy::cube c;
	if (!c.move(scramble).ok()) {
		std::cout << "Invalid scramble!" << std::endl;
		return 1;
	}

	// Ask for a limit on the solution's length
	int maxmoves;
	std::cout << "Maximum number of moves: ";
	std::cin >> maxmoves;

	// Load the solver
	auto h48h3 = std::get<nissy::solver>(nissy::solver::get("h48h3"));
	std::filesystem::path tableDir("tables");
	std::filesystem::create_directories(tableDir); // Ignored if dir exists
	std::filesystem::path tableFile("tables/" + h48h3.id);

	// If the table is not present, generate it
	if (!std::filesystem::exists(tableFile)) {
		std::cout << "Data for h48h3 solver was not found, "
		    << "generating it..." << std::endl;
		auto err = h48h3.generate_data();
		if (!err.ok()) {
			std::cout << "Unexpected error! Error code: "
			    << err.value << std::endl;
			return 1;
		}
		std::ofstream ofs(tableFile, std::ios::binary);
		ofs.write(reinterpret_cast<char *>(h48h3.data.data()),
		    h48h3.size);
		std::cout << "Table generated and written to "
		    << tableFile << std::endl;
		ofs.close();
	}
	// Otherwise read it from file
	else {
		std::cout << "Loading data table from file" << std::endl;
		std::ifstream ifs(tableFile, std::ios::binary);
		h48h3.read_data(ifs);
		ifs.close();
		std::cout << "Data loaded, checking table..." << std::endl;
		auto err = h48h3.check_data();
		if (!err.ok()) {
			std::cout << "Error reading data table from file! "
			    << "Error code: " << err.value << std::endl;
			return 1;
		}
		std::cout << "Data table loaded" << std::endl;
	}

	// Solve
	auto solve_result = h48h3.solve(c, nissy::nissflag::NORMAL,
	    0, maxmoves, 1, 20, 8, NULL, NULL);

	// Write the result
	if (!solve_result.err.ok()) {
		std::cout << "Error solving! Error code: " <<
		    solve_result.err.value << std::endl;
		return 1;
	}

	if (solve_result.solutions.size() == 0) {
		std::cout << "No solution found!" << std::endl;
	} else {
		auto len = nissy::count_moves(solve_result.solutions).value;
		std::cout << "Solution (" << len << " moves): "
		    << solve_result.solutions << std::endl;
	}

	return 0;
}
