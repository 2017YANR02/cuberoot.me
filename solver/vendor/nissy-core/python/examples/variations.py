# Small example of nissy Python module usage
# See the solve.py example for more details on how this works

import sys, os
sys.path.append(os.getcwd())
sys.path.append(os.getcwd() + os.path.sep + "python")
import nissy

moves = "R U' Bw2 M D' x' F B(E2 F D B' Lw2 U2 U' S2 B)"

print("Changing the last quarter turns of {} gives:".format(moves))
for s in nissy.variations(moves, "lastqt"):
	print(s)
