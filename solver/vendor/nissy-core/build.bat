@echo off

SET DEBUG=0
if "%1"=="/d" (
    SET DEBUG=1
    shift
)
if "%1"=="test" (SET DEBUG=1)

:: Detect architecture, or use user-specified one
if "%ARCH%"=="" goto :detect_arch
if "%ARCH%"=="PORTABLE" goto :arch_done
if "%ARCH%"=="AVX2" goto :arch_done
if "%ARCH%"=="NEON" goto :arch_done

echo Unsupported architecture '%ARCH%'
exit /b 1

:detect_arch
    if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
        SET ARCH=AVX2
    ) else if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
        SET ARCH=NEON
    ) else (
        SET ARCH=PORTABLE
    )
:arch_done

:: Default value for maximum number of threads
SET THREADS=16

:: Detect Python libraries path
for /f "delims=" %%i in ('python -c "import sys; print(sys.base_prefix)"') do set PYPATH=%%i
SET PYINCLUDE=%PYPATH%\include
SET PYLIBS=%PYPATH%\libs

:: Select compiler from possibly user-set %CC% variable
:: Currently we only support clang and MSVC
if "%CC%"=="" goto :set_msvc
if /I "%CC%"=="cl" goto :set_msvc
if /I "%CC%"=="msvc" goto :set_msvc
if /I "%CC%"=="clang" goto :set_clang

echo Unsupported compiler '%CC%'
exit /b 1

:set_msvc
    SET CC=cl
    SET CXX=cl

    SET DFLAGS=/Zi /DDEBUG
    SET WARNINGS=/W4 /wd4100 /wd4324 /wd4505 /wd4996
    SET VARIABLES=/DTHREADS=%THREADS% /D%ARCH%
    SET OFLAGS=/O2

    if %DEBUG%==1 (SET ODFLAGS=%DFLAGS%) else (SET ODFLAGS=%OFLAGS%)
    if "%ARCH%"=="AVX2" (SET ARCHOPTS=/arch:AVX2) else (SET ARCHOPTS=)

    SET CFLAGS=/std:c11 /experimental:c11atomics /nologo %ARCHOPTS% %WARNINGS% %VARIABLES%
    SET LFLAGS=/F 16777216

    SET CC_NISSY=%CC% %CFLAGS% %ODFLAGS% /c src\nissy.c
    SET CC_SHELL=%CC% %CFLAGS% %ODFALGS% %LFLAGS% nissy.obj shell\shell.c /Fe:run.exe
    SET CC_PYTHON=%CC% %CFLAGS% %LFLAGS% /I"%PYINCLUDE%" /LD /Fe:python\nissy.pyd python\nissy_module.c nissy.obj /link /LIBPATH:"%PYLIBS%" python3.lib
    SET CC_TEST=%CC% %CFLAGS% %ODFLAGS% %LFLAGS% /Fe:runtest.exe nissy.obj
    SET CC_TOOL=%CC% %CFLAGS% %ODFLAGS% %LFLAGS% /Fe:runtool.exe nissy.obj
    SET CC_CXX=%CXX% /EHsc /nologo %ARCHOPTS% %ODFLAGS% %LFLAGS% /std:c++20 /Fe:runcpp.exe nissy_c.obj cpp\nissy.cpp
goto :compiler_done

:set_clang
    SET CC=clang
    SET CXX=clang++

    SET DFLAGS=-g3 -DDEBUG
    SET WARNINGS=-Wall -Wextra -Wno-unused-function -Wno-unused-parameter -Wno-deprecated-declarations
    SET VARIABLES=-DTHREADS=%THREADS% -D%ARCH%
    SET OFLAGS=-O3

    if %DEBUG%==1 (SET ODFLAGS=%DFLAGS%) else (SET ODFLAGS=%OFLAGS%)
    if "%ARCH%"=="AVX2" (SET ARCHOPTS=-mavx2) else (SET ARCHOPTS=)

    SET CFLAGS=-std=c11 %ARCHOPTS% %WARNINGS% %VARIABLES%
    SET LFLAGS=-Wl,-stack:16777216

    SET CC_NISSY=%CC% %CFLAGS% %ODFLAGS% -c src\nissy.c -o nissy.obj
    SET CC_SHELL=%CC% %CFLAGS% %ODFLAGS% %LFLAGS% nissy.obj shell\shell.c -o run.exe
    SET CC_PYTHON=%CC% %CFLAGS% %LFLAGS% -I%PYINCLUDE% -L%PYLIBS% -shared -lpython3 python\nissy_module.c nissy.obj -o python\nissy.pyd
    SET CC_TEST=%CC% %CFLAGS% %ODFLAGS% %LFLAGS% -o runtest.exe nissy.obj
    SET CC_TOOL=%CC% %CFLAGS% %ODFLAGS% %LFLAGS% -o runtool.exe nissy.obj
    SET CC_CXX=%CXX% %ARCHOPTS% %ODFLAGS% %LFLAGS% -std=c++20 -o runcpp.exe nissy_c.obj cpp\nissy.cpp
:compiler_done

:: Select compilation target from command line argument
SET TARGET=%1
if not defined TARGET SET TARGET=nissy
SET EXPR=%2
for %%a in (nissy python shell test config help clean tool cpp solvetest) do (
    if %TARGET%==%%a (
        call:build_%TARGET% %*
        exit /b
    )
)
echo Target '%TARGET%' unavailable, run 'build help' for info
exit /b 1

:build_help
    echo *** Warning: support for building nissy on Windows is incomplete ***
    echo.
    echo Build system for nissy. Usage:
    echo.
    echo build [/d] [TARGET]
    echo.
    echo Possible values for TARGET (defaults to 'nissy' if unspecified):
    echo.
    echo nissy       Build the nissy.obj object file.
    echo python      Build the Python module for nissy.
    echo             NOTE: Python development headers must be installed in
    echo                   order to build the Python module. The path of these
    echo                   headers is hardcoded in the PYPATH varible in
    echo                   build.bat. You may need to edit this file.
    echo shell       Build the basic nissy shell (./run).
    echo cpp FILE    Build and run the given C++ FILE.
    echo test [EXPR] Build and run unit tests. If EXPR is provided, only the
    echo             tests whose name contains EXPR are run. The /d option is
    echo             is always implied.
    echo tool EXPR   Run the 'tool' matching the given EXPR.
    echo solvetest   Build nissy and run a collection of tools for testing"
    echo             various solvers.
    echo help        Show this help message.
    echo config      Show build configuration and exit.
    echo clean       Remove all build files.
    echo.
    echo The /d option activates debug mode (slower, used for testing).
    echo Tests are automatically built in debug mode even without /d.
    echo For more on build configurations, see the comments in build.bat.
exit /b

:build_config
    echo Compiler: %CC%
    echo Architecture: %ARCH%
    echo Max threads: %THREADS%
    echo Optimization flags: %OFLAGS%
    echo Debug flags: %DFLAGS%
exit /b

:build_nissy
    @echo on
    %CC_NISSY% || exit /b 1
    @echo off
exit /b

:build_shell
    call:build_nissy || exit /b 1
    @echo on
    %CC_SHELL% || exit /b 1
    @echo off
exit /b

:build_python
    call:build_nissy || exit /b 1
    @echo on
    %CC_PYTHON% || exit /b 1
    @echo off
exit /b

:build_test
    call:build_nissy || exit /b 1
    if not defined EXPR (
        SET WILDCARD=*
    ) else (
        SET WILDCARD=*%EXPR%*
    )
    for /d %%d in ( test\%WILDCARD% ) do (
        if exist %%d\* (
            call:build_single_test %%d || exit /b 1
        )
    )
exit /b

:build_clean
    @echo on
    del *.o *.obj *.so *.a *.ilk *.pdb *.exe
    @echo off
exit /b

:build_tool
    if not defined EXPR (
        @echo Please provide a valid EXPR to select a tool
        exit /b 1
    )
    
    set toolname=
    for /d %%d in ( tools\*%EXPR%* ) do (
        set toolname=%%~nd
    )

    if [%toolname%]==[] (
        @echo Expression '%EXPR%' does not match any tool
        exit /b 1
    )
    
    call:build_nissy || exit /b 1
    call:build_single_tool %*
exit /b

:build_cpp
    if not defined EXPR (
        @echo Please provide a valid C++ source file.
        exit /b 1
    )
    if not exist %EXPR% (
        @echo File %EXPR% does not exist.
        exit /b 1
    )
    call:build_nissy || exit /b 1
    copy nissy.obj nissy_c.obj
    @echo on
    %CC_CXX% %EXPR% || exit /b 1
    del nissy.obj
    copy nissy_c.obj nissy.obj
    runcpp
    @echo off
exit /b

:build_solvetest
    call:build_nissy || exit /b 1
    for /d %%d in ( tools\*solvetest* ) do (
        set toolname=%%~nd
        call:build_single_tool
    )
exit /b

:build_single_test
    %CC_TEST% %1\*.c || exit /b 1
    set error=0
    for %%c in ( %1\*.in ) do (
        if %error%==1 exit /b 1
        @echo | set /p v="%1\%%~nc: "
        runtest < %%c > test\last.out 2> test\last.err
        FC /a %1\%%~nc.out test\last.out > test\last.fc.out
        if ERRORLEVEL 1 (
            @echo Test failed! Different output:
            type test\last.fc.out
            @echo stderr:
            type test\last.err
            goto :error
        ) else (
            @echo ok
        )
    )
    if %error%==1 exit /b 1
    del runtest.*
exit /b

:build_single_tool
    @echo on
    %CC_TOOL% tools\%toolname%\*.c || exit /b 1
    @echo off
    runtool %3 %4 %5 %6 %7 %8 %9 || exit /b 1
    @echo.
    @echo (On Windows, the output of a tool is not saved to any file.)
exit /b

:error
    exit /b 1