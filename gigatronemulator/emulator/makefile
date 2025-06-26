.PHONY: build clean rebuild

SOURCES = emulator.cpp

OUTPUT = emulator

EXPORTS = _emulator_create \
	  _emulator_destroy \
	  _emulator_load_rom \
	  _emulator_run \
	  _emulator_get_framebuffer \
	  _emulator_run_to_vblank \
	  _emulator_get_audio_buffer \
	  _emulator_get_audio_write_index \
	  _emulator_reset \
	  _emulator_set_input \
	  _emulator_load_gt1 \
	  _emulator_set_64k_mode \
	  _emulator_get_64k_mode \
	  _emulator_wait_microseconds \
	  _emulator_get_xout \
	  _emulator_get_rom_type \
	  _emulator_set_ram \
	  _malloc \
	  _free

RUNTIME_METHODS = ccall cwrap HEAPU8 HEAPF32

build:
	emcc $(SOURCES) -o $(OUTPUT).js \
		-s EXPORTED_FUNCTIONS="[$(shell echo '$(EXPORTS)' | sed 's/ /,/g' | sed "s/[^,]*/'&'/g")]" \
		-s EXPORTED_RUNTIME_METHODS="[$(shell echo '$(RUNTIME_METHODS)' | sed 's/ /,/g' | sed "s/[^,]*/'&'/g")]"

clean:
	rm -f $(OUTPUT).js $(OUTPUT).wasm

rebuild: clean build
