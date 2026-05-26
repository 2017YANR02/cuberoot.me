var is_busy = false;
const solvers = {
	"cube48opt1": ["./cube48opt1.mjs", "30.4M"],
	"cube48opt2": ["./cube48opt2.mjs", "121M"],
	"cube48opt3": ["./cube48opt3.mjs", "243M"],
	"cube48opt4": ["./cube48opt4.mjs", "486M"],
	"cube48opt5": ["./cube48opt5.mjs", "972M"],
	"cube48opt6": ["./cube48opt6.mjs", "1945M"],
	"cube48opt7": ["./cube48opt7.mjs", "3891M"],
	"cube48opt8": ["./cube48opt8.mjs", "7782M"],
	"cube48opt9": ["./cube48opt9.mjs", "15565M"],
};
var cur_solver = null;
var cur_solver_name = null;

function solver_check(e, check_init = true) {
	if (!cur_solver) {
		self.postMessage(Object.assign({}, e, { code: 1 }));
		return true;
	}
	if (check_init && cur_solver.init(-1, 1) == 1) {
		self.postMessage(Object.assign({}, e, { code: 2 }));
		return true;
	}
	return false;
}

function generate_table(e) {
	if (solver_check(e, false)) {
		return;
	}
	cur_solver.init(self.navigator.hardwareConcurrency, navigator.hardwareConcurrency);
	self.postMessage(Object.assign({}, e, { code: 0 }));
}

function download_table(e) {
	if (solver_check(e, true)) {
		return;
	}
	const table_base = cur_solver._get_mem_ptr();
	const table_size = Number(cur_solver.get_table_size());
	const data = cur_solver.HEAPU8.slice(table_base, table_base + table_size);
	self.postMessage(Object.assign({}, e, { code: 0, data: data.buffer }), [data.buffer]);
}

function download_table_fileapi(e) {
	if (solver_check(e, true)) {
		return;
	}
	e.data.createWritable().then(writable => {
		let proc = Promise.resolve();
		const table_base = cur_solver._get_mem_ptr();
		const table_size = Number(cur_solver.get_table_size());
		const chunkSize = 64 * 1024 * 1024;
		for (let offset = 0; offset < table_size; offset += chunkSize) {
			proc = proc.then(function(start, end) {
				postMessage({ code: -2, data: start / table_size });
				return writable.write(cur_solver.HEAPU8.slice(start, end));
			}.bind(null, table_base + offset, table_base + Math.min(offset + chunkSize, table_size)));
		}
		return proc.then(() => {
			postMessage({ code: -2, data: 1 });
			writable.close();
		}).then(() => {
			self.postMessage(Object.assign({}, e, { code: 0 }));
		});
	}).catch(e => {
		self.postMessage(Object.assign({}, e, { code: 3 }));
	});
}

function start_solve(e) {
	if (solver_check(e, true)) {
		return;
	}
	cur_solver.solve_scramble(e.scramble, e.n_threads, e.n_group, e.debug);
	self.postMessage(Object.assign({}, e, { code: 0 }));
}

function change_solver(e) {
	const solver_name = e.data;
	const solver = solvers[solver_name];
	if (!solver) {
		self.postMessage(Object.assign({}, e, { code: 1 }));
		return;
	}
	import(solver[0]).then(createModule => {
		return createModule.default({
			print: function(text) {
				self.postMessage({ code: -1, data: text });
			}
		});
	}).then(solver => {
		cur_solver = solver;
		cur_solver_name = solver_name;
		self.postMessage(Object.assign({}, e, {
			code: cur_solver.init(-1, 1) == 0 ? 0 : 2,
			solver: cur_solver_name,
			table_name: cur_solver.get_table_name(),
			table_size: cur_solver.get_table_size()
		}));
	});
}

// assume e.data is Uint8Array(e.target.result)
function upload_table(e) {
	if (solver_check(e, false)) {
		return;
	}
	const file = e.data;
	if (file.size == Number(cur_solver.get_table_size())) {
		const table_base = Number(cur_solver._get_mem_ptr());
		const reader = new FileReaderSync();
		const chunkSize = 64 * 1024 * 1024;
		for (let start = 0; start < file.size; start += chunkSize) {
			const slice = file.slice(start, start + chunkSize);
			const chunkData = reader.readAsArrayBuffer(slice);
			const data = new Uint8Array(chunkData);
			cur_solver.HEAPU8.set(data, table_base + start);
			postMessage({ code: -2, data: (start + data.length) / file.size });
		}
		if (cur_solver.init(0, navigator.hardwareConcurrency) == 1) {
			self.postMessage(Object.assign({}, e, { code: 2 }));
		}
		self.postMessage(Object.assign({}, e, { code: 0 }));
	} else {
		self.postMessage(Object.assign({}, e, { code: 3 }));
	}
}

self.onmessage = (e) => {
	e = e.data;
	if (e.cmd == 'select solver') {
		change_solver(e);
	} else if (e.cmd == 'start solve') {
		start_solve(e);
	} else if (e.cmd == 'generate table') {
		generate_table(e);
	} else if (e.cmd == 'download table') {
		download_table(e);
	} else if (e.cmd == 'download table fileapi') {
		download_table_fileapi(e);
	} else if (e.cmd == 'upload table') {
		upload_table(e);
	}
};

