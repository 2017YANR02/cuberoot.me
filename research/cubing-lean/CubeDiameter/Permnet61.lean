module

public import CubeDiameter.Table

@[expose] public section

namespace CubeDiameter.Network

/-- Convert the left-to-right movement around a displayed cycle into transpositions. -/
def cycle : List Nat → Stage
  | [] => []
  | a :: rest => rest.map fun b => (min a b, max a b)

/-- Appendix F, Table F.1 of arXiv:2611.11018v1, permutation column.
    A stage containing two disjoint cycles has one shared take/skip decision. -/
def split24 : List Stage := [
  cycle [3,15,21,12,18,20,7],
  cycle [2,17,5,11,12,22,18],
  cycle [1,11,21,17] ++ cycle [4,10,15,18],
  cycle [1,18,21,10] ++ cycle [2,14,20,6],
  cycle [3,7,23,15] ++ cycle [6,11,12,19],
  cycle [1,7,21,13] ++ cycle [6,9,14,17],
  cycle [0,11,20,19] ++ cycle [5,18,13,8],
  cycle [0,12,20,4] ++ cycle [1,10,23,16],
  cycle [2,7,23,14] ++ cycle [3,16,22,11],
  cycle [0,5,21,15] ++ cycle [6,9,14,19],
  cycle [0,6,20,14] ++ cycle [3,8,21,16],
  cycle [0,12,13] ++ cycle [6,7,22],
  cycle [2,3,20,14,7],
  cycle [3,4,10] ++ cycle [13,16,21],
  cycle [0,12,6],
  cycle [3,6,11] ++ cycle [12,17,21],
  cycle [1,14,19] ++ cycle [4,9,23],
  cycle [2,18,5] ++ cycle [8,15,20],
  cycle [1,4,9],
  cycle [5,17,20],
  cycle [2,23,3],
  cycle [3,21] ++ cycle [11,17],
  cycle [1,8,4] ++ cycle [14,23,16],
  cycle [6,22,13]]

/-- Table F.2, in its representative 16-wire orientation. -/
def split16 : List Stage := [
  cycle [0,10,12,3,4,9,7],
  cycle [0,4,5,12,9,3,10],
  cycle [0,9,1,7,3,15,11],
  cycle [5,9,12] ++ cycle [7,10,11],
  cycle [0,15,10,1,3,6,4],
  cycle [5,7,9] ++ cycle [10,11,12],
  cycle [0,12] ++ cycle [3,7],
  cycle [1,11] ++ cycle [5,15],
  cycle [2,11,15], cycle [3,12,8], cycle [0,7,12], cycle [1,5,14],
  cycle [1,4,9], cycle [5,14,15], cycle [2,6,10], cycle [7,12,13]]

/-- Table F.3, in its representative 8-wire orientation. -/
def split8 : List Stage := [
  cycle [1,2,4], cycle [2,7,6], cycle [1,6] ++ cycle [2,7],
  cycle [0,6,7], cycle [1,2,4], cycle [1,2,5], cycle [3,6,7]]

theorem split8_routes (x : Nat) (hx : x < 2^8) (hw : weight 8 x = 4) :
    Routes 8 split8 x 15 :=
  routes_of_certificate (by decide +kernel) hx hw

theorem split16_routes (x : Nat) (hx : x < 2^16) (hw : weight 16 x = 8) :
    Routes 16 split16 x 255 :=
  routes_of_certificate (by decide +kernel) hx hw

theorem split24_routes (x : Nat) (hx : x < 2^24) (hw : weight 24 x = 8) :
    Routes 24 split24 x 255 :=
  routes_of_certificate (by decide +kernel) hx hw

end CubeDiameter.Network
