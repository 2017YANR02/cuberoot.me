/*
https://gemini.google.com/app/3a15a0ad5e8f731d
*/
#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <fstream>

using namespace std;

int main() {
    // 网格画布总尺寸 (CUBE 4字 + ROOT 4字，含空格宽19列，加上行距总高12行)
    int W_grid = 19;
    int H_grid = 12;
    vector<vector<int>> grid(H_grid, vector<int>(W_grid, 0));

    // 1. 精确复刻 Claude 极客像素字模 (包含经典的 C、D 外圆角倒角和等宽特征)
    vector<string> text_C = {"0111", "1000", "1000", "1000", "0111"};
    vector<string> text_U = {"1001", "1001", "1001", "1001", "1111"};
    vector<string> text_B = {"1110", "1001", "1110", "1001", "1110"};
    vector<string> text_E = {"1111", "1000", "1110", "1000", "1111"};
    
    vector<string> text_R = {"1110", "1001", "1110", "1010", "1001"};
    vector<string> text_O = {"0110", "1001", "1001", "1001", "0110"};
    vector<string> text_T = {"1111", "0110", "0110", "0110", "0110"};

    // 辅助函数：将字模印入主画布矩阵
    auto place_letter = [&](int x, int y, const vector<string>& letter) {
        for (int r = 0; r < 5; ++r) {
            for (int c = 0; c < 4; ++c) {
                if (letter[r][c] == '1') grid[y + r][x + c] = 1;
            }
        }
    };

    // 第一行: C U B E (字母距 1 列)
    place_letter(0, 0, text_C);
    place_letter(5, 0, text_U);
    place_letter(10, 0, text_B);
    place_letter(15, 0, text_E);

    // 第二行: R O O T (行距 2 行)
    place_letter(0, 7, text_R);
    place_letter(5, 7, text_O);
    place_letter(10, 7, text_O);
    place_letter(15, 7, text_T);

    // 2. 核心等距美学比例配置
    int U = 4;              // 基础乘数
    int G = 1 * U;          // 方块间隙 (4)
    int L = 1 * U;          // 阴影线条粗细 (4)
    int S = 6 * U;          // 实体亮色方块边长 (24)
    int P = S + G;          // 逻辑晶格跨度 (28)
    
    // 阴影错位偏移方程 (确保线与线、线与方块的间距恰好全等于G)
    int dx1 = U / 2;        // 第一道线向右下偏移 (由于线宽对中渲染，此值确保完美贴合)
    int dy1 = U / 2;
    int dx2 = dx1 + G + L;  // 第二道线向右下偏移
    int dy2 = dy1 + G + L;

    // 3. 构建拓扑边界追踪器
    // 利用有向边提取每个连通字母的完整外边界与内孔洞
    map<pair<int, int>, vector<pair<int, int>>> adj;
    auto add_edge = [&](int x1, int y1, int x2, int y2) {
        adj[{x1, y1}].push_back({x2, y2});
    };

    for (int r = 0; r < H_grid; ++r) {
        for (int c = 0; c < W_grid; ++c) {
            if (grid[r][c]) {
                int px = c * P;
                int py = r * P;
                // 若相邻方向无方块，则暴露出边界边
                if (r == 0 || !grid[r-1][c]) add_edge(px, py, px + P, py);
                if (c == W_grid - 1 || !grid[r][c+1]) add_edge(px + P, py, px + P, py + P);
                if (r == H_grid - 1 || !grid[r+1][c]) add_edge(px + P, py + P, px, py + P);
                if (c == 0 || !grid[r][c-1]) add_edge(px, py + P, px, py);
            }
        }
    }

    // 4. 将离散边界组装为闭合的 SVG Path (基于欧拉回路)
    string path_d = "";
    while (!adj.empty()) {
        auto it = adj.begin();
        pair<int, int> start = it->first;
        pair<int, int> curr = start;
        path_d += "M " + to_string(curr.first) + " " + to_string(curr.second) + " ";
        while (true) {
            auto& neighbors = adj[curr];
            pair<int, int> next = neighbors.back();
            neighbors.pop_back();
            if (neighbors.empty()) adj.erase(curr);
            curr = next;
            path_d += "L " + to_string(curr.first) + " " + to_string(curr.second) + " ";
            if (curr == start) break;
        }
        path_d += "Z ";
    }

    // 5. 颜色与画幅初始化
    int margin_x = 64;
    int margin_y = 64;
    int canvas_w = W_grid * P + margin_x * 2 + dx2 + L;
    int canvas_h = H_grid * P + margin_y * 2 + dy2 + L;

    // 还原 Anthropic 官方配色
    string bg_color = "#161616"; // 极客深渊灰
    string fg_color = "#D97757"; // 经典三文鱼粉红/珊瑚橘

    // 开始执行 SVG 渲染指令
    ofstream out("cube_root.svg");
    out << "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    out << "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " << canvas_w << " " << canvas_h 
        << "\" width=\"100%\" height=\"100%\">\n";
    
    // 背景层
    out << "  <rect width=\"100%\" height=\"100%\" fill=\"" << bg_color << "\" />\n";
    out << "  <g transform=\"translate(" << margin_x << "," << margin_y << ")\">\n";
    
    // [渲染层级 1]: 第二道投影 (最深层)
    out << "    <path d=\"" << path_d << "\" fill=\"none\" stroke=\"" << fg_color 
        << "\" stroke-width=\"" << L << "\" stroke-linejoin=\"miter\" transform=\"translate(" << dx2 << "," << dy2 << ")\" />\n";
    
    // [渲染层级 2]: 第一道投影 (中间层)
    out << "    <path d=\"" << path_d << "\" fill=\"none\" stroke=\"" << fg_color 
        << "\" stroke-width=\"" << L << "\" stroke-linejoin=\"miter\" transform=\"translate(" << dx1 << "," << dy1 << ")\" />\n";
    
    // [渲染层级 3 - 核心灵魂]: 背景同色原位遮罩 (Topological Mask)
    // 利用 fill-rule="evenodd" 确保内外层关系，它会如同魔法般切断所有越界的内部错位网格线！
    out << "    <path d=\"" << path_d << "\" fill=\"" << bg_color << "\" stroke=\"none\" fill-rule=\"evenodd\" />\n";
    
    // [渲染层级 4]: 悬浮在最前方的实体阵列像素块
    out << "    <g fill=\"" << fg_color << "\">\n";
    for (int r = 0; r < H_grid; ++r) {
        for (int c = 0; c < W_grid; ++c) {
            if (grid[r][c]) {
                int px = c * P;
                int py = r * P;
                out << "      <rect x=\"" << px << "\" y=\"" << py << "\" width=\"" << S << "\" height=\"" << S << "\" />\n";
            }
        }
    }
    out << "    </g>\n";
    
    out << "  </g>\n";
    out << "</svg>\n";

    cout << "Render Success! [ cube_root.svg ] created." << endl;
    return 0;
}