#pragma once
#include <stddef.h>
typedef struct CWEngine CWEngine;
CWEngine *cw_create(void);
CWEngine *cw_create_scene(void);
void cw_destroy(CWEngine *engine);
char *cw_eval(CWEngine *engine, const char *source, int *failed);
void cw_free(char *value);
