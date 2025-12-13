#include <emscripten/bind.h>
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <algorithm>
#include <unordered_map>
#include <string>
#include <sstream>
#include <cstdlib>
#include <map>
#include <numeric>
#include <random>
#include <set>

EM_JS(void, update, (const char *str), {
	postMessage(UTF8ToString(str));
});

struct State
{
	std::vector<int> cp;
	std::vector<int> co;

	State(std::vector<int> arg_cp = {0, 1, 2, 3, 4, 5, 6, 7}, std::vector<int> arg_co = {0, 0, 0, 0, 0, 0, 0, 0}) : cp(arg_cp), co(arg_co) {}

	State apply_move(State move)
	{
		std::vector<int> new_cp;
		std::vector<int> new_co;
		for (int i = 0; i < 8; ++i)
		{
			int p = move.cp[i];
			new_cp.emplace_back(cp[p]);
			new_co.emplace_back((co[p] + move.co[i]) % 3);
		}
		return State(new_cp, new_co);
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
		return State(new_cp, new_co);
	}
};

std::unordered_map<std::string, State> moves = {
	{"U", State({3, 0, 1, 2, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0})},
	{"U2", State({2, 3, 0, 1, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0})},
	{"U'", State({1, 2, 3, 0, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0})},
	{"R", State({0, 2, 6, 3, 4, 1, 5, 7}, {0, 1, 2, 0, 0, 2, 1, 0})},
	{"R2", State({0, 6, 5, 3, 4, 2, 1, 7}, {0, 0, 0, 0, 0, 0, 0, 0})},
	{"R'", State({0, 5, 1, 3, 4, 6, 2, 7}, {0, 1, 2, 0, 0, 2, 1, 0})},
	{"F", State({0, 1, 3, 7, 4, 5, 2, 6}, {0, 0, 1, 2, 0, 0, 2, 1})},
	{"F2", State({0, 1, 7, 6, 4, 5, 3, 2}, {0, 0, 0, 0, 0, 0, 0, 0})},
	{"F'", State({0, 1, 6, 2, 4, 5, 7, 3}, {0, 0, 1, 2, 0, 0, 2, 1})}};

std::vector<std::string> move_names = {"U", "U2", "U'", "R", "R2", "R'", "F", "F2", "F'"};

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
		p[n - i - 1] = 9 * (c * p[n - i - 1] + o_index % c);
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
	std::vector<int> move_table(8 * 9, 0);
	for (int i = 0; i < 8; ++i)
	{
		std::vector<int> cp(8, -1);
		std::vector<int> co(8, -1);
		cp[i] = i;
		co[i] = 0;
		State state(cp, co);
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[j]], i);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i);
			move_table[9 * i + j] = std::distance(new_state.cp.begin(), it);
		}
	}
	return move_table;
}

std::vector<int> create_co_move_table()
{
	std::vector<int> move_table(2187 * 9, 0);
	for (int i = 0; i < 2187; ++i)
	{
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		index_to_o(co, i, 3, 8);
		State state(cp, co);
		for (int j = 0; j < 9; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[9 * i + j] = o_to_index(new_state.co, 3, 8);
		}
	}
	return move_table;
}

std::vector<int> create_multi_move_table(int n, int c, int pn, int size, const std::vector<int> &table)
{
	std::vector<int> move_table(size * 9, -1);
	int tmp;
	int tmp_i;
	std::vector<int> a(n);
	std::vector<int> b(n);
	std::vector<int> inv_move = {2, 1, 0, 5, 4, 3, 8, 7, 6};
	for (int i = 0; i < size; ++i)
	{
		index_to_array(a, i, n, c, pn);
		tmp_i = i * 9;
		for (int j = 0; j < 9; ++j)
		{
			if (move_table[tmp_i + j] == -1)
			{
				for (int k = 0; k < n; ++k)
				{
					b[k] = table[a[k] + j];
				}
				tmp = array_to_index(b, n, c, pn);
				move_table[tmp_i + j] = tmp;
				move_table[9 * tmp + inv_move[j]] = i;
			}
		}
	}
	return move_table;
}

void create_prune_table(int index, int size, const std::vector<int> &table, std::vector<unsigned char> &prune_table)
{
	int next_i;
	int index_tmp;
	int next_d;
	prune_table[index] = 0;
	int num = 1;
	int num_old = 1;
	for (int d = 0; d < 10; ++d)
	{
		next_d = d + 1;
		for (int i = 0; i < size; ++i)
		{
			if (prune_table[i] == d)
			{
				index_tmp = i * 9;
				for (int j = 0; j < 9; ++j)
				{
					next_i = table[index_tmp + j];
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
		num_old = num;
	}
}

const std::map<std::string, int> sticker_indices = {
	{"U1", 0}, {"U2", 1}, {"U3", 2}, {"U4", 3}, {"R1", 4}, {"R2", 5}, {"R3", 6}, {"R4", 7}, {"F1", 8}, {"F2", 9}, {"F3", 10}, {"F4", 11}, {"D1", 12}, {"D2", 13}, {"D3", 14}, {"D4", 15}, {"L1", 16}, {"L2", 17}, {"L3", 18}, {"L4", 19}, {"B1", 20}, {"B2", 21}, {"B3", 22}, {"B4", 23}};

const std::vector<std::vector<std::string>> corner_positions = {
	{"U1", "L1", "B2"},
	{"U2", "B1", "R2"},
	{"U4", "R1", "F2"},
	{"U3", "F1", "L2"},
	{"D3", "B4", "L3"},
	{"D4", "R4", "B3"},
	{"D2", "F4", "R3"},
	{"D1", "L4", "F3"}};

const std::map<std::string, std::pair<int, std::vector<char>>> corner_pieces = {
	{"ULB", {0, {'U', 'L', 'B'}}},
	{"UBR", {1, {'U', 'B', 'R'}}},
	{"URF", {2, {'U', 'R', 'F'}}},
	{"UFL", {3, {'U', 'F', 'L'}}},
	{"DBL", {4, {'D', 'B', 'L'}}},
	{"DRB", {5, {'D', 'R', 'B'}}},
	{"DFR", {6, {'D', 'F', 'R'}}},
	{"DLF", {7, {'D', 'L', 'F'}}},
};

void getStateVector(const std::string &defString, std::vector<int> &cp, std::vector<int> &co)
{
	std::vector<int> fullCornerState(8);

	for (int i = 0; i < 8; ++i)
	{
		const auto &pos_stickers = corner_positions[i];

		char c1 = defString[sticker_indices.at(pos_stickers[0])];
		char c2 = defString[sticker_indices.at(pos_stickers[1])];
		char c3 = defString[sticker_indices.at(pos_stickers[2])];

		std::string current_colors_sorted = {c1, c2, c3};
		std::sort(current_colors_sorted.begin(), current_colors_sorted.end());

		bool piece_found = false;
		for (const auto &pair : corner_pieces)
		{
			const std::string &piece_name = pair.first;
			const auto &piece_data = pair.second;

			std::string piece_colors_sorted = {piece_data.second[0], piece_data.second[1], piece_data.second[2]};
			std::sort(piece_colors_sorted.begin(), piece_colors_sorted.end());

			if (current_colors_sorted == piece_colors_sorted)
			{
				int base_index = piece_data.first;
				const auto &piece_colors_ordered = piece_data.second;

				int num_orientation;
				char primary_color = c1;

				if (primary_color == piece_colors_ordered[0])
				{
					num_orientation = 0;
				}
				else if (primary_color == piece_colors_ordered[2])
				{
					num_orientation = 1;
				}
				else
				{
					num_orientation = 2;
				}

				co[i] = num_orientation;
				cp[base_index] = i;

				piece_found = true;
				break;
			}
		}
	}
}

bool isSolvable(const std::vector<int> &co)
{
	int orientation_sum = 0;
	for (int o : co)
	{
		orientation_sum += o;
	}
	if (orientation_sum % 3 != 0)
	{
		return false;
	}
	return true;
}

struct search
{
	std::vector<int> sol;
	std::string scramble;
	int max_length;
	std::vector<int> single_cp_move_table;
	std::vector<int> cp_move_table;
	std::vector<int> co_move_table;
	std::vector<unsigned char> prune_table1;
	std::vector<unsigned char> prune_table2;
	std::vector<int> alg;
	int index1;
	int index2;
	int index1_tmp;
	int index2_tmp;
	int prune1_tmp;
	int prune2_tmp;
	std::string tmp;
	std::vector<int> cp;
	std::vector<int> co;
	std::mt19937 generator;
	std::uniform_int_distribution<> distribution_CP;
	std::uniform_int_distribution<> distribution_CO;
	std::vector<int> fullSet;

	search()
	{
		prune_table1 = std::vector<unsigned char>(40320, 255);
		single_cp_move_table = create_cp_move_table();
		cp_move_table = create_multi_move_table(8, 1, 8, 40320, single_cp_move_table);
		co_move_table = create_co_move_table();
		create_prune_table(0, 40320, cp_move_table, prune_table1);
		std::random_device rd;
		generator.seed(rd());
		distribution_CP = std::uniform_int_distribution<>(0, 5039);
		distribution_CO = std::uniform_int_distribution<>(0, 728);
		fullSet = {0, 1, 2, 3, 4, 5, 6, 7};
	}

	bool depth_limited_search(int arg_index1, int arg_index2, int depth, int prev)
	{
		for (int i = 0; i < 9; ++i)
		{
			if (prev < 3 && i / 3 == prev)
			{
				continue;
			}
			index1_tmp = cp_move_table[arg_index1 + i];
			prune1_tmp = prune_table1[index1_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			index2_tmp = co_move_table[arg_index2 + i];
			sol.emplace_back(i);
			if (depth == 1)
			{
				if (prune1_tmp == 0 && index2_tmp == 0)
				{
					tmp = AlgToString(sol);
					update(tmp.c_str());
					return true;
				}
			}
			else if (depth_limited_search(index1_tmp * 9, index2_tmp * 9, depth - 1, i / 3))
			{
				return true;
			}
			sol.pop_back();
		}
		return false;
	}

	void start_search(int arg_index1, int arg_index2)
	{
		sol.clear();
		index1 = arg_index1;
		index2 = arg_index2;
		prune1_tmp = prune_table1[index1];

		if (prune1_tmp == 0 && index2 == 0)
		{
			update("Solved");
		}
		else
		{
			index1 *= 9;
			index2 *= 9;
			for (int d = prune1_tmp; d <= 11; d++)
			{
				if (depth_limited_search(index1, index2, d, 3))
				{
					break;
				}
			}
		}
	}

	void solve(std::string defString)
	{
		cp.resize(8);
		co.resize(8);
		getStateVector(defString, cp, co);
		if (!isSolvable(co))
		{
			update("Error");
		}
		else
		{
			index1 = array_to_index(cp, 8, 1, 8);
			index2 = o_to_index(co, 3, 8);
			start_search(index1, index2);
		}
	}

	void getScramble()
	{
		sol.clear();
		while (true)
		{
			int index1_tmp2 = distribution_CP(generator);
			int index2_tmp2 = distribution_CO(generator);
			cp.resize(7);
			index_to_array(cp, index1_tmp2, 7, 1, 8);
			for (int i = 0; i < 7; ++i)
			{
				cp[i] /= 9;
			}
			std::set<int> currentSet(cp.begin(), cp.end());
			std::vector<int> missing;
			std::set_difference(fullSet.begin(), fullSet.end(), currentSet.begin(), currentSet.end(), std::back_inserter(missing));
			auto it = std::find(cp.begin(), cp.end(), 4);
			if (it == cp.end())
			{
				cp.insert(cp.begin() + 4, 4);
			}
			else
			{
				int index = std::distance(cp.begin(), it);
				cp.erase(it);
				if (!missing.empty())
				{
					cp.insert(cp.begin() + index, missing[0]);
				}
				cp.insert(cp.begin() + 4, 4);
			}
			co.resize(7);
			index_to_o(co, index2_tmp2, 3, 7);
			co.insert(co.begin() + 4, 0);
			index1 = array_to_index(cp, 8, 1, 8);
			index2 = o_to_index(co, 3, 8);
			prune1_tmp = prune_table1[index1];
			if (prune1_tmp == 0 && index2 == 0)
			{
				continue;
			}
			else
			{
				break;
			}
		}
		index1 *= 9;
		index2 *= 9;
		for (int d = prune1_tmp; d <= 11; d++)
		{
			if (depth_limited_search(index1, index2, d, 3))
			{
				break;
			}
		}
	}
};

EMSCRIPTEN_BINDINGS(my_module)
{
	emscripten::class_<search>("search")
		.constructor<>()
		.function("solve", &search::solve)
		.function("getScramble", &search::getScramble);
}