static void (*js_log)(const char *) = nullptr;

void log(std::string s)
{
	if (js_log != nullptr)
		js_log(s.c_str());
}

void log_wrapper(const char *cstr, void *data)
{
	log(cstr);
}

/*
To receive a function pointer for JS, we use an int parameter.
This will have to be changed to a 64-bit integer when we move to WASM64.
*/
void set_logger(int f)
{
	js_log = (void (*)(const char *))f;
	nissy::set_logger(log_wrapper, NULL);
}
