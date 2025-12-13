#include <emscripten/bind.h>
#include <emscripten.h>
#include <iostream>
#include <vector>
#include <algorithm>
#include <unordered_map>
#include <string>
#include <sstream>
#include <cstdlib>
#include <cmath>
#include <functional>

int analyzer_count = 0;

EM_JS(void, update, (const char *str), {
	postMessage(UTF8ToString(str));
});

struct State
{
	std::vector<int> cp;
	std::vector<int> co;
	std::vector<int> ep;
	std::vector<int> eo;

	State(std::vector<int> arg_cp = {0, 1, 2, 3, 4, 5, 6, 7}, std::vector<int> arg_co = {0, 0, 0, 0, 0, 0, 0, 0}, std::vector<int> arg_ep = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, std::vector<int> arg_eo = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}) : cp(arg_cp), co(arg_co), ep(arg_ep), eo(arg_eo) {}

	State apply_move(State move)
	{
		std::vector<int> new_cp;
		std::vector<int> new_co;
		std::vector<int> new_ep;
		std::vector<int> new_eo;
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
		return State(new_cp, new_co, new_ep, new_eo);
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
		return State(cp, co, new_ep, new_eo);
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
		return State(new_cp, new_co, ep, eo);
	}
};

std::unordered_map<std::string, State> moves = {
	{"U", State({3, 0, 1, 2, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"U2", State({2, 3, 0, 1, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 6, 7, 4, 5, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"U'", State({1, 2, 3, 0, 4, 5, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"D", State({0, 1, 2, 3, 5, 6, 7, 4}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 8}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"D2", State({0, 1, 2, 3, 6, 7, 4, 5}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 8, 9}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"D'", State({0, 1, 2, 3, 7, 4, 5, 6}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 2, 3, 4, 5, 6, 7, 11, 8, 9, 10}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"L", State({4, 1, 2, 0, 7, 5, 6, 3}, {2, 0, 0, 1, 1, 0, 0, 2}, {11, 1, 2, 7, 4, 5, 6, 0, 8, 9, 10, 3}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"L2", State({7, 1, 2, 4, 3, 5, 6, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {3, 1, 2, 0, 4, 5, 6, 11, 8, 9, 10, 7}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"L'", State({3, 1, 2, 7, 0, 5, 6, 4}, {2, 0, 0, 1, 1, 0, 0, 2}, {7, 1, 2, 11, 4, 5, 6, 3, 8, 9, 10, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"R", State({0, 2, 6, 3, 4, 1, 5, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 5, 9, 3, 4, 2, 6, 7, 8, 1, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"R2", State({0, 6, 5, 3, 4, 2, 1, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 2, 1, 3, 4, 9, 6, 7, 8, 5, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"R'", State({0, 5, 1, 3, 4, 6, 2, 7}, {0, 1, 2, 0, 0, 2, 1, 0}, {0, 9, 5, 3, 4, 1, 6, 7, 8, 2, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"F", State({0, 1, 3, 7, 4, 5, 2, 6}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 6, 10, 4, 5, 3, 7, 8, 9, 2, 11}, {0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0})},
	{"F2", State({0, 1, 7, 6, 4, 5, 3, 2}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 1, 3, 2, 4, 5, 10, 7, 8, 9, 6, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"F'", State({0, 1, 6, 2, 4, 5, 7, 3}, {0, 0, 1, 2, 0, 0, 2, 1}, {0, 1, 10, 6, 4, 5, 2, 7, 8, 9, 3, 11}, {0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0})},
	{"B", State({1, 5, 2, 3, 0, 4, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {4, 8, 2, 3, 1, 5, 6, 7, 0, 9, 10, 11}, {1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0})},
	{"B2", State({5, 4, 2, 3, 1, 0, 6, 7}, {0, 0, 0, 0, 0, 0, 0, 0}, {1, 0, 2, 3, 8, 5, 6, 7, 4, 9, 10, 11}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0})},
	{"B'", State({4, 0, 2, 3, 5, 1, 6, 7}, {1, 2, 0, 0, 2, 1, 0, 0}, {8, 4, 2, 3, 0, 5, 6, 7, 1, 9, 10, 11}, {1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0})}};

std::vector<std::string> move_names = {"U", "U2", "U'", "D", "D2", "D'", "L", "L2", "L'", "R", "R2", "R'", "F", "F2", "F'", "B", "B2", "B'"};

std::string AlgToString(std::vector<int> alg)
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

std::vector<int> AlgConvertRotation(std::vector<int> alg, std::string rotation)
{
	if (rotation.empty())
	{
		return alg;
	}
	std::vector<int> face_list_0 = {0, 1, 2, 3, 4, 5};
	std::vector<int> face_list;
	if (rotation == "x")
	{
		face_list = {5, 4, 2, 3, 0, 1};
	}
	else if (rotation == "x2")
	{
		face_list = {1, 0, 2, 3, 5, 4};
	}
	else if (rotation == "x'")
	{
		face_list = {4, 5, 2, 3, 1, 0};
	}
	else if (rotation == "y")
	{
		face_list = {0, 1, 5, 4, 2, 3};
	}
	else if (rotation == "y2")
	{
		face_list = {0, 1, 3, 2, 5, 4};
	}
	else if (rotation == "y'")
	{
		face_list = {0, 1, 4, 5, 3, 2};
	}
	else if (rotation == "z")
	{
		face_list = {3, 2, 0, 1, 4, 5};
	}
	else if (rotation == "z2")
	{
		face_list = {1, 0, 3, 2, 4, 5};
	}
	else if (rotation == "z'")
	{
		face_list = {2, 3, 1, 0, 4, 5};
	}
	for (size_t i = 0; i < alg.size(); ++i)
	{
		alg[i] = 3 * face_list[alg[i] / 3] + alg[i] % 3;
	}
	return alg;
}

std::vector<int> AlgRotation(std::vector<int> alg, std::string rotation_algString)
{
	std::istringstream iss(rotation_algString);
	std::string rot;
	while (iss >> rot)
	{
		alg = AlgConvertRotation(alg, rot);
	}
	return alg;
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
		p[n - i - 1] = 18 * (c * p[n - i - 1] + o_index % c);
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
	std::vector<int> move_table(24 * 18, -1);
	int index;
	for (int i = 0; i < 24; ++i)
	{
		std::vector<int> ep(12, -1);
		std::vector<int> eo(12, -1);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		ep[i / 2] = i / 2;
		eo[i / 2] = i % 2;
		State state(cp, co, ep, eo);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_edge(moves[move_names[j]], i / 2);
			auto it = std::find(new_state.ep.begin(), new_state.ep.end(), i / 2);
			index = std::distance(new_state.ep.begin(), it);
			move_table[18 * i + j] = 2 * index + new_state.eo[index];
		}
	}
	return move_table;
}

std::vector<int> create_ep_move_table()
{
	std::vector<int> move_table(12 * 18, -1);
	for (int i = 0; i < 12; ++i)
	{
		std::vector<int> ep(12, -1);
		std::vector<int> eo(12, -1);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		ep[i] = i;
		eo[i] = 0;
		State state(cp, co, ep, eo);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_edge(moves[move_names[j]], i);
			auto it = std::find(new_state.ep.begin(), new_state.ep.end(), i);
			move_table[18 * i + j] = std::distance(new_state.ep.begin(), it);
		}
	}
	return move_table;
}

std::vector<int> create_eo_move_table()
{
	std::vector<int> move_table(2048 * 18, -1);
	for (int i = 0; i < 2048; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		index_to_o(eo, i, 2, 12);
		State state(cp, co, ep, eo);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[18 * i + j] = 18 * o_to_index(new_state.eo, 2, 12);
		}
	}
	return move_table;
}

std::vector<int> create_corner_move_table()
{
	std::vector<int> move_table(24 * 18, -1);
	int index;
	for (int i = 0; i < 24; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, -1);
		std::vector<int> co(8, -1);
		cp[i / 3] = i / 3;
		co[i / 3] = i % 3;
		State state(cp, co, ep, eo);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[j]], i / 3);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i / 3);
			index = std::distance(new_state.cp.begin(), it);
			move_table[18 * i + j] = 3 * index + new_state.co[index];
		}
	}
	return move_table;
}

std::vector<int> create_cp_move_table()
{
	std::vector<int> move_table(8 * 18, 0);
	for (int i = 0; i < 8; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, -1);
		std::vector<int> co(8, -1);
		cp[i] = i;
		co[i] = 0;
		State state(cp, co, ep, eo);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move_corner(moves[move_names[j]], i);
			auto it = std::find(new_state.cp.begin(), new_state.cp.end(), i);
			move_table[18 * i + j] = std::distance(new_state.cp.begin(), it);
		}
	}
	return move_table;
}

std::vector<int> create_co_move_table()
{
	std::vector<int> move_table(2187 * 18, 0);
	for (int i = 0; i < 2187; ++i)
	{
		std::vector<int> ep(12, 0);
		std::vector<int> eo(12, 0);
		std::vector<int> cp(8, 0);
		std::vector<int> co(8, 0);
		index_to_o(co, i, 3, 8);
		State state(cp, co, ep, eo);
		for (int j = 0; j < 18; ++j)
		{
			State new_state = state.apply_move(moves[move_names[j]]);
			move_table[18 * i + j] = 18 * o_to_index(new_state.co, 3, 8);
		}
	}
	return move_table;
}

std::vector<int> create_multi_move_table(int n, int c, int pn, int size, const std::vector<int> &table)
{
	std::vector<int> move_table(size * 18, -1);
	int tmp;
	int tmp_i;
	std::vector<int> a(n);
	std::vector<int> b(n);
	std::vector<int> inv_move = {2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15};
	for (int i = 0; i < size; ++i)
	{
		index_to_array(a, i, n, c, pn);
		tmp_i = i * 18;
		for (int j = 0; j < 18; ++j)
		{
			if (move_table[tmp_i + j] == -1)
			{
				for (int k = 0; k < n; ++k)
				{
					b[k] = table[a[k] + j];
				}
				tmp = array_to_index(b, n, c, pn);
				move_table[tmp_i + j] = tmp;
				move_table[18 * tmp + inv_move[j]] = i;
			}
		}
	}
	return move_table;
}

std::vector<int> create_multi_move_table2(int n, int c, int pn, int size, const std::vector<int> &table)
{
	std::vector<int> move_table(size * 24, -1);
	int tmp;
	int tmp_i;
	std::vector<int> a(n);
	std::vector<int> b(n);
	std::vector<int> inv_move = {2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15};
	for (int i = 0; i < size; ++i)
	{
		index_to_array(a, i, n, c, pn);
		tmp_i = i * 24;
		for (int j = 0; j < 18; ++j)
		{
			if (move_table[tmp_i + j] == -1)
			{
				for (int k = 0; k < n; ++k)
				{
					b[k] = table[a[k] + j];
				}
				tmp = 24 * array_to_index(b, n, c, pn);
				move_table[tmp_i + j] = tmp;
				move_table[tmp + inv_move[j]] = tmp_i;
			}
		}
	}
	return move_table;
}

std::vector<unsigned char> create_prune_table_cross(int depth, const std::vector<int> &table1, const std::vector<int> &table2)
{
	int size1 = 528;
	int size2 = 528;
	int size = size1 * size2;
	std::vector<unsigned char> prune_table(size, 255);
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
	for (int d = 0; d < depth; ++d)
	{
		next_d = d + 1;
		for (int i = 0; i < size; ++i)
		{
			if (prune_table[i] == d)
			{
				index1_tmp = (i / size2) * 18;
				index2_tmp = (i % size2) * 18;
				index1_tmp_end = index1_tmp + 18;
				index2_tmp_end = index2_tmp + 18;
				for (int j = index1_tmp, k = index2_tmp; j < index1_tmp_end && k < index2_tmp_end; ++j, ++k)
				{
					next_i = table1[j] * size2 + table2[k];
					if (prune_table[next_i] == 255)
					{
						prune_table[next_i] = next_d;
					}
				}
			}
		}
	}
	return prune_table;
}

void create_prune_table_xcross(int index2, int depth, const std::vector<int> &table1, const std::vector<int> &table2, std::vector<unsigned char> &prune_table)
{
	int size1 = 190080;
	int size2 = 24;
	int size = size1 * size2;
	int next_i;
	int index1_tmp;
	int index2_tmp;
	int next_d;
	std::vector<int> a = {16, 18, 20, 22};
	int index1 = array_to_index(a, 4, 2, 12);
	prune_table[index1 * size2 + index2] = 0;
	prune_table[table1[index1 * 24 + 3] + table2[index2 * 18 + 3]] = 0;
	prune_table[table1[index1 * 24 + 4] + table2[index2 * 18 + 4]] = 0;
	prune_table[table1[index1 * 24 + 5] + table2[index2 * 18 + 5]] = 0;
	for (int d = 0; d < depth; ++d)
	{
		next_d = d + 1;
		for (int i = 0; i < size; ++i)
		{
			if (prune_table[i] == d)
			{
				index1_tmp = (i / size2) * 24;
				index2_tmp = (i % size2) * 18;
				for (int j = 0; j < 18; ++j)
				{
					next_i = table1[index1_tmp + j] + table2[index2_tmp + j];
					prune_table[next_i] = prune_table[next_i] == 255 ? next_d : prune_table[next_i];
				}
			}
		}
	}
}

std::vector<bool> create_ma_table()
{
	std::vector<bool> ma;
	bool condition;
	for (int prev = 0; prev < 19; ++prev)
	{
		for (int i = 0; i < 18; ++i)
		{
			condition = (prev < 18) &&
						(i / 3 == prev / 3 ||
						 ((i / 3) / 2 == (prev / 3) / 2 && (prev / 3) % 2 > (i / 3) % 2));
			ma.emplace_back(condition);
		}
	}
	return ma;
}

struct cross_analyzer
{
	std::vector<int> sol;
	std::string scramble;
	std::string rotation;
	int max_length;
	int sol_num;
	int count;
	std::vector<int> edge_move_table;
	std::vector<int> multi_move_table;
	std::vector<unsigned char> prune_table;
	std::vector<int> alg;
	std::vector<std::string> restrict;
	std::vector<int> move_restrict;
	std::vector<bool> ma;
	int index1;
	int index2;
	int index1_tmp;
	int index2_tmp;
	int prune_tmp;
	int total_length;
	std::vector<int> sol_len;
	int current_max_depth;

	cross_analyzer()
	{
		edge_move_table = create_edge_move_table();
		multi_move_table = create_multi_move_table(2, 2, 12, 24 * 22, edge_move_table);
		index1 = 416;
		index2 = 520;
		prune_table = create_prune_table_cross(8, multi_move_table, multi_move_table);
		ma = create_ma_table();
	}

	bool depth_limited_search(int arg_index1, int arg_index2, int depth, int prev)
	{
		for (int i : move_restrict)
		{
			if (ma[prev + i])
			{
				continue;
			}
			index1_tmp = multi_move_table[arg_index1 + i];
			index2_tmp = multi_move_table[arg_index2 + i];
			prune_tmp = prune_table[index1_tmp * 528 + index2_tmp];
			if (prune_tmp >= depth)
			{
				continue;
			}
			sol[current_max_depth - depth] = i;
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
						if (index1_tmp2 == multi_move_table[index1_tmp2 + j] * 18 && index2_tmp2 == multi_move_table[index2_tmp2 + j] * 18)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + j];
							index2_tmp2 = multi_move_table[index2_tmp2 + j];
							if (c < l && prune_table[index1_tmp2 * 528 + index2_tmp2] == 0)
							{
								valid = false;
								break;
							}
							index1_tmp2 *= 18;
							index2_tmp2 *= 18;
						}
					}
					if (valid)
					{
						count += 1;
						total_length += sol.size();
						sol_len.emplace_back(sol.size());
						if (count == sol_num)
						{
							return true;
						}
					}
				}
			}
			else if (depth_limited_search(index1_tmp * 18, index2_tmp * 18, depth - 1, i * 18))
			{
				return true;
			}
		}
		return false;
	}

	std::string converter(std::string input)
	{
		std::vector<std::string> rotations = {"", "z2", "z'", "z", "x'", "x"};
		std::vector<std::string> rotations_js = {"''", "'z2'", "'z\\''", "'z'", "'x\\''", "'x'"};
		auto it = std::find(rotations.begin(), rotations.end(), input);
		return rotations_js[std::distance(rotations.begin(), it)];
	}

	std::string converter_face(std::string input)
	{
		std::vector<std::string> rotations = {"", "z2", "z'", "z", "x'", "x"};
		std::vector<std::string> rotations_js = {"'D'", "'U'", "'L'", "'R'", "'F'", "'B'"};
		auto it = std::find(rotations.begin(), rotations.end(), input);
		return rotations_js[std::distance(rotations.begin(), it)];
	}

	void start_search(std::string arg_scramble, std::string name, std::string name2, int arg_sol_num, std::vector<std::string> rotations)
	{
		scramble = arg_scramble;
		max_length = 20;
		sol_num = arg_sol_num;
		restrict = move_names;
		analyzer_count++;
		std::string count_string = std::to_string(analyzer_count);
		std::string result = "<tr><th class=\"No\">" + count_string + "</th><th class=\"slot\">None</th><th class=\"pslot\">None</th>";
		move_restrict.clear();
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}

		for (std::string rot : rotations)
		{
			std::vector<int> alg = AlgRotation(StringToAlg(scramble), rot);
			index1 = 416;
			index2 = 520;
			count = 0;
			total_length = 0;
			sol.clear();
			sol_len.clear();
			for (int m : alg)
			{
				index1 = multi_move_table[index1 * 18 + m];
				index2 = multi_move_table[index2 * 18 + m];
			}
			prune_tmp = prune_table[index1 * 528 + index2];
			if (prune_tmp == 0)
			{
				result += "<td class=" + converter_face(rot) + ">0</td>";
			}
			else
			{
				index1 *= 18;
				index2 *= 18;
				for (int d = prune_tmp; d <= max_length; d++)
				{
					current_max_depth = d;
					sol.resize(d);
					if (depth_limited_search(index1, index2, d, 324))
					{
						break;
					}
				}
				std::ostringstream oss;
				if (arg_sol_num > 1)
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << round(double(total_length) * 10 / sol_num) / 10 << "</td>";
				}
				else
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << sol_len[0] << "</td>";
				}
				result += oss.str();
			}
		}
		update((result + "</tr>").c_str());
	}
};

struct xcross_analyzer2
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
	std::vector<int> edge_move_table;
	std::vector<int> corner_move_table;
	std::vector<int> multi_move_table;
	std::vector<unsigned char> prune_table1;
	std::vector<unsigned char> prune_table2;
	std::vector<unsigned char> prune_table3;
	std::vector<unsigned char> prune_table4;
	std::vector<int> alg;
	std::vector<std::string> restrict;
	std::vector<int> move_restrict;
	std::vector<bool> ma;
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
	int total_length;
	std::vector<int> sol_len;
	int current_max_depth;

	xcross_analyzer2()
	{
		edge_move_table = create_edge_move_table();
		corner_move_table = create_corner_move_table();
		multi_move_table = create_multi_move_table2(4, 2, 12, 24 * 22 * 20 * 18, edge_move_table);
		ma = create_ma_table();
		std::vector<int> edge_index = {187520, 187520, 187520, 187520};
		std::vector<int> corner_index = {12, 15, 18, 21};
		prune_table1 = std::vector<unsigned char>(190080 * 24, 255);
		prune_table2 = std::vector<unsigned char>(190080 * 24, 255);
		prune_table3 = std::vector<unsigned char>(190080 * 24, 255);
		prune_table4 = std::vector<unsigned char>(190080 * 24, 255);
		create_prune_table_xcross(corner_index[0], 10, multi_move_table, corner_move_table, prune_table1);
		create_prune_table_xcross(corner_index[1], 10, multi_move_table, corner_move_table, prune_table2);
		create_prune_table_xcross(corner_index[2], 10, multi_move_table, corner_move_table, prune_table3);
		create_prune_table_xcross(corner_index[3], 10, multi_move_table, corner_move_table, prune_table4);
	}

	bool depth_limited_search_1(int arg_index1, int arg_index2, int arg_index3, int depth, int prev, std::vector<unsigned char> &prune1)
	{
		for (int i : move_restrict)
		{
			if (ma[prev + i])
			{
				continue;
			}
			index1_tmp = multi_move_table[arg_index1 + i];
			index2_tmp = corner_move_table[arg_index2 + i];
			index3_tmp = edge_move_table[arg_index3 + i];
			prune1_tmp = prune1[index1_tmp + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			sol[current_max_depth - depth] = i;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && index3_tmp == edge_solved1)
				{
					bool valid = true;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index3_tmp2 = index3;
					for (int j : sol)
					{
						if (index1_tmp2 == multi_move_table[index1_tmp2 + j] && index2_tmp2 == corner_move_table[index2_tmp2 + j] * 18 && index3_tmp2 == edge_move_table[index3_tmp2 + j] * 18)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + j];
							index2_tmp2 = corner_move_table[index2_tmp2 + j];
							index3_tmp2 = edge_move_table[index3_tmp2 + j];
							if (c < l && (prune_table1[index1_tmp2 + index2_tmp2] == 0 && index3_tmp2 == edge_solved1))
							{
								valid = false;
								break;
							}
							index2_tmp2 *= 18;
							index3_tmp2 *= 18;
						}
					}
					if (valid)
					{
						count += 1;
						total_length += sol.size();
						sol_len.emplace_back(sol.size());
						if (count == sol_num)
						{
							return true;
						}
					}
				}
			}
			else if (depth_limited_search_1(index1_tmp, index2_tmp * 18, index3_tmp * 18, depth - 1, i * 18, prune1))
			{
				return true;
			}
		}
		return false;
	}

	std::string converter(std::string input)
	{
		std::vector<std::string> rotations = {"", "z2", "z'", "z", "x'", "x"};
		std::vector<std::string> rotations_js = {"''", "'z2'", "'z\\''", "'z'", "'x\\''", "'x'"};
		auto it = std::find(rotations.begin(), rotations.end(), input);
		return rotations_js[std::distance(rotations.begin(), it)];
	}

	std::string converter_face(std::string input)
	{
		std::vector<std::string> rotations = {"", "z2", "z'", "z", "x'", "x"};
		std::vector<std::string> rotations_js = {"'D'", "'U'", "'L'", "'R'", "'F'", "'B'"};
		auto it = std::find(rotations.begin(), rotations.end(), input);
		return rotations_js[std::distance(rotations.begin(), it)];
	}

	void start_search_1(std::string arg_scramble, int arg_slot1, int arg_pslot1, std::vector<unsigned char> &prune1, std::string name, std::string name2, int arg_sol_num, std::vector<std::string> rotations)
	{
		move_restrict.clear();
		scramble = arg_scramble;
		slot1 = arg_slot1;
		pslot1 = arg_pslot1;
		max_length = 20;
		sol_num = arg_sol_num;
		restrict = move_names;
		analyzer_count++;
		std::string count_string = std::to_string(analyzer_count);
		std::string result = "<tr><th class=\"No\">" + count_string + "</th><th class=\"slot\">" + name + "</th><th class=\"pslot\">" + name2 + "</th>";
		std::vector<int> edge_index = {187520, 187520, 187520, 187520};
		std::vector<int> single_edge_index = {0, 2, 4, 6};
		std::vector<int> corner_index = {12, 15, 18, 21};
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		for (std::string rot : rotations)
		{
			total_length = 0;
			sol.clear();
			sol_len.clear();
			count = 0;
			index1 = edge_index[slot1];
			index2 = corner_index[pslot1];
			index3 = single_edge_index[slot1];
			edge_solved1 = index3;
			index1 *= 24;
			std::vector<int> alg = AlgRotation(StringToAlg(scramble), rot);
			for (int m : alg)
			{
				index1 = multi_move_table[index1 + m];
				index2 = corner_move_table[index2 * 18 + m];
				index3 = edge_move_table[index3 * 18 + m];
			}
			prune1_tmp = prune1[index1 + index2];
			if (prune1_tmp == 0 && index3 == edge_solved1)
			{
				result += "<td class=" + converter_face(rot) + ">0</td>";
			}
			else
			{
				index2 *= 18;
				index3 *= 18;
				for (int d = prune1_tmp; d <= max_length; d++)
				{
					current_max_depth = d;
					sol.resize(d);
					if (depth_limited_search_1(index1, index2, index3, d, 324, prune1))
					{
						break;
					}
				}
				std::ostringstream oss;
				if (arg_sol_num > 1)
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << round(double(total_length) * 10 / sol_num) / 10 << "</td>";
				}
				else
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << sol_len[0] << "</td>";
				}
				result += oss.str();
			}
		}
		update((result + "</tr>").c_str());
	}

	void xcross_analyze(std::string scramble, int arg_sol_num, std::vector<std::string> rotations)
	{

		start_search_1(scramble, 0, 0, prune_table1, "BL", "BL", arg_sol_num, rotations);
		start_search_1(scramble, 0, 1, prune_table2, "BL", "BR", arg_sol_num, rotations);
		start_search_1(scramble, 0, 2, prune_table3, "BL", "FR", arg_sol_num, rotations);
		start_search_1(scramble, 0, 3, prune_table4, "BL", "FL", arg_sol_num, rotations);

		start_search_1(scramble, 1, 0, prune_table1, "BR", "BL", arg_sol_num, rotations);
		start_search_1(scramble, 1, 1, prune_table2, "BR", "BR", arg_sol_num, rotations);
		start_search_1(scramble, 1, 2, prune_table3, "BR", "FR", arg_sol_num, rotations);
		start_search_1(scramble, 1, 3, prune_table4, "BR", "FL", arg_sol_num, rotations);

		start_search_1(scramble, 2, 0, prune_table1, "FR", "BL", arg_sol_num, rotations);
		start_search_1(scramble, 2, 1, prune_table2, "FR", "BR", arg_sol_num, rotations);
		start_search_1(scramble, 2, 2, prune_table3, "FR", "FR", arg_sol_num, rotations);
		start_search_1(scramble, 2, 3, prune_table4, "FR", "FL", arg_sol_num, rotations);

		start_search_1(scramble, 3, 0, prune_table1, "FL", "BL", arg_sol_num, rotations);
		start_search_1(scramble, 3, 1, prune_table2, "FL", "BR", arg_sol_num, rotations);
		start_search_1(scramble, 3, 2, prune_table3, "FL", "FR", arg_sol_num, rotations);
		start_search_1(scramble, 3, 3, prune_table4, "FL", "FL", arg_sol_num, rotations);
	}

	bool depth_limited_search_2(int arg_index1, int arg_index2, int arg_index4, int arg_index5, int arg_index6, int depth, int prev, std::vector<unsigned char> &prune1, std::vector<unsigned char> &prune2)
	{
		for (int i : move_restrict)
		{
			if (ma[prev + i])
			{
				continue;
			}
			index1_tmp = multi_move_table[arg_index1 + i];
			index2_tmp = corner_move_table[arg_index2 + i];
			index5_tmp = edge_move_table[arg_index5 + i];
			prune1_tmp = prune1[index1_tmp + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			index4_tmp = corner_move_table[arg_index4 + i];
			index6_tmp = edge_move_table[arg_index6 + i];
			prune2_tmp = prune2[index1_tmp + index4_tmp];
			if (prune2_tmp >= depth)
			{
				continue;
			}
			sol[current_max_depth - depth] = i;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && prune2_tmp == 0 && index5_tmp == edge_solved1 && index6_tmp == edge_solved2)
				{
					bool valid = true;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index4_tmp2 = index4;
					int index5_tmp2 = index5;
					int index6_tmp2 = index6;
					for (int j : sol)
					{
						if (index1_tmp2 == multi_move_table[index1_tmp2 + j] && index2_tmp2 == corner_move_table[index2_tmp2 + j] * 18 && index4_tmp2 == corner_move_table[index4_tmp2 + j] * 18 && index5_tmp2 == edge_move_table[index5_tmp2 + j] * 18 && index6_tmp2 == edge_move_table[index6_tmp2 + j] * 18)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + j];
							index2_tmp2 = corner_move_table[index2_tmp2 + j];
							index4_tmp2 = corner_move_table[index4_tmp2 + j];
							index5_tmp2 = edge_move_table[index5_tmp2 + j];
							index6_tmp2 = edge_move_table[index6_tmp2 + j];
							if (c < l && (prune_table1[index1_tmp2 + index2_tmp2] == 0 && prune_table2[index1_tmp2 + index4_tmp2] == 0 && index5_tmp2 == edge_solved1 && index6_tmp2 == edge_solved2))
							{
								valid = false;
								break;
							}
							index2_tmp2 *= 18;
							index4_tmp2 *= 18;
							index5_tmp2 *= 18;
							index6_tmp2 *= 18;
						}
					}
					if (valid)
					{
						count += 1;
						total_length += sol.size();
						sol_len.emplace_back(sol.size());
						if (count == sol_num)
						{
							return true;
						}
					}
				}
			}
			else if (depth_limited_search_2(index1_tmp, index2_tmp * 18, index4_tmp * 18, index5_tmp * 18, index6_tmp * 18, depth - 1, i * 18, prune1, prune2))
			{
				return true;
			}
		}
		return false;
	}

	void start_search_2(std::string arg_scramble, int arg_slot1, int arg_slot2, int arg_pslot1, int arg_pslot2, std::vector<unsigned char> &prune1, std::vector<unsigned char> &prune2, std::string name, std::string name2, int arg_sol_num, std::vector<std::string> rotations)
	{
		move_restrict.clear();
		scramble = arg_scramble;
		slot1 = arg_slot1;
		slot2 = arg_slot2;
		pslot1 = arg_pslot1;
		pslot2 = arg_pslot2;
		max_length = 20;
		sol_num = arg_sol_num;
		restrict = move_names;
		analyzer_count++;
		std::string count_string = std::to_string(analyzer_count);
		std::string result = "<tr><th class=\"No\">" + count_string + "</th><th class=\"slot\">" + name + "</th><th class=\"pslot\">" + name2 + "</th>";
		std::vector<int> edge_index = {187520, 187520, 187520, 187520};
		std::vector<int> single_edge_index = {0, 2, 4, 6};
		std::vector<int> corner_index = {12, 15, 18, 21};
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		for (std::string rot : rotations)
		{
			count = 0;
			total_length = 0;
			sol.clear();
			sol_len.clear();
			index1 = edge_index[slot1];
			index2 = corner_index[pslot1];
			index5 = single_edge_index[slot1];
			edge_solved1 = index5;
			index4 = corner_index[pslot2];
			index6 = single_edge_index[slot2];
			edge_solved2 = index6;
			index1 *= 24;
			std::vector<int> alg = AlgRotation(StringToAlg(scramble), rot);
			for (int m : alg)
			{
				index1 = multi_move_table[index1 + m];
				index2 = corner_move_table[index2 * 18 + m];
				index4 = corner_move_table[index4 * 18 + m];
				index5 = edge_move_table[index5 * 18 + m];
				index6 = edge_move_table[index6 * 18 + m];
			}
			prune1_tmp = prune1[index1 + index2];
			prune2_tmp = prune2[index1 + index4];
			if (prune1_tmp == 0 && prune2_tmp == 0 && index5 == edge_solved1 && index6 == edge_solved2)
			{
				result += "<td class=" + converter_face(rot) + ">0</td>";
			}
			else
			{
				index2 *= 18;
				index4 *= 18;
				index5 *= 18;
				index6 *= 18;
				for (int d = std::max(prune1_tmp, prune2_tmp); d <= max_length; d++)
				{
					current_max_depth = d;
					sol.resize(d);
					if (depth_limited_search_2(index1, index2, index4, index5, index6, d, 324, prune1, prune2))
					{
						break;
					}
				}
				std::ostringstream oss;
				if (arg_sol_num > 1)
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << round(double(total_length) * 10 / sol_num) / 10 << "</td>";
				}
				else
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << sol_len[0] << "</td>";
				}
				result += oss.str();
			}
		}
		update((result + "</tr>").c_str());
	}

	void xxcross_analyze(std::string scramble, int arg_sol_num, std::vector<std::string> rotations)
	{

		start_search_2(scramble, 0, 1, 0, 1, prune_table1, prune_table2, "BL BR", "BL BR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 1, 0, 2, prune_table1, prune_table3, "BL BR", "BL FR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 1, 0, 3, prune_table1, prune_table4, "BL BR", "BL FL", arg_sol_num, rotations);
		start_search_2(scramble, 0, 1, 1, 2, prune_table2, prune_table3, "BL BR", "BR FR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 1, 1, 3, prune_table2, prune_table4, "BL BR", "BR FL", arg_sol_num, rotations);
		start_search_2(scramble, 0, 1, 2, 3, prune_table3, prune_table4, "BL BR", "FR FL", arg_sol_num, rotations);

		start_search_2(scramble, 0, 2, 0, 1, prune_table1, prune_table2, "BL FR", "BL BR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 2, 0, 2, prune_table1, prune_table3, "BL FR", "BL FR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 2, 0, 3, prune_table1, prune_table4, "BL FR", "BL FL", arg_sol_num, rotations);
		start_search_2(scramble, 0, 2, 1, 2, prune_table2, prune_table3, "BL FR", "BR FR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 2, 1, 3, prune_table2, prune_table4, "BL FR", "BR FL", arg_sol_num, rotations);
		start_search_2(scramble, 0, 2, 2, 3, prune_table3, prune_table4, "BL FR", "FR FL", arg_sol_num, rotations);

		start_search_2(scramble, 0, 3, 0, 1, prune_table1, prune_table2, "BL FL", "BL BR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 3, 0, 2, prune_table1, prune_table3, "BL FL", "BL FR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 3, 0, 3, prune_table1, prune_table4, "BL FL", "BL FL", arg_sol_num, rotations);
		start_search_2(scramble, 0, 3, 1, 2, prune_table2, prune_table3, "BL FL", "BR FR", arg_sol_num, rotations);
		start_search_2(scramble, 0, 3, 1, 3, prune_table2, prune_table4, "BL FL", "BR FL", arg_sol_num, rotations);
		start_search_2(scramble, 0, 3, 2, 3, prune_table3, prune_table4, "BL FL", "FR FL", arg_sol_num, rotations);

		start_search_2(scramble, 1, 2, 0, 1, prune_table1, prune_table2, "BR FR", "BL BR", arg_sol_num, rotations);
		start_search_2(scramble, 1, 2, 0, 2, prune_table1, prune_table3, "BR FR", "BL FR", arg_sol_num, rotations);
		start_search_2(scramble, 1, 2, 0, 3, prune_table1, prune_table4, "BR FR", "BL FL", arg_sol_num, rotations);
		start_search_2(scramble, 1, 2, 1, 2, prune_table2, prune_table3, "BR FR", "BR FR", arg_sol_num, rotations);
		start_search_2(scramble, 1, 2, 1, 3, prune_table2, prune_table4, "BR FR", "BR FL", arg_sol_num, rotations);
		start_search_2(scramble, 1, 2, 2, 3, prune_table3, prune_table4, "BR FR", "FR FL", arg_sol_num, rotations);

		start_search_2(scramble, 1, 3, 0, 1, prune_table1, prune_table2, "BR FL", "BL BR", arg_sol_num, rotations);
		start_search_2(scramble, 1, 3, 0, 2, prune_table1, prune_table3, "BR FL", "BL FR", arg_sol_num, rotations);
		start_search_2(scramble, 1, 3, 0, 3, prune_table1, prune_table4, "BR FL", "BL FL", arg_sol_num, rotations);
		start_search_2(scramble, 1, 3, 1, 2, prune_table2, prune_table3, "BR FL", "BR FR", arg_sol_num, rotations);
		start_search_2(scramble, 1, 3, 1, 3, prune_table2, prune_table4, "BR FL", "BR FL", arg_sol_num, rotations);
		start_search_2(scramble, 1, 3, 2, 3, prune_table3, prune_table4, "BR FL", "FR FL", arg_sol_num, rotations);

		start_search_2(scramble, 2, 3, 0, 1, prune_table1, prune_table2, "FR FL", "BL BR", arg_sol_num, rotations);
		start_search_2(scramble, 2, 3, 0, 2, prune_table1, prune_table3, "FR FL", "BL FR", arg_sol_num, rotations);
		start_search_2(scramble, 2, 3, 0, 3, prune_table1, prune_table4, "FR FL", "BL FL", arg_sol_num, rotations);
		start_search_2(scramble, 2, 3, 1, 2, prune_table2, prune_table3, "FR FL", "BR FR", arg_sol_num, rotations);
		start_search_2(scramble, 2, 3, 1, 3, prune_table2, prune_table4, "FR FL", "BR FL", arg_sol_num, rotations);
		start_search_2(scramble, 2, 3, 2, 3, prune_table3, prune_table4, "FR FL", "FR FL", arg_sol_num, rotations);
	}

	bool depth_limited_search_3(int arg_index1, int arg_index2, int arg_index4, int arg_index6, int arg_index7, int arg_index8, int arg_index9, int depth, int prev, std::vector<unsigned char> &prune1, std::vector<unsigned char> &prune2, std::vector<unsigned char> &prune3)
	{
		for (int i : move_restrict)
		{
			if (ma[prev + i])
			{
				continue;
			}
			index1_tmp = multi_move_table[arg_index1 + i];
			index2_tmp = corner_move_table[arg_index2 + i];
			index7_tmp = edge_move_table[arg_index7 + i];
			prune1_tmp = prune1[index1_tmp + index2_tmp];
			if (prune1_tmp >= depth)
			{
				continue;
			}
			index4_tmp = corner_move_table[arg_index4 + i];
			index8_tmp = edge_move_table[arg_index8 + i];
			prune2_tmp = prune2[index1_tmp + index4_tmp];
			if (prune2_tmp >= depth)
			{
				continue;
			}
			index6_tmp = corner_move_table[arg_index6 + i];
			index9_tmp = edge_move_table[arg_index9 + i];
			prune3_tmp = prune3[index1_tmp + index6_tmp];
			if (prune3_tmp >= depth)
			{
				continue;
			}
			sol[current_max_depth - depth] = i;
			if (depth == 1)
			{
				if (prune1_tmp == 0 && prune2_tmp == 0 && prune3_tmp == 0 && index7_tmp == edge_solved1 && index8_tmp == edge_solved2 && index9_tmp == edge_solved3)
				{
					bool valid = true;
					int l = static_cast<int>(sol.size());
					int c = 0;
					int index1_tmp2 = index1;
					int index2_tmp2 = index2;
					int index4_tmp2 = index4;
					int index6_tmp2 = index6;
					int index7_tmp2 = index7;
					int index8_tmp2 = index8;
					int index9_tmp2 = index9;
					for (int j : sol)
					{
						if (index1_tmp2 == multi_move_table[index1_tmp2 + j] && index2_tmp2 == corner_move_table[index2_tmp2 + j] * 18 && index4_tmp2 == corner_move_table[index4_tmp2 + j] * 18 && index6_tmp2 == corner_move_table[index6_tmp2 + j] * 18 && index7_tmp2 == edge_move_table[index7_tmp2 + j] * 18 && index8_tmp2 == edge_move_table[index8_tmp2 + j] * 18 && index9_tmp2 == edge_move_table[index9_tmp2 + j] * 18)
						{
							valid = false;
							break;
						}
						else
						{
							c += 1;
							index1_tmp2 = multi_move_table[index1_tmp2 + j];
							index2_tmp2 = corner_move_table[index2_tmp2 + j];
							index4_tmp2 = corner_move_table[index4_tmp2 + j];
							index6_tmp2 = corner_move_table[index6_tmp2 + j];
							index7_tmp2 = edge_move_table[index7_tmp2 + j];
							index8_tmp2 = edge_move_table[index8_tmp2 + j];
							index9_tmp2 = edge_move_table[index9_tmp2 + j];
							if (c < l && (prune_table1[index1_tmp2 + index2_tmp2] == 0 && prune_table2[index1_tmp2 + index4_tmp2] == 0 && prune_table3[index1_tmp2 + index6_tmp2] == 0 && index7_tmp2 == edge_solved1 && index8_tmp2 == edge_solved2 && index9_tmp2 == edge_solved3))
							{
								valid = false;
								break;
							}
							index2_tmp2 *= 18;
							index4_tmp2 *= 18;
							index6_tmp2 *= 18;
							index7_tmp2 *= 18;
							index8_tmp2 *= 18;
							index9_tmp2 *= 18;
						}
					}
					if (valid)
					{
						count += 1;
						total_length += sol.size();
						sol_len.emplace_back(sol.size());
						if (count == sol_num)
						{
							return true;
						}
					}
				}
			}
			else if (depth_limited_search_3(index1_tmp, index2_tmp * 18, index4_tmp * 18, index6_tmp * 18, index7_tmp * 18, index8_tmp * 18, index9_tmp * 18, depth - 1, i * 18, prune1, prune2, prune3))
			{
				return true;
			}
		}
		return false;
	}

	void start_search_3(std::string arg_scramble, int arg_slot1, int arg_slot2, int arg_slot3, int arg_pslot1, int arg_pslot2, int arg_pslot3, std::vector<unsigned char> &prune1, std::vector<unsigned char> &prune2, std::vector<unsigned char> &prune3, std::string name, std::string name2, int arg_sol_num, std::vector<std::string> rotations)
	{
		move_restrict.clear();
		scramble = arg_scramble;
		slot1 = arg_slot1;
		slot2 = arg_slot2;
		slot3 = arg_slot3;
		pslot1 = arg_pslot1;
		pslot2 = arg_pslot2;
		pslot3 = arg_pslot3;
		max_length = 20;
		sol_num = arg_sol_num;
		restrict = move_names;
		analyzer_count++;
		std::string count_string = std::to_string(analyzer_count);
		std::string result = "<tr><th class=\"No\">" + count_string + "</th><th class=\"slot\">" + name + "</th><th class=\"pslot\">" + name2 + "</th>";
		std::vector<int> edge_index = {187520, 187520, 187520, 187520};
		std::vector<int> single_edge_index = {0, 2, 4, 6};
		std::vector<int> corner_index = {12, 15, 18, 21};
		for (std::string name : restrict)
		{
			auto it = std::find(move_names.begin(), move_names.end(), name);
			move_restrict.emplace_back(std::distance(move_names.begin(), it));
		}
		for (std::string rot : rotations)
		{
			count = 0;
			total_length = 0;
			sol.clear();
			sol_len.clear();
			index1 = edge_index[slot1];
			index2 = corner_index[pslot1];
			index7 = single_edge_index[slot1];
			edge_solved1 = index7;
			index4 = corner_index[pslot2];
			index8 = single_edge_index[slot2];
			edge_solved2 = index8;
			index6 = corner_index[pslot3];
			index9 = single_edge_index[slot3];
			edge_solved3 = index9;
			index1 *= 24;
			std::vector<int> alg = AlgRotation(StringToAlg(scramble), rot);
			for (int m : alg)
			{
				index1 = multi_move_table[index1 + m];
				index2 = corner_move_table[index2 * 18 + m];
				index4 = corner_move_table[index4 * 18 + m];
				index6 = corner_move_table[index6 * 18 + m];
				index7 = edge_move_table[index7 * 18 + m];
				index8 = edge_move_table[index8 * 18 + m];
				index9 = edge_move_table[index9 * 18 + m];
			}
			prune1_tmp = prune1[index1 + index2];
			prune2_tmp = prune2[index1 + index4];
			prune3_tmp = prune3[index1 + index6];
			if (prune1_tmp == 0 && prune2_tmp == 0 && prune3_tmp == 0 && index7 == edge_solved1 && index8 == edge_solved2 && index9 == edge_solved3)
			{
				result += "<td class=" + converter_face(rot) + ">0</td>";
			}
			else
			{
				index2 *= 18;
				index4 *= 18;
				index6 *= 18;
				index7 *= 18;
				index8 *= 18;
				index9 *= 18;
				for (int d = std::max(prune1_tmp, std::max(prune2_tmp, prune3_tmp)); d <= max_length; d++)
				{
					current_max_depth = d;
					sol.resize(d);
					if (depth_limited_search_3(index1, index2, index4, index6, index7, index8, index9, d, 324, prune1, prune2, prune3))
					{
						break;
					}
				}
				std::ostringstream oss;
				if (arg_sol_num > 1)
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << round(double(total_length) * 10 / sol_num) / 10 << "</td>";
				}
				else
				{
					oss << "<td class=" << converter_face(rot) << " onclick=\"psolve(\'" << name << "\', \'" << name2 << "\', " << converter(rot) << ")\">" << sol_len[0] << "</td>";
				}
				result += oss.str();
			}
		}
		update((result + "</tr>").c_str());
	}

	void xxxcross_analyze(std::string scramble, int arg_sol_num, std::vector<std::string> rotations)
	{

		start_search_3(scramble, 0, 1, 2, 0, 1, 2, prune_table1, prune_table2, prune_table3, "BL BR FR", "BL BR FR", arg_sol_num, rotations);
		start_search_3(scramble, 0, 1, 2, 0, 1, 3, prune_table1, prune_table2, prune_table4, "BL BR FR", "BL BR FL", arg_sol_num, rotations);
		start_search_3(scramble, 0, 1, 2, 0, 2, 3, prune_table1, prune_table3, prune_table4, "BL BR FR", "BL FR FL", arg_sol_num, rotations);
		start_search_3(scramble, 0, 1, 2, 1, 2, 3, prune_table2, prune_table3, prune_table4, "BL BR FR", "BR FR FL", arg_sol_num, rotations);

		start_search_3(scramble, 0, 1, 3, 0, 1, 2, prune_table1, prune_table2, prune_table3, "BL BR FL", "BL BR FR", arg_sol_num, rotations);
		start_search_3(scramble, 0, 1, 3, 0, 1, 3, prune_table1, prune_table2, prune_table4, "BL BR FL", "BL BR FL", arg_sol_num, rotations);
		start_search_3(scramble, 0, 1, 3, 0, 2, 3, prune_table1, prune_table3, prune_table4, "BL BR FL", "BL FR FL", arg_sol_num, rotations);
		start_search_3(scramble, 0, 1, 3, 1, 2, 3, prune_table2, prune_table3, prune_table4, "BL BR FL", "BR FR FL", arg_sol_num, rotations);

		start_search_3(scramble, 0, 2, 3, 0, 1, 2, prune_table1, prune_table2, prune_table3, "BL FR FL", "BL BR FR", arg_sol_num, rotations);
		start_search_3(scramble, 0, 2, 3, 0, 1, 3, prune_table1, prune_table2, prune_table4, "BL FR FL", "BL BR FL", arg_sol_num, rotations);
		start_search_3(scramble, 0, 2, 3, 0, 2, 3, prune_table1, prune_table3, prune_table4, "BL FR FL", "BL FR FL", arg_sol_num, rotations);
		start_search_3(scramble, 0, 2, 3, 1, 2, 3, prune_table2, prune_table3, prune_table4, "BL FR FL", "BR FR FL", arg_sol_num, rotations);

		start_search_3(scramble, 1, 2, 3, 0, 1, 2, prune_table1, prune_table2, prune_table3, "BR FR FL", "BL BR FR", arg_sol_num, rotations);
		start_search_3(scramble, 1, 2, 3, 0, 1, 3, prune_table1, prune_table2, prune_table4, "BR FR FL", "BL BR FL", arg_sol_num, rotations);
		start_search_3(scramble, 1, 2, 3, 0, 2, 3, prune_table1, prune_table3, prune_table4, "BR FR FL", "BL FR FL", arg_sol_num, rotations);
		start_search_3(scramble, 1, 2, 3, 1, 2, 3, prune_table2, prune_table3, prune_table4, "BR FR FL", "BR FR FL", arg_sol_num, rotations);
	}
};

void analyzer(std::string scramble, bool cross, bool x, bool xx, bool xxx, std::string num, std::string rot_set)
{
	std::vector<std::string> rotations;
	std::string table = "<br><table border=\"2\" id=\"panalyzer_result\" translate=\"no\"><thead><tr><th class=\"sort\" data-sort=\"No\">No</th><th class=\"sort\" data-sort=\"slot\">PSE</th><th class=\"sort\" data-sort=\"pslot\">PSC</th>";
	for (char c_tmp : rot_set)
	{
		std::string c(1, c_tmp);
		if (c == "D")
		{
			table += "<th class=\"sort\" data-sort=\"D\">None</th>";
			rotations.emplace_back("");
		}
		else if (c == "U")
		{
			table += "<th class=\"sort\" data-sort=\"U\">z2</th>";
			rotations.emplace_back("z2");
		}
		else if (c == "L")
		{
			table += "<th class=\"sort\" data-sort=\"L\">z'</th>";
			rotations.emplace_back("z'");
		}
		else if (c == "R")
		{
			table += "<th class=\"sort\" data-sort=\"R\">z</th>";
			rotations.emplace_back("z");
		}
		else if (c == "F")
		{
			table += "<th class=\"sort\" data-sort=\"F\">x'</th>";
			rotations.emplace_back("x'");
		}
		else
		{
			table += "<th class=\"sort\" data-sort=\"B\">x</th>";
			rotations.emplace_back("x");
		}
	}
	table += "</tr></thead><tbody class=\"list\"></tbody></table>";

	update(table.c_str());
	int sol_num = std::stoi(num);
	int count = 0;
	if (cross)
	{
		count += 1;
	}
	if (x)
	{
		count += 16;
	}
	if (xx)
	{
		count += 36;
	}
	if (xxx)
	{
		count += 16;
	}
	update((std::to_string(count)).c_str());
	if (cross)
	{
		cross_analyzer cs;
		cs.start_search(scramble, "", "", sol_num, rotations);
	}
	if (x || xx || xxx)
	{
		xcross_analyzer2 xcs;
		if (x)
		{
			xcs.xcross_analyze(scramble, sol_num, rotations);
		}
		if (xx)
		{
			xcs.xxcross_analyze(scramble, sol_num, rotations);
		}
		if (xxx)
		{
			xcs.xxxcross_analyze(scramble, sol_num, rotations);
		}
	}
	update("Finished.");
}

EMSCRIPTEN_BINDINGS(my_module)
{
	emscripten::function("analyze", &analyzer);
}