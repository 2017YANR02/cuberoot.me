#include <emscripten/bind.h>
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <algorithm>
#include <unordered_map>
#include <string>
#include <sstream>
#include <bitset>

EM_JS(void, update, (const char *str), {
	postMessage(UTF8ToString(str));
});

struct State
{
	std::vector<int> cp;
	std::vector<int> co;
	std::vector<int> ep;
	std::vector<int> eo;
	std::vector<int> center;

	State(std::vector<int> arg_cp = {0, 1, 2, 3, 4, 5, 6, 7}, std::vector<int> arg_co = {0, 0, 0, 0, 0, 0, 0, 0}, std::vector<int> arg_ep = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, std::vector<int> arg_eo = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, std::vector<int> arg_center = {0, 1, 2, 3, 4, 5}) : cp(arg_cp), co(arg_co), ep(arg_ep), eo(arg_eo), center(arg_center) {}

	State apply_move(State move)
	{
		std::vector<int> new_cp;
		std::vector<int> new_co;
		std::vector<int> new_ep;
		std::vector<int> new_eo;
		std::vector<int> new_center;
		for (int i = 0; i < 8; ++i)
		{
			int p = move.cp[i];
			new_cp.emplace_back(cp[p]);
			new_co.emplace_back((co[p] + move.co[i]) % 3);
		}
		for (int i = 0; i < 12; ++i)
		{
			int p = move.ep[i];
			new_ep.emplace_back(ep[p]);
			new_eo.emplace_back((eo[p] + move.eo[i]) % 2);
		}
		for (int i = 0; i < 6; ++i)
		{
			int p = move.center[i];
			new_center.emplace_back(center[p]);
		}
		return State(new_cp, new_co, new_ep, new_eo, new_center);
	}

	State apply_move_edge(State move, int e)
	{
		std::vector<int> new_ep(12, -1);
		std::vector<int> new_eo(12, -1);
		auto it = std::find(ep.begin(), ep.end(), e);
		int index = std::distance(ep.begin(), it);
		it = std::find(move.ep.begin(), move.ep.end(), e);
		int index_next = std::distance(move.ep.begin(), it);
		new_ep[index_next] = e;
		new_eo[index_next] = (eo[index] + move.eo[index_next]) % 2;
		return State(cp, co, new_ep, new_eo, center);
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
		return State(new_cp, new_co, ep, eo, center);
	}
};

std::unordered_map<std::string, State> moves = {
	{"U", State({3, 0, 1, 2, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"U2", State({2, 3, 0, 1, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 6, 7, 4, 5, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"U'", State({1, 2, 3, 0, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"D", State({0, 1, 2, 3, 5, 6, 7, 4}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"D2", State({0, 1, 2, 3, 6, 7, 4, 5}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"D'", State({0, 1, 2, 3, 7, 4, 5, 6}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"L", State({4, 1, 2, 0, 7, 5, 6, 3}, {2, 0, 0, 1, 1, 0, 0, 2}, {11, 1, 2, 7, 4, 5, 6, 0, 8, 9, 10, 3}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"L2", State({7, 1, 2, 4, 3, 5, 6, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {3, 1, 2, 0, 4, 5, 6, 11, 8, 9, 10, 7}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"L'", State({3, 1, 2, 7, 0, 5, 6, 4}, {2, 0, 0, 1, 1, 0, 0, 2}, {7, 1, 2, 11, 4, 5, 6, 3, 8, 9, 10, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"R", State({0, 2, 6, 3, 4, 1, 5, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 5, 9, 3, 4, 2, 6, 7, 8, 1, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"R2", State({0, 6, 5, 3, 4, 2, 1, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 2, 1, 3, 4, 9, 6, 7, 8, 5, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"R'", State({0, 5, 1, 3, 4, 6, 2, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 9, 5, 3, 4, 1, 6, 7, 8, 2, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"F", State({0, 1, 3, 7, 4, 5, 2, 6}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 6, 10, 4, 5, 3, 7, 8, 9, 2, 11}, {0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0}, {0, 1, 2, 3, 4, 5})},
	{"F2", State({0, 1, 7, 6, 4, 5, 3, 2}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 4, 5, 10, 7, 8, 9, 6, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"F'", State({0, 1, 6, 2, 4, 5, 7, 3}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 10, 6, 4, 5, 2, 7, 8, 9, 3, 11}, {0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0}, {0, 1, 2, 3, 4, 5})},
	{"B", State({1, 5, 2, 3, 0, 4, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {4, 8, 2, 3, 1, 5, 6, 7, 0, 9, 10, 11}, {1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"B2", State({5, 4, 2, 3, 1, 0, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 8, 5, 6, 7, 4, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"B'", State({4, 0, 2, 3, 5, 1, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {8, 4, 2, 3, 0, 5, 6, 7, 1, 9, 10, 11}, {1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0}, {0, 1, 2, 3, 4, 5})},
	{"u", State({0, 1, 2, 3, 5, 6, 7, 4}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 4, 5, 3, 2})},
	{"u2", State({0, 1, 2, 3, 6, 7, 4, 5}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 5, 4})},
	{"u'", State({0, 1, 2, 3, 7, 4, 5, 6}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 5, 4, 2, 3})},
	{"d", State({3, 0, 1, 2, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 5, 4, 2, 3})},
	{"d2", State({2, 3, 0, 1, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 6, 7, 4, 5, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 5, 4})},
	{"d'", State({1, 2, 3, 0, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 4, 5, 3, 2})},
	{"l", State({0, 2, 6, 3, 4, 1, 5, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 5, 9, 3, 4, 2, 6, 7, 8, 1, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {5, 4, 2, 3, 0, 1})},
	{"l2", State({0, 6, 5, 3, 4, 2, 1, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 2, 1, 3, 4, 9, 6, 7, 8, 5, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 5, 4})},
	{"l'", State({0, 5, 1, 3, 4, 6, 2, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 9, 5, 3, 4, 1, 6, 7, 8, 2, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {4, 5, 2, 3, 1, 0})},
	{"r", State({4, 1, 2, 0, 7, 5, 6, 3}, {2, 0, 0, 1, 1, 0, 0, 2}, {11, 1, 2, 7, 4, 5, 6, 0, 8, 9, 10, 3}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {4, 5, 2, 3, 1, 0})},
	{"r2", State({7, 1, 2, 4, 3, 5, 6, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {3, 1, 2, 0, 4, 5, 6, 11, 8, 9, 10, 7}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 5, 4})},
	{"r'", State({3, 1, 2, 7, 0, 5, 6, 4}, {2, 0, 0, 1, 1, 0, 0, 2}, {7, 1, 2, 11, 4, 5, 6, 3, 8, 9, 10, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {5, 4, 2, 3, 0, 1})},
	{"f", State({1, 5, 2, 3, 0, 4, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {4, 8, 2, 3, 1, 5, 6, 7, 0, 9, 10, 11}, {1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0}, {2, 3, 1, 0, 4, 5})},
	{"f2", State({5, 4, 2, 3, 1, 0, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 8, 5, 6, 7, 4, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 3, 2, 4, 5})},
	{"f'", State({4, 0, 2, 3, 5, 1, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {8, 4, 2, 3, 0, 5, 6, 7, 1, 9, 10, 11}, {1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0}, {3, 2, 0, 1, 4, 5})},
	{"b", State({0, 1, 3, 7, 4, 5, 2, 6}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 6, 10, 4, 5, 3, 7, 8, 9, 2, 11}, {0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0}, {3, 2, 0, 1, 4, 5})},
	{"b2", State({0, 1, 7, 6, 4, 5, 3, 2}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 4, 5, 10, 7, 8, 9, 6, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 3, 2, 4, 5})},
	{"b'", State({0, 1, 6, 2, 4, 5, 7, 3}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 10, 6, 4, 5, 2, 7, 8, 9, 3, 11}, {0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0}, {2, 3, 1, 0, 4, 5})},
	{"M", State({3, 2, 6, 7, 0, 1, 5, 4}, {2, 1, 2, 1, 1, 2, 1, 2}, {7, 5, 9, 11, 4, 2, 6, 3, 8, 1, 10, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {5, 4, 2, 3, 0, 1})},
	{"M2", State({7, 6, 5, 4, 3, 2, 1, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {3, 2, 1, 0, 4, 9, 6, 11, 8, 5, 10, 7}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 5, 4})},
	{"M'", State({4, 5, 1, 0, 7, 6, 2, 3}, {2, 1, 2, 1, 1, 2, 1, 2}, {11, 9, 5, 7, 4, 1, 6, 0, 8, 2, 10, 3}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {4, 5, 2, 3, 1, 0})},
	{"E", State({3, 0, 1, 2, 7, 4, 5, 6}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 7, 4, 5, 6, 11, 8, 9, 10}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 5, 4, 2, 3})},
	{"E2", State({2, 3, 0, 1, 6, 7, 4, 5}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 6, 7, 4, 5, 10, 11, 8, 9}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 5, 4})},
	{"E'", State({1, 2, 3, 0, 5, 6, 7, 4}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 5, 6, 7, 4, 9, 10, 11, 8}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 4, 5, 3, 2})},
	{"S", State({1, 5, 6, 2, 0, 4, 7, 3}, {1, 2, 1, 2, 2, 1, 2, 1}, {4, 8, 10, 6, 1, 5, 2, 7, 0, 9, 3, 11}, {1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0}, {2, 3, 1, 0, 4, 5})},
	{"S2", State({5, 4, 7, 6, 1, 0, 3, 2}, {0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 3, 2, 8, 5, 10, 7, 4, 9, 6, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 3, 2, 4, 5})},
	{"S'", State({4, 0, 3, 7, 5, 1, 2, 6}, {1, 2, 1, 2, 2, 1, 2, 1}, {8, 4, 6, 10, 0, 5, 3, 7, 1, 9, 2, 11}, {1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0}, {3, 2, 0, 1, 4, 5})},
	{"x", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {4, 5, 2, 3, 1, 0})},
	{"x2", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 5, 4})},
	{"x'", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {5, 4, 2, 3, 0, 1})},
	{"y", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 4, 5, 3, 2})},
	{"y2", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 5, 4})},
	{"y'", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 5, 4, 2, 3})},
	{"z", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {2, 3, 1, 0, 4, 5})},
	{"z2", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 3, 2, 4, 5})},
	{"z'", State({0, 1, 2, 3, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {3, 2, 0, 1, 4, 5})}};

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

std::vector<std::string> move_names = {"U", "U2", "U'", "D", "D2", "D'", "L", "L2", "L'", "R", "R2", "R'", "F", "F2", "F'", "B", "B2", "B'", "u", "u2", "u'", "d", "d2", "d'", "l", "l2", "l'", "r", "r2", "r'", "f", "f2", "f'", "b", "b2", "b'", "M", "M2", "M'", "E", "E2", "E'", "S", "S2", "S'", "x", "x2", "x'", "y", "y2", "y'", "z", "z2", "z'"};

std::vector<std::string> rotation_names = {"x", "x2", "x'", "y", "y2", "y'", "z", "z2", "z'"};

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
		{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53},
		{0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 18, 19, 20, 21, 22, 23, 33, 34, 35, 30, 31, 32, 24, 25, 26, 27, 28, 29, 44, 43, 42, 39, 40, 41, 36, 37, 38, 51, 52, 53, 48, 49, 50, 47, 46, 45},
		{0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 18, 19, 20, 21, 22, 23, 27, 28, 29, 24, 25, 26, 33, 34, 35, 30, 31, 32, 38, 37, 36, 39, 40, 41, 44, 43, 42, 47, 46, 45, 48, 49, 50, 53, 52, 51},
		{0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 27, 28, 29, 24, 25, 26, 42, 43, 44, 39, 40, 41, 38, 37, 36, 53, 52, 51, 48, 49, 50, 45, 46, 47},
		{3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 21, 22, 23, 18, 19, 20, 27, 28, 29, 24, 25, 26, 30, 31, 32, 33, 34, 35, 38, 37, 36, 41, 40, 39, 42, 43, 44, 47, 46, 45, 50, 49, 48, 51, 52, 53},
		{3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 21, 22, 23, 18, 19, 20, 30, 31, 32, 33, 34, 35, 24, 25, 26, 27, 28, 29, 42, 43, 44, 41, 40, 39, 36, 37, 38, 53, 52, 51, 50, 49, 48, 47, 46, 45},
		{3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 21, 22, 23, 18, 19, 20, 24, 25, 26, 27, 28, 29, 33, 34, 35, 30, 31, 32, 36, 37, 38, 41, 40, 39, 44, 43, 42, 45, 46, 47, 50, 49, 48, 53, 52, 51},
		{3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 21, 22, 23, 18, 19, 20, 33, 34, 35, 30, 31, 32, 27, 28, 29, 24, 25, 26, 44, 43, 42, 41, 40, 39, 38, 37, 36, 51, 52, 53, 50, 49, 48, 45, 46, 47},
		{6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 24, 25, 26, 27, 28, 29, 21, 22, 23, 18, 19, 20, 30, 31, 32, 33, 34, 35, 39, 40, 41, 38, 37, 36, 42, 43, 44, 48, 49, 50, 47, 46, 45, 51, 52, 53},
		{15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 33, 34, 35, 30, 31, 32, 21, 22, 23, 18, 19, 20, 24, 25, 26, 27, 28, 29, 39, 40, 41, 42, 43, 44, 36, 37, 38, 48, 49, 50, 53, 52, 51, 47, 46, 45},
		{9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 27, 28, 29, 24, 25, 26, 21, 22, 23, 18, 19, 20, 33, 34, 35, 30, 31, 32, 39, 40, 41, 36, 37, 38, 44, 43, 42, 48, 49, 50, 45, 46, 47, 53, 52, 51},
		{12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 30, 31, 32, 33, 34, 35, 21, 22, 23, 18, 19, 20, 27, 28, 29, 24, 25, 26, 39, 40, 41, 44, 43, 42, 38, 37, 36, 48, 49, 50, 51, 52, 53, 45, 46, 47},
		{9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 27, 28, 29, 24, 25, 26, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 41, 40, 39, 36, 37, 38, 42, 43, 44, 50, 49, 48, 45, 46, 47, 51, 52, 53},
		{12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 30, 31, 32, 33, 34, 35, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 41, 40, 39, 44, 43, 42, 36, 37, 38, 50, 49, 48, 51, 52, 53, 47, 46, 45},
		{6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 24, 25, 26, 27, 28, 29, 18, 19, 20, 21, 22, 23, 33, 34, 35, 30, 31, 32, 41, 40, 39, 38, 37, 36, 44, 43, 42, 50, 49, 48, 47, 46, 45, 53, 52, 51},
		{15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 33, 34, 35, 30, 31, 32, 18, 19, 20, 21, 22, 23, 27, 28, 29, 24, 25, 26, 41, 40, 39, 42, 43, 44, 38, 37, 36, 50, 49, 48, 53, 52, 51, 45, 46, 47},
		{12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 30, 31, 32, 33, 34, 35, 24, 25, 26, 27, 28, 29, 21, 22, 23, 18, 19, 20, 36, 37, 38, 44, 43, 42, 39, 40, 41, 45, 46, 47, 51, 52, 53, 50, 49, 48},
		{6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 24, 25, 26, 27, 28, 29, 33, 34, 35, 30, 31, 32, 21, 22, 23, 18, 19, 20, 44, 43, 42, 38, 37, 36, 39, 40, 41, 51, 52, 53, 47, 46, 45, 50, 49, 48},
		{15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 33, 34, 35, 30, 31, 32, 27, 28, 29, 24, 25, 26, 21, 22, 23, 18, 19, 20, 38, 37, 36, 42, 43, 44, 39, 40, 41, 47, 46, 45, 53, 52, 51, 50, 49, 48},
		{9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 27, 28, 29, 24, 25, 26, 30, 31, 32, 33, 34, 35, 21, 22, 23, 18, 19, 20, 42, 43, 44, 36, 37, 38, 39, 40, 41, 53, 52, 51, 45, 46, 47, 50, 49, 48},
		{15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 33, 34, 35, 30, 31, 32, 24, 25, 26, 27, 28, 29, 18, 19, 20, 21, 22, 23, 36, 37, 38, 42, 43, 44, 41, 40, 39, 45, 46, 47, 53, 52, 51, 48, 49, 50},
		{9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 27, 28, 29, 24, 25, 26, 33, 34, 35, 30, 31, 32, 18, 19, 20, 21, 22, 23, 44, 43, 42, 36, 37, 38, 41, 40, 39, 51, 52, 53, 45, 46, 47, 48, 49, 50},
		{12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 30, 31, 32, 33, 34, 35, 27, 28, 29, 24, 25, 26, 18, 19, 20, 21, 22, 23, 38, 37, 36, 44, 43, 42, 41, 40, 39, 47, 46, 45, 51, 52, 53, 48, 49, 50},
		{6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 18, 19, 20, 21, 22, 23, 42, 43, 44, 38, 37, 36, 41, 40, 39, 53, 52, 51, 47, 46, 45, 48, 49, 50}};

std::vector<std::vector<int>> rotationMapReverse =
	{
		{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53},
		{0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 27, 28, 29, 24, 25, 26, 42, 43, 44, 39, 40, 41, 38, 37, 36, 53, 52, 51, 48, 49, 50, 45, 46, 47},
		{0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 18, 19, 20, 21, 22, 23, 27, 28, 29, 24, 25, 26, 33, 34, 35, 30, 31, 32, 38, 37, 36, 39, 40, 41, 44, 43, 42, 47, 46, 45, 48, 49, 50, 53, 52, 51},
		{0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 18, 19, 20, 21, 22, 23, 33, 34, 35, 30, 31, 32, 24, 25, 26, 27, 28, 29, 44, 43, 42, 39, 40, 41, 36, 37, 38, 51, 52, 53, 48, 49, 50, 47, 46, 45},
		{3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 21, 22, 23, 18, 19, 20, 27, 28, 29, 24, 25, 26, 30, 31, 32, 33, 34, 35, 38, 37, 36, 41, 40, 39, 42, 43, 44, 47, 46, 45, 50, 49, 48, 51, 52, 53},
		{3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 21, 22, 23, 18, 19, 20, 30, 31, 32, 33, 34, 35, 24, 25, 26, 27, 28, 29, 42, 43, 44, 41, 40, 39, 36, 37, 38, 53, 52, 51, 50, 49, 48, 47, 46, 45},
		{3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 21, 22, 23, 18, 19, 20, 24, 25, 26, 27, 28, 29, 33, 34, 35, 30, 31, 32, 36, 37, 38, 41, 40, 39, 44, 43, 42, 45, 46, 47, 50, 49, 48, 53, 52, 51},
		{3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 21, 22, 23, 18, 19, 20, 33, 34, 35, 30, 31, 32, 27, 28, 29, 24, 25, 26, 44, 43, 42, 41, 40, 39, 38, 37, 36, 51, 52, 53, 50, 49, 48, 45, 46, 47},
		{9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 27, 28, 29, 24, 25, 26, 18, 19, 20, 21, 22, 23, 30, 31, 32, 33, 34, 35, 41, 40, 39, 36, 37, 38, 42, 43, 44, 50, 49, 48, 45, 46, 47, 51, 52, 53},
		{9, 10, 11, 6, 7, 8, 12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 27, 28, 29, 24, 25, 26, 30, 31, 32, 33, 34, 35, 21, 22, 23, 18, 19, 20, 42, 43, 44, 36, 37, 38, 39, 40, 41, 53, 52, 51, 45, 46, 47, 50, 49, 48},
		{9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 15, 16, 17, 12, 13, 14, 27, 28, 29, 24, 25, 26, 21, 22, 23, 18, 19, 20, 33, 34, 35, 30, 31, 32, 39, 40, 41, 36, 37, 38, 44, 43, 42, 48, 49, 50, 45, 46, 47, 53, 52, 51},
		{9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 27, 28, 29, 24, 25, 26, 33, 34, 35, 30, 31, 32, 18, 19, 20, 21, 22, 23, 44, 43, 42, 36, 37, 38, 41, 40, 39, 51, 52, 53, 45, 46, 47, 48, 49, 50},
		{6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 12, 13, 14, 15, 16, 17, 24, 25, 26, 27, 28, 29, 21, 22, 23, 18, 19, 20, 30, 31, 32, 33, 34, 35, 39, 40, 41, 38, 37, 36, 42, 43, 44, 48, 49, 50, 47, 46, 45, 51, 52, 53},
		{6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 18, 19, 20, 21, 22, 23, 42, 43, 44, 38, 37, 36, 41, 40, 39, 53, 52, 51, 47, 46, 45, 48, 49, 50},
		{6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 15, 16, 17, 12, 13, 14, 24, 25, 26, 27, 28, 29, 18, 19, 20, 21, 22, 23, 33, 34, 35, 30, 31, 32, 41, 40, 39, 38, 37, 36, 44, 43, 42, 50, 49, 48, 47, 46, 45, 53, 52, 51},
		{6, 7, 8, 9, 10, 11, 15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 24, 25, 26, 27, 28, 29, 33, 34, 35, 30, 31, 32, 21, 22, 23, 18, 19, 20, 44, 43, 42, 38, 37, 36, 39, 40, 41, 51, 52, 53, 47, 46, 45, 50, 49, 48},
		{15, 16, 17, 12, 13, 14, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 33, 34, 35, 30, 31, 32, 24, 25, 26, 27, 28, 29, 18, 19, 20, 21, 22, 23, 36, 37, 38, 42, 43, 44, 41, 40, 39, 45, 46, 47, 53, 52, 51, 48, 49, 50},
		{15, 16, 17, 12, 13, 14, 0, 1, 2, 3, 4, 5, 9, 10, 11, 6, 7, 8, 33, 34, 35, 30, 31, 32, 18, 19, 20, 21, 22, 23, 27, 28, 29, 24, 25, 26, 41, 40, 39, 42, 43, 44, 38, 37, 36, 50, 49, 48, 53, 52, 51, 45, 46, 47},
		{15, 16, 17, 12, 13, 14, 9, 10, 11, 6, 7, 8, 3, 4, 5, 0, 1, 2, 33, 34, 35, 30, 31, 32, 27, 28, 29, 24, 25, 26, 21, 22, 23, 18, 19, 20, 38, 37, 36, 42, 43, 44, 39, 40, 41, 47, 46, 45, 53, 52, 51, 50, 49, 48},
		{15, 16, 17, 12, 13, 14, 3, 4, 5, 0, 1, 2, 6, 7, 8, 9, 10, 11, 33, 34, 35, 30, 31, 32, 21, 22, 23, 18, 19, 20, 24, 25, 26, 27, 28, 29, 39, 40, 41, 42, 43, 44, 36, 37, 38, 48, 49, 50, 53, 52, 51, 47, 46, 45},
		{12, 13, 14, 15, 16, 17, 6, 7, 8, 9, 10, 11, 3, 4, 5, 0, 1, 2, 30, 31, 32, 33, 34, 35, 24, 25, 26, 27, 28, 29, 21, 22, 23, 18, 19, 20, 36, 37, 38, 44, 43, 42, 39, 40, 41, 45, 46, 47, 51, 52, 53, 50, 49, 48},
		{12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 30, 31, 32, 33, 34, 35, 21, 22, 23, 18, 19, 20, 27, 28, 29, 24, 25, 26, 39, 40, 41, 44, 43, 42, 38, 37, 36, 48, 49, 50, 51, 52, 53, 45, 46, 47},
		{12, 13, 14, 15, 16, 17, 9, 10, 11, 6, 7, 8, 0, 1, 2, 3, 4, 5, 30, 31, 32, 33, 34, 35, 27, 28, 29, 24, 25, 26, 18, 19, 20, 21, 22, 23, 38, 37, 36, 44, 43, 42, 41, 40, 39, 47, 46, 45, 51, 52, 53, 48, 49, 50},
		{12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 30, 31, 32, 33, 34, 35, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 41, 40, 39, 44, 43, 42, 36, 37, 38, 50, 49, 48, 51, 52, 53, 47, 46, 45}};

std::vector<int> converter = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8, 15, 16, 17, 12, 13, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26};

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

std::vector<std::vector<int>> c_array = {{0}, {1, 1, 1, 1, 1}, {1, 2, 4, 8, 16, 32}, {1, 3, 9, 27, 81, 243}};

std::vector<std::vector<int>> base_array = {{0}, {0}, {1, 12, 12 * 11, 12 * 11 * 10, 12 * 11 * 10 * 9}, {1, 8, 8 * 7, 8 * 7 * 6, 8 * 7 * 6 * 5}};

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

std::vector<int> sorted(5);

std::vector<std::vector<int>> base_array2 = {{0}, {0}, {12, 11, 10, 9, 8}, {8, 7, 6, 5, 4}};

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

std::vector<int> create_edge_move_table()
{
	std::vector<int> move_table(24 * 27, -1);
	int index;
	for (int i = 0; i < 24; ++i)
	{
		std::vector<int> ep(12, -1);
		std::vector<int> eo(12, -1);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		ep[i / 2] = i / 2;
		eo[i / 2] = i % 2;
		State state(cp, co, ep, eo, center);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_edge(moves[move_names[j]], i / 2);
			auto it = std::find(new_state.ep.begin(), new_state.ep.end(), i / 2);
			index = std::distance(new_state.ep.begin(), it);
			move_table[27 * i + j] = 2 * index + new_state.eo[index];
		}
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move_edge(moves[move_names[36 + j]], i / 2);
			auto it = std::find(new_state.ep.begin(), new_state.ep.end(), i / 2);
			index = std::distance(new_state.ep.begin(), it);
			move_table[27 * i + 18 + j] = 2 * index + new_state.eo[index];
		}
	}
	return move_table;
}

std::vector<int> create_ep_move_table()
{
	std::vector<int> move_table(12 * 27, -1);
	for (int i = 0; i < 12; ++i)
	{
		std::vector<int> ep(12, -1);
		std::vector<int> eo(12, -1);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		ep[i] = i;
		eo[i] = 0;
		State state(cp, co, ep, eo, center);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_edge(moves[move_names[j]], i);
			auto it = std::find(new_state.ep.begin(), new_state.ep.end(), i);
			move_table[27 * i + j] = std::distance(new_state.ep.begin(), it);
		}
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move_edge(moves[move_names[36 + j]], i);
			auto it = std::find(new_state.ep.begin(), new_state.ep.end(), i);
			move_table[27 * i + 18 + j] = std::distance(new_state.ep.begin(), it);
		}
	}
	return move_table;
}

std::vector<int> create_eo_move_table()
{
	std::vector<int> move_table(2048 * 27, -1);
	for (int i = 0; i < 2048; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		index_to_o(eo, i, 2, 12);
		State state(cp, co, ep, eo, center);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[27 * i + j] = 27 * o_to_index(new_state.eo, 2, 12);
		}
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move(moves[move_names[36 + j]]);
			move_table[27 * i + 18 + j] = 27 * o_to_index(new_state.eo, 2, 12);
		}
	}
	return move_table;
}

std::vector<int> create_corner_move_table()
{
	std::vector<int> move_table(24 * 27, -1);
	int index;
	for (int i = 0; i < 24; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, -1);
		std::vector<int> co(8, -1);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		cp[i / 3] = i / 3;
		co[i / 3] = i % 3;
		State state(cp, co, ep, eo, center);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[j]], i / 3);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i / 3);
			index = std::distance(new_state.cp.begin(), it);
			move_table[27 * i + j] = 3 * index + new_state.co[index];
		}
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[36 + j]], i / 3);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i / 3);
			index = std::distance(new_state.cp.begin(), it);
			move_table[27 * i + 18 + j] = 3 * index + new_state.co[index];
		}
	}
	return move_table;
}

std::vector<int> create_cp_move_table()
{
	std::vector<int> move_table(8 * 27, 0);
	for (int i = 0; i < 8; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, -1);
		std::vector<int> co(8, -1);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		cp[i] = i;
		co[i] = 0;
		State state(cp, co, ep, eo, center);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[j]], i);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i);
			move_table[27 * i + j] = std::distance(new_state.cp.begin(), it);
		}
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[36 + j]], i);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i);
			move_table[27 * i + 18 + j] = std::distance(new_state.cp.begin(), it);
		}
	}
	return move_table;
}

std::vector<int> create_co_move_table()
{
	std::vector<int> move_table(2187 * 27, 0);
	for (int i = 0; i < 2187; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		std::vector<int> center = {0, 1, 2, 3, 4, 5};
		index_to_o(co, i, 3, 8);
		State state(cp, co, ep, eo, center);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[27 * i + j] = 27 * o_to_index(new_state.co, 3, 8);
		}
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move(moves[move_names[36 + j]]);
			move_table[27 * i + 18 + j] = 27 * o_to_index(new_state.co, 3, 8);
		}
	}
	return move_table;
}

std::vector<std::vector<int>> create_center_move_table()
{
	std::vector<std::vector<int>> move_table(24, std::vector<int>(54, 0));
	for (int i = 0; i < 24; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		std::vector<int> center = index_to_center[i];
		State state(cp, co, ep, eo, center);
		for (int j = 0; j < 54; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[i][j] = center_to_index[new_state.center];
		}
	}
	return move_table;
}

void create_multi_move_table(int n, int c, int pn, int size, std::vector<int> &move_table, const std::vector<int> &table)
{
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
}

void create_prune_table_cross(int depth, const std::vector<int> &table1, const std::vector<int> &table2, std::vector<unsigned char> &prune_table, std::vector<int> &move_restrict, std::vector<unsigned char> &tmp_array, std::vector<std::vector<int>> &center_move_table)
{
	int size1 = 528;
	int size2 = 528;
	int size = size1 * size2;
	tmp_array = std::vector<unsigned char>(size, 0);
	int next_i;
	int index1_tmp;
	int index2_tmp;
	int index1_tmp_end;
	int index2_tmp_end;
	int next_d;
	prune_table[416 * size2 + 520] = 0;
	prune_table[468 * size2 + 428] = 0;
	prune_table[520 * size2 + 416] = 0;
	prune_table[428 * size2 + 468] = 0;
	int num = 4;
	int num_old = 4;
	int m;
	int center = 0;
	int center_tmp;
	std::bitset<27> computed;
	std::vector<int> move_restrict_move;
	std::vector<int> move_restrict_rot;
	for (int i : move_restrict)
	{
		if (i < 45)
		{
			move_restrict_move.emplace_back(i);
		}
		else
		{
			move_restrict_rot.emplace_back(i);
		}
	}
	for (int d = 0; d < depth; ++d)
	{
		next_d = d + 1;
		for (int i = 0; i < size; ++i)
		{
			if (prune_table[i] == d)
			{
				index1_tmp = (i / size2) * 27;
				index2_tmp = (i % size2) * 27;
				center = tmp_array[i];
				for (int j : move_restrict_move)
				{
					computed.reset();
					if (j >= 45)
					{
						continue;
					}
					m = converter[rotationMapReverse[center][j]];
					if (!computed[m])
					{
						next_i = table1[index1_tmp + m] * size2 + table2[index2_tmp + m];
						if (prune_table[next_i] == 255)
						{
							tmp_array[next_i] = center_move_table[center][j];
							prune_table[next_i] = next_d;
							num += 1;
						}
						computed.set(m);
					}
					else
					{
						continue;
					}
					for (int r : move_restrict_rot)
					{
						center_tmp = center_move_table[center][r];
						m = converter[rotationMapReverse[center_tmp][j]];
						if (!computed[m])
						{
							next_i = table1[index1_tmp + m] * size2 + table2[index2_tmp + m];
							if (prune_table[next_i] == 255)
							{
								tmp_array[next_i] = center_move_table[center][j];
								prune_table[next_i] = next_d;
								num += 1;
							}
							computed.set(m);
						}
						else
						{
							continue;
						}
					}
				}
			}
		}
		if (num == num_old)
		{
			break;
		}
		num_old = num;
	}
}

void create_prune_table_xcross(int index2, int depth, const std::vector<int> &table1, const std::vector<int> &table2, std::vector<unsigned char> &prune_table, std::vector<int> &move_restrict, std::vector<unsigned char> &tmp_array, std::vector<std::vector<int>> &center_move_table)
{
	int size1 = 190080;
	int size2 = 24;
	int size = size1 * size2;
	tmp_array = std::vector<unsigned char>(size, 0);
	int next_i;
	int index1_tmp;
	int index2_tmp;
	int next_d;
	std::vector<int> a = {16, 18, 20, 22};
	int index1 = array_to_index(a, 4, 2, 12);
	prune_table[index1 * size2 + index2] = 0;
	prune_table[table1[index1 * 27 + 3] * size2 + table2[index2 * 27 + 3]] = 0;
	prune_table[table1[index1 * 27 + 4] * size2 + table2[index2 * 27 + 4]] = 0;
	prune_table[table1[index1 * 27 + 5] * size2 + table2[index2 * 27 + 5]] = 0;
	int num = 4;
	int num_old = 4;
	int m;
	int center = 0;
	int center_tmp;
	std::bitset<27> computed;
	std::vector<int> move_restrict_move;
	std::vector<int> move_restrict_rot;
	for (int i : move_restrict)
	{
		if (i < 45)
		{
			move_restrict_move.emplace_back(i);
		}
		else
		{
			move_restrict_rot.emplace_back(i);
		}
	}
	for (int d = 0; d < depth; ++d)
	{
		next_d = d + 1;
		for (int i = 0; i < size; ++i)
		{
			if (prune_table[i] == d)
			{
				index1_tmp = (i / size2) * 27;
				index2_tmp = (i % size2) * 27;
				center = tmp_array[i];
				for (int j : move_restrict_move)
				{
					computed.reset();
					if (j >= 45)
					{
						continue;
					}
					m = converter[rotationMapReverse[center][j]];
					if (!computed[m])
					{
						next_i = table1[index1_tmp + m] * size2 + table2[index2_tmp + m];
						if (prune_table[next_i] == 255)
						{
							tmp_array[next_i] = center_move_table[center][j];
							prune_table[next_i] = next_d;
							num += 1;
						}
						computed.set(m);
					}
					else
					{
						continue;
					}
					for (int r : move_restrict_rot)
					{
						center_tmp = center_move_table[center][r];
						m = converter[rotationMapReverse[center_tmp][j]];
						if (!computed[m])
						{
							next_i = table1[index1_tmp + m] * size2 + table2[index2_tmp + m];
							if (prune_table[next_i] == 255)
							{
								tmp_array[next_i] = center_move_table[center][j];
								prune_table[next_i] = next_d;
								num += 1;
							}
							computed.set(m);
						}
						else
						{
							continue;
						}
					}
				}
			}
		}
		if (num == num_old)
		{
			break;
		}
		num_old = num;
	}
}

std::vector<bool> create_ma_table()
{
	std::vector<bool> ma(28 * 27, false);
	for (int prev = 0; prev < 28; ++prev)
	{
		for (int i = 0; i < 27; ++i)
		{
			if (prev < 18 && i < 18)
			{
				if (i / 3 == prev / 3)
				{
					ma[prev * 27 + i] = true;
				}
			}
			else if (prev >= 18 && i >= 18)
			{
				if (i / 3 == prev / 3)
				{
					ma[prev * 27 + i] = true;
				}
			}
		}
	}
	return ma;
}

struct cross_search
{
	std::vector<int> sol;
	std::string scramble;
	std::string rotation;
	int max_length;
	int sol_num;
	int count;
	std::vector<std::vector<int>> center_move_table;
	std::vector<unsigned char> tmp_array;
	std::vector<int> edge_move_table;
	std::vector<int> multi_move_table;
	std::vector<unsigned char> prune_table;
	std::vector<int> alg;
	std::vector<std::string> restrict;
	std::vector<int> move_restrict;
	std::vector<int> move_restrict_move;
	std::vector<int> move_restrict_rot;
	std::vector<bool> ma;
	std::vector<bool> ma2;
	std::vector<int> mc;
	std::vector<int> mc_tmp;
	int index1;
	int index2;
	int index1_tmp;
	int index2_tmp;
	int prune_tmp;
	std::string tmp;
	int m;
	int m_tmp;
	std::vector<int> center_offset;
	int max_rot_count;
	std::string post_moves;
	int initial_center;

	cross_search()
	{
		edge_move_table = create_edge_move_table();
		center_move_table = create_center_move_table();
		multi_move_table = std::vector<int>(24 * 22 * 27, -1);
		create_multi_move_table(2, 2, 12, 24 * 22, multi_move_table, edge_move_table);
		index1 = 416;
		index2 = 520;
		ma = create_ma_table();
		prune_table = std::vector<unsigned char>(24 * 22 * 24 * 22, 255);
	}

	bool depth_limited_search(int arg_index1, int arg_index2, int depth, int center, int rot_count, int aprev)
	{
		for (int i : move_restrict_move)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			m = converter[rotationMapReverse[center][i]];
			index1_tmp = multi_move_table[arg_index1 + m];
			index2_tmp = multi_move_table[arg_index2 + m];
			prune_tmp = prune_table[index1_tmp * 528 + index2_tmp];
			if (prune_tmp >= depth)
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
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == multi_move_table[index2_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = multi_move_table[index2_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && prune_table[index1_tmp2 * 528 + index2_tmp2] == 0)
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, depth - 1, center_move_table[center][i], rot_count, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		for (int i : move_restrict_rot)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			if (rot_count >= max_rot_count)
			{
				continue;
			}
			index1_tmp = arg_index1 / 27;
			index2_tmp = arg_index2 / 27;
			prune_tmp = prune_table[index1_tmp * 528 + index2_tmp];
			if (prune_tmp >= depth)
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
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == multi_move_table[index2_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = multi_move_table[index2_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && prune_table[index1_tmp2 * 528 + index2_tmp2] == 0)
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, depth, center_move_table[center][i], rot_count + 1, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		return false;
	}

	void start_search(std::string arg_scramble = "", std::string arg_rotation = "", int arg_sol_num = 100, int arg_max_length = 8, const std::vector<std::string> &arg_restrict = move_names, std::string arg_post_alg = "", const std::vector<int> &arg_center_offset = {0}, int arg_max_rot_count = 0, const std::vector<bool> &arg_ma2 = std::vector<bool>(55 * 54, false), const std::vector<int> &arg_mc = std::vector<int>(54, 20))
	{
		scramble = arg_scramble;
		rotation = arg_rotation;
		max_length = arg_max_length;
		sol_num = arg_sol_num;
		restrict = arg_restrict;
		ma2 = arg_ma2;
		mc = arg_mc;
		mc_tmp = std::vector<int>(54, 0);
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		for (int i : move_restrict)
		{
			if (i < 45)
			{
				move_restrict_move.emplace_back(i);
			}
			else
			{
				move_restrict_rot.emplace_back(i);
			}
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
		max_rot_count = arg_max_rot_count;
		center_offset = arg_center_offset;
		index1 = 416;
		index2 = 520;
		create_prune_table_cross(20, multi_move_table, multi_move_table, prune_table, move_restrict_tmp, tmp_array, center_move_table);
		count = 0;
		int aprev_tmp = 54;
		for (int m : alg)
		{
			index1 = multi_move_table[index1 * 27 + m];
			index2 = multi_move_table[index2 * 27 + m];
		}
		initial_center = 0;
		for (int m_tmp : post_alg)
		{
			aprev_tmp = m_tmp;
			if (m_tmp >= 45)
			{
				initial_center = center_move_table[initial_center][m_tmp];
				continue;
			}
			int m = converter[rotationMapReverse[initial_center][m_tmp]];
			initial_center = center_move_table[initial_center][m_tmp];
			index1 = multi_move_table[index1 * 27 + m];
			index2 = multi_move_table[index2 * 27 + m];
		}
		auto it = std::find(move_restrict.begin(), move_restrict.end(), aprev_tmp);
		if (it == move_restrict.end())
		{
			aprev_tmp = 54;
		}
		prune_tmp = prune_table[index1 * 528 + index2];
		if (prune_tmp == 255)
		{
			update("Unsolvable.");
		}
		else if (prune_tmp == 0)
		{
			update("Already solved.");
		}
		else
		{
			index1 *= 27;
			index2 *= 27;
			for (int d = prune_tmp; d <= max_length; d++)
			{
				tmp = "depth=" + std::to_string(d);
				update(tmp.c_str());
				if (depth_limited_search(index1, index2, d, initial_center, 0, aprev_tmp * 54))
				{
					break;
				}
			}
			update("Search finished.");
		}
	}
};

struct xcross_search
{
	std::vector<int> sol;
	std::string scramble;
	std::string rotation;
	int slot1;
	int pslot1;
	int max_length;
	int sol_num;
	int count;
	std::vector<std::vector<int>> center_move_table;
	std::vector<unsigned char> tmp_array;
	std::vector<int> edge_move_table;
	std::vector<int> corner_move_table;
	std::vector<int> multi_move_table;
	std::vector<unsigned char> prune_table1;
	std::vector<int> alg;
	std::vector<std::string> restrict;
	std::vector<int> move_restrict;
	std::vector<int> move_restrict_move;
	std::vector<int> move_restrict_rot;
	std::vector<bool> ma;
	std::vector<bool> ma2;
	std::vector<int> mc;
	std::vector<int> mc_tmp;
	int edge_solved1;
	int index1;
	int index2;
	int index3;
	int index1_tmp;
	int index2_tmp;
	int index3_tmp;
	int prune1_tmp;
	std::string tmp;
	int m;
	int m_tmp;
	std::vector<int> center_offset;
	int max_rot_count;
	std::string post_moves;
	int initial_center;

	xcross_search()
	{
		center_move_table = create_center_move_table();
		edge_move_table = create_edge_move_table();
		corner_move_table = create_corner_move_table();
		multi_move_table = std::vector<int>(24 * 22 * 20 * 18 * 27, -1);
		create_multi_move_table(4, 2, 12, 24 * 22 * 20 * 18, multi_move_table, edge_move_table);
		ma = create_ma_table();
		prune_table1 = std::vector<unsigned char>(190080 * 24, 255);
	}

	bool depth_limited_search(int arg_index1, int arg_index2, int arg_index3, int depth, int center, int rot_count, int aprev)
	{
		for (int i : move_restrict_move)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			m = converter[rotationMapReverse[center][i]];
			index1_tmp = multi_move_table[arg_index1 + m];
			index2_tmp = corner_move_table[arg_index2 + m];
			index3_tmp = edge_move_table[arg_index3 + m];
			prune1_tmp = prune_table1[index1_tmp * 24 + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			sol.emplace_back(i);
			mc_tmp[i] += 1;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && index3_tmp == edge_solved1)
				{
					bool valid = true;
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index3_tmp2 = index3;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == corner_move_table[index2_tmp2 + m_tmp] * 27 && index3_tmp2 == edge_move_table[index3_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = corner_move_table[index2_tmp2 + m_tmp];
							index3_tmp2 = edge_move_table[index3_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && (prune_table1[index1_tmp2 * 24 + index2_tmp2] == 0 && index3_tmp2 == edge_solved1))
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
							index3_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, index3_tmp * 27, depth - 1, center_move_table[center][i], rot_count, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		for (int i : move_restrict_rot)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			if (rot_count >= max_rot_count)
			{
				continue;
			}
			index1_tmp = arg_index1 / 27;
			index2_tmp = arg_index2 / 27;
			index3_tmp = arg_index3 / 27;
			prune1_tmp = prune_table1[index1_tmp * 24 + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			sol.emplace_back(i);
			mc_tmp[i] += 1;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && index3_tmp == edge_solved1)
				{
					bool valid = true;
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index3_tmp2 = index3;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == corner_move_table[index2_tmp2 + m_tmp] * 27 && index3_tmp2 == edge_move_table[index3_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = corner_move_table[index2_tmp2 + m_tmp];
							index3_tmp2 = edge_move_table[index3_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && (prune_table1[index1_tmp2 * 24 + index2_tmp2] == 0 && index3_tmp2 == edge_solved1))
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
							index3_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, index3_tmp * 27, depth, center_move_table[center][i], rot_count + 1, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		return false;
	}

	void start_search(std::string arg_scramble = "", std::string arg_rotation = "", int arg_slot1 = 0, int arg_pslot1 = 0, int arg_sol_num = 100, int arg_max_length = 10, const std::vector<std::string> &arg_restrict = move_names, std::string arg_post_alg = "", const std::vector<int> &arg_center_offset = {0}, int arg_max_rot_count = 0, const std::vector<bool> &arg_ma2 = std::vector<bool>(55 * 54, false), const std::vector<int> &arg_mc = std::vector<int>(54, 20))
	{
		scramble = arg_scramble;
		rotation = arg_rotation;
		slot1 = arg_slot1;
		pslot1 = arg_pslot1;
		max_length = arg_max_length;
		sol_num = arg_sol_num;
		restrict = arg_restrict;
		ma2 = arg_ma2;
		mc = arg_mc;
		mc_tmp = std::vector<int>(54, 0);
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		for (int i : move_restrict)
		{
			if (i < 45)
			{
				move_restrict_move.emplace_back(i);
			}
			else
			{
				move_restrict_rot.emplace_back(i);
			}
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
		max_rot_count = arg_max_rot_count;
		center_offset = arg_center_offset;
		std::vector<int> edge_index = {187520, 187520, 187520, 187520};
		std::vector<int> single_edge_index = {0, 2, 4, 6};
		std::vector<int> corner_index = {12, 15, 18, 21};
		index1 = edge_index[slot1];
		index2 = corner_index[pslot1];
		index3 = single_edge_index[slot1];
		edge_solved1 = index3;
		create_prune_table_xcross(index2, 20, multi_move_table, corner_move_table, prune_table1, move_restrict_tmp, tmp_array, center_move_table);
		count = 0;
		int aprev_tmp = 54;
		for (int m : alg)
		{
			index1 = multi_move_table[index1 * 27 + m];
			index2 = corner_move_table[index2 * 27 + m];
			index3 = edge_move_table[index3 * 27 + m];
		}
		initial_center = 0;
		for (int m_tmp : post_alg)
		{
			aprev_tmp = m_tmp;
			if (m_tmp >= 45)
			{
				initial_center = center_move_table[initial_center][m_tmp];
				continue;
			}
			int m = converter[rotationMapReverse[initial_center][m_tmp]];
			initial_center = center_move_table[initial_center][m_tmp];
			index1 = multi_move_table[index1 * 27 + m];
			index2 = corner_move_table[index2 * 27 + m];
			index3 = edge_move_table[index3 * 27 + m];
		}
		auto it = std::find(move_restrict.begin(), move_restrict.end(), aprev_tmp);
		if (it == move_restrict.end())
		{
			aprev_tmp = 54;
		}
		prune1_tmp = prune_table1[index1 * 24 + index2];
		if (prune1_tmp == 255)
		{
			update("Unsolvable.");
		}
		else if (prune1_tmp == 0 && index3 == edge_solved1)
		{
			update("Already solved.");
		}
		else
		{
			index1 *= 27;
			index2 *= 27;
			index3 *= 27;
			for (int d = prune1_tmp; d <= max_length; d++)
			{
				tmp = "depth=" + std::to_string(d);
				update(tmp.c_str());
				if (depth_limited_search(index1, index2, index3, d, initial_center, 0, aprev_tmp * 54))
				{
					break;
				}
			}
			update("Search finished.");
		}
	}
};

struct xxcross_search
{
	std::vector<int> sol;
	std::string scramble;
	std::string rotation;
	int slot1;
	int slot2;
	int pslot1;
	int pslot2;
	int max_length;
	int sol_num;
	int count;
	std::vector<std::vector<int>> center_move_table;
	std::vector<unsigned char> tmp_array;
	std::vector<int> edge_move_table;
	std::vector<int> corner_move_table;
	std::vector<int> multi_move_table;
	std::vector<unsigned char> prune_table1;
	std::vector<unsigned char> prune_table2;
	std::vector<int> alg;
	std::vector<std::string> restrict;
	std::vector<int> move_restrict;
	std::vector<int> move_restrict_move;
	std::vector<int> move_restrict_rot;
	std::vector<bool> ma;
	std::vector<bool> ma2;
	std::vector<int> mc;
	std::vector<int> mc_tmp;
	int edge_solved1;
	int edge_solved2;
	int index1;
	int index2;
	int index3;
	int index4;
	int index5;
	int index6;
	int index1_tmp;
	int index2_tmp;
	int index3_tmp;
	int index4_tmp;
	int index5_tmp;
	int index6_tmp;
	int prune1_tmp;
	int prune2_tmp;
	std::string tmp;
	int m;
	int m_tmp;
	std::vector<int> center_offset;
	int max_rot_count;
	std::string post_moves;
	int initial_center;

	xxcross_search()
	{
		center_move_table = create_center_move_table();
		edge_move_table = create_edge_move_table();
		corner_move_table = create_corner_move_table();
		multi_move_table = std::vector<int>(24 * 22 * 20 * 18 * 27, -1);
		create_multi_move_table(4, 2, 12, 24 * 22 * 20 * 18, multi_move_table, edge_move_table);
		ma = create_ma_table();
		prune_table1 = std::vector<unsigned char>(190080 * 24, 255);
		prune_table2 = std::vector<unsigned char>(190080 * 24, 255);
	}

	bool depth_limited_search(int arg_index1, int arg_index2, int arg_index4, int arg_index5, int arg_index6, int depth, int center, int rot_count, int aprev)
	{
		for (int i : move_restrict_move)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			m = converter[rotationMapReverse[center][i]];
			index1_tmp = multi_move_table[arg_index1 + m];
			index2_tmp = corner_move_table[arg_index2 + m];
			index5_tmp = edge_move_table[arg_index5 + m];
			prune1_tmp = prune_table1[index1_tmp * 24 + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			index4_tmp = corner_move_table[arg_index4 + m];
			index6_tmp = edge_move_table[arg_index6 + m];
			prune2_tmp = prune_table2[index1_tmp * 24 + index4_tmp];
			if (prune2_tmp >= depth)
			{
				continue;
			}
			sol.emplace_back(i);
			mc_tmp[i] += 1;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && prune2_tmp == 0 && index5_tmp == edge_solved1 && index6_tmp == edge_solved2)
				{
					bool valid = true;
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index4_tmp2 = index4;
					int index5_tmp2 = index5;
					int index6_tmp2 = index6;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == corner_move_table[index2_tmp2 + m_tmp] * 27 && index4_tmp2 == corner_move_table[index4_tmp2 + m_tmp] * 27 && index5_tmp2 == edge_move_table[index5_tmp2 + m_tmp] * 27 && index6_tmp2 == edge_move_table[index6_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = corner_move_table[index2_tmp2 + m_tmp];
							index4_tmp2 = corner_move_table[index4_tmp2 + m_tmp];
							index5_tmp2 = edge_move_table[index5_tmp2 + m_tmp];
							index6_tmp2 = edge_move_table[index6_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && (prune_table1[index1_tmp2 * 24 + index2_tmp2] == 0 && prune_table2[index1_tmp2 * 24 + index4_tmp2] == 0 && index5_tmp2 == edge_solved1 && index6_tmp2 == edge_solved2))
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
							index4_tmp2 *= 27;
							index5_tmp2 *= 27;
							index6_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, index4_tmp * 27, index5_tmp * 27, index6_tmp * 27, depth - 1, center_move_table[center][i], rot_count, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		for (int i : move_restrict_rot)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			if (rot_count >= max_rot_count)
			{
				continue;
			}
			index1_tmp = arg_index1 / 27;
			index2_tmp = arg_index2 / 27;
			index5_tmp = arg_index5 / 27;
			prune1_tmp = prune_table1[index1_tmp * 24 + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			index4_tmp = arg_index4 / 27;
			index6_tmp = arg_index6 / 27;
			prune2_tmp = prune_table2[index1_tmp * 24 + index4_tmp];
			if (prune2_tmp >= depth)
			{
				continue;
			}
			sol.emplace_back(i);
			mc_tmp[i] += 1;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && prune2_tmp == 0 && index5_tmp == edge_solved1 && index6_tmp == edge_solved2)
				{
					bool valid = true;
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index4_tmp2 = index4;
					int index5_tmp2 = index5;
					int index6_tmp2 = index6;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == corner_move_table[index2_tmp2 + m_tmp] * 27 && index4_tmp2 == corner_move_table[index4_tmp2 + m_tmp] * 27 && index5_tmp2 == edge_move_table[index5_tmp2 + m_tmp] * 27 && index6_tmp2 == edge_move_table[index6_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = corner_move_table[index2_tmp2 + m_tmp];
							index4_tmp2 = corner_move_table[index4_tmp2 + m_tmp];
							index5_tmp2 = edge_move_table[index5_tmp2 + m_tmp];
							index6_tmp2 = edge_move_table[index6_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && (prune_table1[index1_tmp2 * 24 + index2_tmp2] == 0 && prune_table2[index1_tmp2 * 24 + index4_tmp2] == 0 && index5_tmp2 == edge_solved1 && index6_tmp2 == edge_solved2))
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
							index4_tmp2 *= 27;
							index5_tmp2 *= 27;
							index6_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, index4_tmp * 27, index5_tmp * 27, index6_tmp * 27, depth, center_move_table[center][i], rot_count + 1, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		return false;
	}

	void start_search(std::string arg_scramble = "", std::string arg_rotation = "", int arg_slot1 = 0, int arg_slot2 = 3, int arg_pslot1 = 0, int arg_pslot2 = 3, int arg_sol_num = 100, int arg_max_length = 12, const std::vector<std::string> &arg_restrict = move_names, std::string arg_post_alg = "", const std::vector<int> &arg_center_offset = {0}, int arg_max_rot_count = 0, const std::vector<bool> &arg_ma2 = std::vector<bool>(55 * 54, false), const std::vector<int> &arg_mc = std::vector<int>(54, 20))
	{
		scramble = arg_scramble;
		rotation = arg_rotation;
		slot1 = arg_slot1;
		slot2 = arg_slot2;
		pslot1 = arg_pslot1;
		pslot2 = arg_pslot2;
		max_length = arg_max_length;
		sol_num = arg_sol_num;
		restrict = arg_restrict;
		ma2 = arg_ma2;
		mc = arg_mc;
		mc_tmp = std::vector<int>(54, 0);
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		for (int i : move_restrict)
		{
			if (i < 45)
			{
				move_restrict_move.emplace_back(i);
			}
			else
			{
				move_restrict_rot.emplace_back(i);
			}
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
		max_rot_count = arg_max_rot_count;
		center_offset = arg_center_offset;
		std::vector<int> edge_index = {187520, 187520, 187520, 187520};
		std::vector<int> single_edge_index = {0, 2, 4, 6};
		std::vector<int> corner_index = {12, 15, 18, 21};
		index1 = edge_index[slot1];
		index2 = corner_index[pslot1];
		index5 = single_edge_index[slot1];
		edge_solved1 = index5;
		create_prune_table_xcross(index2, 20, multi_move_table, corner_move_table, prune_table1, move_restrict_tmp, tmp_array, center_move_table);
		index4 = corner_index[pslot2];
		index6 = single_edge_index[slot2];
		edge_solved2 = index6;
		create_prune_table_xcross(index4, 20, multi_move_table, corner_move_table, prune_table2, move_restrict_tmp, tmp_array, center_move_table);
		count = 0;
		int aprev_tmp = 54;
		for (int m : alg)
		{
			index1 = multi_move_table[index1 * 27 + m];
			index2 = corner_move_table[index2 * 27 + m];
			index4 = corner_move_table[index4 * 27 + m];
			index5 = edge_move_table[index5 * 27 + m];
			index6 = edge_move_table[index6 * 27 + m];
		}
		initial_center = 0;
		for (int m_tmp : post_alg)
		{
			aprev_tmp = m_tmp;
			if (m_tmp >= 45)
			{
				initial_center = center_move_table[initial_center][m_tmp];
				continue;
			}
			int m = converter[rotationMapReverse[initial_center][m_tmp]];
			initial_center = center_move_table[initial_center][m_tmp];
			index1 = multi_move_table[index1 * 27 + m];
			index2 = corner_move_table[index2 * 27 + m];
			index4 = corner_move_table[index4 * 27 + m];
			index5 = edge_move_table[index5 * 27 + m];
			index6 = edge_move_table[index6 * 27 + m];
		}
		auto it = std::find(move_restrict.begin(), move_restrict.end(), aprev_tmp);
		if (it == move_restrict.end())
		{
			aprev_tmp = 54;
		}
		prune1_tmp = prune_table1[index1 * 24 + index2];
		prune2_tmp = prune_table2[index1 * 24 + index4];
		if (prune1_tmp == 255 || prune2_tmp == 255)
		{
			update("Unsolvable.");
		}
		else if (prune1_tmp == 0 && prune2_tmp == 0 && index5 == edge_solved1 && index6 == edge_solved2)
		{
			update("Already solved.");
		}
		else
		{
			index1 *= 27;
			index2 *= 27;
			index4 *= 27;
			index5 *= 27;
			index6 *= 27;
			for (int d = std::max(prune1_tmp, prune2_tmp); d <= max_length; d++)
			{
				tmp = "depth=" + std::to_string(d);
				update(tmp.c_str());
				if (depth_limited_search(index1, index2, index4, index5, index6, d, initial_center, 0, aprev_tmp * 54))
				{
					break;
				}
			}
			update("Search finished.");
		}
	}
};

struct xxxcross_search
{
	std::vector<int> sol;
	std::string scramble;
	std::string rotation;
	int slot1;
	int slot2;
	int slot3;
	int pslot1;
	int pslot2;
	int pslot3;
	int max_length;
	int sol_num;
	int count;
	std::vector<std::vector<int>> center_move_table;
	std::vector<unsigned char> tmp_array;
	std::vector<int> edge_move_table;
	std::vector<int> corner_move_table;
	std::vector<int> multi_move_table;
	std::vector<unsigned char> prune_table1;
	std::vector<unsigned char> prune_table2;
	std::vector<unsigned char> prune_table3;
	std::vector<int> alg;
	std::vector<std::string> restrict;
	std::vector<int> move_restrict;
	std::vector<int> move_restrict_move;
	std::vector<int> move_restrict_rot;
	std::vector<bool> ma;
	std::vector<bool> ma2;
	std::vector<int> mc;
	std::vector<int> mc_tmp;
	int edge_solved1;
	int edge_solved2;
	int edge_solved3;
	int index1;
	int index2;
	int index3;
	int index4;
	int index5;
	int index6;
	int index7;
	int index8;
	int index9;
	int index1_tmp;
	int index2_tmp;
	int index3_tmp;
	int index4_tmp;
	int index5_tmp;
	int index6_tmp;
	int index7_tmp;
	int index8_tmp;
	int index9_tmp;
	int prune1_tmp;
	int prune2_tmp;
	int prune3_tmp;
	std::string tmp;
	int m;
	int m_tmp;
	std::vector<int> center_offset;
	int max_rot_count;
	std::string post_moves;
	int initial_center;

	xxxcross_search()
	{
		center_move_table = create_center_move_table();
		edge_move_table = create_edge_move_table();
		corner_move_table = create_corner_move_table();
		multi_move_table = std::vector<int>(24 * 22 * 20 * 18 * 27, -1);
		create_multi_move_table(4, 2, 12, 24 * 22 * 20 * 18, multi_move_table, edge_move_table);
		ma = create_ma_table();
		prune_table1 = std::vector<unsigned char>(190080 * 24, 255);
		prune_table2 = std::vector<unsigned char>(190080 * 24, 255);
		prune_table3 = std::vector<unsigned char>(190080 * 24, 255);
	}

	bool depth_limited_search(int arg_index1, int arg_index2, int arg_index4, int arg_index6, int arg_index7, int arg_index8, int arg_index9, int depth, int center, int rot_count, int aprev)
	{
		for (int i : move_restrict_move)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			m = converter[rotationMapReverse[center][i]];
			index1_tmp = multi_move_table[arg_index1 + m];
			index2_tmp = corner_move_table[arg_index2 + m];
			index7_tmp = edge_move_table[arg_index7 + m];
			prune1_tmp = prune_table1[index1_tmp * 24 + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			index4_tmp = corner_move_table[arg_index4 + m];
			index8_tmp = edge_move_table[arg_index8 + m];
			prune2_tmp = prune_table2[index1_tmp * 24 + index4_tmp];
			if (prune2_tmp >= depth)
			{
				continue;
			}
			index6_tmp = corner_move_table[arg_index6 + m];
			index9_tmp = edge_move_table[arg_index9 + m];
			prune3_tmp = prune_table3[index1_tmp * 24 + index6_tmp];
			if (prune3_tmp >= depth)
			{
				continue;
			}
			sol.emplace_back(i);
			mc_tmp[i] += 1;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && prune2_tmp == 0 && prune3_tmp == 0 && index7_tmp == edge_solved1 && index8_tmp == edge_solved2 && index9_tmp == edge_solved3)
				{
					bool valid = true;
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index4_tmp2 = index4;
					int index6_tmp2 = index6;
					int index7_tmp2 = index7;
					int index8_tmp2 = index8;
					int index9_tmp2 = index9;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == corner_move_table[index2_tmp2 + m_tmp] * 27 && index4_tmp2 == corner_move_table[index4_tmp2 + m_tmp] * 27 && index6_tmp2 == corner_move_table[index6_tmp2 + m_tmp] * 27 && index7_tmp2 == edge_move_table[index7_tmp2 + m_tmp] * 27 && index8_tmp2 == edge_move_table[index8_tmp2 + m_tmp] * 27 && index9_tmp2 == edge_move_table[index9_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = corner_move_table[index2_tmp2 + m_tmp];
							index4_tmp2 = corner_move_table[index4_tmp2 + m_tmp];
							index6_tmp2 = corner_move_table[index6_tmp2 + m_tmp];
							index7_tmp2 = edge_move_table[index7_tmp2 + m_tmp];
							index8_tmp2 = edge_move_table[index8_tmp2 + m_tmp];
							index9_tmp2 = edge_move_table[index9_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && (prune_table1[index1_tmp2 * 24 + index2_tmp2] == 0 && prune_table2[index1_tmp2 * 24 + index4_tmp2] == 0 && prune_table3[index1_tmp2 * 24 + index6_tmp2] == 0 && index7_tmp2 == edge_solved1 && index8_tmp2 == edge_solved2 && index9_tmp2 == edge_solved3))
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
							index4_tmp2 *= 27;
							index6_tmp2 *= 27;
							index7_tmp2 *= 27;
							index8_tmp2 *= 27;
							index9_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, index4_tmp * 27, index6_tmp * 27, index7_tmp * 27, index8_tmp * 27, index9_tmp * 27, depth - 1, center_move_table[center][i], rot_count, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		for (int i : move_restrict_rot)
		{
			if (ma2[aprev + i] || mc_tmp[i] >= mc[i])
			{
				continue;
			}
			if (rot_count >= max_rot_count)
			{
				continue;
			}
			index1_tmp = arg_index1 / 27;
			index2_tmp = arg_index2 / 27;
			index7_tmp = arg_index7 / 27;
			prune1_tmp = prune_table1[index1_tmp * 24 + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			index4_tmp = arg_index4 / 27;
			index8_tmp = arg_index8 / 27;
			prune2_tmp = prune_table2[index1_tmp * 24 + index4_tmp];
			if (prune2_tmp >= depth)
			{
				continue;
			}
			index6_tmp = arg_index6 / 27;
			index9_tmp = arg_index9 / 27;
			prune3_tmp = prune_table3[index1_tmp * 24 + index6_tmp];
			if (prune3_tmp >= depth)
			{
				continue;
			}
			sol.emplace_back(i);
			mc_tmp[i] += 1;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && prune2_tmp == 0 && prune3_tmp == 0 && index7_tmp == edge_solved1 && index8_tmp == edge_solved2 && index9_tmp == edge_solved3)
				{
					bool valid = true;
					bool p_valid = false;
					bool center_valid = false;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int rot_count_tmp = 0;
					int center_tmp = initial_center;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index4_tmp2 = index4;
					int index6_tmp2 = index6;
					int index7_tmp2 = index7;
					int index8_tmp2 = index8;
					int index9_tmp2 = index9;
					for (int j : sol)
					{
						center_valid = false;
						if (j >= 45)
						{
							center_tmp = center_move_table[center_tmp][j];
							c++;
							rot_count_tmp++;
							if (rot_count_tmp > max_rot_count)
							{
								valid = false;
								break;
							}
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && center_valid && p_valid)
							{
								valid = false;
								break;
							}
							continue;
						}
						m_tmp = converter[rotationMapReverse[center_tmp][j]];
						center_tmp = center_move_table[center_tmp][j];
						if (index1_tmp2 == multi_move_table[index1_tmp2 + m_tmp] * 27 && index2_tmp2 == corner_move_table[index2_tmp2 + m_tmp] * 27 && index4_tmp2 == corner_move_table[index4_tmp2 + m_tmp] * 27 && index6_tmp2 == corner_move_table[index6_tmp2 + m_tmp] * 27 && index7_tmp2 == edge_move_table[index7_tmp2 + m_tmp] * 27 && index8_tmp2 == edge_move_table[index8_tmp2 + m_tmp] * 27 && index9_tmp2 == edge_move_table[index9_tmp2 + m_tmp] * 27)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + m_tmp];
							index2_tmp2 = corner_move_table[index2_tmp2 + m_tmp];
							index4_tmp2 = corner_move_table[index4_tmp2 + m_tmp];
							index6_tmp2 = corner_move_table[index6_tmp2 + m_tmp];
							index7_tmp2 = edge_move_table[index7_tmp2 + m_tmp];
							index8_tmp2 = edge_move_table[index8_tmp2 + m_tmp];
							index9_tmp2 = edge_move_table[index9_tmp2 + m_tmp];
							for (int center_tmp2 : center_offset)
							{
								if (center_tmp == center_tmp2)
								{
									center_valid = true;
								}
							}
							if (c < l && (prune_table1[index1_tmp2 * 24 + index2_tmp2] == 0 && prune_table2[index1_tmp2 * 24 + index4_tmp2] == 0 && prune_table3[index1_tmp2 * 24 + index6_tmp2] == 0 && index7_tmp2 == edge_solved1 && index8_tmp2 == edge_solved2 && index9_tmp2 == edge_solved3))
							{
								p_valid = true;
								if (center_valid)
								{
									valid = false;
									break;
								}
							}
							index1_tmp2 *= 27;
							index2_tmp2 *= 27;
							index4_tmp2 *= 27;
							index6_tmp2 *= 27;
							index7_tmp2 *= 27;
							index8_tmp2 *= 27;
							index9_tmp2 *= 27;
						}
					}
					if (valid && center_valid)
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
			else if (depth_limited_search(index1_tmp * 27, index2_tmp * 27, index4_tmp * 27, index6_tmp * 27, index7_tmp * 27, index8_tmp * 27, index9_tmp * 27, depth, center_move_table[center][i], rot_count + 1, i * 54))
			{
				return true;
			}
			sol.pop_back();
			mc_tmp[i] -= 1;
		}
		return false;
	}

	void start_search(std::string arg_scramble = "", std::string arg_rotation = "", int arg_slot1 = 0, int arg_slot2 = 3, int arg_slot3 = 1, int arg_pslot1 = 0, int arg_pslot2 = 3, int arg_pslot3 = 1, int arg_sol_num = 100, int arg_max_length = 14, const std::vector<std::string> &arg_restrict = move_names, std::string arg_post_alg = "", const std::vector<int> &arg_center_offset = {0}, int arg_max_rot_count = 0, const std::vector<bool> &arg_ma2 = std::vector<bool>(55 * 54, false), const std::vector<int> &arg_mc = std::vector<int>(54, 20))
	{
		scramble = arg_scramble;
		rotation = arg_rotation;
		slot1 = arg_slot1;
		slot2 = arg_slot2;
		slot3 = arg_slot3;
		pslot1 = arg_pslot1;
		pslot2 = arg_pslot2;
		pslot3 = arg_pslot3;
		max_length = arg_max_length;
		sol_num = arg_sol_num;
		restrict = arg_restrict;
		ma2 = arg_ma2;
		mc = arg_mc;
		mc_tmp = std::vector<int>(54, 0);
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		for (int i : move_restrict)
		{
			if (i < 45)
			{
				move_restrict_move.emplace_back(i);
			}
			else
			{
				move_restrict_rot.emplace_back(i);
			}
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
		max_rot_count = arg_max_rot_count;
		center_offset = arg_center_offset;
		std::vector<int> edge_index = {187520, 187520, 187520, 187520};
		std::vector<int> single_edge_index = {0, 2, 4, 6};
		std::vector<int> corner_index = {12, 15, 18, 21};
		index1 = edge_index[slot1];
		index2 = corner_index[pslot1];
		index7 = single_edge_index[slot1];
		edge_solved1 = index7;
		create_prune_table_xcross(index2, 10, multi_move_table, corner_move_table, prune_table1, move_restrict_tmp, tmp_array, center_move_table);
		index4 = corner_index[pslot2];
		index8 = single_edge_index[slot2];
		edge_solved2 = index8;
		create_prune_table_xcross(index4, 10, multi_move_table, corner_move_table, prune_table2, move_restrict_tmp, tmp_array, center_move_table);
		index6 = corner_index[pslot3];
		index9 = single_edge_index[slot3];
		edge_solved3 = index9;
		create_prune_table_xcross(index6, 10, multi_move_table, corner_move_table, prune_table3, move_restrict_tmp, tmp_array, center_move_table);
		count = 0;
		int aprev_tmp = 54;
		for (int m : alg)
		{
			index1 = multi_move_table[index1 * 27 + m];
			index2 = corner_move_table[index2 * 27 + m];
			index4 = corner_move_table[index4 * 27 + m];
			index6 = corner_move_table[index6 * 27 + m];
			index7 = edge_move_table[index7 * 27 + m];
			index8 = edge_move_table[index8 * 27 + m];
			index9 = edge_move_table[index9 * 27 + m];
		}
		initial_center = 0;
		for (int m_tmp : post_alg)
		{
			aprev_tmp = m_tmp;
			if (m_tmp >= 45)
			{
				initial_center = center_move_table[initial_center][m_tmp];
				continue;
			}
			int m = converter[rotationMapReverse[initial_center][m_tmp]];
			initial_center = center_move_table[initial_center][m_tmp];
			index1 = multi_move_table[index1 * 27 + m];
			index2 = corner_move_table[index2 * 27 + m];
			index4 = corner_move_table[index4 * 27 + m];
			index6 = corner_move_table[index6 * 27 + m];
			index7 = edge_move_table[index7 * 27 + m];
			index8 = edge_move_table[index8 * 27 + m];
			index9 = edge_move_table[index9 * 27 + m];
		}
		auto it = std::find(move_restrict.begin(), move_restrict.end(), aprev_tmp);
		if (it == move_restrict.end())
		{
			aprev_tmp = 54;
		}
		prune1_tmp = prune_table1[index1 * 24 + index2];
		prune2_tmp = prune_table2[index1 * 24 + index4];
		prune3_tmp = prune_table3[index1 * 24 + index6];
		if (prune1_tmp == 255 || prune2_tmp == 255 || prune3_tmp == 255)
		{
			update("Unsolvable.");
		}
		else if (prune1_tmp == 0 && prune2_tmp == 0 && prune3_tmp == 0 && index7 == edge_solved1 && index8 == edge_solved2 && index9 == edge_solved3)
		{
			update("Already solved.");
		}
		else
		{
			index1 *= 27;
			index2 *= 27;
			index4 *= 27;
			index6 *= 27;
			index7 *= 27;
			index8 *= 27;
			index9 *= 27;
			for (int d = std::max(prune1_tmp, std::max(prune2_tmp, prune3_tmp)); d <= max_length; d++)
			{
				tmp = "depth=" + std::to_string(d);
				update(tmp.c_str());
				if (depth_limited_search(index1, index2, index4, index6, index7, index8, index9, d, initial_center, 0, aprev_tmp * 54))
				{
					break;
				}
			}
			update("Search finished.");
		}
	}
};

std::vector<bool> F2L_option_array(const std::string &input)
{
	std::vector<bool> result(4, false);
	std::istringstream iss(input);
	std::string token;

	while (iss >> token)
	{
		if (token == "BL")
		{
			result[0] = true;
		}
		else if (token == "BR")
		{
			result[1] = true;
		}
		else if (token == "FR")
		{
			result[2] = true;
		}
		else if (token == "FL")
		{
			result[3] = true;
		}
	}
	return result;
}

void buildCenterOffset(const std::string &crestString, std::vector<int> &vector)
{
	const static std::map<std::string, int> crest_mapping = {
		{"", 0}, {"y", 1}, {"y2", 2}, {"y'", 3}, {"z2", 4}, {"z2 y", 5}, {"z2 y2", 6}, {"z2 y'", 7}, {"z'", 8}, {"z' y", 9}, {"z' y2", 10}, {"z' y'", 11}, {"z", 12}, {"z y", 13}, {"z y2", 14}, {"z y'", 15}, {"x'", 16}, {"x' y", 17}, {"x' y2", 18}, {"x' y'", 19}, {"x", 20}, {"x y", 21}, {"x y2", 22}, {"x y'", 23}};
	std::stringstream ss(crestString);
	std::string id_part;

	while (std::getline(ss, id_part, '|'))
	{
		if (id_part.empty())
			continue;

		size_t delim_pos = id_part.find('_');
		if (delim_pos == std::string::npos)
			continue;

		std::string row_part_raw = id_part.substr(0, delim_pos);
		std::string col_part_raw = id_part.substr(delim_pos + 1);

		auto sanitize = [](std::string s)
		{
			if (s == "EMPTY")
				return std::string("");
			size_t pos = s.find('-');
			if (pos != std::string::npos)
			{
				s.replace(pos, 1, "'");
			}
			return s;
		};

		std::string row_part = sanitize(row_part_raw);
		std::string col_part = sanitize(col_part_raw);

		std::string key_string = row_part;
		if (!row_part.empty() && !col_part.empty())
		{
			key_string += " ";
		}
		key_string += col_part;
		auto it = crest_mapping.find(key_string);
		vector.push_back(it->second);
	}
}

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
	const static std::map<std::string, int> y_axis_order = {{"U", 0}, {"D", 1}, {"E", 2}, {"u", 3}, {"d", 4}, {"y", 5}};
	const static std::map<std::string, int> x_axis_order = {{"L", 0}, {"R", 1}, {"M", 2}, {"l", 3}, {"r", 4}, {"x", 5}};
	const static std::map<std::string, int> z_axis_order = {{"F", 0}, {"B", 1}, {"S", 2}, {"f", 3}, {"b", 4}, {"z", 5}};
	const static std::map<std::string, const std::map<std::string, int> *> base_to_axis_map = {
		{"U", &y_axis_order}, {"D", &y_axis_order}, {"E", &y_axis_order}, {"u", &y_axis_order}, {"d", &y_axis_order}, {"y", &y_axis_order}, {"L", &x_axis_order}, {"R", &x_axis_order}, {"M", &x_axis_order}, {"l", &x_axis_order}, {"r", &x_axis_order}, {"x", &x_axis_order}, {"F", &z_axis_order}, {"B", &z_axis_order}, {"S", &z_axis_order}, {"f", &z_axis_order}, {"b", &z_axis_order}, {"z", &z_axis_order}};
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

	const int NUM_COLS = 54;
	const int NUM_ROWS = 55;
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
					int row_index = row_move.empty() ? 54 : it_row->second;
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
			int row_index = row_str.empty() ? 54 : it_row->second;
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

void controller(std::string scr, std::string rot, std::string slot, std::string pslot, int num, int len, std::string move_restrict_string, std::string post_alg, std::string center_offset_string, int max_rot_count, std::string ma2_string, std::string mcString)
{
	std::vector<int> center_offset;
	std::vector<bool> ma2;
	std::vector<int> mc;
	std::vector<std::string> move_restrict;
	buildCenterOffset(center_offset_string, center_offset);
	buidMoveRestrict(move_restrict_string, move_restrict);
	buidMA2(move_restrict_string, ma2_string, ma2);
	buildMoveCountVector(move_restrict_string, mcString, mc);
	std::vector<bool> slot_list = F2L_option_array(slot);
	std::vector<bool> pslot_list = F2L_option_array(pslot);
	int count = 0;
	std::vector<int> slot_list2, pslot_list2;
	if (slot_list[0])
	{
		count += 1;
		slot_list2.emplace_back(0);
	}
	if (slot_list[1])
	{
		count += 1;
		slot_list2.emplace_back(1);
	}
	if (slot_list[2])
	{
		count += 1;
		slot_list2.emplace_back(2);
	}
	if (slot_list[3])
	{
		count += 1;
		slot_list2.emplace_back(3);
	}

	if (pslot_list[0])
	{
		pslot_list2.emplace_back(0);
	}
	if (pslot_list[1])
	{
		pslot_list2.emplace_back(1);
	}
	if (pslot_list[2])
	{
		pslot_list2.emplace_back(2);
	}
	if (pslot_list[3])
	{
		pslot_list2.emplace_back(3);
	}

	if (count == 0)
	{
		cross_search search;
		search.start_search(scr, rot, num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mc);
	}
	else if (count == 1)
	{
		xcross_search search;
		search.start_search(scr, rot, slot_list2[0], pslot_list2[0], num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mc);
	}
	else if (count == 2)
	{
		xxcross_search search;
		search.start_search(scr, rot, slot_list2[0], slot_list2[1], pslot_list2[0], pslot_list2[1], num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mc);
	}
	else if (count == 3)
	{
		xxxcross_search search;
		search.start_search(scr, rot, slot_list2[0], slot_list2[1], slot_list2[2], pslot_list2[0], pslot_list2[1], pslot_list2[2], num, len, move_restrict, post_alg, center_offset, max_rot_count, ma2, mc);
	}
}

EMSCRIPTEN_BINDINGS(my_module)
{
	emscripten::function("solve", &controller);
}