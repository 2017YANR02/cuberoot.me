CAPTION(recon)
=LET(
seq, SPLIT(recon, CHAR(10)),
temp, IFERROR(TEXTJOIN(CHAR(10), TRUE, TRANSPOSE(FILTER(TRANSPOSE(SPLIT(JOIN(CHAR(10), FILTER(ARRAYFORMULA(REGEXEXTRACT(seq, "^[^//]*")), ISERROR(SEARCH("insp", seq)))) & CHAR(10) & INDEX(seq, 1), CHAR(10))), ROW(INDIRECT("1:"&COUNTA(SPLIT(JOIN(CHAR(10), FILTER(ARRAYFORMULA(REGEXEXTRACT(seq, "^[^//]*")), ISERROR(SEARCH("insp", seq)))) & CHAR(10) & INDEX(seq, 1), CHAR(10))))) > 2))),""),
REGEXREPLACE(temp, "[ ]+\n", CHAR(10))
)

// delete pre-AUF
DELETE_AUF(alg)
=TRIM(REGEXREPLACE(alg,"^U2'?|^U'|^U",""))

// 删除每一行从//开始到该行结尾的所有内容
DELETE_COMMENT(recon)
=TEXTJOIN(CHAR(10), TRUE, ARRAYFORMULA(REGEXREPLACE(SPLIT(recon, CHAR(10)), "//.*", "")))

// 若某行开头出现//，则删除该行
DELETE_COMMENT_EXTRA(recon)
=TEXTJOIN(CHAR(10), TRUE, FILTER(SPLIT(recon, CHAR(10)), NOT(LEFT(SPLIT(recon, CHAR(10)), 2) = "//")))

EXPANDALG(alg)
=IFS(
  REGEXMATCH(alg, "\(([^()]+)\)2"), REGEXREPLACE(alg, "\(([^()]+)\)2", "$1 $1"),
  REGEXMATCH(alg, "\(([^()]+)\)3"), REGEXREPLACE(alg, "\(([^()]+)\)3", "$1 $1 $1"),
  TRUE, alg
)

FREEPAIR(recon)
=LET(
        xcrossType,
        REGEXEXTRACT(recon, "( cross| xcross| xxcross| xxxcross| xxxxcross)"),

    stageAfterXcross,
    IFERROR(TEXTJOIN(CHAR(10), TRUE, FILTER(SPLIT(MID(recon, FIND(xcrossType, recon) + LEN(xcrossType), LEN(recon)), CHAR(10)), ISNUMBER(SEARCH("//", SPLIT(MID(recon, FIND(xcrossType, recon) + LEN(xcrossType), LEN(recon)), CHAR(10))))), "")),
    
    cleanedText,
    REGEXREPLACE(stageAfterXcross, "[ ()'xyz23·↑↓.]", ""),
    
    deletePreAUF,
    TEXTJOIN(CHAR(10), TRUE, ARRAYFORMULA(TRIM(REGEXREPLACE(SPLIT(cleanedText, CHAR(10)), "^U+", "")))),
    
    IFERROR(ARRAYFORMULA(SUM((LEN(LEFT(SPLIT(deletePreAUF, CHAR(10)), FIND("//", SPLIT(deletePreAUF, CHAR(10))) - 1)) >= 1) * (LEN(LEFT(SPLIT(deletePreAUF, CHAR(10)), FIND("//", SPLIT(deletePreAUF, CHAR(10))) - 1)) <= 4))) - ARRAYFORMULA(SUM(COUNTIF(SPLIT(DELETE_COMMENT(deletePreAUF), CHAR(10)), {"LRUR", "RLUL"}))), "")
)

// move count of a sequence
HTM(alg)
=LAMBDA(myalg, IF(ISBLANK(myalg), "", LEN(REGEXREPLACE(REGEXREPLACE(myalg, "[ ()'xyz234·↑↓./]", ""), CHAR(10), ""))))(alg)

INV(scr)
=IFERROR(
LET(
  splitText, SPLIT(scr, " "),
  replacedText, ARRAYFORMULA(
    IF(
      REGEXMATCH(splitText, "2$"),
      splitText,
      IF(
        REGEXMATCH(splitText, "'$"),
        REGEXREPLACE(splitText, "'", ""),
        splitText & "'"
      )
    )
  ),
  joinedText, JOIN(" ", replacedText),
  reversedText, JOIN("", ARRAYFORMULA(MID(joinedText, LEN(joinedText)-ROW(INDIRECT("1:"&LEN(joinedText)))+1, 1))),
  REGEXREPLACE(reversedText, "(2|')([A-Za-z])", "$2$1")
)
,"")

// 顶层步数
LL(recon)
=IF(ISNUMBER(SEARCH("cross", recon)),
IFS(
        ISNUMBER(SEARCH("OCLL Skip", recon)), 
        HTM(EXPANDALG(STAGE(recon,"PLL"))), 

        ISNUMBER(SEARCH("OLL(CP) Skip", recon)), 
        HTM(EXPANDALG(STAGE(recon,"EPLL"))), 

        ISNUMBER(SEARCH("OLL Skip", recon)), 
        HTM(EXPANDALG(STAGE(recon,"PLL"))),         
                                
        ISNUMBER(SEARCH("PLL Skip", recon)), 
        IFS(
                ISNUMBER(SEARCH("COLL", recon)), HTM(EXPANDALG(STAGE(recon,"COLL"))), 
                ISNUMBER(SEARCH("OLL(CP)", recon)), HTM(EXPANDALG(STAGE(recon,"OLL(CP)"))),
                ISNUMBER(SEARCH("VLS", recon)), LET(seq,
        REGEXREPLACE(REGEXREPLACE(STAGE(recon,"VLS"), "//.*", ""), "[ ()'xyz23·↑↓./]", ""),
        LEN(seq) - LEN(REGEXREPLACE(seq, "U+$", ""))),
		ISNUMBER(SEARCH("OLS", recon)), LET(seq,
        REGEXREPLACE(REGEXREPLACE(STAGE(recon,"OLS"), "//.*", ""), "[ ()'xyz23·↑↓./]", ""),
        LEN(seq) - LEN(REGEXREPLACE(seq, "U+$", ""))),
		ISNUMBER(SEARCH("SV", recon)), LET(seq,
        REGEXREPLACE(REGEXREPLACE(STAGE(recon,"SV"), "//.*", ""), "[ ()'xyz23·↑↓./]", ""),
        LEN(seq) - LEN(REGEXREPLACE(seq, "U+$", ""))),
                ISNUMBER(SEARCH("WV", recon)), LET(seq,
        REGEXREPLACE(REGEXREPLACE(STAGE(recon,"WV"), "//.*", ""), "[ ()'xyz23·↑↓./]", ""),
        LEN(seq) - LEN(REGEXREPLACE(seq, "U+$", "")))
                ),                                 

        ISNUMBER(SEARCH("LL Skip", recon)), 
        LET
        (seq,
        REGEXREPLACE(REGEXREPLACE(STAGE(recon,"LL"), "//.*", ""), "[ ()'xyz23·↑↓./]", ""),
        LEN(seq) - LEN(REGEXREPLACE(seq, "U+$", ""))
        ),                                

        OR(ISNUMBER(SEARCH("WV", recon)), ISNUMBER(SEARCH("SV", recon)),ISNUMBER(SEARCH("VLS", recon))), 
        IFS(
                ISNUMBER(SEARCH("EPLL", recon)), HTM(EXPANDALG(STAGE(recon,"EPLL"))), 
                ISNUMBER(SEARCH("PLL", recon)), HTM(EXPANDALG(STAGE(recon,"PLL")))
                ),

        ISNUMBER(SEARCH("// EO", recon)), 
        HTM(EXPANDALG(STAGE(recon,"EO"))) + HTM(EXPANDALG(STAGE(recon,"ZBLL"))),

        ISNUMBER(SEARCH("1LLL", recon)), 
        HTM(EXPANDALG(STAGE(recon,"1LLL"))),

        ISNUMBER(SEARCH("ZBLL", recon)), 
        HTM(EXPANDALG(STAGE(recon,"ZBLL"))),

        ISNUMBER(SEARCH("EPLL", recon)), 
        IFS(
                ISNUMBER(SEARCH("COLL", recon)), HTM(EXPANDALG(STAGE(recon,"COLL"))) + HTM(EXPANDALG(STAGE(recon,"EPLL"))),
                ISNUMBER(SEARCH("OLL(CP)", recon)), HTM(EXPANDALG(STAGE(recon,"OLL(CP)"))) + HTM(EXPANDALG(STAGE(recon,"EPLL")))
                ),

        ISNUMBER(SEARCH("PLL", recon)), 
        IFS(
                ISNUMBER(SEARCH("OCLL", recon)), HTM(EXPANDALG(STAGE(recon,"OCLL"))) + HTM(EXPANDALG(STAGE(recon,"PLL"))), 
                ISNUMBER(SEARCH("OLL", recon)), HTM(EXPANDALG(STAGE(recon,"OLL"))) + HTM(EXPANDALG(STAGE(recon,"PLL")))
                ), 

          TRUE,""
),
"")

OLL(recon)
=LET(
    val, IFERROR(IFS(
        ISNUMBER(SEARCH("OLL", recon)), MID(recon, SEARCH("OLL", recon), FIND(CHAR(10), recon & CHAR(10), SEARCH("OLL", recon)) - SEARCH("OLL", recon)),
        ISNUMBER(SEARCH("OCLL", recon)), MID(recon, SEARCH("OCLL", recon), FIND(CHAR(10), recon & CHAR(10), SEARCH("OCLL", recon)) - SEARCH("OCLL", recon)),
        ISNUMBER(SEARCH("COLL", recon)), MID(recon, SEARCH("COLL", recon), FIND(CHAR(10), recon & CHAR(10), SEARCH("COLL", recon)) - SEARCH("COLL", recon)),
		ISNUMBER(SEARCH("CMLL", recon)), MID(recon, SEARCH("CMLL", recon), FIND(CHAR(10), recon & CHAR(10), SEARCH("CMLL", recon)) - SEARCH("CMLL", recon)),
        ISNUMBER(SEARCH("EO", recon)), IF(ISNUMBER(SEARCH("EOLS", recon)), "", MID(recon, SEARCH("EO", recon), FIND(CHAR(10), recon & CHAR(10), SEARCH("EO", recon)) - SEARCH("EO", recon)))
    ), ""),
    IF(ISNUMBER(SEARCH("/", val)), LEFT(val, SEARCH("/", val) - 1), val)
)

PLL(recon)
=IF(REGEXMATCH(recon, "cross"),
LET(text, TRIM(RIGHT(SUBSTITUTE(recon, "//", REPT(" ", LEN(recon))), LEN(recon))),
     pos, SEARCH("/", text),
     IF(ISNUMBER(pos), RIGHT(text, LEN(text) - pos), text))
, "")

STAGE(cell, stage)
=LET(
	lines, SPLIT(cell, CHAR(10)),
	StageLine, FILTER(lines, SEARCH(stage, lines) > 0),
	LEFT(StageLine, SEARCH("//", StageLine) - 1)
)

// 输出复盘的第一步到stage
START_TO_STAGE(recon,stage)
=LET(
temp,
IF(REGEXMATCH(recon, "insp"),
MID(recon, FIND("insp", recon) + 4, FIND(stage, recon) - FIND("insp", recon) - 4),
MID(recon, FIND(CHAR(10), recon, FIND(CHAR(10), recon) + 1) + 1, FIND(stage, recon) - FIND(CHAR(10), recon, FIND(CHAR(10), recon) + 1) - 1)),
IF(LEFT(temp, 1) = CHAR(10), MID(temp, 2, LEN(temp) - 1), temp))