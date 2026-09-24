/* A simple example showing how to move a cube and print it in H48 format. */

#include "../nissy.h"
#include <iostream>

int main() {
	nissy::cube c;
	if (!c.move("R' U' F").ok()) {
		std::cout << "Error moving the cube!" << std::endl;
		return 1;
	}

	auto str = c.to_string();
	std::cout << "Cube after R' U' F:" << std::endl << str << std::endl;

	return 0;
}
