#ifndef CORE_CONSTANTS_H
#define CORE_CONSTANTS_H

#define ZERO_ORIENTED_CUBE ((oriented_cube_t) {0})
#define SOLVED_ORIENTED_CUBE \
    ((oriented_cube_t) { .cube = SOLVED_CUBE, .orientation = 0 })

#define MOVE_CUBE_U STATIC_CUBE( \
    5, 4, 2, 3, 0, 1, 6, 7, 4, 5, 2, 3, 1, 0, 6, 7, 8, 9, 10, 11)
#define MOVE_CUBE_U2 STATIC_CUBE( \
    1, 0, 2, 3, 5, 4, 6, 7, 1, 0, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11)
#define MOVE_CUBE_U3 STATIC_CUBE( \
    4, 5, 2, 3, 1, 0, 6, 7, 5, 4, 2, 3, 0, 1, 6, 7, 8, 9, 10, 11)
#define MOVE_CUBE_D STATIC_CUBE( \
    0, 1, 7, 6, 4, 5, 2, 3, 0, 1, 7, 6, 4, 5, 2, 3, 8, 9, 10, 11)
#define MOVE_CUBE_D2 STATIC_CUBE( \
    0, 1, 3, 2, 4, 5, 7, 6, 0, 1, 3, 2, 4, 5, 7, 6, 8, 9, 10, 11)
#define MOVE_CUBE_D3 STATIC_CUBE( \
    0, 1, 6, 7, 4, 5, 3, 2, 0, 1, 6, 7, 4, 5, 3, 2, 8, 9, 10, 11)
#define MOVE_CUBE_R STATIC_CUBE( \
    70, 1, 2, 69, 4, 32, 35, 7, 0, 1, 2, 3, 8, 5, 6, 11, 7, 9, 10, 4)
#define MOVE_CUBE_R2 STATIC_CUBE( \
    3, 1, 2, 0, 4, 6, 5, 7, 0, 1, 2, 3, 7, 5, 6, 4, 11, 9, 10, 8)
#define MOVE_CUBE_R3 STATIC_CUBE( \
    69, 1, 2, 70, 4, 35, 32, 7, 0, 1, 2, 3, 11, 5, 6, 8, 4, 9, 10, 7)
#define MOVE_CUBE_L STATIC_CUBE( \
    0, 71, 68, 3, 33, 5, 6, 34, 0, 1, 2, 3, 4, 10, 9, 7, 8, 5, 6, 11)
#define MOVE_CUBE_L2 STATIC_CUBE( \
    0, 2, 1, 3, 7, 5, 6, 4, 0, 1, 2, 3, 4, 6, 5, 7, 8, 10, 9, 11)
#define MOVE_CUBE_L3 STATIC_CUBE( \
    0, 68, 71, 3, 34, 5, 6, 33, 0, 1, 2, 3, 4, 9, 10, 7, 8, 6, 5, 11)
#define MOVE_CUBE_F STATIC_CUBE( \
    36, 1, 38, 3, 66, 5, 64, 7, 25, 1, 2, 24, 4, 5, 6, 7, 16, 19, 10, 11)
#define MOVE_CUBE_F2 STATIC_CUBE( \
    2, 1, 0, 3, 6, 5, 4, 7, 3, 1, 2, 0, 4, 5, 6, 7, 9, 8, 10, 11)
#define MOVE_CUBE_F3 STATIC_CUBE( \
    38, 1, 36, 3, 64, 5, 66, 7, 24, 1, 2, 25, 4, 5, 6, 7, 19, 16, 10, 11)
#define MOVE_CUBE_B STATIC_CUBE( \
    0, 37, 2, 39, 4, 67, 6, 65, 0, 27, 26, 3, 4, 5, 6, 7, 8, 9, 17, 18)
#define MOVE_CUBE_B2 STATIC_CUBE( \
    0, 3, 2, 1, 4, 7, 6, 5, 0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 11, 10)
#define MOVE_CUBE_B3 STATIC_CUBE( \
    0, 39, 2, 37, 4, 65, 6, 67, 0, 26, 27, 3, 4, 5, 6, 7, 8, 9, 18, 17)

#define TRANS_CUBE_UFr STATIC_CUBE( \
    0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
#define TRANS_CUBE_UFr_INVERSE STATIC_CUBE( \
    0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
#define TRANS_CUBE_ULr STATIC_CUBE( \
    4, 5, 7, 6, 1, 0, 2, 3, 5, 4, 7, 6, 0, 1, 2, 3, 25, 26, 27, 24)
#define TRANS_CUBE_ULr_INVERSE STATIC_CUBE( \
    5, 4, 6, 7, 0, 1, 3, 2, 4, 5, 6, 7, 1, 0, 3, 2, 27, 24, 25, 26)
#define TRANS_CUBE_UBr STATIC_CUBE( \
    1, 0, 3, 2, 5, 4, 7, 6, 1, 0, 3, 2, 5, 4, 7, 6, 10, 11, 8, 9)
#define TRANS_CUBE_UBr_INVERSE STATIC_CUBE( \
    1, 0, 3, 2, 5, 4, 7, 6, 1, 0, 3, 2, 5, 4, 7, 6, 10, 11, 8, 9)
#define TRANS_CUBE_URr STATIC_CUBE( \
    5, 4, 6, 7, 0, 1, 3, 2, 4, 5, 6, 7, 1, 0, 3, 2, 27, 24, 25, 26)
#define TRANS_CUBE_URr_INVERSE STATIC_CUBE( \
    4, 5, 7, 6, 1, 0, 2, 3, 5, 4, 7, 6, 0, 1, 2, 3, 25, 26, 27, 24)
#define TRANS_CUBE_DFr STATIC_CUBE( \
    2, 3, 0, 1, 6, 7, 4, 5, 3, 2, 1, 0, 6, 7, 4, 5, 9, 8, 11, 10)
#define TRANS_CUBE_DFr_INVERSE STATIC_CUBE( \
    2, 3, 0, 1, 6, 7, 4, 5, 3, 2, 1, 0, 6, 7, 4, 5, 9, 8, 11, 10)
#define TRANS_CUBE_DLr STATIC_CUBE( \
    7, 6, 4, 5, 2, 3, 1, 0, 6, 7, 4, 5, 2, 3, 0, 1, 26, 25, 24, 27)
#define TRANS_CUBE_DLr_INVERSE STATIC_CUBE( \
    7, 6, 4, 5, 2, 3, 1, 0, 6, 7, 4, 5, 2, 3, 0, 1, 26, 25, 24, 27)
#define TRANS_CUBE_DBr STATIC_CUBE( \
    3, 2, 1, 0, 7, 6, 5, 4, 2, 3, 0, 1, 7, 6, 5, 4, 11, 10, 9, 8)
#define TRANS_CUBE_DBr_INVERSE STATIC_CUBE( \
    3, 2, 1, 0, 7, 6, 5, 4, 2, 3, 0, 1, 7, 6, 5, 4, 11, 10, 9, 8)
#define TRANS_CUBE_DRr STATIC_CUBE( \
    6, 7, 5, 4, 3, 2, 0, 1, 7, 6, 5, 4, 3, 2, 1, 0, 24, 27, 26, 25)
#define TRANS_CUBE_DRr_INVERSE STATIC_CUBE( \
    6, 7, 5, 4, 3, 2, 0, 1, 7, 6, 5, 4, 3, 2, 1, 0, 24, 27, 26, 25)
#define TRANS_CUBE_RUr STATIC_CUBE( \
    64, 67, 65, 66, 37, 38, 36, 39, 20, 23, 22, 21, 24, 27, 26, 25, 0, 1, 2, 3)
#define TRANS_CUBE_RUr_INVERSE STATIC_CUBE( \
    32, 34, 35, 33, 70, 68, 69, 71, 8, 9, 10, 11, 16, 19, 18, 17, 20, 23, 22, 21)
#define TRANS_CUBE_RFr STATIC_CUBE( \
    38, 37, 36, 39, 64, 67, 66, 65, 24, 27, 26, 25, 23, 20, 21, 22, 19, 16, 17, 18)
#define TRANS_CUBE_RFr_INVERSE STATIC_CUBE( \
    36, 39, 38, 37, 66, 65, 64, 67, 25, 26, 27, 24, 21, 22, 23, 20, 16, 19, 18, 17)
#define TRANS_CUBE_RDr STATIC_CUBE( \
    67, 64, 66, 65, 38, 37, 39, 36, 23, 20, 21, 22, 27, 24, 25, 26, 2, 3, 0, 1)
#define TRANS_CUBE_RDr_INVERSE STATIC_CUBE( \
    33, 35, 34, 32, 71, 69, 68, 70, 10, 11, 8, 9, 17, 18, 19, 16, 21, 22, 23, 20)
#define TRANS_CUBE_RBr STATIC_CUBE( \
    37, 38, 39, 36, 67, 64, 65, 66, 27, 24, 25, 26, 20, 23, 22, 21, 17, 18, 19, 16)
#define TRANS_CUBE_RBr_INVERSE STATIC_CUBE( \
    37, 38, 39, 36, 67, 64, 65, 66, 27, 24, 25, 26, 20, 23, 22, 21, 17, 18, 19, 16)
#define TRANS_CUBE_LUr STATIC_CUBE( \
    65, 66, 64, 67, 36, 39, 37, 38, 21, 22, 23, 20, 26, 25, 24, 27, 1, 0, 3, 2)
#define TRANS_CUBE_LUr_INVERSE STATIC_CUBE( \
    34, 32, 33, 35, 68, 70, 71, 69, 9, 8, 11, 10, 19, 16, 17, 18, 22, 21, 20, 23)
#define TRANS_CUBE_LFr STATIC_CUBE( \
    36, 39, 38, 37, 66, 65, 64, 67, 25, 26, 27, 24, 21, 22, 23, 20, 16, 19, 18, 17)
#define TRANS_CUBE_LFr_INVERSE STATIC_CUBE( \
    38, 37, 36, 39, 64, 67, 66, 65, 24, 27, 26, 25, 23, 20, 21, 22, 19, 16, 17, 18)
#define TRANS_CUBE_LDr STATIC_CUBE( \
    66, 65, 67, 64, 39, 36, 38, 37, 22, 21, 20, 23, 25, 26, 27, 24, 3, 2, 1, 0)
#define TRANS_CUBE_LDr_INVERSE STATIC_CUBE( \
    35, 33, 32, 34, 69, 71, 70, 68, 11, 10, 9, 8, 18, 17, 16, 19, 23, 20, 21, 22)
#define TRANS_CUBE_LBr STATIC_CUBE( \
    39, 36, 37, 38, 65, 66, 67, 64, 26, 25, 24, 27, 22, 21, 20, 23, 18, 17, 16, 19)
#define TRANS_CUBE_LBr_INVERSE STATIC_CUBE( \
    39, 36, 37, 38, 65, 66, 67, 64, 26, 25, 24, 27, 22, 21, 20, 23, 18, 17, 16, 19)
#define TRANS_CUBE_FUr STATIC_CUBE( \
    68, 70, 69, 71, 32, 34, 33, 35, 16, 19, 18, 17, 9, 8, 11, 10, 5, 4, 7, 6)
#define TRANS_CUBE_FUr_INVERSE STATIC_CUBE( \
    68, 70, 69, 71, 32, 34, 33, 35, 16, 19, 18, 17, 9, 8, 11, 10, 5, 4, 7, 6)
#define TRANS_CUBE_FRr STATIC_CUBE( \
    32, 34, 35, 33, 70, 68, 69, 71, 8, 9, 10, 11, 16, 19, 18, 17, 20, 23, 22, 21)
#define TRANS_CUBE_FRr_INVERSE STATIC_CUBE( \
    64, 67, 65, 66, 37, 38, 36, 39, 20, 23, 22, 21, 24, 27, 26, 25, 0, 1, 2, 3)
#define TRANS_CUBE_FDr STATIC_CUBE( \
    70, 68, 71, 69, 34, 32, 35, 33, 19, 16, 17, 18, 8, 9, 10, 11, 7, 6, 5, 4)
#define TRANS_CUBE_FDr_INVERSE STATIC_CUBE( \
    69, 71, 68, 70, 33, 35, 32, 34, 17, 18, 19, 16, 11, 10, 9, 8, 4, 5, 6, 7)
#define TRANS_CUBE_FLr STATIC_CUBE( \
    34, 32, 33, 35, 68, 70, 71, 69, 9, 8, 11, 10, 19, 16, 17, 18, 22, 21, 20, 23)
#define TRANS_CUBE_FLr_INVERSE STATIC_CUBE( \
    65, 66, 64, 67, 36, 39, 37, 38, 21, 22, 23, 20, 26, 25, 24, 27, 1, 0, 3, 2)
#define TRANS_CUBE_BUr STATIC_CUBE( \
    69, 71, 68, 70, 33, 35, 32, 34, 17, 18, 19, 16, 11, 10, 9, 8, 4, 5, 6, 7)
#define TRANS_CUBE_BUr_INVERSE STATIC_CUBE( \
    70, 68, 71, 69, 34, 32, 35, 33, 19, 16, 17, 18, 8, 9, 10, 11, 7, 6, 5, 4)
#define TRANS_CUBE_BRr STATIC_CUBE( \
    35, 33, 32, 34, 69, 71, 70, 68, 11, 10, 9, 8, 18, 17, 16, 19, 23, 20, 21, 22)
#define TRANS_CUBE_BRr_INVERSE STATIC_CUBE( \
    66, 65, 67, 64, 39, 36, 38, 37, 22, 21, 20, 23, 25, 26, 27, 24, 3, 2, 1, 0)
#define TRANS_CUBE_BDr STATIC_CUBE( \
    71, 69, 70, 68, 35, 33, 34, 32, 18, 17, 16, 19, 10, 11, 8, 9, 6, 7, 4, 5)
#define TRANS_CUBE_BDr_INVERSE STATIC_CUBE( \
    71, 69, 70, 68, 35, 33, 34, 32, 18, 17, 16, 19, 10, 11, 8, 9, 6, 7, 4, 5)
#define TRANS_CUBE_BLr STATIC_CUBE( \
    33, 35, 34, 32, 71, 69, 68, 70, 10, 11, 8, 9, 17, 18, 19, 16, 21, 22, 23, 20)
#define TRANS_CUBE_BLr_INVERSE STATIC_CUBE( \
    67, 64, 66, 65, 38, 37, 39, 36, 23, 20, 21, 22, 27, 24, 25, 26, 2, 3, 0, 1)
#define TRANS_CUBE_UFm STATIC_CUBE( \
    4, 5, 6, 7, 0, 1, 2, 3, 0, 1, 2, 3, 5, 4, 7, 6, 9, 8, 11, 10)
#define TRANS_CUBE_UFm_INVERSE STATIC_CUBE( \
    4, 5, 6, 7, 0, 1, 2, 3, 0, 1, 2, 3, 5, 4, 7, 6, 9, 8, 11, 10)
#define TRANS_CUBE_ULm STATIC_CUBE( \
    0, 1, 3, 2, 5, 4, 6, 7, 4, 5, 6, 7, 0, 1, 2, 3, 24, 27, 26, 25)
#define TRANS_CUBE_ULm_INVERSE STATIC_CUBE( \
    0, 1, 3, 2, 5, 4, 6, 7, 4, 5, 6, 7, 0, 1, 2, 3, 24, 27, 26, 25)
#define TRANS_CUBE_UBm STATIC_CUBE( \
    5, 4, 7, 6, 1, 0, 3, 2, 1, 0, 3, 2, 4, 5, 6, 7, 11, 10, 9, 8)
#define TRANS_CUBE_UBm_INVERSE STATIC_CUBE( \
    5, 4, 7, 6, 1, 0, 3, 2, 1, 0, 3, 2, 4, 5, 6, 7, 11, 10, 9, 8)
#define TRANS_CUBE_URm STATIC_CUBE( \
    1, 0, 2, 3, 4, 5, 7, 6, 5, 4, 7, 6, 1, 0, 3, 2, 26, 25, 24, 27)
#define TRANS_CUBE_URm_INVERSE STATIC_CUBE( \
    1, 0, 2, 3, 4, 5, 7, 6, 5, 4, 7, 6, 1, 0, 3, 2, 26, 25, 24, 27)
#define TRANS_CUBE_DFm STATIC_CUBE( \
    6, 7, 4, 5, 2, 3, 0, 1, 3, 2, 1, 0, 7, 6, 5, 4, 8, 9, 10, 11)
#define TRANS_CUBE_DFm_INVERSE STATIC_CUBE( \
    6, 7, 4, 5, 2, 3, 0, 1, 3, 2, 1, 0, 7, 6, 5, 4, 8, 9, 10, 11)
#define TRANS_CUBE_DLm STATIC_CUBE( \
    3, 2, 0, 1, 6, 7, 5, 4, 7, 6, 5, 4, 2, 3, 0, 1, 27, 24, 25, 26)
#define TRANS_CUBE_DLm_INVERSE STATIC_CUBE( \
    2, 3, 1, 0, 7, 6, 4, 5, 6, 7, 4, 5, 3, 2, 1, 0, 25, 26, 27, 24)
#define TRANS_CUBE_DBm STATIC_CUBE( \
    7, 6, 5, 4, 3, 2, 1, 0, 2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9)
#define TRANS_CUBE_DBm_INVERSE STATIC_CUBE( \
    7, 6, 5, 4, 3, 2, 1, 0, 2, 3, 0, 1, 6, 7, 4, 5, 10, 11, 8, 9)
#define TRANS_CUBE_DRm STATIC_CUBE( \
    2, 3, 1, 0, 7, 6, 4, 5, 6, 7, 4, 5, 3, 2, 1, 0, 25, 26, 27, 24)
#define TRANS_CUBE_DRm_INVERSE STATIC_CUBE( \
    3, 2, 0, 1, 6, 7, 5, 4, 7, 6, 5, 4, 2, 3, 0, 1, 27, 24, 25, 26)
#define TRANS_CUBE_RUm STATIC_CUBE( \
    68, 71, 69, 70, 33, 34, 32, 35, 21, 22, 23, 20, 25, 26, 27, 24, 0, 1, 2, 3)
#define TRANS_CUBE_RUm_INVERSE STATIC_CUBE( \
    70, 68, 69, 71, 32, 34, 35, 33, 8, 9, 10, 11, 19, 16, 17, 18, 23, 20, 21, 22)
#define TRANS_CUBE_RFm STATIC_CUBE( \
    34, 33, 32, 35, 68, 71, 70, 69, 25, 26, 27, 24, 22, 21, 20, 23, 19, 16, 17, 18)
#define TRANS_CUBE_RFm_INVERSE STATIC_CUBE( \
    66, 65, 64, 67, 36, 39, 38, 37, 25, 26, 27, 24, 22, 21, 20, 23, 19, 16, 17, 18)
#define TRANS_CUBE_RDm STATIC_CUBE( \
    71, 68, 70, 69, 34, 33, 35, 32, 22, 21, 20, 23, 26, 25, 24, 27, 2, 3, 0, 1)
#define TRANS_CUBE_RDm_INVERSE STATIC_CUBE( \
    71, 69, 68, 70, 33, 35, 34, 32, 10, 11, 8, 9, 18, 17, 16, 19, 22, 21, 20, 23)
#define TRANS_CUBE_RBm STATIC_CUBE( \
    33, 34, 35, 32, 71, 68, 69, 70, 26, 25, 24, 27, 21, 22, 23, 20, 17, 18, 19, 16)
#define TRANS_CUBE_RBm_INVERSE STATIC_CUBE( \
    67, 64, 65, 66, 37, 38, 39, 36, 27, 24, 25, 26, 23, 20, 21, 22, 18, 17, 16, 19)
#define TRANS_CUBE_LUm STATIC_CUBE( \
    69, 70, 68, 71, 32, 35, 33, 34, 20, 23, 22, 21, 27, 24, 25, 26, 1, 0, 3, 2)
#define TRANS_CUBE_LUm_INVERSE STATIC_CUBE( \
    68, 70, 71, 69, 34, 32, 33, 35, 9, 8, 11, 10, 16, 19, 18, 17, 21, 22, 23, 20)
#define TRANS_CUBE_LFm STATIC_CUBE( \
    32, 35, 34, 33, 70, 69, 68, 71, 24, 27, 26, 25, 20, 23, 22, 21, 16, 19, 18, 17)
#define TRANS_CUBE_LFm_INVERSE STATIC_CUBE( \
    64, 67, 66, 65, 38, 37, 36, 39, 24, 27, 26, 25, 20, 23, 22, 21, 16, 19, 18, 17)
#define TRANS_CUBE_LDm STATIC_CUBE( \
    70, 69, 71, 68, 35, 32, 34, 33, 23, 20, 21, 22, 24, 27, 26, 25, 3, 2, 1, 0)
#define TRANS_CUBE_LDm_INVERSE STATIC_CUBE( \
    69, 71, 70, 68, 35, 33, 32, 34, 11, 10, 9, 8, 17, 18, 19, 16, 20, 23, 22, 21)
#define TRANS_CUBE_LBm STATIC_CUBE( \
    35, 32, 33, 34, 69, 70, 71, 68, 27, 24, 25, 26, 23, 20, 21, 22, 18, 17, 16, 19)
#define TRANS_CUBE_LBm_INVERSE STATIC_CUBE( \
    65, 66, 67, 64, 39, 36, 37, 38, 26, 25, 24, 27, 21, 22, 23, 20, 17, 18, 19, 16)
#define TRANS_CUBE_FUm STATIC_CUBE( \
    64, 66, 65, 67, 36, 38, 37, 39, 16, 19, 18, 17, 8, 9, 10, 11, 4, 5, 6, 7)
#define TRANS_CUBE_FUm_INVERSE STATIC_CUBE( \
    32, 34, 33, 35, 68, 70, 69, 71, 16, 19, 18, 17, 8, 9, 10, 11, 4, 5, 6, 7)
#define TRANS_CUBE_FRm STATIC_CUBE( \
    36, 38, 39, 37, 66, 64, 65, 67, 9, 8, 11, 10, 16, 19, 18, 17, 21, 22, 23, 20)
#define TRANS_CUBE_FRm_INVERSE STATIC_CUBE( \
    37, 38, 36, 39, 64, 67, 65, 66, 20, 23, 22, 21, 27, 24, 25, 26, 1, 0, 3, 2)
#define TRANS_CUBE_FDm STATIC_CUBE( \
    66, 64, 67, 65, 38, 36, 39, 37, 19, 16, 17, 18, 9, 8, 11, 10, 6, 7, 4, 5)
#define TRANS_CUBE_FDm_INVERSE STATIC_CUBE( \
    33, 35, 32, 34, 69, 71, 68, 70, 17, 18, 19, 16, 10, 11, 8, 9, 5, 4, 7, 6)
#define TRANS_CUBE_FLm STATIC_CUBE( \
    38, 36, 37, 39, 64, 66, 67, 65, 8, 9, 10, 11, 19, 16, 17, 18, 23, 20, 21, 22)
#define TRANS_CUBE_FLm_INVERSE STATIC_CUBE( \
    36, 39, 37, 38, 65, 66, 64, 67, 21, 22, 23, 20, 25, 26, 27, 24, 0, 1, 2, 3)
#define TRANS_CUBE_BUm STATIC_CUBE( \
    65, 67, 64, 66, 37, 39, 36, 38, 17, 18, 19, 16, 10, 11, 8, 9, 5, 4, 7, 6)
#define TRANS_CUBE_BUm_INVERSE STATIC_CUBE( \
    34, 32, 35, 33, 70, 68, 71, 69, 19, 16, 17, 18, 9, 8, 11, 10, 6, 7, 4, 5)
#define TRANS_CUBE_BRm STATIC_CUBE( \
    39, 37, 36, 38, 65, 67, 66, 64, 10, 11, 8, 9, 18, 17, 16, 19, 22, 21, 20, 23)
#define TRANS_CUBE_BRm_INVERSE STATIC_CUBE( \
    39, 36, 38, 37, 66, 65, 67, 64, 22, 21, 20, 23, 26, 25, 24, 27, 2, 3, 0, 1)
#define TRANS_CUBE_BDm STATIC_CUBE( \
    67, 65, 66, 64, 39, 37, 38, 36, 18, 17, 16, 19, 11, 10, 9, 8, 7, 6, 5, 4)
#define TRANS_CUBE_BDm_INVERSE STATIC_CUBE( \
    35, 33, 34, 32, 71, 69, 70, 68, 18, 17, 16, 19, 11, 10, 9, 8, 7, 6, 5, 4)
#define TRANS_CUBE_BLm STATIC_CUBE( \
    37, 39, 38, 36, 67, 65, 64, 66, 11, 10, 9, 8, 17, 18, 19, 16, 20, 23, 22, 21)
#define TRANS_CUBE_BLm_INVERSE STATIC_CUBE( \
    38, 37, 39, 36, 67, 64, 66, 65, 23, 20, 21, 22, 24, 27, 26, 25, 3, 2, 1, 0)

#define MOVE_U  UINT8_C(0)
#define MOVE_U2 UINT8_C(1)
#define MOVE_U3 UINT8_C(2)
#define MOVE_D  UINT8_C(3)
#define MOVE_D2 UINT8_C(4)
#define MOVE_D3 UINT8_C(5)
#define MOVE_R  UINT8_C(6)
#define MOVE_R2 UINT8_C(7)
#define MOVE_R3 UINT8_C(8)
#define MOVE_L  UINT8_C(9)
#define MOVE_L2 UINT8_C(10)
#define MOVE_L3 UINT8_C(11)
#define MOVE_F  UINT8_C(12)
#define MOVE_F2 UINT8_C(13)
#define MOVE_F3 UINT8_C(14)
#define MOVE_B  UINT8_C(15)
#define MOVE_B2 UINT8_C(16)
#define MOVE_B3 UINT8_C(17)

#define MOVE_Uw  UINT8_C(18)
#define MOVE_Uw2 UINT8_C(19)
#define MOVE_Uw3 UINT8_C(20)
#define MOVE_Dw  UINT8_C(21)
#define MOVE_Dw2 UINT8_C(22)
#define MOVE_Dw3 UINT8_C(23)
#define MOVE_Rw  UINT8_C(24)
#define MOVE_Rw2 UINT8_C(25)
#define MOVE_Rw3 UINT8_C(26)
#define MOVE_Lw  UINT8_C(27)
#define MOVE_Lw2 UINT8_C(28)
#define MOVE_Lw3 UINT8_C(29)
#define MOVE_Fw  UINT8_C(30)
#define MOVE_Fw2 UINT8_C(31)
#define MOVE_Fw3 UINT8_C(32)
#define MOVE_Bw  UINT8_C(33)
#define MOVE_Bw2 UINT8_C(34)
#define MOVE_Bw3 UINT8_C(35)

#define MOVE_M   UINT8_C(36)
#define MOVE_M2  UINT8_C(37)
#define MOVE_M3  UINT8_C(38)
#define MOVE_S   UINT8_C(39)
#define MOVE_S2  UINT8_C(40)
#define MOVE_S3  UINT8_C(41)
#define MOVE_E   UINT8_C(42)
#define MOVE_E2  UINT8_C(43)
#define MOVE_E3  UINT8_C(44)

#define MOVE_x   UINT8_C(45)
#define MOVE_x2  UINT8_C(46)
#define MOVE_x3  UINT8_C(47)
#define MOVE_y   UINT8_C(48)
#define MOVE_y2  UINT8_C(49)
#define MOVE_y3  UINT8_C(50)
#define MOVE_z   UINT8_C(51)
#define MOVE_z2  UINT8_C(52)
#define MOVE_z3  UINT8_C(53)

#define TRANS_UFr UINT8_C(0)
#define TRANS_ULr UINT8_C(1)
#define TRANS_UBr UINT8_C(2)
#define TRANS_URr UINT8_C(3)
#define TRANS_DFr UINT8_C(4)
#define TRANS_DLr UINT8_C(5)
#define TRANS_DBr UINT8_C(6)
#define TRANS_DRr UINT8_C(7)
#define TRANS_RUr UINT8_C(8)
#define TRANS_RFr UINT8_C(9)
#define TRANS_RDr UINT8_C(10)
#define TRANS_RBr UINT8_C(11)
#define TRANS_LUr UINT8_C(12)
#define TRANS_LFr UINT8_C(13)
#define TRANS_LDr UINT8_C(14)
#define TRANS_LBr UINT8_C(15)
#define TRANS_FUr UINT8_C(16)
#define TRANS_FRr UINT8_C(17)
#define TRANS_FDr UINT8_C(18)
#define TRANS_FLr UINT8_C(19)
#define TRANS_BUr UINT8_C(20)
#define TRANS_BRr UINT8_C(21)
#define TRANS_BDr UINT8_C(22)
#define TRANS_BLr UINT8_C(23)

#define TRANS_UFm UINT8_C(24)
#define TRANS_ULm UINT8_C(25)
#define TRANS_UBm UINT8_C(26)
#define TRANS_URm UINT8_C(27)
#define TRANS_DFm UINT8_C(28)
#define TRANS_DLm UINT8_C(29)
#define TRANS_DBm UINT8_C(30)
#define TRANS_DRm UINT8_C(31)
#define TRANS_RUm UINT8_C(32)
#define TRANS_RFm UINT8_C(33)
#define TRANS_RDm UINT8_C(34)
#define TRANS_RBm UINT8_C(35)
#define TRANS_LUm UINT8_C(36)
#define TRANS_LFm UINT8_C(37)
#define TRANS_LDm UINT8_C(38)
#define TRANS_LBm UINT8_C(39)
#define TRANS_FUm UINT8_C(40)
#define TRANS_FRm UINT8_C(41)
#define TRANS_FDm UINT8_C(42)
#define TRANS_FLm UINT8_C(43)
#define TRANS_BUm UINT8_C(44)
#define TRANS_BRm UINT8_C(45)
#define TRANS_BDm UINT8_C(46)
#define TRANS_BLm UINT8_C(47)

#define AXIS_UD   UINT8_C(0)
#define AXIS_RL   UINT8_C(1)
#define AXIS_FB   UINT8_C(2)

#define NMOVES           (1+MOVE_B3)
#define NMOVES_EXTENDED  (1+MOVE_z3)
#define NTRANS           (1+TRANS_BLm)

#define MM_SINGLE(m)     (UINT64_C(1) << (uint64_t)(m))
#define MM18_ALLMOVES    UINT64_C(0x3FFFF)
#define MM18_NOHALFTURNS UINT64_C(0x2DB6D)
#define MM18_FACE(m)     (UINT64_C(7) << (uint64_t)(m))
#define MM18_EO          (\
    MM18_FACE(MOVE_U) | MM18_FACE(MOVE_D) |\
    MM18_FACE(MOVE_R) | MM18_FACE(MOVE_L) |\
    MM_SINGLE(MOVE_F2) | MM_SINGLE(MOVE_B2))
#define MM18_DR          (\
    MM18_FACE(MOVE_U) | MM18_FACE(MOVE_D) |\
    MM_SINGLE(MOVE_R2) | MM_SINGLE(MOVE_L2) |\
    MM_SINGLE(MOVE_F2) | MM_SINGLE(MOVE_B2))
#define MM18_DRHTR       (\
    MM18_FACE(MOVE_U) | MM_SINGLE(MOVE_D) | MM_SINGLE(MOVE_D3) |\
    MM_SINGLE(MOVE_R2) | MM_SINGLE(MOVE_L2) |\
    MM_SINGLE(MOVE_F2) | MM_SINGLE(MOVE_B2))
#define MM18_DR_NOD      (MM18_DR & ~MM18_FACE(MOVE_D))
#define MM18_HTR         (MM18_ALLMOVES & ~MM18_NOHALFTURNS)
#define MM18_URF         (\
    MM18_FACE(MOVE_U) | MM18_FACE(MOVE_R) | MM18_FACE(MOVE_F))

#define TM_SINGLE(t)   (UINT64_C(1) << (uint64_t)(t))
#define TM_ALLTRANS    UINT64_C(0xFFFFFFFFFFFF)
#define TM_UDRLFIX     (\
    TM_SINGLE(TRANS_UFr) | TM_SINGLE(TRANS_UBr) | TM_SINGLE(TRANS_UFm) | \
    TM_SINGLE(TRANS_UBm) | TM_SINGLE(TRANS_DFr) | TM_SINGLE(TRANS_DBr) | \
    TM_SINGLE(TRANS_DFm) | TM_SINGLE(TRANS_DBm))
#define TM_UDFIX       (\
    TM_SINGLE(TRANS_UFr) | TM_SINGLE(TRANS_UBr) | TM_SINGLE(TRANS_URr) | \
    TM_SINGLE(TRANS_ULr) | TM_SINGLE(TRANS_UFm) | TM_SINGLE(TRANS_UBm) | \
    TM_SINGLE(TRANS_URm) | TM_SINGLE(TRANS_ULm) | TM_SINGLE(TRANS_DFr) | \
    TM_SINGLE(TRANS_DBr) | TM_SINGLE(TRANS_DRr) | TM_SINGLE(TRANS_DLr) | \
    TM_SINGLE(TRANS_DFm) | TM_SINGLE(TRANS_DBm) | TM_SINGLE(TRANS_DRm) | \
    TM_SINGLE(TRANS_DLm))

#define CORNER_UFR      UINT8_C(0)
#define CORNER_UBL      UINT8_C(1)
#define CORNER_DFL      UINT8_C(2)
#define CORNER_DBR      UINT8_C(3)
#define CORNER_UFL      UINT8_C(4)
#define CORNER_UBR      UINT8_C(5)
#define CORNER_DFR      UINT8_C(6)
#define CORNER_DBL      UINT8_C(7)

#define EDGE_UF       UINT8_C(0)
#define EDGE_UB       UINT8_C(1)
#define EDGE_DB       UINT8_C(2)
#define EDGE_DF       UINT8_C(3)
#define EDGE_UR       UINT8_C(4)
#define EDGE_UL       UINT8_C(5)
#define EDGE_DL       UINT8_C(6)
#define EDGE_DR       UINT8_C(7)
#define EDGE_FR       UINT8_C(8)
#define EDGE_FL       UINT8_C(9)
#define EDGE_BL       UINT8_C(10)
#define EDGE_BR       UINT8_C(11)

#define ORIENTATION_UF UINT8_C(0)
#define ORIENTATION_UR UINT8_C(1)
#define ORIENTATION_UB UINT8_C(2)
#define ORIENTATION_UL UINT8_C(3)
#define ORIENTATION_DF UINT8_C(4)
#define ORIENTATION_DR UINT8_C(5)
#define ORIENTATION_DB UINT8_C(6)
#define ORIENTATION_DL UINT8_C(7)
#define ORIENTATION_RF UINT8_C(8)
#define ORIENTATION_RD UINT8_C(9)
#define ORIENTATION_RB UINT8_C(10)
#define ORIENTATION_RU UINT8_C(11)
#define ORIENTATION_LF UINT8_C(12)
#define ORIENTATION_LD UINT8_C(13)
#define ORIENTATION_LB UINT8_C(14)
#define ORIENTATION_LU UINT8_C(15)
#define ORIENTATION_FD UINT8_C(16)
#define ORIENTATION_FR UINT8_C(17)
#define ORIENTATION_FU UINT8_C(18)
#define ORIENTATION_FL UINT8_C(19)
#define ORIENTATION_BD UINT8_C(20)
#define ORIENTATION_BR UINT8_C(21)
#define ORIENTATION_BU UINT8_C(22)
#define ORIENTATION_BL UINT8_C(23)

/* This is only meant to work for the 18 base moves, for now */
STATIC const uint64_t allowedmask[] = {
	[MOVE_U  / 3] = UINT64_C(0x3FFF8),
	[MOVE_D  / 3] = UINT64_C(0x3FFC0),
	[MOVE_R  / 3] = UINT64_C(0x3FE3F),
	[MOVE_L  / 3] = UINT64_C(0x3F03F),
	[MOVE_F  / 3] = UINT64_C(0x38FFF),
	[MOVE_B  / 3] = UINT64_C(0x00FFF),
	[MOVE_Uw / 3] = 0,
	[MOVE_Dw / 3] = 0,
	[MOVE_Rw / 3] = 0,
	[MOVE_Lw / 3] = 0,
	[MOVE_Fw / 3] = 0,
	[MOVE_Bw / 3] = 0,
	[MOVE_M  / 3] = 0,
	[MOVE_S  / 3] = 0,
	[MOVE_E  / 3] = 0,
	[MOVE_x  / 3] = 0,
	[MOVE_y  / 3] = 0,
	[MOVE_z  / 3] = 0,
};

STATIC const char *cornerstr[] = {
	[CORNER_UFR] = "UFR",
	[CORNER_UBL] = "UBL",
	[CORNER_DFL] = "DFL",
	[CORNER_DBR] = "DBR",
	[CORNER_UFL] = "UFL",
	[CORNER_UBR] = "UBR",
	[CORNER_DFR] = "DFR",
	[CORNER_DBL] = "DBL"
};

STATIC const char *cornerstralt[] = {
	[CORNER_UFR] = "URF",
	[CORNER_UBL] = "ULB",
	[CORNER_DFL] = "DLF",
	[CORNER_DBR] = "DRB",
	[CORNER_UFL] = "ULF",
	[CORNER_UBR] = "URB",
	[CORNER_DFR] = "DRF",
	[CORNER_DBL] = "DLB"
};

STATIC const char *edgestr[] = {
	[EDGE_UF] = "UF",
	[EDGE_UB] = "UB",
	[EDGE_DB] = "DB",
	[EDGE_DF] = "DF",
	[EDGE_UR] = "UR",
	[EDGE_UL] = "UL",
	[EDGE_DL] = "DL",
	[EDGE_DR] = "DR",
	[EDGE_FR] = "FR",
	[EDGE_FL] = "FL",
	[EDGE_BL] = "BL",
	[EDGE_BR] = "BR"
};

STATIC const char *movestr[] = {
	[MOVE_U]  = "U",
	[MOVE_U2] = "U2",
	[MOVE_U3] = "U'",
	[MOVE_D]  = "D",
	[MOVE_D2] = "D2",
	[MOVE_D3] = "D'",
	[MOVE_R]  = "R",
	[MOVE_R2] = "R2",
	[MOVE_R3] = "R'",
	[MOVE_L]  = "L",
	[MOVE_L2] = "L2",
	[MOVE_L3] = "L'",
	[MOVE_F]  = "F",
	[MOVE_F2] = "F2",
	[MOVE_F3] = "F'",
	[MOVE_B]  = "B",
	[MOVE_B2] = "B2",
	[MOVE_B3] = "B'",

	[MOVE_Uw]  = "Uw",
	[MOVE_Uw2] = "Uw2",
	[MOVE_Uw3] = "Uw'",
	[MOVE_Dw]  = "Dw",
	[MOVE_Dw2] = "Dw2",
	[MOVE_Dw3] = "Dw'",
	[MOVE_Rw]  = "Rw",
	[MOVE_Rw2] = "Rw2",
	[MOVE_Rw3] = "Rw'",
	[MOVE_Lw]  = "Lw",
	[MOVE_Lw2] = "Lw2",
	[MOVE_Lw3] = "Lw'",
	[MOVE_Fw]  = "Fw",
	[MOVE_Fw2] = "Fw2",
	[MOVE_Fw3] = "Fw'",
	[MOVE_Bw]  = "Bw",
	[MOVE_Bw2] = "Bw2",
	[MOVE_Bw3] = "Bw'",

	[MOVE_M]  = "M",
	[MOVE_M2] = "M2",
	[MOVE_M3] = "M'",
	[MOVE_S]  = "S",
	[MOVE_S2] = "S2",
	[MOVE_S3] = "S'",
	[MOVE_E]  = "E",
	[MOVE_E2] = "E2",
	[MOVE_E3] = "E'",

	[MOVE_x]  = "x",
	[MOVE_x2] = "x2",
	[MOVE_x3] = "x'",
	[MOVE_y]  = "y",
	[MOVE_y2] = "y2",
	[MOVE_y3] = "y'",
	[MOVE_z]  = "z",
	[MOVE_z2] = "z2",
	[MOVE_z3] = "z'",
};

STATIC const char *transstr[] = {
	[TRANS_UFr] = "rotation UF",
	[TRANS_UFm] = "mirrored UF",
	[TRANS_ULr] = "rotation UL",
	[TRANS_ULm] = "mirrored UL",
	[TRANS_UBr] = "rotation UB",
	[TRANS_UBm] = "mirrored UB",
	[TRANS_URr] = "rotation UR",
	[TRANS_URm] = "mirrored UR",
	[TRANS_DFr] = "rotation DF",
	[TRANS_DFm] = "mirrored DF",
	[TRANS_DLr] = "rotation DL",
	[TRANS_DLm] = "mirrored DL",
	[TRANS_DBr] = "rotation DB",
	[TRANS_DBm] = "mirrored DB",
	[TRANS_DRr] = "rotation DR",
	[TRANS_DRm] = "mirrored DR",
	[TRANS_RUr] = "rotation RU",
	[TRANS_RUm] = "mirrored RU",
	[TRANS_RFr] = "rotation RF",
	[TRANS_RFm] = "mirrored RF",
	[TRANS_RDr] = "rotation RD",
	[TRANS_RDm] = "mirrored RD",
	[TRANS_RBr] = "rotation RB",
	[TRANS_RBm] = "mirrored RB",
	[TRANS_LUr] = "rotation LU",
	[TRANS_LUm] = "mirrored LU",
	[TRANS_LFr] = "rotation LF",
	[TRANS_LFm] = "mirrored LF",
	[TRANS_LDr] = "rotation LD",
	[TRANS_LDm] = "mirrored LD",
	[TRANS_LBr] = "rotation LB",
	[TRANS_LBm] = "mirrored LB",
	[TRANS_FUr] = "rotation FU",
	[TRANS_FUm] = "mirrored FU",
	[TRANS_FRr] = "rotation FR",
	[TRANS_FRm] = "mirrored FR",
	[TRANS_FDr] = "rotation FD",
	[TRANS_FDm] = "mirrored FD",
	[TRANS_FLr] = "rotation FL",
	[TRANS_FLm] = "mirrored FL",
	[TRANS_BUr] = "rotation BU",
	[TRANS_BUm] = "mirrored BU",
	[TRANS_BRr] = "rotation BR",
	[TRANS_BRm] = "mirrored BR",
	[TRANS_BDr] = "rotation BD",
	[TRANS_BDm] = "mirrored BD",
	[TRANS_BLr] = "rotation BL",
	[TRANS_BLm] = "mirrored BL",
};

STATIC uint8_t inverse_trans_table[] = {
	[TRANS_UFr] = TRANS_UFr,
	[TRANS_UFm] = TRANS_UFm,
	[TRANS_ULr] = TRANS_URr,
	[TRANS_ULm] = TRANS_ULm,
	[TRANS_UBr] = TRANS_UBr,
	[TRANS_UBm] = TRANS_UBm,
	[TRANS_URr] = TRANS_ULr,
	[TRANS_URm] = TRANS_URm,
	[TRANS_DFr] = TRANS_DFr,
	[TRANS_DFm] = TRANS_DFm,
	[TRANS_DLr] = TRANS_DLr,
	[TRANS_DLm] = TRANS_DRm,
	[TRANS_DBr] = TRANS_DBr,
	[TRANS_DBm] = TRANS_DBm,
	[TRANS_DRr] = TRANS_DRr,
	[TRANS_DRm] = TRANS_DLm,
	[TRANS_RUr] = TRANS_FRr,
	[TRANS_RUm] = TRANS_FLm,
	[TRANS_RFr] = TRANS_LFr,
	[TRANS_RFm] = TRANS_RFm,
	[TRANS_RDr] = TRANS_BLr,
	[TRANS_RDm] = TRANS_BRm,
	[TRANS_RBr] = TRANS_RBr,
	[TRANS_RBm] = TRANS_LBm,
	[TRANS_LUr] = TRANS_FLr,
	[TRANS_LUm] = TRANS_FRm,
	[TRANS_LFr] = TRANS_RFr,
	[TRANS_LFm] = TRANS_LFm,
	[TRANS_LDr] = TRANS_BRr,
	[TRANS_LDm] = TRANS_BLm,
	[TRANS_LBr] = TRANS_LBr,
	[TRANS_LBm] = TRANS_RBm,
	[TRANS_FUr] = TRANS_FUr,
	[TRANS_FUm] = TRANS_FUm,
	[TRANS_FRr] = TRANS_RUr,
	[TRANS_FRm] = TRANS_LUm,
	[TRANS_FDr] = TRANS_BUr,
	[TRANS_FDm] = TRANS_BUm,
	[TRANS_FLr] = TRANS_LUr,
	[TRANS_FLm] = TRANS_RUm,
	[TRANS_BUr] = TRANS_FDr,
	[TRANS_BUm] = TRANS_FDm,
	[TRANS_BRr] = TRANS_LDr,
	[TRANS_BRm] = TRANS_RDm,
	[TRANS_BDr] = TRANS_BDr,
	[TRANS_BDm] = TRANS_BDm,
	[TRANS_BLr] = TRANS_RDr,
	[TRANS_BLm] = TRANS_LDm,
};

STATIC uint8_t trans_move_table[][3] = {
	[TRANS_UFr] = { MOVE_U, MOVE_R, MOVE_F },
	[TRANS_UFm] = { MOVE_U, MOVE_L, MOVE_F },
	[TRANS_ULr] = { MOVE_U, MOVE_F, MOVE_L },
	[TRANS_ULm] = { MOVE_U, MOVE_F, MOVE_R },
	[TRANS_UBr] = { MOVE_U, MOVE_L, MOVE_B },
	[TRANS_UBm] = { MOVE_U, MOVE_R, MOVE_B },
	[TRANS_URr] = { MOVE_U, MOVE_B, MOVE_R },
	[TRANS_URm] = { MOVE_U, MOVE_B, MOVE_L },
	[TRANS_DFr] = { MOVE_D, MOVE_L, MOVE_F },
	[TRANS_DFm] = { MOVE_D, MOVE_R, MOVE_F },
	[TRANS_DLr] = { MOVE_D, MOVE_B, MOVE_L },
	[TRANS_DLm] = { MOVE_D, MOVE_B, MOVE_R },
	[TRANS_DBr] = { MOVE_D, MOVE_R, MOVE_B },
	[TRANS_DBm] = { MOVE_D, MOVE_L, MOVE_B },
	[TRANS_DRr] = { MOVE_D, MOVE_F, MOVE_R },
	[TRANS_DRm] = { MOVE_D, MOVE_F, MOVE_L },
	[TRANS_RUr] = { MOVE_R, MOVE_F, MOVE_U },
	[TRANS_RUm] = { MOVE_L, MOVE_F, MOVE_U },
	[TRANS_RFr] = { MOVE_R, MOVE_D, MOVE_F },
	[TRANS_RFm] = { MOVE_L, MOVE_D, MOVE_F },
	[TRANS_RDr] = { MOVE_R, MOVE_B, MOVE_D },
	[TRANS_RDm] = { MOVE_L, MOVE_B, MOVE_D },
	[TRANS_RBr] = { MOVE_R, MOVE_U, MOVE_B },
	[TRANS_RBm] = { MOVE_L, MOVE_U, MOVE_B },
	[TRANS_LUr] = { MOVE_L, MOVE_B, MOVE_U },
	[TRANS_LUm] = { MOVE_R, MOVE_B, MOVE_U },
	[TRANS_LFr] = { MOVE_L, MOVE_U, MOVE_F },
	[TRANS_LFm] = { MOVE_R, MOVE_U, MOVE_F },
	[TRANS_LDr] = { MOVE_L, MOVE_F, MOVE_D },
	[TRANS_LDm] = { MOVE_R, MOVE_F, MOVE_D },
	[TRANS_LBr] = { MOVE_L, MOVE_D, MOVE_B },
	[TRANS_LBm] = { MOVE_R, MOVE_D, MOVE_B },
	[TRANS_FUr] = { MOVE_F, MOVE_L, MOVE_U },
	[TRANS_FUm] = { MOVE_F, MOVE_R, MOVE_U },
	[TRANS_FRr] = { MOVE_F, MOVE_U, MOVE_R },
	[TRANS_FRm] = { MOVE_F, MOVE_U, MOVE_L },
	[TRANS_FDr] = { MOVE_F, MOVE_R, MOVE_D },
	[TRANS_FDm] = { MOVE_F, MOVE_L, MOVE_D },
	[TRANS_FLr] = { MOVE_F, MOVE_D, MOVE_L },
	[TRANS_FLm] = { MOVE_F, MOVE_D, MOVE_R },
	[TRANS_BUr] = { MOVE_B, MOVE_R, MOVE_U },
	[TRANS_BUm] = { MOVE_B, MOVE_L, MOVE_U },
	[TRANS_BRr] = { MOVE_B, MOVE_D, MOVE_R },
	[TRANS_BRm] = { MOVE_B, MOVE_D, MOVE_L },
	[TRANS_BDr] = { MOVE_B, MOVE_L, MOVE_D },
	[TRANS_BDm] = { MOVE_B, MOVE_R, MOVE_D },
	[TRANS_BLr] = { MOVE_B, MOVE_U, MOVE_L },
	[TRANS_BLm] = { MOVE_B, MOVE_U, MOVE_R },
};

STATIC uint8_t orientation_moves[][3] = {
	[ORIENTATION_UF] = { UINT8_MAX },
	[ORIENTATION_UR] = { MOVE_y, UINT8_MAX },
	[ORIENTATION_UB] = { MOVE_y2, UINT8_MAX },
	[ORIENTATION_UL] = { MOVE_y3, UINT8_MAX },
	[ORIENTATION_DF] = { MOVE_z2, UINT8_MAX },
	[ORIENTATION_DR] = { MOVE_y, MOVE_z2, UINT8_MAX },
	[ORIENTATION_DB] = { MOVE_y2, MOVE_z2, UINT8_MAX },
	[ORIENTATION_DL] = { MOVE_y3, MOVE_z2, UINT8_MAX },
	[ORIENTATION_RF] = { MOVE_z3, UINT8_MAX },
	[ORIENTATION_RD] = { MOVE_z3, MOVE_y, UINT8_MAX },
	[ORIENTATION_RB] = { MOVE_z3, MOVE_y2, UINT8_MAX },
	[ORIENTATION_RU] = { MOVE_z3, MOVE_y3, UINT8_MAX },
	[ORIENTATION_LF] = { MOVE_z, UINT8_MAX },
	[ORIENTATION_LD] = { MOVE_z, MOVE_y3, UINT8_MAX },
	[ORIENTATION_LB] = { MOVE_z, MOVE_y2, UINT8_MAX },
	[ORIENTATION_LU] = { MOVE_z, MOVE_y, UINT8_MAX },
	[ORIENTATION_FD] = { MOVE_x, UINT8_MAX },
	[ORIENTATION_FR] = { MOVE_x, MOVE_y, UINT8_MAX },
	[ORIENTATION_FU] = { MOVE_x, MOVE_y2, UINT8_MAX },
	[ORIENTATION_FL] = { MOVE_x, MOVE_y3, UINT8_MAX },
	[ORIENTATION_BD] = { MOVE_x3, MOVE_y2, UINT8_MAX },
	[ORIENTATION_BR] = { MOVE_x3, MOVE_y, UINT8_MAX },
	[ORIENTATION_BU] = { MOVE_x3, UINT8_MAX },
	[ORIENTATION_BL] = { MOVE_x3, MOVE_y3, UINT8_MAX },
};

STATIC uint8_t orientation_transition_table[][3] = {
	[ORIENTATION_UF] = { ORIENTATION_FD, ORIENTATION_UR, ORIENTATION_LF },
	[ORIENTATION_UR] = { ORIENTATION_RD, ORIENTATION_UB, ORIENTATION_FR },
	[ORIENTATION_UB] = { ORIENTATION_BD, ORIENTATION_UL, ORIENTATION_RB },
	[ORIENTATION_UL] = { ORIENTATION_LD, ORIENTATION_UF, ORIENTATION_BL },
	[ORIENTATION_DF] = { ORIENTATION_FU, ORIENTATION_DL, ORIENTATION_RF },
	[ORIENTATION_DR] = { ORIENTATION_RU, ORIENTATION_DF, ORIENTATION_BR },
	[ORIENTATION_DB] = { ORIENTATION_BU, ORIENTATION_DR, ORIENTATION_LB },
	[ORIENTATION_DL] = { ORIENTATION_LU, ORIENTATION_DB, ORIENTATION_FL },
	[ORIENTATION_RF] = { ORIENTATION_FL, ORIENTATION_RD, ORIENTATION_UF },
	[ORIENTATION_RD] = { ORIENTATION_DL, ORIENTATION_RB, ORIENTATION_FD },
	[ORIENTATION_RB] = { ORIENTATION_BL, ORIENTATION_RU, ORIENTATION_DB },
	[ORIENTATION_RU] = { ORIENTATION_UL, ORIENTATION_RF, ORIENTATION_BU },
	[ORIENTATION_LF] = { ORIENTATION_FR, ORIENTATION_LU, ORIENTATION_DF },
	[ORIENTATION_LD] = { ORIENTATION_DR, ORIENTATION_LF, ORIENTATION_BD },
	[ORIENTATION_LB] = { ORIENTATION_BR, ORIENTATION_LD, ORIENTATION_UB },
	[ORIENTATION_LU] = { ORIENTATION_UR, ORIENTATION_LB, ORIENTATION_FU },
	[ORIENTATION_FD] = { ORIENTATION_DB, ORIENTATION_FR, ORIENTATION_LD },
	[ORIENTATION_FR] = { ORIENTATION_RB, ORIENTATION_FU, ORIENTATION_DR },
	[ORIENTATION_FU] = { ORIENTATION_UB, ORIENTATION_FL, ORIENTATION_RU },
	[ORIENTATION_FL] = { ORIENTATION_LB, ORIENTATION_FD, ORIENTATION_UL },
	[ORIENTATION_BD] = { ORIENTATION_DF, ORIENTATION_BL, ORIENTATION_RD },
	[ORIENTATION_BR] = { ORIENTATION_RF, ORIENTATION_BD, ORIENTATION_UR },
	[ORIENTATION_BU] = { ORIENTATION_UF, ORIENTATION_BR, ORIENTATION_LU },
	[ORIENTATION_BL] = { ORIENTATION_LF, ORIENTATION_BU, ORIENTATION_DL },
};

STATIC uint8_t orientation_trans[] = {
	[ORIENTATION_UF] = TRANS_UFr,
	[ORIENTATION_UR] = TRANS_URr,
	[ORIENTATION_UB] = TRANS_UBr,
	[ORIENTATION_UL] = TRANS_ULr,
	[ORIENTATION_DF] = TRANS_DFr,
	[ORIENTATION_DR] = TRANS_DRr,
	[ORIENTATION_DB] = TRANS_DBr,
	[ORIENTATION_DL] = TRANS_DLr,
	[ORIENTATION_RF] = TRANS_RFr,
	[ORIENTATION_RD] = TRANS_RDr,
	[ORIENTATION_RB] = TRANS_RBr,
	[ORIENTATION_RU] = TRANS_RUr,
	[ORIENTATION_LF] = TRANS_LFr,
	[ORIENTATION_LD] = TRANS_LDr,
	[ORIENTATION_LB] = TRANS_LBr,
	[ORIENTATION_LU] = TRANS_LUr,
	[ORIENTATION_FD] = TRANS_FDr,
	[ORIENTATION_FR] = TRANS_FRr,
	[ORIENTATION_FU] = TRANS_FUr,
	[ORIENTATION_FL] = TRANS_FLr,
	[ORIENTATION_BD] = TRANS_BDr,
	[ORIENTATION_BR] = TRANS_BRr,
	[ORIENTATION_BU] = TRANS_BUr,
	[ORIENTATION_BL] = TRANS_BLr,
};

typedef struct {
	uint8_t move[3];
	uint8_t rotation[4];
} equivalent_moves_t;

STATIC equivalent_moves_t equivalent_moves_table[] = {
	[MOVE_U]   = {{MOVE_U,  UINT8_MAX}, {UINT8_MAX}},
	[MOVE_U2]  = {{MOVE_U2, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_U3]  = {{MOVE_U3, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_D]   = {{MOVE_D,  UINT8_MAX}, {UINT8_MAX}},
	[MOVE_D2]  = {{MOVE_D2, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_D3]  = {{MOVE_D3, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_R]   = {{MOVE_R,  UINT8_MAX}, {UINT8_MAX}},
	[MOVE_R2]  = {{MOVE_R2, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_R3]  = {{MOVE_R3, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_L]   = {{MOVE_L,  UINT8_MAX}, {UINT8_MAX}},
	[MOVE_L2]  = {{MOVE_L2, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_L3]  = {{MOVE_L3, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_F]   = {{MOVE_F,  UINT8_MAX}, {UINT8_MAX}},
	[MOVE_F2]  = {{MOVE_F2, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_F3]  = {{MOVE_F3, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_B]   = {{MOVE_B,  UINT8_MAX}, {UINT8_MAX}},
	[MOVE_B2]  = {{MOVE_B2, UINT8_MAX}, {UINT8_MAX}},
	[MOVE_B3]  = {{MOVE_B3, UINT8_MAX}, {UINT8_MAX}},

	[MOVE_Uw]  = {{MOVE_D,  UINT8_MAX}, {1, UINT8_MAX}},
	[MOVE_Uw2] = {{MOVE_D2, UINT8_MAX}, {1, 1, UINT8_MAX}},
	[MOVE_Uw3] = {{MOVE_D3, UINT8_MAX}, {1, 1, 1, UINT8_MAX}},
	[MOVE_Dw]  = {{MOVE_U,  UINT8_MAX}, {1, 1, 1, UINT8_MAX}},
	[MOVE_Dw2] = {{MOVE_U2, UINT8_MAX}, {1, 1, UINT8_MAX}},
	[MOVE_Dw3] = {{MOVE_U3, UINT8_MAX}, {1, UINT8_MAX}},
	[MOVE_Rw]  = {{MOVE_L,  UINT8_MAX}, {0, UINT8_MAX}},
	[MOVE_Rw2] = {{MOVE_L2, UINT8_MAX}, {0, 0, UINT8_MAX}},
	[MOVE_Rw3] = {{MOVE_L3, UINT8_MAX}, {0, 0, 0, UINT8_MAX}},
	[MOVE_Lw]  = {{MOVE_R,  UINT8_MAX}, {0, 0, 0, UINT8_MAX}},
	[MOVE_Lw2] = {{MOVE_R2, UINT8_MAX}, {0, 0, UINT8_MAX}},
	[MOVE_Lw3] = {{MOVE_R3, UINT8_MAX}, {0, UINT8_MAX}},
	[MOVE_Fw]  = {{MOVE_B,  UINT8_MAX}, {2, UINT8_MAX}},
	[MOVE_Fw2] = {{MOVE_B2, UINT8_MAX}, {2, 2, UINT8_MAX}},
	[MOVE_Fw3] = {{MOVE_B3, UINT8_MAX}, {2, 2, 2, UINT8_MAX}},
	[MOVE_Bw]  = {{MOVE_F,  UINT8_MAX}, {2, 2, 2, UINT8_MAX}},
	[MOVE_Bw2] = {{MOVE_F2, UINT8_MAX}, {2, 2, UINT8_MAX}},
	[MOVE_Bw3] = {{MOVE_F3, UINT8_MAX}, {2, UINT8_MAX}},
	
	[MOVE_M]   = {{MOVE_R,  MOVE_L3, UINT8_MAX}, {0, 0, 0, UINT8_MAX}},
	[MOVE_M2]  = {{MOVE_R2, MOVE_L2, UINT8_MAX}, {0, 0, UINT8_MAX}},
	[MOVE_M3]  = {{MOVE_R3, MOVE_L,  UINT8_MAX}, {0, UINT8_MAX}},
	[MOVE_S]   = {{MOVE_F3, MOVE_B,  UINT8_MAX}, {2, UINT8_MAX}},
	[MOVE_S2]  = {{MOVE_F2, MOVE_B2, UINT8_MAX}, {2, 2, UINT8_MAX}},
	[MOVE_S3]  = {{MOVE_F,  MOVE_B3, UINT8_MAX}, {2, 2, 2, UINT8_MAX}},
	[MOVE_E]   = {{MOVE_U,  MOVE_D3, UINT8_MAX}, {1, 1, 1, UINT8_MAX}},
	[MOVE_E2]  = {{MOVE_U2, MOVE_D2, UINT8_MAX}, {1, 1, UINT8_MAX}},
	[MOVE_E3]  = {{MOVE_U3, MOVE_D,  UINT8_MAX}, {1, UINT8_MAX}},

	[MOVE_x]   = {{UINT8_MAX}, {0, UINT8_MAX}},
	[MOVE_x2]  = {{UINT8_MAX}, {0, 0, UINT8_MAX}},
	[MOVE_x3]  = {{UINT8_MAX}, {0, 0, 0, UINT8_MAX}},
	[MOVE_y]   = {{UINT8_MAX}, {1, UINT8_MAX}},
	[MOVE_y2]  = {{UINT8_MAX}, {1, 1, UINT8_MAX}},
	[MOVE_y3]  = {{UINT8_MAX}, {1, 1, 1, UINT8_MAX}},
	[MOVE_z]   = {{UINT8_MAX}, {2, UINT8_MAX}},
	[MOVE_z2]  = {{UINT8_MAX}, {2, 2, UINT8_MAX}},
	[MOVE_z3]  = {{UINT8_MAX}, {2, 2, 2, UINT8_MAX}},
};

STATIC uint8_t slice_to_basic[] = {
	[MOVE_M]  = MOVE_L,
	[MOVE_M2] = MOVE_L2,
	[MOVE_M3] = MOVE_L3,
	[MOVE_S]  = MOVE_F,
	[MOVE_S2] = MOVE_F2,
	[MOVE_S3] = MOVE_F3,
	[MOVE_E]  = MOVE_D,
	[MOVE_E2] = MOVE_D2,
	[MOVE_E3] = MOVE_D3,
};

STATIC uint8_t basic_to_slice[] = {
	[MOVE_U]  = MOVE_E3,
	[MOVE_U2] = MOVE_E2,
	[MOVE_U3] = MOVE_E,
	[MOVE_D]  = MOVE_E,
	[MOVE_D2] = MOVE_E2,
	[MOVE_D3] = MOVE_E3,
	[MOVE_R]  = MOVE_M3,
	[MOVE_R2] = MOVE_M2,
	[MOVE_R3] = MOVE_M,
	[MOVE_L]  = MOVE_M,
	[MOVE_L2] = MOVE_M2,
	[MOVE_L3] = MOVE_M3,
	[MOVE_F]  = MOVE_S,
	[MOVE_F2] = MOVE_S2,
	[MOVE_F3] = MOVE_S3,
	[MOVE_B]  = MOVE_S3,
	[MOVE_B2] = MOVE_S2,
	[MOVE_B3] = MOVE_S,
};

STATIC uint8_t rotation_to_basic[] = {
	[MOVE_x]  = MOVE_R,
	[MOVE_x2] = MOVE_R2,
	[MOVE_x3] = MOVE_R3,
	[MOVE_y]  = MOVE_U,
	[MOVE_y2] = MOVE_U2,
	[MOVE_y3] = MOVE_U3,
	[MOVE_z]  = MOVE_F,
	[MOVE_z2] = MOVE_F2,
	[MOVE_z3] = MOVE_F3,
};

STATIC uint8_t basic_to_rotation[] = {
	[MOVE_U]  = MOVE_y,
	[MOVE_U2] = MOVE_y2,
	[MOVE_U3] = MOVE_y3,
	[MOVE_D]  = MOVE_y3,
	[MOVE_D2] = MOVE_y2,
	[MOVE_D3] = MOVE_y,
	[MOVE_R]  = MOVE_x,
	[MOVE_R2] = MOVE_x2,
	[MOVE_R3] = MOVE_x3,
	[MOVE_L]  = MOVE_x3,
	[MOVE_L2] = MOVE_x2,
	[MOVE_L3] = MOVE_x,
	[MOVE_F]  = MOVE_z,
	[MOVE_F2] = MOVE_z2,
	[MOVE_F3] = MOVE_z3,
	[MOVE_B]  = MOVE_z3,
	[MOVE_B2] = MOVE_z2,
	[MOVE_B3] = MOVE_z,
};

#endif /* CORE_CONSTANTS_H */
