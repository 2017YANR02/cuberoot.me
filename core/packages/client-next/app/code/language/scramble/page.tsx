'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import LangToggle from '@/components/LangToggle';
import { LangCtx, L, type Lang } from '../_intro/Lang';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './compare.css';

interface Snippet {
  slug: string;
  name: string;
  href: string;
  accent: string;
  commentToken: string;
  code: string;
  zhFlavor: string;
  enFlavor: string;
}

const SNIPPETS: Snippet[] = [
  {
    slug: 'ts', name: 'TypeScript', href: '/code/language/ts', accent: '#3178C6', commentToken: '//',
    zhFlavor: '字面量联合 + discriminated Result',
    enFlavor: 'String literal union + discriminated Result',
    code: `type Token = 'U'|'D'|'L'|'R'|'F'|'B'|'M'|'E'|'S'|'x'|'y'|'z';
type Move = { token: Token; turn: 1 | 2 | 3 };
type Result = { ok: true; moves: Move[] } | { ok: false; error: string };

const TOKENS = new Set('UDLRFBMESxyz'); // 12 valid first chars

export function parse(s: string): Result {
  const moves: Move[] = [];
  for (const t of s.split(/\\s+/).filter(Boolean)) {
    const head = t[0];
    if (!TOKENS.has(head)) return { ok: false, error: \`bad token: \${t}\` };
    const tail = t.slice(1);
    const turn = tail === ''  ? 1
               : tail === '2' ? 2
               : tail === "'" ? 3
               : 0;
    if (!turn) return { ok: false, error: \`bad suffix: \${t}\` };
    moves.push({ token: head as Token, turn: turn as 1 | 2 | 3 });
  }
  return { ok: true, moves };
}`,
  },
  {
    slug: 'rust', name: 'Rust', href: '/code/language/rust', accent: '#CE422B', commentToken: '//',
    zhFlavor: 'enum + Result + 穷尽 match',
    enFlavor: 'enum + Result + exhaustive match',
    code: `#[derive(Debug, Clone, Copy)]
pub enum Token { U, D, L, R, F, B, M, E, S, X, Y, Z }

pub struct Move { pub token: Token, pub turn: u8 }

pub fn parse(s: &str) -> Result<Vec<Move>, String> {
    s.split_whitespace().map(|t| {
        let mut c = t.chars();
        let token = match c.next() {
            Some('U') => Token::U, Some('D') => Token::D,
            Some('L') => Token::L, Some('R') => Token::R,
            Some('F') => Token::F, Some('B') => Token::B,
            Some('M') => Token::M, Some('E') => Token::E,
            Some('S') => Token::S, Some('x') => Token::X,
            Some('y') => Token::Y, Some('z') => Token::Z,
            _ => return Err(format!("bad token: {t}")),
        };
        let turn = match c.as_str() {
            ""  => 1, "2" => 2, "'" => 3,
            _   => return Err(format!("bad suffix: {t}")),
        };
        Ok(Move { token, turn })
    }).collect()
}`,
  },
  {
    slug: 'go', name: 'Go', href: '/code/language/go', accent: '#00ADD8', commentToken: '//',
    zhFlavor: '(value, error) + strings.Fields',
    enFlavor: '(value, error) + strings.Fields',
    code: `package scramble

import (
    "fmt"
    "strings"
)

type Move struct {
    Token byte
    Turn  int
}

const valid = "UDLRFBMESxyz"

func Parse(s string) ([]Move, error) {
    var out []Move
    for _, t := range strings.Fields(s) { // skips empty tokens
        if !strings.ContainsRune(valid, rune(t[0])) {
            return nil, fmt.Errorf("bad token: %q", t)
        }
        var turn int
        switch t[1:] {
        case "":  turn = 1
        case "2": turn = 2
        case "'": turn = 3
        default:
            return nil, fmt.Errorf("bad suffix: %q", t)
        }
        out = append(out, Move{t[0], turn})
    }
    return out, nil
}`,
  },
  {
    slug: 'python', name: 'Python', href: '/code/language/python', accent: '#3776AB', commentToken: '#',
    zhFlavor: 'dataclass + match/case 守卫',
    enFlavor: 'dataclass + match/case with guards',
    code: `from dataclasses import dataclass

VALID = set("UDLRFBMESxyz")  # 12 first chars

@dataclass
class Move:
    token: str
    turn: int  # 1, 2, or 3

class ScrambleError(ValueError): pass

def parse(s: str) -> list[Move]:
    out: list[Move] = []
    for t in s.split():  # split() collapses runs of whitespace
        if not t or t[0] not in VALID:
            raise ScrambleError(f"bad token: {t!r}")
        match t[1:]:
            case "":   turn = 1
            case "2":  turn = 2
            case "'":  turn = 3
            case _:    raise ScrambleError(f"bad suffix: {t!r}")
        out.append(Move(t[0], turn))
    return out`,
  },
  {
    slug: 'c', name: 'C', href: '/code/language/c', accent: '#03579B', commentToken: '//',
    zhFlavor: '输出参数 + 返回 int 错误码',
    enFlavor: 'Out param + int error code',
    code: `#include <string.h>
#include <ctype.h>

typedef struct { char token; int turn; } Move;

// returns 0 on success, -1 on error; writes count to *n_out.
int parse(const char *s, Move *out, int cap, int *n_out) {
    int n = 0;
    while (*s) {
        while (isspace((unsigned char)*s)) s++;
        if (!*s) break;
        if (n >= cap || !strchr("UDLRFBMESxyz", *s)) return -1;
        char head = *s++;
        int turn;
        if      (*s == '\\0' || isspace((unsigned char)*s)) turn = 1;
        else if (*s == '2')  { turn = 2; s++; }
        else if (*s == '\\'') { turn = 3; s++; }
        else return -1;
        if (*s && !isspace((unsigned char)*s)) return -1;
        out[n++] = (Move){ head, turn };
    }
    *n_out = n;
    return 0;
}`,
  },
  {
    slug: 'cpp', name: 'C++', href: '/code/language/cpp', accent: '#00599C', commentToken: '//',
    zhFlavor: 'enum class + std::expected',
    enFlavor: 'enum class + std::expected (C++23)',
    code: `#include <expected>
#include <string>
#include <vector>
#include <sstream>

enum class Token : char {
    U='U', D='D', L='L', R='R', F='F', B='B',
    M='M', E='E', S='S', x='x', y='y', z='z',
};
struct Move { Token token; int turn; };

std::expected<std::vector<Move>, std::string> parse(std::string_view s) {
    std::vector<Move> out;
    std::istringstream in{std::string{s}};
    for (std::string t; in >> t; ) {
        if (std::string_view{"UDLRFBMESxyz"}.find(t[0]) == std::string_view::npos)
            return std::unexpected("bad token: " + t);
        int turn = t.size() == 1     ? 1
                 : t == std::string{t[0]} + "2"  ? 2
                 : t == std::string{t[0]} + "'"  ? 3 : 0;
        if (!turn) return std::unexpected("bad suffix: " + t);
        out.push_back({static_cast<Token>(t[0]), turn});
    }
    return out;
}`,
  },
  {
    slug: 'zig', name: 'Zig', href: '/code/language/zig', accent: '#F7A41D', commentToken: '//',
    zhFlavor: 'error{} + !T 错误联合',
    enFlavor: 'error{} set + !T error union',
    code: `const std = @import("std");

pub const Move = struct { token: u8, turn: u8 };
pub const ParseError = error{ BadToken, BadSuffix };

pub fn parse(alloc: std.mem.Allocator, s: []const u8) ![]Move {
    var out = std.ArrayList(Move).init(alloc);
    errdefer out.deinit();

    var it = std.mem.tokenizeAny(u8, s, " \\t\\n");
    while (it.next()) |t| {
        if (std.mem.indexOfScalar(u8, "UDLRFBMESxyz", t[0]) == null)
            return ParseError.BadToken;
        const turn: u8 = switch (t.len) {
            1 => 1,
            2 => switch (t[1]) {
                '2'  => 2,
                '\\'' => 3,
                else => return ParseError.BadSuffix,
            },
            else => return ParseError.BadSuffix,
        };
        try out.append(.{ .token = t[0], .turn = turn });
    }
    return out.toOwnedSlice();
}`,
  },
  {
    slug: 'swift', name: 'Swift', href: '/code/language/swift', accent: '#F05138', commentToken: '//',
    zhFlavor: 'enum + throws + Result builder',
    enFlavor: 'enum + throws + raw-value init',
    code: `enum Token: Character {
    case U, D, L, R, F, B, M, E, S
    case x, y, z
}

struct Move { let token: Token; let turn: Int }

enum ScrambleError: Error { case badToken(String), badSuffix(String) }

func parse(_ s: String) throws -> [Move] {
    try s.split(whereSeparator: \\.isWhitespace).map { piece -> Move in
        let t = String(piece)
        guard let token = Token(rawValue: t.first!) else {
            throw ScrambleError.badToken(t)
        }
        let turn: Int
        switch t.dropFirst() {
        case "":  turn = 1
        case "2": turn = 2
        case "'": turn = 3
        default:  throw ScrambleError.badSuffix(t)
        }
        return Move(token: token, turn: turn)
    }
}`,
  },
  {
    slug: 'kotlin', name: 'Kotlin', href: '/code/language/kotlin', accent: '#7F52FF', commentToken: '//',
    zhFlavor: 'sealed class + Result + when',
    enFlavor: 'sealed class + Result + when',
    code: `enum class Token { U, D, L, R, F, B, M, E, S, x, y, z }

data class Move(val token: Token, val turn: Int)

fun parse(s: String): Result<List<Move>> = runCatching {
    s.split(Regex("\\\\s+")).filter { it.isNotEmpty() }.map { t ->
        val token = runCatching { Token.valueOf(t[0].toString()) }
            .getOrElse { throw IllegalArgumentException("bad token: $t") }
        val turn = when (t.drop(1)) {
            ""   -> 1
            "2"  -> 2
            "'"  -> 3
            else -> throw IllegalArgumentException("bad suffix: $t")
        }
        Move(token, turn)
    }
}`,
  },
  {
    slug: 'java', name: 'Java', href: '/code/language/java', accent: '#E76F00', commentToken: '//',
    zhFlavor: 'enum + record + checked exception',
    enFlavor: 'enum + record + checked exception',
    code: `import java.util.*;

public class Scramble {
    public enum Token { U, D, L, R, F, B, M, E, S, x, y, z }
    public record Move(Token token, int turn) {}

    public static class ScrambleException extends Exception {
        public ScrambleException(String m) { super(m); }
    }

    public static List<Move> parse(String s) throws ScrambleException {
        List<Move> out = new ArrayList<>();
        for (String t : s.trim().split("\\\\s+")) {
            if (t.isEmpty()) continue;
            Token token;
            try { token = Token.valueOf(String.valueOf(t.charAt(0))); }
            catch (IllegalArgumentException e) {
                throw new ScrambleException("bad token: " + t);
            }
            int turn = switch (t.substring(1)) {
                case ""  -> 1;
                case "2" -> 2;
                case "'" -> 3;
                default  -> throw new ScrambleException("bad suffix: " + t);
            };
            out.add(new Move(token, turn));
        }
        return out;
    }
}`,
  },
  {
    slug: 'js', name: 'JavaScript', href: '/code/language/javascript', accent: '#E5C100', commentToken: '//',
    zhFlavor: '无类型 + throw,纯运行时检查',
    enFlavor: 'No types + throw; runtime checks only',
    code: `// no Token enum, no Move type — just objects and strings.
// every guard here is a runtime check the type system can't see.

const VALID = new Set([...'UDLRFBMESxyz']);

export function parse(s) {
  return s.split(/\\s+/).filter(Boolean).map((t) => {
    if (!VALID.has(t[0])) {
      throw new Error(\`bad token: \${t}\`);
    }
    const tail = t.slice(1);
    const turn = tail === ''  ? 1
               : tail === '2' ? 2
               : tail === "'" ? 3
               : null;
    if (turn === null) throw new Error(\`bad suffix: \${t}\`);
    return { token: t[0], turn };
  });
}`,
  },
  {
    slug: 'mojo', name: 'Mojo', href: '/code/language/mojo', accent: '#FF4B00', commentToken: '#',
    zhFlavor: '@value struct + Optional[List[Move]]',
    enFlavor: '@value struct + Optional[List[Move]]',
    code: `# Mojo: @value auto-derives copy/init/del.
# fn = strict types; Optional[List[Move]] for parse failure.
# No native enum yet — String holds the token char.

@value
struct Move:
    var token: String
    var turn: Int

fn parse(s: String) -> Optional[List[Move]]:
    alias VALID = "UDLRFBMESxyz"
    var out = List[Move]()
    for t in s.split():
        if len(t) == 0: continue
        var head = String(t[0])
        if VALID.find(head) < 0: return None
        var rest = String(t[1:])
        var turn: Int
        if rest == "":   turn = 1
        elif rest == "2": turn = 2
        elif rest == "'": turn = 3
        else:            return None
        out.append(Move(head, turn))
    return out`,
  },
  {
    slug: 'csharp', name: 'C#', href: '/code/language/csharp', accent: '#512BD4', commentToken: '//',
    zhFlavor: 'record + enum + switch 表达式',
    enFlavor: 'record + enum + switch expression',
    code: `using System;
using System.Collections.Generic;

public enum Token { U, D, L, R, F, B, M, E, S, x, y, z }
public record Move(Token Token, int Turn);

public static class Scramble
{
    public static List<Move> Parse(string s)
    {
        var moves = new List<Move>();
        foreach (var t in s.Split(default(char[]),
                                  StringSplitOptions.RemoveEmptyEntries))
        {
            if (!Enum.TryParse<Token>(t[..1], out var token))
                throw new FormatException($"bad token: {t}");
            int turn = t[1..] switch
            {
                ""  => 1,
                "2" => 2,
                "'" => 3,
                _   => throw new FormatException($"bad suffix: {t}"),
            };
            moves.Add(new Move(token, turn));
        }
        return moves;
    }
}`,
  },
  {
    slug: 'ruby', name: 'Ruby', href: '/code/language/ruby', accent: '#CC342D', commentToken: '#',
    zhFlavor: '动态类型 + Struct + case/when',
    enFlavor: 'Duck-typed + Struct + case/when',
    code: `require 'set'

VALID = Set.new("UDLRFBMESxyz".chars)

Move = Struct.new(:token, :turn)
class ScrambleError < StandardError; end

def parse(s)
  s.split.map do |t|
    raise ScrambleError, "bad token: #{t}" unless VALID.include?(t[0])
    turn = case t[1..]
           when ''   then 1
           when '2'  then 2
           when "'"  then 3
           else raise ScrambleError, "bad suffix: #{t}"
           end
    Move.new(t[0], turn)
  end
end`,
  },
  {
    slug: 'php', name: 'PHP', href: '/code/language/php', accent: '#777BB4', commentToken: '//',
    zhFlavor: 'enum (PHP 8.1) + match 表达式',
    enFlavor: 'PHP 8.1 enum + match expression',
    code: `<?php
enum Token: string {
    case U = 'U'; case D = 'D'; case L = 'L'; case R = 'R';
    case F = 'F'; case B = 'B'; case M = 'M'; case E = 'E';
    case S = 'S'; case X = 'x'; case Y = 'y'; case Z = 'z';
}

readonly class Move {
    public function __construct(public Token $token, public int $turn) {}
}

function parse(string $s): array {
    $out = [];
    foreach (preg_split('/\\\\s+/', trim($s)) as $t) {
        if ($t === '') continue;
        $token = Token::tryFrom($t[0]);
        if (!$token) throw new ValueError("bad token: $t");
        $turn = match (substr($t, 1)) {
            ''  => 1,
            '2' => 2,
            "'" => 3,
            default => throw new ValueError("bad suffix: $t"),
        };
        $out[] = new Move($token, $turn);
    }
    return $out;
}`,
  },
  {
    slug: 'lua', name: 'Lua', href: '/code/language/lua', accent: '#2C2D72', commentToken: '--',
    zhFlavor: '多返回值 (value, err) + gmatch %S+',
    enFlavor: 'Multi-return (value, err) + gmatch %S+',
    code: `-- Lua: no enum, no Result type. Idiom: return value, err.

local VALID = {}
for c in ("UDLRFBMESxyz"):gmatch(".") do VALID[c] = true end

local function parse(s)
    local out = {}
    for t in s:gmatch("%S+") do
        local head = t:sub(1, 1)
        if not VALID[head] then
            return nil, "bad token: " .. t
        end
        local tail = t:sub(2)
        local turn
        if     tail == ""  then turn = 1
        elseif tail == "2" then turn = 2
        elseif tail == "'" then turn = 3
        else
            return nil, "bad suffix: " .. t
        end
        out[#out + 1] = { token = head, turn = turn }
    end
    return out
end`,
  },
  {
    slug: 'haskell', name: 'Haskell', href: '/code/language/haskell', accent: '#5E5086', commentToken: '--',
    zhFlavor: 'ADT (Token / Move) + Either String',
    enFlavor: 'ADT (Token / Move) + Either String',
    code: `-- Haskell: ADT for Token, Either for failure. mapM threads errors.

data Token = U | D | L | R | F | B
           | M | E | S | X | Y | Z
           deriving (Show, Eq)

data Move = Move { token :: Token, turn :: Int } deriving Show

parse :: String -> Either String [Move]
parse = mapM parseOne . words
  where
    parseOne []     = Left "empty token"
    parseOne (h:rs) = Move <$> tokenOf h <*> turnOf rs

    tokenOf c = case c of
      'U' -> Right U; 'D' -> Right D; 'L' -> Right L; 'R' -> Right R
      'F' -> Right F; 'B' -> Right B; 'M' -> Right M; 'E' -> Right E
      'S' -> Right S; 'x' -> Right X; 'y' -> Right Y; 'z' -> Right Z
      _   -> Left ("bad token: " ++ [c])

    turnOf ""  = Right 1
    turnOf "2" = Right 2
    turnOf "'" = Right 3
    turnOf r   = Left ("bad suffix: " ++ r)`,
  },
];

function highlightComments(code: string, token: string) {
  return code.split('\n').map((line, i) => {
    const idx = line.indexOf(token);
    if (idx === -1 || /["']/.test(line.slice(0, idx))) {
      return <div key={i}>{line || ' '}</div>;
    }
    return (
      <div key={i}>
        {line.slice(0, idx)}
        <span className="compare-cmt">{line.slice(idx)}</span>
      </div>
    );
  });
}

export default function CompareScramblePage() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  useDocumentTitle('17 种语言, 一个打乱解析器', 'One scramble parser, seventeen languages');

  return (
    <LangCtx.Provider value={lang}>
      <div className="compare-root">
        <div className="compare-bg" />

        <header className="compare-head">
          <div className="compare-topbar">
            <Link href="/code/language" className="compare-back">
              ← <L zh="回 /code/language" en="Back to /code/language" />
            </Link>
            <LangToggle variant="inline" />
          </div>

          <div className="compare-tag">
            <L zh="// Scramble Parser · 17 Languages · 1 Algorithm" en="// Scramble Parser · 17 Languages · 1 Algorithm" />
          </div>
          <h1 className="compare-title">
            <L
              zh={<>17 种语言<span className="compare-comma">,</span> 一个 <span className="compare-hl">打乱解析器</span></>}
              en={<>One <span className="compare-hl">scramble parser</span><span className="compare-comma">,</span> seventeen languages</>}
            />
          </h1>
          <p className="compare-sub">
            <L
              zh={<>同一个 <strong>scramble → Move[]</strong> 解析器, 17 种语言写一遍。看每门语言怎么表达"12 种合法 token 之一 + 可选后缀", 以及解析失败时怎么把错误回传给调用者——这才是类型系统真正干活的地方。</>}
              en={<>The same <strong>scramble → Move[]</strong> parser, written in seventeen languages. Watch each language model "one of 12 legal tokens, plus an optional suffix" and how it hands a parse failure back to the caller — that's where a type system actually earns its keep.</>}
            />
          </p>
        </header>

        <section className="compare-rules">
          <h2 className="compare-rules-h">
            <L zh="打乱记号规则 (60 秒速览)" en="Scramble notation rules (in 60 seconds)" />
          </h2>
          <ol className="compare-rules-list">
            <li><L
              zh={<>每个 token 首字符必须是 12 个之一: <strong>U D L R F B</strong> (面)、<strong>M E S</strong> (中层)、<strong>x y z</strong> (整体旋转)</>}
              en={<>The first char of every token must be one of 12: <strong>U D L R F B</strong> (faces), <strong>M E S</strong> (slices), <strong>x y z</strong> (whole-cube rotations)</>}
            /></li>
            <li><L
              zh={<>后缀可选: 无 = 顺时针 90°、<code>2</code> = 180°、<code>'</code> = 逆时针 90°</>}
              en={<>Suffix is optional: none = 90° CW, <code>2</code> = 180°, <code>'</code> = 90° CCW</>}
            /></li>
            <li><L
              zh={<>token 间用空白分隔;连续多个空格视为一个</>}
              en={<>Tokens are whitespace-separated; runs of whitespace collapse</>}
            /></li>
            <li><L
              zh={<>输出每步用 <code>Move(token, turn)</code> 表示, <code>turn ∈ {'{1, 2, 3}'}</code>(3 个 quarter-turn = CCW)</>}
              en={<>Each step is a <code>Move(token, turn)</code> with <code>turn ∈ {'{1, 2, 3}'}</code> (3 quarter-turns = CCW)</>}
            /></li>
            <li><L
              zh={<>非法输入(<code>R3</code> / <code>Q</code> / <code>R''</code> / 空 token)按各语言习惯回错误</>}
              en={<>Invalid input (<code>R3</code>, <code>Q</code>, <code>R''</code>, empty token) returns a language-idiomatic error</>}
            /></li>
          </ol>
          <div className="compare-example">
            <span className="compare-example-tag"><L zh="示例" en="Example" /></span>
            <code>"R U2 R' F'"</code>
            <span className="compare-arrow">→</span>
            <code>[(R,1), (U,2), (R,3), (F,3)]</code>
            <span className="compare-arrow">→</span>
            <code><L zh="非法输入: R3 → error" en="invalid: R3 → error" /></code>
          </div>
        </section>

        <section className="compare-grid">
          {SNIPPETS.map((s) => (
            <article
              key={s.slug}
              className="compare-card"
              style={{ '--accent': s.accent } as React.CSSProperties}
            >
              <header className="compare-card-h">
                <span className="compare-card-name">{s.name}</span>
                <Link href={s.href} className="compare-card-link">
                  <L zh="深入读 →" en="deep dive →" />
                </Link>
              </header>
              <pre className="compare-code"><code>
                {highlightComments(s.code, s.commentToken)}
              </code></pre>
              <footer className="compare-card-flavor">
                {lang === 'zh' ? s.zhFlavor : s.enFlavor}
              </footer>
            </article>
          ))}
        </section>

        <section className="compare-takeaway">
          <h2 className="compare-takeaway-h">
            <L zh="哪里看出门道?" en="What to notice" />
          </h2>
          <div className="compare-takeaway-grid">
            <div>
              <h3><L zh={'12 个 token 怎么建模'} en="How to model 12 tokens" /></h3>
              <p><L
                zh={<>Rust / Swift / Kotlin / Java / C++ / C# / PHP 走 <strong>enum</strong>, 编译期就能保证"只接受这 12 个值";Haskell 用 <strong>ADT</strong> <code>data Token = U | D | …</code> 拿到一样的保证。TS 用<strong>字面量联合</strong> <code>'U' | 'D' | …</code> 走类型层。Python / Ruby / Lua 用字符串 + 运行时 set 检查。JS 连这层都没有——只有一个 <code>Set</code> 拦着 typo。</>}
                en={<>Rust / Swift / Kotlin / Java / C++ / C# / PHP reach for an <strong>enum</strong> — the type system locks the set to those 12 values at compile time; Haskell uses an <strong>ADT</strong> <code>data Token = U | D | …</code> for the same guarantee. TS gets a static guarantee through a <strong>string literal union</strong> <code>'U' | 'D' | …</code>. Python / Ruby / Lua use strings + a runtime set. JS doesn't even have that — just a <code>Set</code> as a typo guard.</>}
              /></p>
            </div>
            <div>
              <h3><L zh={'解析失败怎么传出去'} en="How a parse failure escapes" /></h3>
              <p><L
                zh={<>6 种风格: <strong>Result / Either / Optional</strong>(TS / Rust / Kotlin / Haskell / Mojo)、<strong>std::expected</strong>(C++23)、<strong>错误联合</strong>(Zig <code>!T</code>)、<strong>throws / 异常</strong>(Swift / Java / Python / JS / Ruby / PHP / C#)、<strong>多返回值</strong>(Go / Lua: <code>(v, err)</code>)、<strong>输出参数 + 错误码</strong>(C)。每种风格背后都是一套不同的"调用方记得处理错误吗"的设计哲学。</>}
                en={<>Six flavours: <strong>Result / Either / Optional</strong> (TS / Rust / Kotlin / Haskell / Mojo), <strong>std::expected</strong> (C++23), <strong>error union</strong> (Zig <code>!T</code>), <strong>throws / exceptions</strong> (Swift / Java / Python / JS / Ruby / PHP / C#), <strong>multi-return</strong> (Go / Lua: <code>(v, err)</code>), and <strong>out-param + error code</strong> (C). Each style comes with its own answer to "will the caller actually handle the error".</>}
              /></p>
            </div>
            <div>
              <h3><L zh="后缀分支:match/switch 形态各异" en="The suffix branch, in five shapes" /></h3>
              <p><L
                zh={<>都是同一个三选一(<code>"" | "2" | "'"</code>),写出来千差万别: Rust / Swift 是穷尽 <code>match</code>;Python 3.10+ 用 <code>match/case</code>;Java 21 的 <code>switch</code> 表达式; Kotlin 的 <code>when</code>;TS / JS 退化为三元嵌套。<strong>同样的语义,语法密度差 3 倍</strong>。</>}
                en={<>All a three-way choice (<code>"" | "2" | "'"</code>), but the shape varies wildly: Rust / Swift use exhaustive <code>match</code>; Python 3.10+ uses <code>match/case</code>; Java 21's <code>switch</code> expression; Kotlin's <code>when</code>; TS / JS collapse to nested ternaries. <strong>Same semantics, 3× variance in syntactic density.</strong></>}
              /></p>
            </div>
            <div>
              <h3><L zh={'分词:让标准库去操心'} en="Tokenizing: let stdlib handle it" /></h3>
              <p><L
                zh={<>Go <code>strings.Fields</code>、Python / Ruby / Mojo <code>s.split()</code>、Rust <code>split_whitespace</code>、Zig <code>tokenizeAny</code>、Kotlin/Java/JS/TS <code>split(/\\s+/)</code>、Lua <code>gmatch("%S+")</code>、Haskell <code>words</code>、C# <code>Split(RemoveEmptyEntries)</code>、PHP <code>preg_split</code> —— 一行就把"连续空格"问题处理掉。C 是反例:得手动 <code>isspace</code> + 字符指针推进、自己管缓冲区。<strong>能交给标准库的就别自己写</strong>, 这条规则在 17 种语言里只有 1 种例外。</>}
                en={<>Go's <code>strings.Fields</code>, Python / Ruby / Mojo <code>s.split()</code>, Rust's <code>split_whitespace</code>, Zig's <code>tokenizeAny</code>, Kotlin/Java/JS/TS's <code>split(/\\s+/)</code>, Lua's <code>gmatch("%S+")</code>, Haskell's <code>words</code>, C#'s <code>Split(RemoveEmptyEntries)</code>, PHP's <code>preg_split</code> — one line and "runs of whitespace" is handled. C is the counterexample: you walk the pointer with <code>isspace</code> and manage the output buffer yourself. <strong>Defer to stdlib whenever you can</strong> — across 17 languages, only one is an exception.</>}
              /></p>
            </div>
          </div>
        </section>

        <footer className="compare-foot">
          <div className="compare-foot-line">
            <L zh="想看更多对比示例?" en="Want more comparison examples?" />
            <span className="compare-meta-dot">·</span>
            <Link href="/code/language/compare"><L zh="去 Ao5 对比" en="See the Ao5 comparison" /></Link>
            <span className="compare-meta-dot">·</span>
            <Link href="/code/language"><L zh="回 /code/language 主页" en="Back to /code/language" /></Link>
          </div>
          <p className="compare-foot-note">
            <L
              zh={<>下一组想加什么:打乱反演 <code>R U R' → R U' R'</code>?颜色还原比对?随便提。</>}
              en={<>Next batch ideas — scramble inversion <code>R U R' → R U' R'</code>? Sticker matching? Tell me.</>}
            />
          </p>
        </footer>
      </div>
    </LangCtx.Provider>
  );
}
