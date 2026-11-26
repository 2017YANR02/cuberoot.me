import CubeComm.Classification

namespace CubeComm

def cornerCatalog : List (Representative 7 3) := [
  ⟨corner_1_1_1_1_1_1_1_1, [], corner_1_1_1_1_1_1_1_1_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_1_1_1_1_1_3, [3], corner_1_1_1_1_1_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_1_1_1_1_2_2, [2, 2], corner_1_1_1_1_2_2_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_1_1_1_5, [5], corner_1_1_1_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_1_1_2_4, [2, 4], corner_1_1_2_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_1_1_3_3, [3, 3], corner_1_1_3_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_1_2_2_3, [2, 2, 3], corner_1_2_2_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_1_7, [7], corner_1_7_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_2_2_2_2, [2, 2, 2, 2], corner_2_2_2_2_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_2_6, [2, 6], corner_2_6_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_3_5, [3, 5], corner_3_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨corner_4_4, [4, 4], corner_4_4_ok, by decide +kernel, by decide +kernel⟩]

theorem cornerCatalog_complete :
    ((evenShapes 8)).all (fun s => (cornerCatalog.map Representative.parts).contains s) = true :=
  by decide +kernel

def edgeCatalog : List (Representative 11 2) := [
  ⟨edge_1_1_1_1_1_1_1_1_1_3, [3], edge_1_1_1_1_1_1_1_1_1_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_1_1_1_1_2_2, [2, 2], edge_1_1_1_1_1_1_1_1_2_2_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_1_1_1_5, [5], edge_1_1_1_1_1_1_1_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_1_1_2_4, [2, 4], edge_1_1_1_1_1_1_2_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_1_1_3_3, [3, 3], edge_1_1_1_1_1_1_3_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_1_2_2_3, [2, 2, 3], edge_1_1_1_1_1_2_2_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_1_7, [7], edge_1_1_1_1_1_7_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_2_2_2_2, [2, 2, 2, 2], edge_1_1_1_1_2_2_2_2_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_2_6, [2, 6], edge_1_1_1_1_2_6_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_3_5, [3, 5], edge_1_1_1_1_3_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_1_4_4, [4, 4], edge_1_1_1_1_4_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_2_2_5, [2, 2, 5], edge_1_1_1_2_2_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_2_3_4, [2, 3, 4], edge_1_1_1_2_3_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_3_3_3, [3, 3, 3], edge_1_1_1_3_3_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_1_9, [9], edge_1_1_1_9_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_2_2_2_4, [2, 2, 2, 4], edge_1_1_2_2_2_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_2_2_3_3, [2, 2, 3, 3], edge_1_1_2_2_3_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_2_8, [2, 8], edge_1_1_2_8_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_3_7, [3, 7], edge_1_1_3_7_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_4_6, [4, 6], edge_1_1_4_6_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_1_5_5, [5, 5], edge_1_1_5_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_2_2_2_2_3, [2, 2, 2, 2, 3], edge_1_2_2_2_2_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_2_2_7, [2, 2, 7], edge_1_2_2_7_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_2_3_6, [2, 3, 6], edge_1_2_3_6_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_2_4_5, [2, 4, 5], edge_1_2_4_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_3_3_5, [3, 3, 5], edge_1_3_3_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_3_4_4, [3, 4, 4], edge_1_3_4_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_1_11, [11], edge_1_11_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_2_2_2_2_2_2, [2, 2, 2, 2, 2, 2], edge_2_2_2_2_2_2_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_2_2_2_6, [2, 2, 2, 6], edge_2_2_2_6_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_2_2_3_5, [2, 2, 3, 5], edge_2_2_3_5_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_2_2_4_4, [2, 2, 4, 4], edge_2_2_4_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_2_3_3_4, [2, 3, 3, 4], edge_2_3_3_4_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_2_10, [2, 10], edge_2_10_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_3_3_3_3, [3, 3, 3, 3], edge_3_3_3_3_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_3_9, [3, 9], edge_3_9_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_4_8, [4, 8], edge_4_8_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_5_7, [5, 7], edge_5_7_ok, by decide +kernel, by decide +kernel⟩,
  ⟨edge_6_6, [6, 6], edge_6_6_ok, by decide +kernel, by decide +kernel⟩]

theorem edgeCatalog_complete :
    ((evenShapes 12).filter (· != [])).all (fun s => (edgeCatalog.map Representative.parts).contains s) = true :=
  by decide +kernel

end CubeComm
