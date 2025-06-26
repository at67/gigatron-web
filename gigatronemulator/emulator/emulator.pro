TARGET = emulator
TEMPLATE = app

SOURCES += $$files(./*.cpp)  \
	   $$files(./*.js)   \
	   $$files(*.html)   \
	   $$files(*.css)
    
HEADERS += $$files(*.h)

OTHER_FILES += makefile
