import matplotlib.pyplot as plt
import results_h48
import results_vcube
from pathlib import Path

benchmarks_dir = Path("benchmarks")
benchmarks_img_dir = benchmarks_dir / "img"
benchmarks_single_thread = benchmarks_dir / "tables_1_thread.md"
benchmarks_4_threads = benchmarks_dir / "tables_4_threads.md"
benchmarks_16_threads = benchmarks_dir / "tables_16_threads.md"
benchmarks_all_solutions = benchmarks_dir / "tables_all_solutions.md"

# Table sizes in bytes

sizes_h48 = {
	6: 1897951528,
	7: 3793842344,
	8: 7585624040,
	9: 15169187432,
	10: 30336314216,
	11: 60670567784,
}

sizes_vcube = {
	112: 2603089920,
	208: 7809269760,
	308: 22777036800,
	404: 34165555200,
	212: 62474158080,
}

# Printing tables in markdown format

def print_row(f, solver_name, solver_size, dict, mul_by_size, superflip_star):
	if dict is None:
		return
	solver_gib = solver_size / (2**30)
	m = solver_gib if mul_by_size else 1
	s = "   (a)   " if superflip_star else "         "
	cols = [f"{solver_name: <10}", f"{solver_gib:>4.1f} GiB"] + [
		f"{dict[key]*m/25:>8.2f}" if key in dict else "        "
		for key in [17, 18, 19, 20]
	] + [
		f"{dict["superflip"]*m:>9.2f}" if "superflip" in dict else s
	]
	sep = "|"
	f.write(sep + sep.join(cols) + sep + "\n")

def print_table(f, h48, vcube, ms, st):
	vcube = vcube or {}
	f.write("|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|\n")
	f.write("|:---------|:-------|-------:|-------:|-------:|-------:|--------:|\n")
	print_row(f, "vcube 212", sizes_vcube[212], vcube.get(212), ms, not st)
	print_row(f, "H48 h11", sizes_h48[11], h48[11], ms, False)
	print_row(f, "vcube 404", sizes_vcube[404], vcube.get(404), ms, not st)
	print_row(f, "H48 h10", sizes_h48[10], h48[10], ms, False)
	print_row(f, "vcube 308", sizes_vcube[308], vcube.get(308), ms, not st)
	print_row(f, "H48 h9", sizes_h48[9], h48[9], ms, False)
	print_row(f, "vcube 208", sizes_vcube[208], vcube.get(208), ms, not st)
	print_row(f, "H48 h8", sizes_h48[8], h48[8], ms, False)
	print_row(f, "H48 h7", sizes_h48[7], h48[7], ms, False)
	print_row(f, "vcube 112", sizes_vcube[112], vcube.get(112), ms, not st)
	print_row(f, "H48 h6", sizes_h48[6], h48[6], ms, False)

def print_factor_table(f, slow, fast):
	ratio = {}
	for m in [6, 7, 8, 9, 10, 11]:
		ratio[m] = {}
		for k in slow[m]:
			ratio[m][k] = (slow[m][k] / fast[m][k]) * (25 if k != "superflip" else 1)
	f.write("|  Solver  |  Size  |17 moves|18 moves|19 moves|20 moves|Superflip|\n")
	f.write("|:---------|:-------|-------:|-------:|-------:|-------:|--------:|\n")
	print_row(f, "H48 h11", sizes_h48[11], ratio[11], False, False)
	print_row(f, "H48 h10", sizes_h48[10], ratio[10], False, False)
	print_row(f, "H48 h9", sizes_h48[9], ratio[9], False, False)
	print_row(f, "H48 h8", sizes_h48[8], ratio[8], False, False)
	print_row(f, "H48 h7", sizes_h48[7], ratio[7], False, False)
	print_row(f, "H48 h6", sizes_h48[6], ratio[6], False, False)

with open(benchmarks_single_thread, "w") as f:
	f.write(f"<!-- The following details block can be found in {benchmarks_single_thread} -->\n") 
	f.write("<details><summary>Results: Single solution, single thread</summary>\n")
	f.write("\n")
	f.write("Time per cube (in seconds, lower is better).\n")
	f.write("\n")
	print_table(f, results_h48.h48_single_thread, results_vcube.vcube_single_thread, False, True)
	f.write("\n")
	f.write("Time per cube adjusted for table size (in seconds \\* GiB, lower is better).\n")
	f.write("\n")
	print_table(f, results_h48.h48_single_thread, results_vcube.vcube_single_thread, True, True)
	f.write("\n")
	f.write(
		'<img src="img/17moves1thread.png">\n'
		'<img src="img/18moves1thread.png">\n'
		'<img src="img/19moves1thread.png">\n'
		'<img src="img/20moves1thread.png">\n'
	)
	f.write("</details>\n")

with open(benchmarks_4_threads, "w") as f:
	f.write(f"<!-- The following details block can be found in {benchmarks_4_threads} -->\n") 
	f.write("<details><summary>Results: Single solution, 4 threads</summary>\n")
	f.write("\n")
	f.write("Time per cube (in seconds, lower is better).\n")
	f.write("\n")
	print_table(f, results_h48.h48_4_threads, None, False, False)
	f.write("\n")
	f.write("Speed-up factor (higher is better).\n")
	f.write("\n")
	print_factor_table(f, results_h48.h48_single_thread, results_h48.h48_4_threads)
	f.write("\n")
	f.write('<img src="img/4threadsspeedupfactor.png">\n')
	f.write("\n")
	f.write("</details>\n")

with open(benchmarks_16_threads, "w") as f:
	f.write(f"<!-- The following details block can be found in {benchmarks_16_threads} -->\n") 
	f.write("<details><summary>Results: Single solution, 16 threads</summary>\n")
	f.write("\n")
	f.write("Time per cube (in seconds, lower is better).\n")
	f.write("\n")
	print_table(f, results_h48.h48_16_threads, None, False, False)
	f.write("\n")
	f.write("Speed-up factor (higher is better).\n")
	f.write("\n")
	print_factor_table(f, results_h48.h48_single_thread, results_h48.h48_16_threads)
	f.write("\n")
	f.write('<img src="img/16threadsspeedupfactor.png">\n')
	f.write("\n")
	f.write("</details>\n")

with open(benchmarks_all_solutions, "w") as f:
	f.write(f"<!-- The following details block can be found in {benchmarks_all_solutions} -->\n") 
	f.write("<details><summary>Results: All solutions, 16 threads</summary>\n")
	f.write("\n")
	f.write("Time per cube (in seconds, lower is better).\n")
	f.write("\n")
	print_table(f, results_h48.h48_all_solutions, None, False, False)
	f.write("\n")
	f.write("Time per cube adjusted for table size (in seconds \\* GiB, lower is better).\n")
	f.write("\n")
	print_table(f, results_h48.h48_all_solutions, None, True, False)
	f.write("\n")
	f.write("</details>\n")

# Plotting

def plot_comparison(title, hd, vd, key):
	d = 1 if key == "superflip" else 25
	h48x = [sizes_h48[m]/(2**30) for m in hd.keys() if key in hd[m]]
	vcubex = [sizes_vcube[m]/(2**30) for m in vd.keys() if key in vd[m]]
	h48y = [d[key] for _, d in hd.items() if key in d]
	vcubey = [d[key] for _, d in vd.items() if key in d]

	plt.clf()
	plt.title(title)
	plt.xlabel("Table size (GiB)")
	plt.ylabel("Time to solve (s / cube)")
	plt.plot(h48x, h48y, "o--", label = "H48")
	plt.plot(vcubex, vcubey, "o--", label = "vcube")
	plt.legend(loc = "right")
	filename = title.replace(" ", "").replace(",", "") + ".png"
	plt.savefig(benchmarks_img_dir / filename, dpi=300)
	#plt.show()

rh, rv = results_h48.h48_single_thread, results_vcube.vcube_single_thread
for m in [17, 18, 19, 20]:
	plot_comparison(f"{m} moves 1 thread", rh, rv, m)

def plot_multithread_scatter(title, slow, fast):
	plt.clf()
	plt.title(title)
	plt.xlabel("Moves")
	plt.ylabel("Speed-up factor")
	x = [17, 18, 19]
	plt.xticks(x)
	for h in [11, 10, 9, 8, 7, 6]:
		y = [slow[h][i] / fast[h][i] for i in x]
		plt.scatter(x, y, label=f"H48 h{h}")
		plt.legend(loc = "right")
		filename = title.replace(" ", "").replace(",", "") + ".png"
		plt.savefig(benchmarks_img_dir / filename, dpi=300)
	#plt.show()

plot_multithread_scatter("4 threads speedup factor", results_h48.h48_single_thread, results_h48.h48_4_threads)
plot_multithread_scatter("16 threads speedup factor", results_h48.h48_single_thread, results_h48.h48_16_threads)
