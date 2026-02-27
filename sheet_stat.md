free pair
基 (基态)
=FREEPAIR(U2)

y
=LET(text, SUBSTITUTE(U2, "Gd", ""),
    LEN(RIGHT(text, LEN(text) - IFERROR(FIND("insp", text), 0))) 
    - LEN(SUBSTITUTE(SUBSTITUTE(RIGHT(text, LEN(text) - IFERROR(FIND("insp", text), 0)), "y", ""), "d", ""))
    )

regrip
换手
=LEN(U2) - LEN(REGEXREPLACE(U2, "[↑↓·]", ""))

lockup
卡 (卡顿)
=(LEN(U2) - LEN(SUBSTITUTE(U2, "...", ""))) / LEN("...")

?x
=IFS(ISNUMBER(SEARCH("xxxxcross", U2)), 4,
     ISNUMBER(SEARCH("xxxcross", U2)), 3,
     ISNUMBER(SEARCH("xxcross", U2)), 2,
     ISNUMBER(SEARCH("xcross", U2)), 1,
     ISNUMBER(SEARCH("cross", U2)), 0,
     TRUE, "")

?x STM
=IFS(
  AD2 = 0, HTM(EXPANDALG(DELETE_COMMENT(START_TO_STAGE(U2, "cross")))),
  AD2 = 1, HTM(EXPANDALG(DELETE_COMMENT(START_TO_STAGE(U2, "xcross")))),
  AD2 = 2, HTM(EXPANDALG(DELETE_COMMENT(START_TO_STAGE(U2, "xxcross")))),
  AD2 = 3, HTM(EXPANDALG(DELETE_COMMENT(START_TO_STAGE(U2, "xxxcross")))),
  AD2 = 4, HTM(EXPANDALG(DELETE_COMMENT(START_TO_STAGE(U2, "xxxxcross")))),
  AD2 = "", ""
)

F2L
=IF(LEN(AP2)=0, "", AP2-AL2)

LL
=LL(U2)

STM
=IFERROR(IF(VALUE(LEFT(U2, SEARCH("STM", U2) - 1)) = 0, "", VALUE(LEFT(U2, SEARCH("STM", U2) - 1))), "")

TPS
=IF(LEN(AP2)>0, AP2/FLOOR(S2,0.01),"")

S
=LEN(U2) - LEN(SUBSTITUTE(U2, "S", "")) - IF(ISNUMBER(SEARCH("STM", U2)), 1, 0) - IF(ISNUMBER(SEARCH("TPS", U2)), 1, 0)

cross color
=IFS(
    NOT(ISNUMBER(FIND("cross", U2))), "",
        ISNUMBER(SEARCH("insp", U2)), MID(U2, FIND("// ", U2, FIND("// ", U2) + 1) + 3, 1),
    TRUE, MID(U2, FIND("// ", U2) + 3, 1)
)

OLL/CLL
=REGEXREPLACE(REGEXREPLACE(REGEXREPLACE(BB2, "\([^)]*\)", ""), " cancel into", ""), "(COLL|OCLL)", "OLL")

PLL/ELL
=REGEXREPLACE(REGEXREPLACE(REGEXREPLACE(BC2, "\([^)]*\)", ""), " cancel into", ""), "(VLS/|WV/|SV/)", "")

OLL_full
=OLL(U2)

PLL_full
=PLL(U2)