cmake_minimum_required(VERSION 3.7)

project(gtbasic)

set(CMAKE_MODULE_PATH ${CMAKE_MODULE_PATH})

add_definitions(-DSTAND_ALONE)

set(headers ../src/memory.h ../src/loader.h ../src/cpu.h ../src/assembler.h ../src/compiler.h ../src/operators.h ../src/functions.h ../src/keywords.h ../src/load.h ../src/pragmas.h ../src/optimiser.h ../src/validater.h ../src/linker.h)
set(sources ../src/memory.cpp ../src/loader.cpp ../src/cpu.cpp ../src/image.cpp ../src/expression.cpp ../src/assembler.cpp ../src/compiler.cpp ../src/operators.cpp ../src/functions.cpp ../src/keywords.cpp ../src/load.cpp ../src/midi.cpp ../src/pragmas.cpp ../src/optimiser.cpp ../src/validater.cpp ../src/linker.cpp gtbasic.cpp)

if(MSVC)
    add_compile_options(/W4)
    add_definitions(-D_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra -pedantic)
endif()

add_executable(gtbasic ${headers} ${sources})

if(MSVC)
    set_target_properties(gtbasic PROPERTIES RUNTIME_OUTPUT_DIRECTORY_RELEASE ..)
endif()

target_link_libraries(gtbasic)
