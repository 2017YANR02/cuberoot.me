/* A simple example showing how to move a cube and print it in H48 format. */

#include "../nissy.h"
#include <iostream>

int main() {
	std::string moves = "R U' Bw2 M D' x' F B(E2 F D B' Lw2 U2 U' S2 B)";
	auto v = std::get<nissy::variation>(nissy::variation::get("lastqt"));
	auto variations = v.find_variations(moves).solutions;

	std::cout << "Changing the last quarter turn of " << moves << " gives:"
	    << std::endl << variations;

	return 0;
}
