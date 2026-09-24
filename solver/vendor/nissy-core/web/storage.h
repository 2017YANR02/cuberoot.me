#include <string>
#include <fstream>
#include <emscripten/fetch.h>

namespace storage {
	bool read(std::string key, size_t data_size, char *data);
	bool write(std::string key, size_t data_size, const char *data);
	int download(std::string key, std::string url);
}
