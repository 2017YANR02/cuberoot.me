# Small example of nissy Python module usage
# See the solve.py example for more details on how this works

import os, sys

# Assume we are eithe rin the top-level directory of the nissy-core repo,
# or in the python subdirectory
sys.path.append(os.getcwd())
sys.path.append(os.getcwd() + os.path.sep + "python")
import nissy

cube = nissy.applymoves(nissy.solved_cube, "R' U' F");
print("Cube after the moves R' U' F:")
print(cube)
