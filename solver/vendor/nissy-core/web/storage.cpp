#include "storage.h"

#include "emscripten.h"
#include <filesystem>
#include <fstream>

EM_JS(int, inbrowser, (), { return typeof window !== 'undefined'; });
EM_JS(int, inworker, (), { return typeof WorkerGlobalScope !== 'undefined' &&
    self instanceof WorkerGlobalScope; });

std::string getprefix() {
	return inbrowser() || inworker() ? "/tables/" : "./tables/";
}

EM_ASYNC_JS(int, loadfs, (), {
	const inBrowser = typeof window !== 'undefined';
	const inWorker = typeof WorkerGlobalScope !== 'undefined' &&
	    self instanceof WorkerGlobalScope;
	console.assert(inBrowser || inWorker, "Non-browsers not supported");

	const dir = '/tables';

	if (!FS.analyzePath(dir).exists)
		FS.mkdir(dir);

	if (FS.analyzePath(dir).object.mount.mountpoint != dir) {
		FS.mount(IDBFS, { autoPersist: true }, dir);

		await new Promise((resolve, reject) => {
			FS.syncfs(true, function (err) {
				if (err)
					reject(err);
				else
					resolve(true);
			});
		});
	}
});

EM_ASYNC_JS(int, download_and_store, (const char *key, const char *url), {
	const inBrowser = typeof window !== 'undefined';
	const inWorker = typeof WorkerGlobalScope !== 'undefined' &&
	    self instanceof WorkerGlobalScope;
	console.assert(inBrowser || inWorker, "Non-browsers not supported");

	// This is a workaround related to usign WASM64
	// JavaScript's UTF8ToString expects a pointer argument, which for JS is
	// of type "number", but WASM64 is passing a BigInt. See also:
	// https://github.com/emscripten-core/emscripten/issues/21541
	// (but I could not make the suggested solution work in this case).
	// TODO: check if there is a better workaround.
	const non64_url = Number(url);
	const non64_key = Number(key);
	url = UTF8ToString(non64_url);
	key = UTF8ToString(non64_key);
	let response = await fetch(url);
	if (!response.ok) {
		console.log("Error downloading data for " + key);
		console.log("" + response.status + ": " + response.statusText);
		return 0;
	}

	let data = await response.bytes();
	var stream = FS.open("/tables/" + key, "w+");
	FS.write(stream, data, 0, data.length, 0);
	FS.close(stream);
	console.log("Data for " + key + " stored (" + data.length + " bytes)");
	return 1;
});

bool storage::read(std::string key, size_t data_size, char *data)
{
	loadfs();

	std::filesystem::path path(getprefix() + key);
	if (!std::filesystem::exists(path))
		return false;

	std::ifstream ifs(path, std::ios::binary);
	ifs.read(data, data_size);
	ifs.close();

	return !ifs.fail();
}

bool storage::write(std::string key, size_t data_size, const char *data)
{
	loadfs();

	std::filesystem::path path(getprefix() + key);

	std::ofstream ofs(path, std::ios::binary);
	ofs.write(data, data_size);
	ofs.close();

	return !ofs.fail();
}

int storage::download(std::string key, std::string url)
{
	loadfs();
	return download_and_store(key.c_str(), url.c_str());
}
