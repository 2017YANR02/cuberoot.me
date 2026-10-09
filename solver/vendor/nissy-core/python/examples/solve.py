# Small example of nissy Python module usage

# Run "./build.sh python", then run this from either the top-level directory
# of the nissy-core repo or from the python subdirectory.

# Append the directories to the python path so we can load the module
import sys, os
sys.path.append(os.getcwd())
sys.path.append(os.getcwd() + os.path.sep + "python")

# Import with a nicer name
import nissy

# Choose the solver you prefer
solver = "h48h3"

# Load the pruning table from file, generate it if needed
datapath = "tables" + os.path.sep + solver
if os.path.exists(datapath):
	data = bytearray(open(datapath, "rb").read())
else:
	data = nissy.gendata(solver)
	print("Generated data will NOT be persisted")

# Get a scrambled cube
cube = nissy.applymoves(nissy.solved_cube, "U F R2");

# Solve!
solutions = nissy.solve(cube, solver, nissy.nissflag_normal, 0, 9, 3, 20, 4, data)

# Print the solutions, one per line
print("Found ", len(solutions), " solutions:")
for s in solutions:
	print(s)

# You can use help(nissy) for more info about the available methods:
# help(nissy)

# Or help(nissy.methodname) if you want to know more about a specific method:
# help(nissy.solve)
