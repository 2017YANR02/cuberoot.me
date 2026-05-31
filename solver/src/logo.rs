//! CUBEROOT 终端 logo 渲染。忠实移植 C++ logo.h + cube_logo_claudecode/claudecode.cpp。
//! std-only,Unicode block/box-drawing + ANSI 24-bit TrueColor,需 VT/UTF-8 终端。

#[cfg(windows)]
fn prep_console() {
    #[link(name = "kernel32")]
    extern "system" {
        fn SetConsoleOutputCP(cp: u32) -> i32;
        fn GetStdHandle(h: u32) -> isize;
        fn GetConsoleMode(h: isize, mode: *mut u32) -> i32;
        fn SetConsoleMode(h: isize, mode: u32) -> i32;
    }
    unsafe {
        SetConsoleOutputCP(65001); // CP_UTF8
        let h = GetStdHandle(0xFFFF_FFF5); // STD_OUTPUT_HANDLE (-11)
        let mut m = 0u32;
        if GetConsoleMode(h, &mut m) != 0 {
            SetConsoleMode(h, m | 0x0004); // ENABLE_VIRTUAL_TERMINAL_PROCESSING
        }
    }
}
#[cfg(not(windows))]
fn prep_console() {}

pub fn print_logo_v4() {
    prep_console();

    let layout: [&str; 18] = [
        "         1333331         333333333333333333333333333333333333333333",
        "        22   333        33SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
        "           13332       33SSMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
        "        11   3331     33SSMM                                       ",
        "         2333332     33SSMM       AAAAAAc  AAAAAAc  AAAAAAc        ",
        "                    33SSMM        AAAAAAdhhAAAAAAdhhAAAAAAi        ",
        "                   33SSMM         aaammwi  aaammwi  aaammwi        ",
        "                  33SSMM          ehhfhhg  ehhfhhg  ehhfhhg        ",
        "                 33SSMM              i        i        i           ",
        "                33SSMM            BBBBBBc  AAAAAAc  BBBBBBc        ",
        "               33SSMM             BBBBBBdhhAAAAAAdhhBBBBBBi        ",
        "              33SSMM              bbbnnqi  aaammwi  bbbnnqi        ",
        "             33SSMM               ehhfhhg  ehhfhhg  ehhfhhg        ",
        "   1331     33SSMM                   i        i        i           ",
        " 12 2331   33SSMM                 BBBBBBc  AAAAAAc  BBBBBBc        ",
        "     2331333SSMM                  BBBBBBdhhAAAAAAdhhBBBBBBi        ",
        "      23333SSMM                   bbbnnqi  aaammwi  bbbnnqi        ",
        "       233SSMM                    ehhhhhg  ehhhhhg  ehhhhhg        ",
    ];

    let mut out = String::new();
    out.push_str("\n\n");

    for line in layout.iter() {
        let bytes = line.as_bytes();
        for (x, &cb) in bytes.iter().enumerate() {
            let c = cb as char;
            if c == ' ' {
                out.push(' ');
                continue;
            }

            let mut r: i32 = 255;
            let mut g: i32 = 255;
            let mut b: i32 = 255;
            let mut glyph = " ";

            match c {
                '1' => {
                    r = 160;
                    g = 165;
                    b = 170;
                    glyph = "▄"; // Lower half block
                }
                '2' => {
                    r = 160;
                    g = 165;
                    b = 170;
                    glyph = "▀"; // Upper half block
                }
                '3' => {
                    r = 160;
                    g = 165;
                    b = 170;
                    glyph = "█"; // Full block
                }
                'S' | 'M' | 'W' => {
                    let t = x as f32 / 66.0_f32;
                    if t < 0.333_f32 {
                        let f = t / 0.333_f32;
                        r = (255.0 + (195.0 - 255.0) * f) as i32;
                        g = (113.0 + (153.0 - 113.0) * f) as i32;
                        b = (204.0 + (242.0 - 204.0) * f) as i32;
                    } else if t < 0.666_f32 {
                        let f = (t - 0.333_f32) / 0.333_f32;
                        r = (195.0 + (153.0 - 195.0) * f) as i32;
                        g = (153.0 + (186.0 - 153.0) * f) as i32;
                        b = (242.0 + (242.0 - 242.0) * f) as i32;
                    } else {
                        let f = (t - 0.666_f32) / 0.334_f32;
                        r = (153.0 + (85.0 - 153.0) * f) as i32;
                        g = (186.0 + (225.0 - 186.0) * f) as i32;
                        b = (242.0 + (255.0 - 242.0) * f) as i32;
                    }
                    glyph = match c {
                        'S' => "▓", // Dark Shade
                        'M' => "▒", // Medium Shade
                        _ => "░",   // Light Shade
                    };
                }
                'A' => {
                    r = 229;
                    g = 57;
                    b = 53;
                    glyph = "█"; // Red Matrix
                }
                'a' => {
                    r = 150;
                    g = 20;
                    b = 20;
                    glyph = "▓";
                }
                'm' => {
                    r = 110;
                    g = 15;
                    b = 15;
                    glyph = "▒";
                }
                'w' => {
                    r = 70;
                    g = 10;
                    b = 10;
                    glyph = "░";
                }
                'B' => {
                    r = 30;
                    g = 136;
                    b = 229;
                    glyph = "█"; // Blue Matrix
                }
                'b' => {
                    r = 20;
                    g = 100;
                    b = 180;
                    glyph = "▓";
                }
                'n' => {
                    r = 15;
                    g = 70;
                    b = 130;
                    glyph = "▒";
                }
                'q' => {
                    r = 10;
                    g = 40;
                    b = 80;
                    glyph = "░";
                }
                'c' => {
                    r = 100;
                    g = 105;
                    b = 110;
                    glyph = "╗";
                }
                'd' => {
                    r = 100;
                    g = 105;
                    b = 110;
                    glyph = "╠";
                }
                'e' => {
                    r = 100;
                    g = 105;
                    b = 110;
                    glyph = "╚";
                }
                'f' => {
                    r = 100;
                    g = 105;
                    b = 110;
                    glyph = "╦";
                }
                'g' => {
                    r = 100;
                    g = 105;
                    b = 110;
                    glyph = "╝";
                }
                'h' => {
                    r = 100;
                    g = 105;
                    b = 110;
                    glyph = "═";
                }
                'i' => {
                    r = 100;
                    g = 105;
                    b = 110;
                    glyph = "║";
                }
                _ => {}
            }

            out.push_str(&format!("\x1b[38;2;{};{};{}m{}", r, g, b, glyph));
        }
        out.push_str("\x1b[0m\n");
    }
    out.push_str("\n\n");

    print!("{}", out);
}

struct Color {
    r: i32,
    g: i32,
    b: i32,
}

fn get_color(t: f32) -> Color {
    let colors = [
        Color { r: 255, g: 113, b: 204 }, // Hot Pink
        Color { r: 195, g: 153, b: 242 }, // Light Purple
        Color { r: 153, g: 186, b: 242 }, // Pale Blue
        Color { r: 85, g: 225, b: 255 },  // Cyan
    ];
    let n = 3;
    let scaled_t = t * n as f32;
    let i = scaled_t as i32;
    if i >= n {
        let c = &colors[n as usize];
        return Color { r: c.r, g: c.g, b: c.b };
    }
    if i < 0 {
        let c = &colors[0];
        return Color { r: c.r, g: c.g, b: c.b };
    }
    let f = scaled_t - i as f32;
    let c1 = &colors[i as usize];
    let c2 = &colors[(i + 1) as usize];
    Color {
        r: (c1.r as f32 + (c2.r - c1.r) as f32 * f) as i32,
        g: (c1.g as f32 + (c2.g - c1.g) as f32 * f) as i32,
        b: (c1.b as f32 + (c2.b - c1.b) as f32 * f) as i32,
    }
}

fn get_letter(c: char) -> [&'static str; 10] {
    match c {
        'C' => [
            "##########", "##########", "####      ", "####      ", "####      ", "####      ",
            "####      ", "####      ", "##########", "##########",
        ],
        'U' => [
            "####  ####", "####  ####", "####  ####", "####  ####", "####  ####", "####  ####",
            "####  ####", "####  ####", "##########", "##########",
        ],
        'B' => [
            "########  ", "##########", "####  ####", "####  ####", "########  ", "########  ",
            "####  ####", "####  ####", "##########", "########  ",
        ],
        'E' => [
            "##########", "##########", "####      ", "####      ", "########  ", "########  ",
            "####      ", "####      ", "##########", "##########",
        ],
        'R' => [
            "########  ", "##########", "####  ####", "####  ####", "##########", "########  ",
            "####  ####", "####  ####", "####  ####", "####  ####",
        ],
        'O' => [
            "##########", "##########", "####  ####", "####  ####", "####  ####", "####  ####",
            "####  ####", "####  ####", "##########", "##########",
        ],
        'T' => [
            "##########", "##########", "   ####   ", "   ####   ", "   ####   ", "   ####   ",
            "   ####   ", "   ####   ", "   ####   ", "   ####   ",
        ],
        _ => [
            "          ", "          ", "          ", "          ", "          ", "          ",
            "          ", "          ", "          ", "          ",
        ],
    }
}

fn print_word(word: &str, out: &mut String) {
    let chars: Vec<char> = word.chars().collect();
    let num_letters = chars.len() as i32;
    let char_w = 10;
    let gap = 2;
    let width = num_letters * char_w + (num_letters - 1) * gap;

    let dx: i32 = -2;
    let dy: i32 = 1;

    let grid_w = width + dx.abs();
    let grid_h = 10 + dy.abs();

    let mut fg = vec![vec![0i32; width as usize]; 10];

    for i in 0..num_letters {
        let letter = get_letter(chars[i as usize]);
        let start_x = i * (char_w + gap);
        for y in 0..10 {
            let row = letter[y as usize].as_bytes();
            for x in 0..char_w {
                if row[x as usize] == b'#' {
                    fg[y as usize][(start_x + x) as usize] = 1;
                }
            }
        }
    }

    // 0 = 空白, 1 = 阴影, 2 = 前景
    let mut canvas = vec![vec![0i32; grid_w as usize]; grid_h as usize];

    for y in 0..10 {
        for x in 0..width {
            if fg[y as usize][x as usize] != 0 {
                canvas[(y + dy) as usize][(x + dx.abs() + dx) as usize] = 1;
            }
        }
    }

    for y in 0..10 {
        for x in 0..width {
            if fg[y as usize][x as usize] != 0 {
                canvas[y as usize][(x + dx.abs()) as usize] = 2;
            }
        }
    }

    for y in 0..grid_h {
        out.push_str("  ");
        for x in 0..grid_w {
            let val = canvas[y as usize][x as usize];
            if val == 0 {
                out.push(' ');
            } else {
                let t = x as f32 / (grid_w - 1) as f32;
                let c = get_color(t);
                out.push_str(&format!("\x1b[38;2;{};{};{}m", c.r, c.g, c.b));
                if val == 2 {
                    out.push('█'); // Solid Block
                } else {
                    out.push('░'); // Light Shade
                }
            }
        }
        out.push_str("\x1b[0m\n");
    }
}

pub fn print_logo() {
    prep_console();

    let mut out = String::new();
    out.push('\n');
    print_word("CUBE", &mut out);
    out.push('\n');
    print_word("ROOT", &mut out);
    out.push('\n');

    print!("{}", out);
}

pub fn print_logo_block() {
    prep_console();

    let color = "\x1b[38;2;217;119;87m";
    let reset = "\x1b[0m";

    let cube_line = [
        " ██████╗ ██╗   ██╗ ██████╗ ██████╗",
        "██╔════╝ ██║   ██║ ██╔══██╗██╔════╝",
        "██║      ██║   ██║ ██████╔╝█████╗  ",
        "██║      ██║   ██║ ██╔══██╗██╔══╝  ",
        "╚██████╗ ╚██████╔╝ ██████╔╝██████╗ ",
        " ╚═════╝  ╚═════╝  ╚═════╝ ╚═════╝ ",
    ];

    let root_line = [
        "██████╗  ██████╗  ██████╗ ████████╗",
        "██╔══██╗██╔═══██╗██╔═══██╗╚══██╔══╝",
        "██████╔╝██║   ██║██║   ██║   ██║   ",
        "██╔══██╗██║   ██║██║   ██║   ██║   ",
        "██║  ██║╚██████╔╝╚██████╔╝   ██║   ",
        "╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ",
    ];

    let mut out = String::new();
    out.push('\n');
    for line in cube_line.iter() {
        out.push_str(&format!("{}{}{}\n", color, line, reset));
    }
    out.push('\n');
    for line in root_line.iter() {
        out.push_str(&format!("{}{}{}\n", color, line, reset));
    }
    out.push('\n');

    print!("{}", out);
}

pub fn print_claude_cube_logo() {
    prep_console();

    const W_GRID: usize = 19;
    const H_GRID: usize = 12;
    let mut grid = [[0i32; W_GRID]; H_GRID];

    let text_c = ["0111", "1000", "1000", "1000", "0111"];
    let text_u = ["1001", "1001", "1001", "1001", "1111"];
    let text_b = ["1110", "1001", "1110", "1001", "1110"];
    let text_e = ["1111", "1000", "1110", "1000", "1111"];
    let text_r = ["1110", "1001", "1110", "1010", "1001"];
    let text_o = ["0110", "1001", "1001", "1001", "0110"];
    let text_t = ["1111", "0110", "0110", "0110", "0110"];

    let mut place_letter = |x: usize, y: usize, letter: &[&str; 5]| {
        for r in 0..5 {
            let row = letter[r].as_bytes();
            for c in 0..4 {
                if row[c] == b'1' {
                    grid[y + r][x + c] = 1;
                }
            }
        }
    };

    place_letter(0, 0, &text_c);
    place_letter(5, 0, &text_u);
    place_letter(10, 0, &text_b);
    place_letter(15, 0, &text_e);

    place_letter(0, 7, &text_r);
    place_letter(5, 7, &text_o);
    place_letter(10, 7, &text_o);
    place_letter(15, 7, &text_t);

    let color = "\x1b[38;2;217;119;87m"; // #D97757 三文鱼粉红/珊瑚橘
    let reset = "\x1b[0m";

    let mut out = String::new();
    out.push('\n');
    for r in 0..H_GRID {
        out.push_str(color);
        for c in 0..W_GRID {
            if grid[r][c] != 0 {
                out.push_str("██");
            } else {
                out.push_str("  ");
            }
        }
        out.push_str(reset);
        out.push('\n');
    }
    out.push('\n');

    print!("{}", out);
}
