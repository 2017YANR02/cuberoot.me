import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import"./i18n-Bq9LDJhp.js";import{t as n}from"./useTranslation-azoUBVHB.js";import{n as r}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as i}from"./jsx-runtime-DhG3BTtD.js";import{t as a}from"./LangToggle-BIG_wtlT.js";/* empty css                */var o=e(t(),1),s=i(),c=(0,o.createContext)(`zh`);function l({zh:e,en:t}){return(0,s.jsx)(s.Fragment,{children:(0,o.useContext)(c)===`zh`?e:t})}var u=[{slug:`ts`,name:`TypeScript`,href:`/code/language/ts`,accent:`#3178C6`,commentToken:`//`,zhFlavor:`联合类型 number | null + filter 链`,enFlavor:`Union number | null + filter chain`,code:`type Time = number | null; // null = DNF, value in centiseconds

function ao5(times: Time[]): Time {
  const dnfs = times.filter(t => t === null).length;
  if (dnfs >= 2) return null;

  const sorted = [...times].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  const mid = sorted.slice(1, 4) as number[];
  return Math.round(mid.reduce((s, t) => s + t, 0) / 3);
}`},{slug:`rust`,name:`Rust`,href:`/code/language/rust`,accent:`#CE422B`,commentToken:`//`,zhFlavor:`Option<T> + tuple match`,enFlavor:`Option<T> + tuple match`,code:`type Time = Option<u32>;

fn ao5(times: &[Time; 5]) -> Time {
    if times.iter().filter(|t| t.is_none()).count() >= 2 {
        return None;
    }

    let mut s = *times;
    s.sort_by(|a, b| match (a, b) {
        (None, None)       => std::cmp::Ordering::Equal,
        (None, _)          => std::cmp::Ordering::Greater,
        (_, None)          => std::cmp::Ordering::Less,
        (Some(a), Some(b)) => a.cmp(b),
    });

    let sum: u32 = s[1..4].iter().filter_map(|&t| t).sum();
    Some(sum / 3)
}`},{slug:`go`,name:`Go`,href:`/code/language/go`,accent:`#00ADD8`,commentToken:`//`,zhFlavor:`-1 哨兵值 + sort.Slice`,enFlavor:`-1 sentinel + sort.Slice`,code:`package main

import "sort"

const DNF = -1

func ao5(times [5]int) int {
    dnfs := 0
    for _, t := range times {
        if t == DNF {
            dnfs++
        }
    }
    if dnfs >= 2 {
        return DNF
    }

    s := times
    sort.Slice(s[:], func(i, j int) bool {
        if s[i] == DNF { return false }
        if s[j] == DNF { return true }
        return s[i] < s[j]
    })

    return (s[1] + s[2] + s[3]) / 3
}`},{slug:`python`,name:`Python`,href:`/code/language/python`,accent:`#3776AB`,commentToken:`#`,zhFlavor:`类型注解 + sorted key lambda`,enFlavor:`Type hints + sorted key lambda`,code:`from typing import Optional

# WCA Ao5: drop best & worst, mean of middle 3.
# DNFs sort to the bottom; 2+ DNFs → entire average is DNF.

def ao5(times: list[Optional[int]]) -> Optional[int]:
    if sum(1 for t in times if t is None) >= 2:
        return None

    s = sorted(times, key=lambda t: float('inf') if t is None else t)
    return sum(s[1:4]) // 3`},{slug:`c`,name:`C`,href:`/code/language/c`,accent:`#03579B`,commentToken:`//`,zhFlavor:`宏定义 + qsort 自定义比较器`,enFlavor:`#define + qsort with custom comparator`,code:`#include <stdlib.h>

#define DNF -1

static int cmp(const void *a, const void *b) {
    int x = *(const int*)a, y = *(const int*)b;
    if (x == DNF) return 1;
    if (y == DNF) return -1;
    return x - y;
}

int ao5(int t[5]) {
    int dnfs = 0;
    for (int i = 0; i < 5; i++)
        if (t[i] == DNF) dnfs++;
    if (dnfs >= 2) return DNF;

    int s[5];
    for (int i = 0; i < 5; i++) s[i] = t[i];
    qsort(s, 5, sizeof(int), cmp);

    return (s[1] + s[2] + s[3]) / 3;
}`},{slug:`cpp`,name:`C++`,href:`/code/language/cpp`,accent:`#00599C`,commentToken:`//`,zhFlavor:`std::optional + ranges::sort`,enFlavor:`std::optional + ranges::sort`,code:`#include <array>
#include <optional>
#include <algorithm>

using Time = std::optional<int>;

Time ao5(std::array<Time, 5> t) {
    if (std::ranges::count(t, std::nullopt) >= 2)
        return std::nullopt;

    std::ranges::sort(t, [](auto a, auto b) {
        if (!a) return false;
        if (!b) return true;
        return *a < *b;
    });

    return (*t[1] + *t[2] + *t[3]) / 3;
}`},{slug:`zig`,name:`Zig`,href:`/code/language/zig`,accent:`#F7A41D`,commentToken:`//`,zhFlavor:`?T 可空类型 + 内联结构体函数`,enFlavor:`?T optional + struct-wrapped fn`,code:`const std = @import("std");

const Time = ?u32;

fn ao5(times: [5]Time) Time {
    var dnfs: u32 = 0;
    for (times) |t| if (t == null) { dnfs += 1; };
    if (dnfs >= 2) return null;

    var s = times;
    std.mem.sort(Time, &s, {}, struct {
        fn lt(_: void, a: Time, b: Time) bool {
            if (a == null) return false;
            if (b == null) return true;
            return a.? < b.?;
        }
    }.lt);

    return (s[1].? + s[2].? + s[3].?) / 3;
}`},{slug:`swift`,name:`Swift`,href:`/code/language/swift`,accent:`#F05138`,commentToken:`//`,zhFlavor:`Optional + 元组 switch`,enFlavor:`Optional + tuple switch`,code:`func ao5(_ times: [Int?]) -> Int? {
    let dnfs = times.lazy.filter { $0 == nil }.count
    guard dnfs < 2 else { return nil }

    let sorted = times.sorted {
        switch ($0, $1) {
        case (nil, _):     return false
        case (_, nil):     return true
        case let (a?, b?): return a < b
        }
    }

    let mid = sorted[1...3].compactMap { $0 }
    return mid.reduce(0, +) / 3
}`},{slug:`kotlin`,name:`Kotlin`,href:`/code/language/kotlin`,accent:`#7F52FF`,commentToken:`//`,zhFlavor:`compareBy(nullsLast()) + filterNotNull`,enFlavor:`compareBy(nullsLast()) + filterNotNull`,code:`fun ao5(times: List<Int?>): Int? {
    if (times.count { it == null } >= 2) return null

    val sorted = times.sortedWith(
        compareBy(nullsLast()) { it }
    )

    return sorted.subList(1, 4)
        .filterNotNull()
        .sum() / 3
}`},{slug:`java`,name:`Java`,href:`/code/language/java`,accent:`#E76F00`,commentToken:`//`,zhFlavor:`Comparator.nullsLast + 装箱 Integer`,enFlavor:`Comparator.nullsLast + boxed Integer`,code:`import java.util.*;

// WCA Ao5: DNF = null. Drop best & worst, mean of middle 3.

public static Integer ao5(Integer[] times) {
    long dnfs = Arrays.stream(times)
        .filter(Objects::isNull).count();
    if (dnfs >= 2) return null;

    Integer[] s = times.clone();
    Arrays.sort(s, Comparator.nullsLast(Integer::compare));
    return (s[1] + s[2] + s[3]) / 3;
}`},{slug:`js`,name:`JavaScript`,href:`/code/language/javascript`,accent:`#E5C100`,commentToken:`//`,zhFlavor:`和 TS 同源,但没类型把门`,enFlavor:`Same shape as TS, no types at the door`,code:`// WCA Ao5: DNF = null.
// No type system to remind you DNF is unhandled — write defensively.

const ao5 = (times) => {
  if (times.filter(t => t == null).length >= 2) return null;

  const s = [...times].sort((a, b) =>
    a == null ? 1 : b == null ? -1 : a - b
  );

  return Math.round((s[1] + s[2] + s[3]) / 3);
};`},{slug:`mojo`,name:`Mojo`,href:`/code/language/mojo`,accent:`#FF4B00`,commentToken:`#`,zhFlavor:`fn 严格 + Optional + MLIR 后端`,enFlavor:`Strict fn + Optional + MLIR backend`,code:`# Mojo: fn = strict typed (vs Python's loose def).
# Same shape as Python, but compiles to native via MLIR.

fn ao5(times: List[Optional[Int]]) -> Optional[Int]:
    var dnfs = 0
    for t in times:
        if not t: dnfs += 1
    if dnfs >= 2: return None

    var s = sorted(
        times,
        key=fn(t: Optional[Int]) -> Int:
            return t.value() if t else Int.MAX,
    )
    return (s[1].value() + s[2].value() + s[3].value()) // 3`},{slug:`csharp`,name:`C#`,href:`/code/language/csharp`,accent:`#512BD4`,commentToken:`//`,zhFlavor:`int? 可空 + LINQ OrderBy`,enFlavor:`Nullable<int> + LINQ OrderBy`,code:`// C# 8+: int? is Nullable<int>. LINQ for sort & sum.
// DNFs become null and float to the end via int.MaxValue key.

public static int? Ao5(int?[] times)
{
    if (times.Count(t => t is null) >= 2) return null;

    var s = times
        .OrderBy(t => t ?? int.MaxValue)
        .ToArray();

    return (s[1]!.Value + s[2]!.Value + s[3]!.Value) / 3;
}`},{slug:`ruby`,name:`Ruby`,href:`/code/language/ruby`,accent:`#CC342D`,commentToken:`#`,zhFlavor:`nil + sort_by Float::INFINITY`,enFlavor:`nil + sort_by Float::INFINITY`,code:`# WCA Ao5: nil = DNF. INFINITY in sort_by pushes nils to the end.

def ao5(times)
  return nil if times.count(&:nil?) >= 2

  s = times.sort_by { |t| t.nil? ? Float::INFINITY : t }
  (s[1] + s[2] + s[3]) / 3
end`},{slug:`php`,name:`PHP`,href:`/code/language/php`,accent:`#777BB4`,commentToken:`//`,zhFlavor:`?int 可空 + usort + 太空船 <=>`,enFlavor:`?int nullable + usort + spaceship <=>`,code:`<?php
// PHP 8: nullable return ?int, arrow fn, spaceship operator <=>.

function ao5(array $times): ?int {
    $dnfs = count(array_filter($times, fn($t) => $t === null));
    if ($dnfs >= 2) return null;

    $s = $times;
    usort($s, fn($a, $b) =>
        $a === null ? 1 : ($b === null ? -1 : $a <=> $b)
    );

    return intdiv($s[1] + $s[2] + $s[3], 3);
}`},{slug:`lua`,name:`Lua`,href:`/code/language/lua`,accent:`#2C2D72`,commentToken:`--`,zhFlavor:`1-indexed 表 + -1 哨兵 (nil 在表里会消失)`,enFlavor:`1-indexed table + -1 sentinel (nil holes vanish)`,code:`-- Lua: tables drop trailing nils, so we use -1 as DNF.
-- Tables are 1-indexed.

local DNF = -1

local function ao5(times)
    local dnfs = 0
    for i = 1, 5 do
        if times[i] == DNF then dnfs = dnfs + 1 end
    end
    if dnfs >= 2 then return DNF end

    local s = { table.unpack(times) }
    table.sort(s, function(a, b)
        if a == DNF then return false end
        if b == DNF then return true  end
        return a < b
    end)

    return math.floor((s[2] + s[3] + s[4]) / 3)
end`},{slug:`haskell`,name:`Haskell`,href:`/code/language/haskell`,accent:`#5E5086`,commentToken:`--`,zhFlavor:`Maybe Int + sortBy comparing + catMaybes`,enFlavor:`Maybe Int + sortBy comparing + catMaybes`,code:`-- WCA Ao5: Maybe Int. Total functions, pattern-matching the empties out.

import Data.List  (sortBy)
import Data.Ord   (comparing)
import Data.Maybe (catMaybes, isNothing)

ao5 :: [Maybe Int] -> Maybe Int
ao5 ts
  | length (filter isNothing ts) >= 2 = Nothing
  | otherwise = Just (sum middle \`div\` 3)
  where
    sorted = sortBy (comparing (maybe maxBound id)) ts
    middle = catMaybes (take 3 (drop 1 sorted))`}];function d(e,t){return e.split(`
`).map((e,n)=>{let r=e.indexOf(t);return r===-1||/["']/.test(e.slice(0,r))?(0,s.jsx)(`div`,{children:e||`\xA0`},n):(0,s.jsxs)(`div`,{children:[e.slice(0,r),(0,s.jsx)(`span`,{className:`compare-cmt`,children:e.slice(r)})]},n)})}function f(){let{i18n:e}=n(),t=e.language.startsWith(`zh`)?`zh`:`en`;return(0,o.useEffect)(()=>{document.title=t===`zh`?`17 种语言, 一个 Ao5 — CubeRoot`:`One Ao5, Seventeen Languages — CubeRoot`},[t]),(0,s.jsx)(c.Provider,{value:t,children:(0,s.jsxs)(`div`,{className:`compare-root`,children:[(0,s.jsx)(`div`,{className:`compare-bg`}),(0,s.jsxs)(`header`,{className:`compare-head`,children:[(0,s.jsxs)(`div`,{className:`compare-topbar`,children:[(0,s.jsxs)(r,{to:`/code/language`,className:`compare-back`,children:[`← `,(0,s.jsx)(l,{zh:`回 /code/language`,en:`Back to /code/language`})]}),(0,s.jsx)(a,{variant:`inline`})]}),(0,s.jsx)(`div`,{className:`compare-tag`,children:(0,s.jsx)(l,{zh:`// WCA Ao5 · 17 Languages · 1 Algorithm`,en:`// WCA Ao5 · 17 Languages · 1 Algorithm`})}),(0,s.jsx)(`h1`,{className:`compare-title`,children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`17 种语言`,(0,s.jsx)(`span`,{className:`compare-comma`,children:`,`}),` 一个 `,(0,s.jsx)(`span`,{className:`compare-hl`,children:`Ao5`})]}),en:(0,s.jsxs)(s.Fragment,{children:[`One `,(0,s.jsx)(`span`,{className:`compare-hl`,children:`Ao5`}),(0,s.jsx)(`span`,{className:`compare-comma`,children:`,`}),` Seventeen Languages`]})})}),(0,s.jsx)(`p`,{className:`compare-sub`,children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`同一个 `,(0,s.jsx)(`strong`,{children:`WCA Average-of-5`}),` 算法, 17 种语言写一遍。看每门语言怎么处理"DNF"——这个"成绩不存在"的情况是每个语言类型系统的试金石。`]}),en:(0,s.jsxs)(s.Fragment,{children:[`The same `,(0,s.jsx)(`strong`,{children:`WCA Average-of-5`}),` algorithm, written in seventeen languages. Watch each language handle "DNF" — that "value doesn't exist" case is a litmus test for any type system.`]})})})]}),(0,s.jsxs)(`section`,{className:`compare-rules`,children:[(0,s.jsx)(`h2`,{className:`compare-rules-h`,children:(0,s.jsx)(l,{zh:`WCA Ao5 规则 (60 秒速览)`,en:`The WCA Ao5 rules (in 60 seconds)`})}),(0,s.jsxs)(`ol`,{className:`compare-rules-list`,children:[(0,s.jsx)(`li`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`选手做 `,(0,s.jsx)(`strong`,{children:`5 次`}),` 该项目的尝试,记下时间(单位:厘秒)`]}),en:(0,s.jsxs)(s.Fragment,{children:[`Cuber attempts the event `,(0,s.jsx)(`strong`,{children:`5 times`}),`; each result in centiseconds`]})})}),(0,s.jsx)(`li`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`把 `,(0,s.jsx)(`strong`,{children:`最快`}),` 和 `,(0,s.jsx)(`strong`,{children:`最慢`}),` 那次去掉`]}),en:(0,s.jsxs)(s.Fragment,{children:[`Drop the `,(0,s.jsx)(`strong`,{children:`fastest`}),` and the `,(0,s.jsx)(`strong`,{children:`slowest`}),` attempt`]})})}),(0,s.jsx)(`li`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`剩下中间 3 次的算术平均 = `,(0,s.jsx)(`code`,{children:`Ao5`})]}),en:(0,s.jsxs)(s.Fragment,{children:[`Arithmetic mean of the remaining 3 = `,(0,s.jsx)(`code`,{children:`Ao5`})]})})}),(0,s.jsx)(`li`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(`strong`,{children:`DNF`}),`(Did Not Finish)按"无穷大"参与排序——它会被当作"最慢"被丢掉`]}),en:(0,s.jsxs)(s.Fragment,{children:[`A `,(0,s.jsx)(`strong`,{children:`DNF`}),` (Did Not Finish) sorts to the very end — it gets dropped as the "slowest"`]})})}),(0,s.jsx)(`li`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`但如果有 `,(0,s.jsx)(`strong`,{children:`≥ 2 次 DNF`}),`,整个 Ao5 也算 `,(0,s.jsx)(`code`,{children:`DNF`})]}),en:(0,s.jsxs)(s.Fragment,{children:[`But with `,(0,s.jsx)(`strong`,{children:`≥ 2 DNFs`}),`, the whole Ao5 itself becomes `,(0,s.jsx)(`code`,{children:`DNF`})]})})})]}),(0,s.jsxs)(`div`,{className:`compare-example`,children:[(0,s.jsx)(`span`,{className:`compare-example-tag`,children:(0,s.jsx)(l,{zh:`示例`,en:`Example`})}),(0,s.jsx)(`code`,{children:`[12.34, 11.22, DNF, 13.45, 10.99]`}),(0,s.jsx)(`span`,{className:`compare-arrow`,children:`→`}),(0,s.jsx)(`code`,{children:`排序: [10.99, 11.22, 12.34, 13.45, DNF]`}),(0,s.jsx)(`span`,{className:`compare-arrow`,children:`→`}),(0,s.jsx)(`code`,{children:(0,s.jsx)(l,{zh:`去头去尾,mean(11.22, 12.34, 13.45) = 12.34s`,en:`drop ends, mean(11.22, 12.34, 13.45) = 12.34s`})})]})]}),(0,s.jsx)(`section`,{className:`compare-grid`,children:u.map(e=>(0,s.jsxs)(`article`,{className:`compare-card`,style:{"--accent":e.accent},children:[(0,s.jsxs)(`header`,{className:`compare-card-h`,children:[(0,s.jsx)(`span`,{className:`compare-card-name`,children:e.name}),(0,s.jsx)(r,{to:e.href,className:`compare-card-link`,children:(0,s.jsx)(l,{zh:`深入读 →`,en:`deep dive →`})})]}),(0,s.jsx)(`pre`,{className:`compare-code`,children:(0,s.jsx)(`code`,{children:d(e.code,e.commentToken)})}),(0,s.jsx)(`footer`,{className:`compare-card-flavor`,children:t===`zh`?e.zhFlavor:e.enFlavor})]},e.slug))}),(0,s.jsxs)(`section`,{className:`compare-takeaway`,children:[(0,s.jsx)(`h2`,{className:`compare-takeaway-h`,children:(0,s.jsx)(l,{zh:`哪里看出门道?`,en:`What to notice`})}),(0,s.jsxs)(`div`,{className:`compare-takeaway-grid`,children:[(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h3`,{children:(0,s.jsx)(l,{zh:`DNF 这个"空值"`,en:`The DNF empty value`})}),(0,s.jsx)(`p`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`17 种语言对"成绩不存在"给出 4 种不同答案:`,(0,s.jsx)(`strong`,{children:`类型联合`}),`(TS `,(0,s.jsx)(`code`,{children:`number | null`}),` / PHP `,(0,s.jsx)(`code`,{children:`?int`}),`)、`,(0,s.jsx)(`strong`,{children:`Option / Optional / Maybe`}),`(Rust / C++ / Swift / Kotlin / Zig / Python / Java boxed null / Mojo `,(0,s.jsx)(`code`,{children:`Optional[Int]`}),` / C# `,(0,s.jsx)(`code`,{children:`int?`}),` / Haskell `,(0,s.jsx)(`code`,{children:`Maybe Int`}),`)、`,(0,s.jsx)(`strong`,{children:`哨兵值`}),`(C / Go / Lua 用 -1)、`,(0,s.jsx)(`strong`,{children:`无类型把门`}),`(JS / Ruby)。AI agent 写代码时, 前两类编译期就能查出 DNF 没处理;后两类要靠测试才发现——JS / Ruby 这一栏是 TS 的反衬。`]}),en:(0,s.jsxs)(s.Fragment,{children:[`Seventeen languages, four distinct answers to "value doesn't exist": `,(0,s.jsx)(`strong`,{children:`union types`}),` (TS `,(0,s.jsx)(`code`,{children:`number | null`}),` / PHP `,(0,s.jsx)(`code`,{children:`?int`}),`), `,(0,s.jsx)(`strong`,{children:`Option / Optional / Maybe`}),` (Rust / C++ / Swift / Kotlin / Zig / Python / Java's boxed null / Mojo's `,(0,s.jsx)(`code`,{children:`Optional[Int]`}),` / C# `,(0,s.jsx)(`code`,{children:`int?`}),` / Haskell `,(0,s.jsx)(`code`,{children:`Maybe Int`}),`), `,(0,s.jsx)(`strong`,{children:`sentinel values`}),` (C / Go / Lua using -1), and `,(0,s.jsx)(`strong`,{children:`no type guard at all`}),` (JS / Ruby). The first two surface unhandled DNFs at compile time; the last two need tests to catch — JS / Ruby are the foil to TS here.`]})})})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h3`,{children:(0,s.jsx)(l,{zh:`排序时的"空值放哪"`,en:`Where do empties sort to`})}),(0,s.jsx)(`p`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`Kotlin 一行: `,(0,s.jsx)(`code`,{children:`compareBy(nullsLast())`}),`。Ruby `,(0,s.jsx)(`code`,{children:`sort_by`}),` 一句。Python 一行 lambda key。Haskell `,(0,s.jsx)(`code`,{children:`comparing (maybe maxBound id)`}),` 一行。Rust 要 4 行 match 穷尽。Zig 要包一个内联结构体。同样的语义, 代码量差 5×——这就是"语言密度"的真实差距。`]}),en:(0,s.jsxs)(s.Fragment,{children:[`Kotlin in one line: `,(0,s.jsx)(`code`,{children:`compareBy(nullsLast())`}),`. Ruby `,(0,s.jsx)(`code`,{children:`sort_by`}),` in one line. Python in one lambda key. Haskell with `,(0,s.jsx)(`code`,{children:`comparing (maybe maxBound id)`}),` in one line. Rust takes a four-arm exhaustive match. Zig wraps it in an inline struct. Same semantics, 5× variance in line count — the real "language density" gap.`]})})})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h3`,{children:(0,s.jsx)(l,{zh:`高阶函数 vs 命令式`,en:`Higher-order vs imperative`})}),(0,s.jsx)(`p`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`Python / Swift / Kotlin / TS 用 `,(0,s.jsx)(`code`,{children:`filter / map / reduce / sorted`}),` 链式表达"管道"风格;C / Zig 仍走 `,(0,s.jsx)(`code`,{children:`for`}),` 循环 + 中间数组的命令式。Rust 介于两者之间——既能 iterator chain 又能 imperative。`]}),en:(0,s.jsxs)(s.Fragment,{children:[`Python / Swift / Kotlin / TS lean on `,(0,s.jsx)(`code`,{children:`filter / map / reduce / sorted`}),` chains in a pipeline style; C and Zig still go imperative with `,(0,s.jsx)(`code`,{children:`for`}),` loops and scratch arrays. Rust sits in between — iterator chains or imperative, both feel native.`]})})})]}),(0,s.jsxs)(`div`,{children:[(0,s.jsx)(`h3`,{children:(0,s.jsx)(l,{zh:`错误 / 边界处理`,en:`Errors / boundary handling`})}),(0,s.jsx)(`p`,{children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`WCA 规则要求恰好 5 次尝试。在 Rust / Zig / C++ 里这通过`,(0,s.jsx)(`strong`,{children:`定长数组类型`}),` `,(0,s.jsx)(`code`,{children:`[Time; 5]`}),` 编译期就保证了——参数过短直接编译失败。Python / TS 用 `,(0,s.jsx)(`code`,{children:`list`}),`,要靠运行时 `,(0,s.jsx)(`code`,{children:`assert`}),` 检查。`]}),en:(0,s.jsxs)(s.Fragment,{children:[`WCA rules demand exactly 5 attempts. Rust / Zig / C++ guarantee this with `,(0,s.jsx)(`strong`,{children:`fixed-size array types`}),` like `,(0,s.jsx)(`code`,{children:`[Time; 5]`}),` — too few args, won't compile. Python / TS use `,(0,s.jsx)(`code`,{children:`list`}),`, so they need a runtime `,(0,s.jsx)(`code`,{children:`assert`}),`.`]})})})]})]})]}),(0,s.jsxs)(`footer`,{className:`compare-foot`,children:[(0,s.jsxs)(`div`,{className:`compare-foot-line`,children:[(0,s.jsx)(l,{zh:`想看更多对比示例?`,en:`Want more comparison examples?`}),(0,s.jsx)(`span`,{className:`compare-meta-dot`,children:`·`}),(0,s.jsx)(r,{to:`/code/language`,children:(0,s.jsx)(l,{zh:`回 /code/language 主页`,en:`Back to /code/language`})})]}),(0,s.jsx)(`p`,{className:`compare-foot-note`,children:(0,s.jsx)(l,{zh:(0,s.jsxs)(s.Fragment,{children:[`第二篇横向对比已经上了:`,(0,s.jsx)(r,{to:`/code/language/scramble`,children:`打乱解析器, 17 种语言`}),`。`]}),en:(0,s.jsxs)(s.Fragment,{children:[`The second comparison is live: `,(0,s.jsx)(r,{to:`/code/language/scramble`,children:`scramble parser, seventeen languages`}),`.`]})})})]})]})})}export{f as default};