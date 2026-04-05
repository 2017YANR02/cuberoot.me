#include <emscripten/bind.h>
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <algorithm>
#include <unordered_map>
#include <string>
#include <sstream>
#include <cstdlib>

EM_JS(void, update, (const char *str), {
	postMessage(UTF8ToString(str));
});

struct State
{
	std::vector<int> cp;
	std::vector<int> co;
	std::vector<int> center;

	State(std::vector<int> arg_cp = {0, 1, 2, 3, 4, 5, 6, 7}, std::vector<int> arg_co = {0, 0, 0, 0, 0, 0, 0, 0}, std::vector<int> arg_center = {0, 1, 2, 3, 4, 5}) : cp(arg_cp), co(arg_co), center(arg_center) {}

	State apply_move(State move)
	{
		std::vector<int> new_cp;
		std::vector<int> new_co;
		std::vector<int> new_center;
		for (int i = 0; i < 8; ++i)
		{
			int p = move.cp[i];
			new_cp.emplace_back(cp[p]);
			new_co.emplace_back((co[p] + move.co[i]) % 3);
		}
		for (int i = 0; i < 6; ++i)
		{
			int p = move.center[i];
			new_center.emplace_back(center[p]);
		}
		return State(new_cp, new_co, new_center);
	}

	State apply_move_corner(State move, int c)
	{
		std::vector<int> new_cp(8, -1);
		std::vector<int> new_co(8, -1);
		auto it = std::find(cp.begin(), cp.end(), c);
		int index = std::distance(cp.begin(), it);
		it = std::find(move.cp.begin(), move.cp.end(), c);
		int index_next = std::distance(move.cp.begin(), it);
		new_cp[index_next] = c;
		new_co[index_next] = (co[index] + move.co[index_next]) % 3;
		return State(new_cp, new_co, center);
	}
};

std::unordered_map<std::string, State> moves = {
	{"U", State({3, 0, 1, 2, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"U2", State({2, 3, 0, 1, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"U'", State({1, 2, 3, 0, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"D", State({0, 1, 2, 3, 5, 6, 7, 4}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"D2", State({0, 1, 2, 3, 6, 7, 4, 5}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"D'", State({0, 1, 2, 3, 7, 4, 5, 6}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"L", State({4, 1, 2, 0, 7, 5, 6, 3}, {2, 0, 0, 1, 1, 0, 0, 2}, {0, 1, 2, 3, 4, 5})},
	{"L2", State({7, 1, 2, 4, 3, 5, 6, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"L'", State({3, 1, 2, 7, 0, 5, 6, 4}, {2, 0, 0, 1, 1, 0, 0, 2}, {0, 1, 2, 3, 4, 5})},
	{"R", State({0, 2, 6, 3, 4, 1, 5, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 1, 2, 3, 4, 5})},
	{"R2", State({0, 6, 5, 3, 4, 2, 1, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"R'", State({0, 5, 1, 3, 4, 6, 2, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 1, 2, 3, 4, 5})},
	{"F", State({0, 1, 3, 7, 4, 5, 2, 6}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 2, 3, 4, 5})},
	{"F2", State({0, 1, 7, 6, 4, 5, 3, 2}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"F'", State({0, 1, 6, 2, 4, 5, 7, 3}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 2, 3, 4, 5})},
	{"B", State({1, 5, 2, 3, 0, 4, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"B2", State({5, 4, 2, 3, 1, 0, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"B'", State({4, 0, 2, 3, 5, 1, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"x", State({3, 2, 6, 7, 0, 1, 5, 4}, {2, 1, 2, 1, 1, 2, 1, 2}, {4, 5, 2, 3, 1, 0})},
	{"x2", State({7, 6, 5, 4, 3, 2, 1, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 5, 4})},
	{"x'", State({4, 5, 1, 0, 7, 6, 2, 3}, {2, 1, 2, 1, 1, 2, 1, 2}, {5, 4, 2, 3, 0, 1})},
	{"y", State({3, 0, 1, 2, 7, 4, 5, 6}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 4, 5, 3, 2})},
	{"y2", State({2, 3, 0, 1, 6, 7, 4, 5}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 5, 4})},
	{"y'", State({1, 2, 3, 0, 5, 6, 7, 4}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 5, 4, 2, 3})},
	{"z", State({4, 0, 3, 7, 5, 1, 2, 6}, {1, 2, 1, 2, 2, 1, 2, 1}, {2, 3, 1, 0, 4, 5})},
	{"z2", State({5, 4, 7, 6, 1, 0, 3, 2}, {0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 3, 2, 4, 5})},
	{"z'", State({1, 5, 6, 2, 0, 4, 7, 3}, {1, 2, 1, 2, 2, 1, 2, 1}, {3, 2, 0, 1, 4, 5})}};

std::vector<std::string> move_names = {"U", "U2", "U'", "D", "D2", "D'", "L", "L2", "L'", "R", "R2", "R'", "F", "F2", "F'", "B", "B2", "B'", "x", "x2", "x'", "y", "y2", "y'", "z", "z2", "z'"};

std::string AlgToString(std::vector<int> &alg)
{
	std::string result = "";
	for (int i : alg)
	{
		result += move_names[i] + " ";
	}
	return result;
}

std::vector<int> StringToAlg(std::string str)
{
	std::vector<int> alg;
	std::istringstream iss(str);
	std::string name;
	while (iss >> name)
	{
		if (!name.empty())
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			if (it != move_names.end())
			{
				alg.emplace_back(std::distance(move_names.begin(), it));
			}
		}
	}
	return alg;
}

std::vector<std::vector<int>> rotationMap =
	{
		{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
		{0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 24, 25, 26, 21, 22, 23, 20, 19, 18},
		{0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 20, 19, 18, 21, 22, 23, 26, 25, 24},
		{0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 26, 25, 24, 21, 22, 23, 18, 19, 20},
		{3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 20, 19, 18, 23, 22, 21, 24, 25, 26},
		{3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 26, 25, 24, 23, 22, 21, 20, 19, 18},
		{3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 18, 19, 20, 23, 22, 21, 26, 25, 24},
		{3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 24, 25, 26, 23, 22, 21, 18, 19, 20},
		{6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 21, 22, 23, 20, 19, 18, 24, 25, 26},
		{15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 21, 22, 23, 26, 25, 24, 20, 19, 18},
		{9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 21, 22, 23, 18, 19, 20, 26, 25, 24},
		{12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 21, 22, 23, 24, 25, 26, 18, 19, 20},
		{9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 23, 22, 21, 18, 19, 20, 24, 25, 26},
		{12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 23, 22, 21, 24, 25, 26, 20, 19, 18},
		{6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 23, 22, 21, 20, 19, 18, 26, 25, 24},
		{15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 23, 22, 21, 26, 25, 24, 18, 19, 20},
		{12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 18, 19, 20, 24, 25, 26, 23, 22, 21},
		{6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 24, 25, 26, 20, 19, 18, 23, 22, 21},
		{15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 20, 19, 18, 26, 25, 24, 23, 22, 21},
		{9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 26, 25, 24, 18, 19, 20, 23, 22, 21},
		{15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 18, 19, 20, 26, 25, 24, 21, 22, 23},
		{9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 24, 25, 26, 18, 19, 20, 21, 22, 23},
		{12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 20, 19, 18, 24, 25, 26, 21, 22, 23},
		{6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 26, 25, 24, 20, 19, 18, 21, 22, 23}};

std::vector<std::vector<int>> rotationMapReverse =
	{
		{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
		{0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 26, 25, 24, 21, 22, 23, 18, 19, 20},
		{0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 20, 19, 18, 21, 22, 23, 26, 25, 24},
		{0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 24, 25, 26, 21, 22, 23, 20, 19, 18},
		{3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 20, 19, 18, 23, 22, 21, 24, 25, 26},
		{3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 26, 25, 24, 23, 22, 21, 20, 19, 18},
		{3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 18, 19, 20, 23, 22, 21, 26, 25, 24},
		{3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 24, 25, 26, 23, 22, 21, 18, 19, 20},
		{9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 23, 22, 21, 18, 19, 20, 24, 25, 26},
		{9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 26, 25, 24, 18, 19, 20, 23, 22, 21},
		{9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 21, 22, 23, 18, 19, 20, 26, 25, 24},
		{9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 24, 25, 26, 18, 19, 20, 21, 22, 23},
		{6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 21, 22, 23, 20, 19, 18, 24, 25, 26},
		{6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 26, 25, 24, 20, 19, 18, 21, 22, 23},
		{6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 23, 22, 21, 20, 19, 18, 26, 25, 24},
		{6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 24, 25, 26, 20, 19, 18, 23, 22, 21},
		{15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 18, 19, 20, 26, 25, 24, 21, 22, 23},
		{15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 23, 22, 21, 26, 25, 24, 18, 19, 20},
		{15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 20, 19, 18, 26, 25, 24, 23, 22, 21},
		{15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 21, 22, 23, 26, 25, 24, 20, 19, 18},
		{12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 18, 19, 20, 24, 25, 26, 23, 22, 21},
		{12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 21, 22, 23, 24, 25, 26, 18, 19, 20},
		{12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 20, 19, 18, 24, 25, 26, 21, 22, 23},
		{12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 23, 22, 21, 24, 25, 26, 20, 19, 18}};

struct VectorHash
{
	std::size_t operator()(const std::vector<int> &vec) const
	{
		std::size_t hash = 0;
		for (int num : vec)
		{
			hash ^= std::hash<int>()(num) + 0x9e3779b9 + (hash << 6) + (hash >> 2);
		}
		return hash;
	}
};

struct VectorEqual
{
	bool operator()(const std::vector<int> &lhs, const std::vector<int> &rhs) const
	{
		return lhs == rhs;
	}
};

std::unordered_map<std::vector<int>, int, VectorHash, VectorEqual> center_to_index =
	{
		{{0, 1, 2, 3, 4, 5}, 0},
		{{0, 1, 4, 5, 3, 2}, 1},
		{{0, 1, 3, 2, 5, 4}, 2},
		{{0, 1, 5, 4, 2, 3}, 3},
		{{1, 0, 3, 2, 4, 5}, 4},
		{{1, 0, 4, 5, 2, 3}, 5},
		{{1, 0, 2, 3, 5, 4}, 6},
		{{1, 0, 5, 4, 3, 2}, 7},
		{{3, 2, 0, 1, 4, 5}, 8},
		{{3, 2, 4, 5, 1, 0}, 9},
		{{3, 2, 1, 0, 5, 4}, 10},
		{{3, 2, 5, 4, 0, 1}, 11},
		{{2, 3, 1, 0, 4, 5}, 12},
		{{2, 3, 4, 5, 0, 1}, 13},
		{{2, 3, 0, 1, 5, 4}, 14},
		{{2, 3, 5, 4, 1, 0}, 15},
		{{5, 4, 2, 3, 0, 1}, 16},
		{{5, 4, 0, 1, 3, 2}, 17},
		{{5, 4, 3, 2, 1, 0}, 18},
		{{5, 4, 1, 0, 2, 3}, 19},
		{{4, 5, 2, 3, 1, 0}, 20},
		{{4, 5, 1, 0, 3, 2}, 21},
		{{4, 5, 3, 2, 0, 1}, 22},
		{{4, 5, 0, 1, 2, 3}, 23}};

std::vector<std::vector<int>> index_to_center =
	{
		{0, 1, 2, 3, 4, 5},
		{0, 1, 4, 5, 3, 2},
		{0, 1, 3, 2, 5, 4},
		{0, 1, 5, 4, 2, 3},
		{1, 0, 3, 2, 4, 5},
		{1, 0, 4, 5, 2, 3},
		{1, 0, 2, 3, 5, 4},
		{1, 0, 5, 4, 3, 2},
		{3, 2, 0, 1, 4, 5},
		{3, 2, 4, 5, 1, 0},
		{3, 2, 1, 0, 5, 4},
		{3, 2, 5, 4, 0, 1},
		{2, 3, 1, 0, 4, 5},
		{2, 3, 4, 5, 0, 1},
		{2, 3, 0, 1, 5, 4},
		{2, 3, 5, 4, 1, 0},
		{5, 4, 2, 3, 0, 1},
		{5, 4, 0, 1, 3, 2},
		{5, 4, 3, 2, 1, 0},
		{5, 4, 1, 0, 2, 3},
		{4, 5, 2, 3, 1, 0},
		{4, 5, 1, 0, 3, 2},
		{4, 5, 3, 2, 0, 1},
		{4, 5, 0, 1, 2, 3}};

std::vector<int> AlgRotation(std::vector<int> &alg, std::vector<int> &rotation_alg, std::vector<std::vector<int>> &table)
{
	if (rotation_alg.empty())
	{
		return alg;
	}
	int l = alg.size();
	std::vector<int> ret(l, 0);
	int c = 0;
	for (int r : rotation_alg)
	{
		c = table[c][r];
	}
	for (int i = 0; i < l; ++i)
	{
		ret[i] = rotationMap[c][alg[i]];
	}
	return ret;
}

std::vector<std::vector<int>> c_array = {{0}, {1, 1, 1, 1, 1, 1, 1, 1, 1}, {1, 2, 4, 8, 16, 32}, {1, 3, 9, 27, 81, 243}};

std::vector<std::vector<int>> base_array = {{0}, {0}, {1, 12, 12 * 11, 12 * 11 * 10, 12 * 11 * 10 * 9}, {1, 8, 8 * 7, 8 * 7 * 6, 8 * 7 * 6 * 5, 8 * 7 * 6 * 5 * 4, 8 * 7 * 6 * 5 * 4 * 3, 8 * 7 * 6 * 5 * 4 * 3 * 2, 8 * 7 * 6 * 5 * 4 * 3 * 2}};

inline int array_to_index(std::vector<int> &a, int n, int c, int pn)
{
	int index_p = 0;
	int index_o = 0;
	int tmp;
	int tmp2 = 24 / pn;
	for (int i = 0; i < n; ++i)
	{
		index_o += (a[i] % c) * c_array[c][n - i - 1];
		a[i] /= c;
	}
	for (int i = 0; i < n; ++i)
	{
		tmp = 0;
		for (int j = 0; j < i; ++j)
		{
			if (a[j] < a[i])
			{
				tmp++;
			}
		}
		index_p += (a[i] - tmp) * base_array[tmp2][i];
	}
	return index_p * c_array[c][n] + index_o;
}

std::vector<int> sorted(8);

std::vector<std::vector<int>> base_array2 = {{0}, {0}, {12, 11, 10, 9, 8}, {8, 7, 6, 5, 4, 3, 2, 1}};

inline void index_to_array(std::vector<int> &p, int index, int n, int c, int pn)
{
	int tmp2 = 24 / pn;
	int p_index = index / c_array[c][n];
	int o_index = index % c_array[c][n];
	for (int i = 0; i < n; ++i)
	{
		p[i] = p_index % base_array2[tmp2][i];
		p_index /= base_array2[tmp2][i];
		std::sort(sorted.begin(), sorted.begin() + i);
		for (int j = 0; j < i; ++j)
		{
			if (sorted[j] <= p[i])
			{
				p[i] += 1;
			}
		}
		sorted[i] = p[i];
	}
	for (int i = 0; i < n; ++i)
	{
		p[n - i - 1] = 27 * (c * p[n - i - 1] + o_index % c);
		o_index /= c;
	}
}

std::vector<std::vector<int>> c_array2 = {{0}, {0}, {1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048}, {1, 3, 9, 27, 81, 243, 729, 2187}};

inline int o_to_index(std::vector<int> &o, int c, int pn)
{
	int o_index = 0;
	for (int i = 0; i < pn - 1; ++i)
	{
		o_index += o[i] * c_array2[c][pn - i - 2];
	}
	return o_index;
}

inline void index_to_o(std::vector<int> &o, int index, int c, int pn)
{
	int count = 0;
	for (int i = 0; i < pn - 1; ++i)
	{
		o[pn - i - 2] = index % c;
		count += o[pn - i - 2];
		index /= c;
	}
	o[pn - 1] = (c - count % c) % c;
}

std::vector<int> create_cp_move_table()
{
	std::vector<int> move_table(8 * 27, 0);
	for (int i = 0; i < 8; ++i)
	{
		std::vector<int> cp(8, -1);
		std::vector<int> co(8, -1);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		cp[i] = i;
		co[i] = 0;
		State state(cp, co, center);
		for (int j = 0; j < 27; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[j]], i);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i);
			move_table[27 * i + j] = std::distance(new_state.cp.begin(), it);
		}
	}
	return move_table;
}

std::vector<int> create_co_move_table()
{
	std::vector<int> move_table(2187 * 27, 0);
	for (int i = 0; i < 2187; ++i)
	{
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		index_to_o(co, i, 3, 8);
		State state(cp, co, center);
		for (int j = 0; j < 27; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[27 * i + j] = o_to_index(new_state.co, 3, 8);
		}
	}
	return move_table;
}

std::vector<std::vector<int>> create_center_move_table()
{
	std::vector<std::vector<int>> move_table(24, std::vector<int>(27, 0));
	for (int i = 0; i < 24; ++i)
	{
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		std::vector<int> center = index_to_center[i];
		State state(cp, co, center);
		for (int j = 0; j < 27; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[i][j] = center_to_index[new_state.center];
		}
	}
	return move_table;
}

std::vector<int> create_multi_move_table(int n, int c, int pn, int size, const std::vector<int> &table)
{
	std::vector<int> move_table(size * 27, -1);
	int tmp;
	int tmp_i;
	std::vector<int> a(n);
	std::vector<int> b(n);
	std::vector<int> inv_move = {2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15, 20, 19, 18, 23, 22, 21, 26, 25, 24};
	for (int i = 0; i < size; ++i)
	{
		index_to_array(a, i, n, c, pn);
		tmp_i = i * 27;
		for (int j = 0; j < 27; ++j)
		{
			if (move_table[tmp_i + j] == -1)
			{
				for (int k = 0; k < n; ++k)
				{
					b[k] = table[a[k] + j];
				}
				tmp = array_to_index(b, n, c, pn);
				move_table[tmp_i + j] = tmp;
				move_table[27 * tmp + inv_move[j]] = i;
			}
		}
	}
	return move_table;
}

void create_prune_table(const std::vector<int> &table1, const std::vector<int> &table2, std::vector<unsigned char> &prune_table, std::vector<int> &move_restrict, int prune_depth)
{
	int size = 88179840;
	int size2 = 2187;
	int next_i;
	int index1_tmp;
	int index2_tmp;
	int next_d;
	std::vector<std::string> af = {"", "F2 B2 ", "F' B ", "F B' ", "L R' ", "L' R"};
	std::vector<std::string> ad = {"U D'", "U2 D2", "U' D"};
	for (int i = 0; i < 6; ++i)
	{
		index1_tmp = 0;
		index2_tmp = 0;
		std::string tmp_scr = af[i];
		std::vector<int> tmp_alg = StringToAlg(tmp_scr);
		for (int k : tmp_alg)
		{
			index1_tmp = table1[index1_tmp * 27 + k];
			index2_tmp = table2[index2_tmp * 27 + k];
		}
		prune_table[index1_tmp * size2 + index2_tmp] = 0;
		for (int j = 0; j < 3; ++j)
		{
			tmp_scr = ad[j];
			tmp_alg = StringToAlg(tmp_scr);
			int index1_tmp2 = index1_tmp;
			int index2_tmp2 = index2_tmp;
			for (int k : tmp_alg)
			{
				index1_tmp2 = table1[index1_tmp2 * 27 + k];
				index2_tmp2 = table2[index2_tmp2 * 27 + k];
			}
			prune_table[index1_tmp2 * size2 + index2_tmp2] = 0;
		}
	}
	int num = 24;
	int num_old = 24;
	for (int d = 0; d < prune_depth; ++d)
	{
		next_d = d + 1;
		for (int i = 0; i < size; ++i)
		{
			if (prune_table[i] == d)
			{
				index1_tmp = (i / size2) * 27;
				index2_tmp = (i % size2) * 27;
				for (int j : move_restrict)
				{
					next_i = table1[index1_tmp + j] * size2 + table2[index2_tmp + j];
					if (prune_table[next_i] == 255)
					{
						prune_table[next_i] = next_d;
						num += 1;
					}
				}
			}
		}
		if (num == num_old)
		{
			break;
		}
	}
}

struct search
{
	std::vector<int> sol;
	std::string scramble;
	std::string rotation;
	int max_length;
	int sol_num;
	int count;
	std::vector<std::vector<int>> center_move_table;
	std::vector<int> single_cp_move_table;
	std::vector<int> cp_move_table;
	std::vector<int> co_move_table;
	std::vector<unsigned char> prune_table;
	std::vector<int> alg;
	std::vector<std::string> restrict;
	std::vector<int> move_restrict;
	std::vector<bool> ma2;
	std::vector<int> mc;
	std::vector<int> mc_tmp;
	int index1;
	int index2;
	int index1_tmp;
	int index2_tmp;
	int prune_tmp;
	std::string tmp;
	std::string post_moves;

	search()
	{
		center_move_table = create_center_move_table();
		prune_table = std::vector<unsigned char>(88179840, 255);
		single_cp_move_table = create_cp_move_table();
		cp_move_table = create_multi_move_table(8, 1, 8, 40320, single_cp_move_table);
		co_move_table = create_co_move_table();
	}

	bool depth_limited_search(int arg_index1, int arg_index2, int depth, int aprev)
	{
		for (int i : move_restrict)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			index1_tmp = cp_move_table[arg_index1 + i];
			index2_tmp = co_move_table[arg_index2 + i];
			prune_tmp = prune_table[index1_tmp * 2187 + index2_tmp];
			if (prune_tmp != 255 && prune_tmp >= depth)
			{
				continue;
			}
			sol.emplace_back(i);
			mc_tmp[i] += 1;
			if (depth == 1)
			{
				if (prune_tmp == 0)
				{
					bool valid = true;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					for (int j : sol)
					{
						if (index1_tmp2 == cp_move_table[index1_tmp2 + j] * 27 && index2_tmp2 == co_move_table[index2_tmp2 + j] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = cp_move_table[index1_tmp2 + j];
							index2_tmp2 = co_move_table[index2_tmp2 + j];
							if (c < l && prune_table[index1_tmp2 * 2187 + index2_tmp2] == 0)
							{
								valid = false;
								break;
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
						}
					}
					if (valid)
					{
						count += 1;
						if (rotation == "")
						{
							tmp = post_moves + AlgToString(sol);
						}
						else
						{
							tmp = rotation + " " + post_moves + AlgToString(sol);
						}
						update(tmp.c_str());
						if (count == sol_num)
						{
							return true;
						}
					}
				}
			}
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, depth - 1, i * 27))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		return false;
	}

	void start_search(std::string arg_scramble = "", std::string arg_rotation = "", int arg_sol_num = 100, int arg_max_length = 12, std::vector<std::string> arg_restrict = move_names, int prune_depth = 8, std::string arg_post_alg = "", const std::vector<bool> &arg_ma2 = std::vector<bool>(27 * 27, false), const std::vector<int> &arg_mc = std::vector<int>(27, 20))
	{
		scramble = arg_scramble;
		rotation = arg_rotation;
		max_length = arg_max_length;
		sol_num = arg_sol_num;
		restrict = arg_restrict;
		ma2 = arg_ma2;
		mc = arg_mc;
		mc_tmp = std::vector<int>(27, 0);
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		std::vector<int> scramble_alg = StringToAlg(scramble);
		std::vector<int> rotation_alg = StringToAlg(rotation);
		std::vector<int> alg = AlgRotation(scramble_alg, rotation_alg, center_move_table);
		std::vector<int> post_alg = StringToAlg(arg_post_alg);
		post_moves = AlgToString(post_alg);
		std::vector<int> move_restrict_tmp = move_restrict;
		int tc = 0;
		for (int i : post_alg)
		{
			tc = center_move_table[tc][i];
		}
		for (int i = 0; i < move_restrict_tmp.size(); ++i)
		{
			move_restrict_tmp[i] = rotationMapReverse[tc][move_restrict_tmp[i]];
		}
		create_prune_table(cp_move_table, co_move_table, prune_table, move_restrict_tmp, prune_depth);
		index1 = 0;
		index2 = 0;
		count = 0;
		int aprev_tmp = 27;
		for (int m : alg)
		{
			index1 = cp_move_table[index1 * 27 + m];
			index2 = co_move_table[index2 * 27 + m];
		}
		for (int m : post_alg)
		{
			aprev_tmp = m;
			index1 = cp_move_table[index1 * 27 + m];
			index2 = co_move_table[index2 * 27 + m];
		}
		auto it = std::find(move_restrict.begin(), move_restrict.end(), aprev_tmp);
		if (it == move_restrict.end())
		{
			aprev_tmp = 27;
		}
		prune_tmp = prune_table[index1 * 2187 + index2];
		if (prune_tmp == 0)
		{
			update("Already solved.");
		}
		else
		{
			index1 *= 27;
			index2 *= 27;
			for (int d = 1; d <= max_length; d++)
			{
				tmp = "depth=" + std::to_string(d);
				update(tmp.c_str());
				if (depth_limited_search(index1, index2, d, aprev_tmp * 27))
				{
					break;
				}
			}
			update("Search finished.");
		}
	}
};

void buidMoveRestrict(const std::string &restID, std::vector<std::string> &move_restrict)
{
	std::stringstream ss(restID);
	std::string move;

	while (std::getline(ss, move, '_'))
	{
		if (!move.empty())
		{
			size_t pos = move.find('-');
			if (pos != std::string::npos)
			{
				move.replace(pos, 1, "'");
			}
			move_restrict.push_back(move);
		}
	}
}

static std::string get_move_base(const std::string &move)
{
	if (move.empty())
		return "";
	return move.substr(0, 1);
}

static bool should_be_checked_by_default(const std::string &prev_move, const std::string &next_move)
{
	if (prev_move.empty())
		return false;
	const static std::map<std::string, int> y_axis_order = {{"U", 0}, {"D", 1}, {"y", 2}};
	const static std::map<std::string, int> x_axis_order = {{"L", 0}, {"R", 1}, {"x", 2}};
	const static std::map<std::string, int> z_axis_order = {{"F", 0}, {"B", 1}, {"z", 2}};
	const static std::map<std::string, const std::map<std::string, int> *> base_to_axis_map = {
		{"U", &y_axis_order}, {"D", &y_axis_order}, {"y", &y_axis_order}, {"L", &x_axis_order}, {"R", &x_axis_order}, {"x", &x_axis_order}, {"F", &z_axis_order}, {"B", &z_axis_order}, {"z", &z_axis_order}};
	std::string prev_base = get_move_base(prev_move);
	std::string next_base = get_move_base(next_move);
	if (prev_base == next_base)
		return true;
	auto it_prev = base_to_axis_map.find(prev_base);
	auto it_next = base_to_axis_map.find(next_base);
	if (it_prev != base_to_axis_map.end() && it_next != base_to_axis_map.end() && it_prev->second == it_next->second)
	{
		const auto &axis_map = *it_prev->second;
		if (axis_map.at(prev_base) > axis_map.at(next_base))
		{
			return true;
		}
	}
	return false;
}

void buidMA2(const std::string &restID, const std::string &mavString, std::vector<bool> &vector)
{
	const static std::map<std::string, int> move_to_index_map = []
	{
		std::map<std::string, int> m;
		for (int i = 0; i < move_names.size(); ++i)
		{
			m[move_names[i]] = i;
		}
		return m;
	}();

	std::vector<std::string> active_moves;
	buidMoveRestrict(restID, active_moves);

	const int NUM_COLS = 27;
	const int NUM_ROWS = 28;
	vector = std::vector<bool>(NUM_ROWS * NUM_COLS, false);

	std::vector<std::string> row_headers = active_moves;
	row_headers.push_back("");
	for (const auto &row_move : row_headers)
	{
		for (const auto &col_move : active_moves)
		{
			if (should_be_checked_by_default(row_move, col_move))
			{
				auto it_row = row_move.empty() ? move_to_index_map.end() : move_to_index_map.find(row_move);
				auto it_col = move_to_index_map.find(col_move);

				if (it_col != move_to_index_map.end())
				{
					int row_index = row_move.empty() ? 27 : it_row->second;
					vector[row_index * NUM_COLS + it_col->second] = true;
				}
			}
		}
	}

	auto sanitize = [](std::string s) -> std::string
	{
		if (s == "EMPTY")
			return "";
		size_t pos = s.find('-');
		if (pos != std::string::npos)
		{
			s.replace(pos, 1, "'");
		}
		return s;
	};

	std::stringstream ss_mav(mavString);
	std::string override_part;
	while (std::getline(ss_mav, override_part, '|'))
	{
		size_t delim_pos = override_part.find('~');
		if (delim_pos == std::string::npos)
			continue;

		std::string row_str = sanitize(override_part.substr(0, delim_pos));
		std::string col_str = sanitize(override_part.substr(delim_pos + 1));

		auto it_row = row_str.empty() ? move_to_index_map.end() : move_to_index_map.find(row_str);
		auto it_col = move_to_index_map.find(col_str);

		if (it_col != move_to_index_map.end())
		{
			int row_index = row_str.empty() ? 27 : it_row->second;
			int vector_index = row_index * NUM_COLS + it_col->second;
			if (vector_index >= 0 && vector_index < vector.size())
			{
				vector[vector_index] = !vector[vector_index];
			}
		}
	}
}

void buildMoveCountVector(const std::string &restID, const std::string &moveCountString, std::vector<int> &move_count_vector)
{
	static const std::map<std::string, int> move_to_index_map = []
	{
		std::map<std::string, int> m;
		for (int i = 0; i < move_names.size(); ++i)
		{
			m[move_names[i]] = i;
		}
		return m;
	}();

	move_count_vector.assign(move_names.size(), 0);

	std::stringstream rest_ss(restID);
	std::string rest_move;
	while (std::getline(rest_ss, rest_move, '_'))
	{
		if (rest_move.empty())
			continue;

		size_t pos = rest_move.find('-');
		if (pos != std::string::npos)
		{
			rest_move.replace(pos, 1, "'");
		}

		auto it = move_to_index_map.find(rest_move);
		if (it != move_to_index_map.end())
		{
			move_count_vector[it->second] = 20;
		}
	}

	std::stringstream count_ss(moveCountString);
	std::string count_part;
	while (std::getline(count_ss, count_part, '_'))
	{
		size_t delim_pos = count_part.find(':');
		if (delim_pos == std::string::npos)
			continue;

		std::string move_str = count_part.substr(0, delim_pos);
		std::string value_str = count_part.substr(delim_pos + 1);

		size_t pos = move_str.find('-');
		if (pos != std::string::npos)
		{
			move_str.replace(pos, 1, "'");
		}

		auto it = move_to_index_map.find(move_str);
		if (it != move_to_index_map.end())
		{
			try
			{
				move_count_vector[it->second] = std::stoi(value_str);
			}
			catch (const std::invalid_argument &e)
			{
			}
		}
	}
}

void solve(std::string scramble, std::string rotation, int num, int len, int prune, std::string move_restrict_string, std::string post_alg, std::string ma2_string, std::string mcString)
{
	std::vector<bool> ma2;
	std::vector<int> mc;
	std::vector<std::string> move_restrict;
	buidMoveRestrict(move_restrict_string, move_restrict);
	buidMA2(move_restrict_string, ma2_string, ma2);
	buildMoveCountVector(move_restrict_string, mcString, mc);
	search cs;
	cs.start_search(scramble, rotation, num, len, move_restrict, prune, post_alg, ma2, mc);
}

EMSCRIPTEN_BINDINGS(my_module)
{
	emscripten::function("solve", &solve);
}
