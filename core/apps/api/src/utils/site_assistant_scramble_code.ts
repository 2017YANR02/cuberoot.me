// A timer in the poster's own program is background, not a CubeRoot feature.
export function scrambleProgrammingTask(question: string) {
  return /scrambl|打乱|打亂/i.test(question)
    && /\b(?:javascript|typescript|python|c\+\+|my code|function \w+\s*\(|def \w+\s*\(|console\.log|std::|int\s+main\s*\(|cout\s*<<|rand\(\)\s*%|random\.choice)|我的代码|我的程式|打乱.{0,6}代码/i.test(question);
}

export function selfContainedScrambleCode(question: string) {
  return scrambleProgrammingTask(question)
    && !/https?:\/\/|CubeRoot|csTimer|TNoodle|cubing\.js|本站|官方|文档|网页|链接|引用|来源|\b(?:official|WCA|sources?|cite|documentation|your (?:site|timer)|on this site)\b/i.test(question);
}

// This is authored JavaScript, with every predecessor/next face/suffix tested
// in the API regression suite. Never execute a visitor's code in the worker.
export const distinctFaceGenerator = `function generateScramble(length = 20) {
  const faces = ["U", "D", "L", "R", "F", "B"];
  const suffixes = ["", "'", "2"];
  const pick = values => values[Math.floor(Math.random() * values.length)];
  const moves = [];
  let previous;
  for (let i = 0; i < length; i++) {
    const face = pick(faces.filter(next => next !== previous));
    moves.push(face + pick(suffixes));
    previous = face;
  }
  return moves.join(" ");
}`;

// Use the tested construction as input to composition. This leaves extra
// requirements, requested languages, and UI integration with the normal checker.
export function scrambleCodeGuidance(question: string) {
  if (!selfContainedScrambleCode(question)) return;
  const facts = 'This is code for the visitor’s own program. Work from the supplied code and observable inputs and outputs. Answer in the requested language with a usable correction and a small check. Use answerKind general. Do not infer site behavior. Only claim execution for checks actually supplied.';
  if (!/same (?:face|direction|letter|column|notation)|(?:同面|同一.{0,3}面|连续.{0,3}相同)/i.test(question)) return facts;
  return facts+' The following tested JavaScript construction performs a random move walk. It draws a different face from the previous emitted face before adding its suffix. It does not enforce extra axis restrictions or sample uniform states. Adapt it when the question needs different constraints or a different language.\n'+distinctFaceGenerator;
}

export function checkedScrambleExample(question:string, lang:'en'|'zh') {
  if (!selfContainedScrambleCode(question)) return;
  const cpp=commutingFaceExample(question,lang);
  if (cpp) return cpp;
  if (!/javascript|\bMath\.random\(/i.test(question)) return;
  const requests=question.split(/(?<=[?!。？！])\s*|\n+/).map(line=>line.trim()).filter(line=>/[?？]$/.test(line));
  if (requests.length!==1 || !/(?:how (?:can|do) I|how to|如何|怎么)/i.test(requests[0])
      || !/same (?:face|direction|letter).{0,32}(?:in a row|twice|consecutiv)|(?:连续|相邻).{0,12}同.{0,3}面/i.test(requests[0])) return;
  if (/\balso\b|\b(?:axis|opposite|subset|uniform|seed|typescript|python|probability|no arrays|without|in.place|complexity|only use|keep (?:my|the)|exactly|prove)\b|同时|另外|仅用|原地|对面|种子|均匀|复杂度/i.test(question)) return;
  const explanation=lang==='zh'?'每一步先排除上一次实际输出的面，再独立选择后缀。这样同一个面无论方向如何都不会连续出现。传入所需步数。':'Remove the previous emitted face from the choices, then pick the suffix independently. A face and all its variants are excluded together. Pass the desired move count.';
  return explanation+'\n\n```javascript\n'+distinctFaceGenerator+'\n```';
}

// Keep the predicate in the published program so tests compile exactly the
// implementation a visitor receives. Adjacent indices denote opposite faces.
export const cppFaceWalk = `#include <array>
#include <cstddef>
#include <iostream>
#include <random>

bool allowedFace(int older, int last, int next) {
    return next != last && !(older == next && last == (next ^ 1));
}

void printScramble(std::ostream& out, std::size_t length, std::mt19937& rng) {
    const char faces[] = "RLFBUD"; // R/L, F/B, U/D
    const std::array<const char*, 3> suffix = {"", "'", "2"};
    int older = -1, last = -1;
    for (std::size_t i = 0; i < length; ++i) {
        std::array<int, 6> choices{};
        int count = 0;
        for (int face = 0; face < 6; ++face)
            if (allowedFace(older, last, face)) choices[count++] = face;
        int next = choices[std::uniform_int_distribution<int>(0, count - 1)(rng)];
        out << (i ? " " : "") << faces[next]
            << suffix[std::uniform_int_distribution<int>(0, 2)(rng)];
        older = last;
        last = next;
    }
    out << '\\n';
}`;

function commutingFaceExample(question:string, lang:'zh'|'en') {
  if (!/c\+\+|int\s+main\s*\(|std::|cout\s*<</i.test(question)
      || !/oppos(?:ing|ite) (?:sides?|faces?)|对面|相对面/i.test(question)
      || !/more than once|three|third|(?:R|U|F)[,'′2\s]+(?:L|D|B)[,'′2\s]+(?:R|U|F)\b|三步|第三/i.test(question)) return;
  if (/\b(?:python|javascript|uniform(?:ly)?|seeded|complexity|prove|also|never (?:allow|use) (?:two )?opposite|no adjacent opposite|without (?:arrays|random))\b|禁止相邻对面|另外|概率/i.test(question)) return;
  if (/(?:never|ban|forbid|exclude|disallow|prevent) (?:any |two )?(?:adjacent |consecutive )?opposite faces? (?:from (?:being|occurring) )?(?:next to|adjacent|consecutive)|opposite faces? (?:must|should|can) ?(?:not|'t) (?:be )?(?:adjacent|consecutive)/i.test(question)) return;
  const asks=question.match(/[?？]/g);
  if (asks && asks.length>1) return;
  const length=/scrambleSize\s*=\s*(\d{1,4})\s*;/i.exec(question)?.[1] ?? /\b(\d{1,4})\s*[- ]?(?:moves?|步)/i.exec(question)?.[1] ?? '22';
  const explanation=lang==='en'
    ? "Keep the last two emitted face columns. R L is allowed: opposite faces commute but do not cancel each other. R L R reduces to R2 L, and R L R' reduces to L. Reject an adjacent repeat or a return to the same face across its opposite, regardless of suffix. R U R stays legal. Pick a suffix after choosing the face."
    : "记住实际输出的前两个面。R L 合法，对面可以交换次序。R L R 可合并为 R2 L，R L R' 可化为 L。排除相邻同面，以及隔着对面回到原面的第三步；判断时忽略后缀。R U R 仍然合法。选定面后再独立选择后缀。";
  return explanation+'\n\n```cpp\n'+cppFaceWalk+'\n\nint main() {\n    std::mt19937 rng(std::random_device{}());\n    printScramble(std::cout, '+Number(length)+', rng);\n}\n```';
}

// Diagnose a duplicated Python boolean test only when the same call and
// arguments guard both loops. A different index or function can change truth.
export function invertedScrambleLoop(question:string,lang:'en'|'zh') {
  if (!selfContainedScrambleCode(question) || !/\bpython\b/i.test(question)
      || !/infinite loop|looping|死循环/i.test(question) || !/index.{0,9}(?:out of range|越界)/i.test(question)
      || /opposite|uniform|seed|time complexity|also (?:explain|implement)|对面|均匀|随机种子/i.test(question)) return;
  const calls=[...question.matchAll(/^\s*if\s+(\w+\([\w ,+-]+\))\s*==\s*False\s*:/gm)];
  const guards=[...question.matchAll(/^\s*while\s+\(?\s*(\w+\([\w ,+-]+\))\s*\)?\s*!=\s*False\s*:/gm)];
  if (!calls.some(c=>guards.some(g=>g.index>c.index && g.index-c.index<120 && c[1]===g[1] &&
    /^\s*(?:print\s*\([^\n]*\)\s*)?$/.test(question.slice(c.index+c[0].length,g.index))))) return;
  const target=/\bwhile\s*\(?\s*(\w+)\s*<\s*([1-9]\d{0,3})\s*\)?\s*:/.exec(question);
  const indexLoop=/\bwhile\s*\(?\s*([a-z_]\w*)\s*<\s*\d+\s*\)?\s*:/ig;
  const usesCounter=[...question.matchAll(indexLoop)].some(loop=>{
    const counter=loop[1];
    const tail=question.slice(loop.index+loop[0].length);
    const increment=new RegExp('\\b'+counter+'\\s*\\+=\\s*1').exec(tail);
    return increment && calls.some(call=>call[1].endsWith(', '+counter+')') && tail.slice(0,increment.index).includes(call[1]));
  });
  if (!usesCounter || !target || !/\.remove\(\s*\w+(?:\s*-\s*1)?\s*\)/.test(question) || !/\.append\(/.test(question)) return;
  const explanation=lang==='en'
    ? 'When the predicate returns False, the nested while tests the same unchanged call for != False, so its body never runs. No move is appended on that branch, the length stays unchanged, and the outer loop repeats. list.remove(x) searches for a value; an integer index is absent from a list of move strings and would raise ValueError. In the counter-based version the candidate has not been appended yet: at index i == len(scramble), the last valid index is i−1. Check a candidate against the last emitted face before appending. Choosing from the allowed faces gives exactly one new move each iteration.'
    : '谓词为 False 时进入分支，里面的 while 对同一调用检查 != False，因此一次也不执行。这条路径没有追加动作，长度不变，外层继续循环。list.remove(x) 按值删除，在字符串列表里找整数下标会抛出 ValueError。计数器版在追加前访问 i == len(scramble)，最后一个有效下标实际为 i−1。先从与上一步不同的面中选择，再追加，每轮就能增加一步。';
  return explanation+'\n\n```python\nfrom random import choice\n\nmoves = []\nfor _ in range('+target[2]+'):\n    faces = [f for f in "RLFBUD" if not moves or f != moves[-1][0]]\n    moves.append(choice(faces) + choice(("", "2", "\'")))\nprint(" ".join(moves))\n```';
}

export function pythonScrambleListAnswer(question:string,lang:'en'|'zh') {
  if (!selfContainedScrambleCode(question) || !/python|import random|\.append\(/i.test(question) ||
      /\b(?:uniform|complexity|benchmark|write tests|typescript|javascript|prove|scramble state)\b|概率|复杂度/i.test(question)) return;
  const lengthQuestion=/more than one item|greater than one item|list index\s*>\s*0|至少两项/i.test(question);
  const list=/\bif\s+(\w+)\s*:/.exec(question)?.[1];
  if (lengthQuestion && list && new RegExp('\\b'+list+'\\.append\\(').test(question)) {
    const count=/for \w+ in range\(0,\s*([1-9]\d{0,3})\):/.exec(question)?.[1];
    const indices=[...new Set([...question.matchAll(new RegExp('\\b'+list+'\\[(\\d+)\\]','g'))].map(m=>Number(m[1])))];
    const bounds=count && indices.length ? (lang==='en'?' After exactly '+count+' appends the valid positive and zero indices are 0 through '+(Number(count)-1)+'. The largest fixed index in the snippet, '+Math.max(...indices)+', needs at least '+(Math.max(...indices)+1)+' items.':' 追加 '+count+' 项后，有效非负下标为 0 到 '+(Number(count)-1)+'；代码中最大固定下标 '+Math.max(...indices)+' 至少需要 '+(Math.max(...indices)+1)+' 项。') : '';
    return (lang==='en'
      ? 'Use `len('+list+') > 1` to ask whether an item exists at a positive index (index 1 is the first). For a particular nonnegative index j use `0 <= j < len('+list+')`. This tests existence even if the stored value is false. In your move loop, `if '+list+':` already means there is at least one earlier move. Keep that guard when comparing the candidate face with `'+list+'[-1][0]`: it is false on the first iteration and true when choosing the second move. Changing that guard to > 1 would allow the second move to repeat the first face.'
      : '要判断是否存在下标大于零的项，用 `len('+list+') > 1`。判断指定非负下标 j 是否存在，用 `0 <= j < len('+list+')`，即使元素的值是假也能正确判断。在逐步生成打乱的循环中，`if '+list+':` 已能保护访问最后一步；第一次为空，选第二步时已有一步，要立即比较候选面的首字母。改成长度大于 1 会漏掉前两步同面的情况。')+bounds;
  }
  const count=/\bwhile\s+len\(\w+\)\s*<\s*([1-9]\d{0,3})\s*:/.exec(question)?.[1];
  if (!count || !/quot|引号|surrounded by|starts with "/i.test(question) ||
      !/not (?:be )?repeated|no (?:consecutive|repeated)|same face|重复/i.test(question) ||
      /opposite|对面|seed/i.test(question)) return;
  const explanation=lang==='en'
    ? 'Printing a list displays each string using repr, which supplies delimiters. The enclosing quotes are not stored characters. The apostrophe in a move such as R\' is stored and must be kept. Join the moves with spaces for display. Choose a face different from the previous move’s first character, then independently choose its suffix.'
    : '打印列表时 Python 用 repr 显示每个字符串，外侧引号只是显示用的分隔符。动作内部的撇号表示逆转，要保留。用空格拼接列表输出，每次先排除上一步的面，再单独选择后缀。';
  return explanation+'\n\n```python\nfrom random import choice\n\ndef scramble(length):\n    moves = []\n    for _ in range(length):\n        faces = [f for f in "RLFBUD" if not moves or f != moves[-1][0]]\n        moves.append(choice(faces) + choice(("", "\'", "2")))\n    return " ".join(moves)\n\nprint(scramble('+count+'))\n```';
}

// For a random face list repaired in a later pass, derive the poster's
// directed forbidden pairs from literal neighbour comparisons. Do not
// silently turn "R then L" into a ban on both orders or on whole axes.
export function repairedPythonFaceWalk(question:string,lang:'en'|'zh') {
  if (!selfContainedScrambleCode(question) || !/random\.choice\(/.test(question) ||
      !/same face|face one after the other|同面/i.test(question) ||
      /uniform|seed|complexity|opposite.{0,15}both ways|概率|复杂度/i.test(question)) return;
  const noop=/^\s*(\w+)\[\w+\s*\+\s*1\]\s*==\s*random\.choice\(\w+\)\s*$/m.exec(question);
  const target=/for \w+ in range\(([1-9]\d{0,3})\):\s*(\w+)\.append\(random\.choice\(\w+\)\)/.exec(question);
  if (!noop || !target || noop[1]!==target[2]) return;
  const pairs=[...question.matchAll(/if\s+(\w+)\[(\w+)\]\s*==\s*["']([RLFBUD])["']\s+and\s+\1\[\2\s*\+\s*1\]\s*==\s*["']([RLFBUD])["']\s*:/g)]
    .filter(m=>m[1]===noop[1]).map(m=>'("'+m[3]+'", "'+m[4]+'")');
  if (!pairs.length) return;
  const why=lang==='en'?'Your first pass redraws only once: it may pick the same face again or spoil a pair already checked. In the next pass a bare == expression compares and discards its result; it does not assign. Later edits can also reintroduce same-face neighbours. Build left to right and keep the three suffixes independent. The forbidden pairs below follow the direction of the comparisons in your code; if you only care about adjacent identical faces, use an empty set.':'单次重抽仍可能选回同面，也可能破坏前一个已检查的组合。第二轮里单独一行 == 只比较，并未赋值。改为从左到右生成，再独立选择后缀。下列有向禁配按输入代码提取；若只要求相邻不同面，可使用空集合。';
  return why+'\n\n```python\nfrom random import choice\n\ndef getscramble(length='+target[1]+'):\n    forbidden = {'+pairs.join(', ')+'}\n    previous = None\n    moves = []\n    for _ in range(length):\n        options = [f for f in "RLFBUD" if f != previous and (previous, f) not in forbidden]\n        previous = choice(options)\n        moves.append(previous + choice(("", "\'", "2")))\n    return " ".join(moves)\n```';
}

export function pythonRuntimeDiagnostic(question:string,lang:'en'|'zh') {
  if (!/execjs\._exceptions\.ProgramError:\s*SyntaxError/i.test(question) ||
      !/scrambl/i.test(question) || !/on win32|[A-Z]:\\Users\\/i.test(question) ||
      !/execjs[\\/]_external_runtime\.py/i.test(question)) return;
  return lang==='en'?'The call reached the external JavaScript runtime through PyExecJS. That runtime reported a JavaScript syntax error while the scrambler was being evaluated. The traceback does not identify the engine or the offending token. In the same Python environment run `python -c "import execjs; print(execjs.get().name)"`, then run `node --version` and `where.exe node`. If Node is missing or broken, install or reinstall it, reopen the terminal and check the selected runtime again. Start a fresh Python process and retry the original call. If it still fails, record the Python, Node and package versions and the selected engine so the failing script can be reproduced.':'调用已经由 PyExecJS 进入外部 JavaScript 运行时，报错发生在解析脚本时。这份堆栈不能确定引擎或出错字符。在同一 Python 环境运行 `python -c "import execjs; print(execjs.get().name)"`，再用 `node --version` 和 `where.exe node` 确认 Node。若缺失或损坏，安装或重装后打开新终端，复查选中的引擎并重试原调用。若仍出错，记录 Python、Node、包版本和运行时名称。';
}

export function competitionPythonWalk(question:string,lang:'en'|'zh') {
  if (!scrambleProgrammingTask(question) || /also (?:write|design|add|explain|compare)|另外|同时实现|compare (?:websites|libraries)|including refunds/i.test(question) || !/competition|比赛/i.test(question) ||
      !/rules|规定|规则/i.test(question) ||
      !/double moves|same face|连续同面/i.test(question) || /[2456789]\s*[×x]|blindfold|fewest moves|pyraminx|square-1/i.test(question)) return;
  const selection=/\b(\w+)\[\s*random\.(randrange|randint)\(\s*(-?\d{1,3}(?:\s*,\s*-?\d{1,3}){0,2})\s*\)\s*\]/.exec(question);
  if (!selection) return;
  const source=new RegExp('\\b'+selection[1]+'\\s*=\\s*\\[([^\\]\\n]+)\\]').exec(question);
  if (!source) return;
  const tokens=source[1].trim().replace(/,$/,'').split(',').map(token=>/^\s*(["'])([URFDLB](?:2|')?)\1\s*$/.exec(token)?.[2]);
  if (!tokens.length || !tokens.every(move=>move!==undefined)) return;
  const args=selection[3].split(',').map(Number);
  const inclusive=selection[2]==='randint';
  if (inclusive && args.length!==2) return;
  const first=args.length===1 ? 0 : args[0];
  const stop=(args[1] ?? args[0])+(inclusive?1:0);
  const step=args[2] ?? 1;
  const reachable=new Set<number>();
  let outOfRange=false;
  if (step) for (let i=first;step>0?i<stop:i>stop;i+=step) {
    const index=i<0 ? tokens.length+i : i;
    if (index<0 || index>=tokens.length) outOfRange=true;
    else reachable.add(index);
  }
  const unavailable=[...new Set(tokens.filter((_,i)=>!reachable.has(i)))].filter(move=>![...reachable].some(i=>tokens[i]===move));
  const missing=[...'URFLDB'].filter(face=>!tokens.some(move=>move[0]===face));
  const rangeFailure=outOfRange ? (lang==='en'?'The sampled index can fall outside the move list and raise IndexError. ':'抽到的下标可能越界，抛出 IndexError。') :
    !reachable.size ? (lang==='en'?'This range cannot produce an index and raises ValueError. ':'这个取值范围无法产生下标，会抛出 ValueError。') : '';
  const bounds=lang==='en'?(inclusive?'randint includes both endpoints; unreachable entries: ':step<0?'randrange excludes its stop value; unreachable entries: ':'randrange excludes its upper bound; unreachable entries: '):
    (inclusive?'randint 包含两个端点，取不到 ':step<0?'randrange 不含终止值，取不到 ':'randrange 不含上界，取不到 ');
  const diagnosis=rangeFailure+(unavailable.length?bounds+unavailable.join(', ')+'. ':'')+
    (missing.length?(lang==='en'?'Your list omits faces: ':'列表缺少面 ')+missing.join(', ')+'. ':'');
  return diagnosis+(lang==='en'?'For practice, replace the move-selection loop below; adjacent half turns on the same face cancel. Pick the face before its suffix. A longer random walk does not guarantee uniformly sampled states.':'练习时可用下面的循环生成动作。同一面连续两个半转会抵消。先选面，再选后缀。增加步数不能保证均匀随机局面。')+
    '\n\n```python\nfrom random import choice\n\ndef practice_scramble(length):\n    moves = []\n    for _ in range(length):\n        faces = [f for f in "URFLDB" if not moves or f != moves[-1][0]]\n        moves.append(choice(faces) + choice(("", "2", "\'")))\n    return moves\n```';
}

// Keep the poster's actual dispatch keys and bound arguments. Only accept a
// complete table of literal zero-argument or single-string method calls.
export function pythonMoveDispatch(question:string,lang:'en'|'zh') {
  if (!selfContainedScrambleCode(question) || !/dict(?:ionary|ionaries)|字典/i.test(question)) return;
  const table=/\b(\w+)\s*=\s*\{([^{}]{1,2200})\}/.exec(question);
  const loop=/for \w+ in range\(([1-9]\d{0,3})\):\s*(\w+)\s*=\s*random\.randint\((\d+),\s*(\d+)\)\s*(\w+)\[\2\](?!\s*\()/.exec(question);
  if (!table || !loop || loop[5]!==table[1]) return;
  const entries=table[2].trim().replace(/,$/,'').split(',').map(part=>/^\s*(\d+)\s*:\s*self\.(\w+)\((?:["']([\w -]{1,32})["'])?\)\s*$/.exec(part));
  if (!entries.length || entries.length>40 || !entries.every(entry=>entry!==null)) return;
  const keys=new Set(entries.map(e=>Number(e[1])));
  if (keys.size!==entries.length || Math.min(...keys)!==Number(loop[3]) ||
      Math.max(...keys)!==Number(loop[4]) || keys.size!==Number(loop[4])-Number(loop[3])+1) return;
  const lines=entries.map(e=>'        '+e[1]+': '+(e[3]?'partial(self.'+e[2]+', '+JSON.stringify(e[3])+')':'self.'+e[2])+',');
  const explanation=lang==='en'?'Calling methods inside the dictionary literal executes them immediately and stores their return values. Looking up a key alone does not call anything. Store bound methods and use partial to bind the actual argument for inverted moves, then call the selected entry once per iteration. If the flag is still ignored after this change, inspect how the method reads its parameter. A fixed-length random walk is a practice shuffle.':'在字典值里调用方法会立即执行并保存返回值。只查键不会再次执行。正常转动存绑定方法，逆转用 partial 绑定实参；每次抽一个键并调用。若这样仍未逆转，再检查方法内部如何读取参数。固定步数随机转动可用于练习。';
  return explanation+'\n\n```python\nfrom functools import partial\nimport random\n\ndef random_cube(self):\n    turns = {\n'+lines.join('\n')+'\n    }\n    for _ in range('+loop[1]+'):\n        turns[random.choice(tuple(turns))]()\n```';
}
