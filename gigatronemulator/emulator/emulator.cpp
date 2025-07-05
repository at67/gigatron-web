#include "emulator.h"

#include <cstdio>
#include <cstdint>
#include <cstring>
#include <chrono>
#include <thread>
#include <algorithm>


enum RomType {ROMERR=0x00, ROMv1=0x1c, ROMv2=0x20, ROMv3=0x28, ROMv4=0x38, ROMv5a=0x40, ROMv6=0x48, ROMv7=0x50, ROMvX0=0x80, ROMvX1=0x88, SDCARD=0xF0, DEVROM=0xF8};
enum RomTypeAddr {ROMADDRERR=0x0000, ROMADDRv1=0x009A, ROMADDRv2=0x0098, ROMADDRv3=0x0098, ROMADDRv4=0x007E, ROMADDRv5a=0x005E, ROMADDRv6=0x005F,
    ROMADDRv7=0x0000, ROMADDRvX0=0x0000, ROMADDRvX1=0x0000, SDCARDADDR=0x005E, DEVROMADDR=0x005E};

struct State
{
    uint16_t _PC;
    uint8_t _IR, _D, _AC, _X, _Y, _OUT;
    uint8_t _undef;
};


class Emulator
{
private:
    uint64_t _clock = 0;
    State _stateS, _stateT;

    uint8_t _romType = ROMERR;

    uint8_t _ROM[ROM_SIZE][2]={{0},{0}}; // ROM array [address][inst/data]
    uint8_t _RAM[RAM_SIZE]={0};			 // RAM array - always 64K

    uint8_t _IN=0xFF, _XOUT=0;
    int _vSync=0, _hSync=0;
    int _vgaX=0, _vgaY=VSYNC_START;

    bool _is64k=false;
    bool _vBlank = false;
    bool _initAudio=true;

    uint32_t _colours[COLOUR_PALETTE]={0};
    uint8_t _framebuffer[SCREEN_WIDTH*SCREEN_HEIGHT*4]={0}; // RGBA pixels

    uint8_t _waveTable[WAVE_TABLE_SIZE]={0};
    float _audioBuffer[AUDIO_BUFFER_SIZE]={0};
    int _audioWriteIndex=0;

    uint64_t _lastVCPUDispatch = 0;
    static const uint64_t WATCHDOG_TIMEOUT_CYCLES = CLOCK_FREQUENCY * 3;

public:
    Emulator();

    bool get64kMode() {return _is64k;}

    uint8_t getXOUT() {return _XOUT;}
    uint8_t getRomType() {return _romType;}
    int getVBlank() {bool vBlank = _vBlank; _vBlank = false; return vBlank;}

    uint8_t* getFramebuffer() {return _framebuffer;}

    float* getAudioBuffer() {return _audioBuffer;}
    int getAudioWriteIndex() {return _audioWriteIndex;}

    bool isWatchdogTriggered() {return _lastVCPUDispatch > 0  &&  (_clock - _lastVCPUDispatch) > WATCHDOG_TIMEOUT_CYCLES;}

    uint8_t getROM(uint16_t address, int page);

    uint8_t getRAM(uint16_t addr);
    void setRAM(uint16_t addr, uint8_t value);

    uint16_t getRAM16(uint16_t addr);
    void setRAM16(uint16_t addr, uint16_t value);

    void setInput(uint8_t inputValue);
    void set64kMode(bool enable);

    void saveWaveTable(void);
    void restoreWaveTable(void);

    void loadROM(const uint8_t* data);

    void cycle(const State& S, State& T);

    void loadRomType(void);

    void resetVTable(void);
    void resetAudio(void);
    void resetVcpu(void);
    void reset();

    void processPixel(const State& S, int vgaX, int vgaY);
    void processPixel();

    void watchdog(void);
    void process();

    void run(uint64_t cycles);
    void runToVBlank();

    void loadGT1(const uint8_t* data, int size);
};


Emulator::Emulator()
{
    memset(&_stateS, 0, sizeof(State));
    memset(&_stateT, 0, sizeof(State));

    memset(_ROM, 0, sizeof(_ROM));
    memset(_RAM, 0, sizeof(_RAM));

    memset(_framebuffer, 0, sizeof(_framebuffer));
    memset(_audioBuffer, 0, sizeof(_audioBuffer));
}

void Emulator::saveWaveTable(void)
{
    for(uint16_t i=0; i<WAVE_TABLE_SIZE; i++)
    {
        _waveTable[i] = getRAM(WAVE_TABLE_START + i);
    }
}

void Emulator::restoreWaveTable(void)
{
    for(uint16_t i=0; i<WAVE_TABLE_SIZE; i++)
    {
        setRAM(WAVE_TABLE_START + i, _waveTable[i]);
    }
}

void Emulator::loadROM(const uint8_t* data)
{
    _clock = 0;
    _initAudio = true;
    memcpy(_ROM, data, sizeof(_ROM));
    loadRomType();
}

uint8_t Emulator::getROM(uint16_t address, int page)
{
    return _ROM[address & (ROM_SIZE-1)][page & 0x01];
}

uint8_t Emulator::getRAM(uint16_t addr)
{
    uint16_t mask = _is64k ? 0xFFFF : 0x7FFF;
    return _RAM[addr & mask];
}

uint16_t Emulator::getRAM16(uint16_t addr)
{
    uint16_t mask = _is64k ? 0xFFFF : 0x7FFF;
    return (_RAM[(addr+1) & mask] <<8) | _RAM[addr & mask];
}

void Emulator::setRAM(uint16_t addr, uint8_t value)
{
    uint16_t mask = _is64k ? 0xFFFF : 0x7FFF;
    _RAM[addr & mask] = value;
}

void Emulator::setRAM16(uint16_t addr, uint16_t value)
{
    uint16_t mask = _is64k ? 0xFFFF : 0x7FFF;
    _RAM[addr & mask] = value & 0x00FF;
    _RAM[(addr+1) & mask] = (value >>8) & 0x00FF;
}

void Emulator::setInput(uint8_t inputValue)
{
    _IN = inputValue;
}

void Emulator::set64kMode(bool enable)
{
    _is64k = enable;
    printf("Memory model set to %s\n", enable ? "64K" : "32K");
}

void Emulator::loadRomType(void)
{
    _romType = ROMERR;

    // Directly read from hard coded addresses in ROM, because RAM can be corrupted in emulation mode and resets to
    // correct the corruption are not guaranteed, (unlike real hardware)
    if(getROM(ROMADDRv1, 1) == ROMv1)
    {
        _romType = ROMv1;
    }
    else if(getROM(ROMADDRv2, 1) == ROMv2)
    {
        _romType = ROMv2;
    }
    else if(getROM(ROMADDRv3, 1) == ROMv3)
    {
        _romType = ROMv3;
    }
    else if(getROM(ROMADDRv4, 1) == ROMv4)
    {
        _romType = ROMv4;
    }
    else if(getROM(ROMADDRv5a, 1) == ROMv5a)
    {
        _romType = ROMv5a;
    }
    else if(getROM(ROMADDRv6, 1) == ROMv6)
    {
        _romType = ROMv6;
    }
    else if(getROM(ROMADDRv7, 1) == ROMv7)
    {
        _romType = ROMv7;
    }
    else if(getROM(ROMADDRvX0, 1) == ROMvX0)
    {
        _romType = ROMvX0;
    }
    else if(getROM(ROMADDRvX1, 1) == ROMvX1)
    {
        _romType = ROMvX1;
    }
    else if(getROM(SDCARDADDR, 1) == SDCARD)
    {
        _romType = SDCARD;
    }
    else if(getROM(DEVROMADDR, 1) == DEVROM)
    {
        _romType = DEVROM;
    }

    printf("ROM type: %02x\n", _romType);
}

void Emulator::resetVTable(void)
{
    for(int i=0; i<DISPLAY_HEIGHT; i++)
    {
        setRAM(uint16_t(VIDEO_TABLE + i*2), uint8_t((VIDEO_RAM_START >>8) + i));
        setRAM(uint16_t(VIDEO_TABLE + i*2 + 1), 0x00);
    }
}

void Emulator::resetAudio(void)
{
    restoreWaveTable();

    // Reset channels
    for(uint16_t i=0; i<AUDIO_CHANNELS; i++)
    {
        setRAM(AUDIO_CH0_WAV_A + i*AUDIO_CHAN_START, 0x00); // ADD, (volume)
        setRAM(AUDIO_CH0_WAV_X + i*AUDIO_CHAN_START, 0x02); // waveform index and XOR index modulation, (noise)
        setRAM(AUDIO_CH0_KEY_L + i*AUDIO_CHAN_START, 0x00); // low frequency look up from ROM
        setRAM(AUDIO_CH0_KEY_H + i*AUDIO_CHAN_START, 0x00); // high frequency look up from ROM
        setRAM(AUDIO_CH0_OSC_L + i*AUDIO_CHAN_START, 0x00); // low internal oscillator
        setRAM(AUDIO_CH0_OSC_H + i*AUDIO_CHAN_START, 0x00); // high internal oscillator
    }

    setRAM(AUDIO_TICK_TIMER, 0);
}

void Emulator::resetVcpu(void)
{
    _stateS = {};

    switch(_romType)
    {
    case ROMv1: // fallthrough
    case ROMv2: // fallthrough
    case ROMv3: _stateS._PC = ROM_OLD_INTERPRETER; break;

    case ROMv4:  // fallthrough
    case ROMv5a: // fallthrough
    case DEVROM: // fallthrough
    case ROMv6:  // fallthrough
    case SDCARD: _stateS._PC = ROM_ACTIVE_INTERPRETER; break;

    case ROMv7:  _stateS._PC = ROM_ROMv7_INTERPRETER;  break;

    case ROMvX0: _stateS._PC = ROM_ROMvX0_INTERPRETER; break;

    case ROMvX1: _stateS._PC = ROM_ROMvX1_INTERPRETER; break;

    default: break;
    }

    _stateT = _stateS;

    // Reset vSP
    setRAM(VCPU_SP, 0);

    // Reset constants
    setRAM(ZERO_CONST_ADDRESS, 0x00);
    setRAM(ONE_CONST_ADDRESS, 0x01);

    // Reset VBlank and video top
    setRAM16(VBLANK_PROC, 0x0000);
    setRAM(VIDEO_TOP, 0x00);
}

void Emulator::reset()
{
    memset(&_stateS, 0, sizeof(State));
    memset(&_stateT, 0, sizeof(State));
    memset(_RAM, 0, sizeof(_RAM));
    memset(_framebuffer, 0, sizeof(_framebuffer));

    for(int i=0; i<COLOUR_PALETTE; i++)
    {
        uint8_t b = uint8_t(double((i & 0x03) >>0) / 3.0 * 255.0);
        uint8_t g = uint8_t(double((i & 0x0C) >>2) / 3.0 * 255.0);
        uint8_t r = uint8_t(double((i & 0x30) >>4) / 3.0 * 255.0);
        _colours[i] = 0xFF000000 | (r <<16) | (g <<8) | b;
    }

    _IN = 0xFF;
    _is64k = false;
    _audioWriteIndex = 0;

    _vgaX = 0, _vgaY = VSYNC_START;
    _hSync = 0, _vSync = 0;

    _lastVCPUDispatch = _clock;
}

void Emulator::cycle(const State& S, State& T)
{
    if(S._PC == 0x0309  ||  S._PC == 0x0e23) _lastVCPUDispatch = _clock;

    // New state is old state unless something changes
    T = S;

    // Instruction Fetch
    T._IR = _ROM[S._PC][ROM_INST];
    T._D  = _ROM[S._PC][ROM_DATA];

    // Adapted from https://github.com/kervinck/gigatron-rom/blob/master/Contrib/dhkolf/libgtemu/gtemu.c
    // Optimise for the statistically most common instructions
    switch(S._IR)
    {
    case 0x5D: // ora [Y,X++],OUT
    {
        uint16_t addr = MAKE_ADDR(S._Y, S._X);
        T._OUT = getRAM(addr) | S._AC;
        T._X++;
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0xC2: // st [D]
    {
        setRAM(S._D, S._AC);
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0x01: // ld [D]
    {
        T._AC = getRAM(S._D);
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0x00: // ld D
    {
        T._AC = S._D;
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0x80: // adda D
    {
        T._AC += S._D;
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0xFC: // bra D
    {
        T._PC = (S._PC & 0xFF00) | S._D;
        return;
    }
        break;

    case 0x0D: // ld [Y,X]
    {
        uint16_t addr = MAKE_ADDR(S._Y, S._X);
        T._AC = getRAM(addr);
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0xA0: // suba D
    {
        T._AC -= S._D;
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0xE8: // blt PC,D
    {
        T._PC = (S._AC & 0x80) ? (S._PC & 0xFF00) | S._D : S._PC + 1;
        return;
    }
        break;

    case 0x81: // adda [D]
    {
        T._AC += getRAM(S._D);
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0x89: // adda [Y,D]
    {
        uint16_t addr = MAKE_ADDR(S._Y, S._D);
        T._AC += getRAM(addr);
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0x12: // ld AC,X
    {
        T._X = S._AC;
        T._PC = S._PC + 1;
        return;
    }
        break;

    case 0x18: // ld D,OUT
    {
        T._OUT = S._D;
        T._PC = S._PC + 1;
        return;
    }
        break;

    default: break;
    }

    int ins = S._IR >> 5;       // Instruction
    int mod = (S._IR >> 2) & 7; // Addressing mode (or condition)
    int bus = S._IR & 3;        // Busmode
    int W = (ins == 6);         // Write instruction
    int J = (ins == 7);         // Jump instruction

    uint8_t lo=S._D, hi=0, *to=nullptr; // Mode Decoder
    int incX=0;
    if(!J)
    {
        switch(mod)
        {
#define E(p) (W ? 0 : p) // Disable *AC and *OUT loading during _RAM write
        case 0: to = E(&T._AC);                            break;
        case 1: to = E(&T._AC);  lo=S._X;                  break;
        case 2: to = E(&T._AC);           hi=S._Y;         break;
        case 3: to = E(&T._AC);  lo=S._X; hi=S._Y;         break;
        case 4: to =   &T._X;                              break;
        case 5: to =   &T._Y;                              break;
        case 6: to = E(&T._OUT);                           break;
        case 7: to = E(&T._OUT); lo=S._X; hi=S._Y; incX=1; break;
        default: break;
        }
    }

    uint16_t addr = (hi << 8) | lo;
    uint8_t B = S._undef; // Data Bus
    switch(bus)
    {
    case 0: B=S._D;                  break;
    case 1: if(!W) B = getRAM(addr); break;
    case 2: B=S._AC;                 break;
    case 3: B=_IN;                   break;
    default: break;
    }

    // Disable write to RAM for any instructions trying to both read and write RAM, including CTRL
    if(W && bus != 1) setRAM(addr, B); // Random Access Memory
    uint8_t ALU = 0; // Arithmetic and Logic Unit
    switch(ins)
    {
    case 0: ALU =         B; break; // LD
    case 1: ALU = S._AC & B; break; // ANDA
    case 2: ALU = S._AC | B; break; // ORA
    case 3: ALU = S._AC ^ B; break; // XORA
    case 4: ALU = S._AC + B; break; // ADDA
    case 5: ALU = S._AC - B; break; // SUBA
    case 6: ALU = S._AC;     break; // ST
    case 7: ALU = -S._AC;    break; // Bcc/JMP
    default: break;
    }

    if(to) *to = ALU; // Load value into register
    if(incX) T._X = S._X + 1; // Increment _X
    T._PC = S._PC + 1; // Next instruction

    if(J)
    {
        if(mod != 0) // Conditional branch within page
        {
            int cond = (S._AC>>7) + 2*(S._AC==0);
            if(mod & (1 << cond)) // 74153
            {
                T._PC = (S._PC & 0xff00) | B;
            }
        }
        else
        {
            T._PC = (S._Y << 8) | B; // Unconditional far jump
        }
    }
}

void Emulator::processPixel(const State& S, int vgaX, int vgaY)
{
    uint32_t colour = _colours[S._OUT & (COLOUR_PALETTE - 1)];
    uint32_t address = (vgaX % DISPLAY_WIDTH)*4*4 + (vgaY % SCREEN_HEIGHT)*SCREEN_WIDTH*4;

    uint32_t* framebuffer = reinterpret_cast<uint32_t*>(&_framebuffer[address]);
    framebuffer[0] = colour;
    framebuffer[1] = colour;
    framebuffer[2] = colour;
    framebuffer[3] = colour;
}

void Emulator::processPixel()
{
    if(_vgaX++ < HLINE_END)
    {
        if(_vgaY >= 0  &&  _vgaY < SCREEN_HEIGHT)
        {
            if(_vgaX >= HPIXELS_START  &&  _vgaX < HPIXELS_END)
            {
                processPixel(_stateS, _vgaX-HPIXELS_START, _vgaY);
            }
        }
    }
}

void Emulator::watchdog(void)
{
    if(isWatchdogTriggered())
    {
        printf("Watchdog triggered - performing reset\n");
        reset();
        return; // Exit the run loop after reset
    }
}

void Emulator::process()
{
    watchdog();

    cycle(_stateS, _stateT);
    _hSync = (_stateT._OUT & 0x40) - (_stateS._OUT & 0x40);
    _vSync = (_stateT._OUT & 0x80) - (_stateS._OUT & 0x80);

    processPixel();

    // XOUT sampling on hsync rising edge
    if(_hSync > 0)
    {
        _vgaX = 0;

        _XOUT = _stateT._AC;

        // Get valid XOUT on every 4th scanline
        if((_vgaY & 3) == 3)
        {
            // Input
            float input = float(_XOUT) / 128.0f - 1.0f;

            // Derivative, (to remove inherit Gigatron DC offset)
            static float lastInput = 0.0f;
            float derivative = input - lastInput;
            lastInput = input;

            // Integrate, (to restore low frequencies)
            static float integrator = 0.0f;
            integrator = integrator*0.9f + derivative;

            // Output, x2 to get sample rate over 8000Hz for some browsers
            _audioBuffer[_audioWriteIndex++ % AUDIO_BUFFER_SIZE] = integrator;
            _audioBuffer[_audioWriteIndex++ % AUDIO_BUFFER_SIZE] = integrator;
        }
        _vgaY++;
    }

    _stateS = _stateT;
    _clock++;

    // Wait until wavetable has been initialised in RAM, theoretically this is
    // firmware dependent, but we are waiting a LONG time; so all good
    if(_initAudio  &&  _clock > AUDIO_INITIALISED)
    {
        _initAudio = false;
        saveWaveTable();
    }
}

void Emulator::run(uint64_t cycles)
{
    for(uint64_t c=0; c<cycles; c++)
    {
        process();
        if(_vSync < 0)
        {
            _vBlank = true;
            _vgaY = VSYNC_START;

            // Skip first short vBlank, Gigatron is guaranteed to produce AUDIO_PER_FRAME samples in one frame
            if(_audioWriteIndex  &&  _audioWriteIndex % AUDIO_PER_FRAME !=0) _audioWriteIndex = 0;
        }
    }
}

void Emulator::runToVBlank()
{
    while(true)
    {
        process();
        if(_vSync < 0)
        {
            _vBlank = true;
            _vgaY = VSYNC_START;

            // Skip first short vBlank, Gigatron is guaranteed to produce AUDIO_PER_FRAME samples in one frame
            if(_audioWriteIndex  &&  _audioWriteIndex % AUDIO_PER_FRAME !=0) _audioWriteIndex = 0;
            break;
        }
    }
}

void Emulator::loadGT1(const uint8_t* data, int size)
{
    if(size < 3)
    {
        printf("Error: GT1 file too small (%d bytes)\n", size);
        return;
    }

    resetAudio();
    resetVTable();
    resetVcpu();

    int pos = 0;
    int segmentCount = 0;

    // Parse segments
    while(pos + 2 < size)
    {
        // Need at least 3 bytes for header
        uint8_t hiAddr = data[pos];
        uint8_t loAddr = data[pos + 1];
        uint8_t segSize = data[pos + 2];

        // Check for terminator: first byte is 0 AND we're at the last 3 bytes
        if(data[pos] == 0x00 && pos + 2 == size - 1)
        {
            // Terminator interprets header differently to segment
            hiAddr = data[pos + 1];
            loAddr = data[pos + 2];
            uint16_t startAddr = (hiAddr << 8) | loAddr;  // Big-endian from file

            // Check exec address hi byte for 64k requirement
            if(hiAddr >= 0x80) set64kMode(true);

            // Set vPC and vLR in little-endian format (with -2 adjustment for low byte)
            setRAM(VCPU_VPC + 0, (startAddr - 2) & 0xFF);  // vPC low
            setRAM(VCPU_VPC + 1, (startAddr >> 8) & 0xFF); // vPC high
            setRAM(VCPU_VLR + 0, (startAddr - 2) & 0xFF);  // vLR low
            setRAM(VCPU_VLR + 1, (startAddr >> 8) & 0xFF); // vLR high

            return;
        }

        // Check segment address hi byte for 64k requirement
        if(hiAddr >= 0x80) set64kMode(true);

        // This is a regular segment, move past header
        pos += 3;

        // Segment size of 0 means 256 bytes
        int actualSize = (segSize == 0) ? 256 : segSize;

        if(pos + actualSize > size)
        {
            printf("Error: Not enough data - need %d bytes, have %d\n", pos + actualSize, size);
            return;
        }

        // Calculate 16-bit address
        uint16_t address = (hiAddr << 8) | loAddr;

        // Load segment into RAM
        for(int i = 0; i < actualSize; i++)
        {
            setRAM(address + i, data[pos + i]);
        }

        pos += actualSize;
        segmentCount++;
    }

    printf("Error: Reached end of file without finding terminator\n");
}


// Export functions for WASM
extern "C"
{
Emulator* emulator_create()
{
    return new Emulator();
}

void emulator_destroy(Emulator* emu)
{
    delete emu;
}

void emulator_load_rom(Emulator* emu, uint8_t* data)
{
    emu->loadROM(data);
}

void emulator_reset(Emulator* emu)
{
    emu->reset();
}

void emulator_run(Emulator* emu, int cycles)
{
    emu->run(cycles);
}

uint8_t* emulator_get_framebuffer(Emulator* emu)
{
    return emu->getFramebuffer();
}

void emulator_run_to_vblank(Emulator* emu)
{
    emu->runToVBlank();
}

float* emulator_get_audio_buffer(Emulator* emu)
{
    return emu->getAudioBuffer();
}

int emulator_get_audio_write_index(Emulator* emu)
{
    return emu->getAudioWriteIndex();
}

void emulator_set_input(Emulator* emu, uint8_t inputValue)
{
    emu->setInput(inputValue);
}

void emulator_load_gt1(Emulator* emu, uint8_t* data, int size)
{
    emu->loadGT1(data, size);
}

bool emulator_get_64k_mode(Emulator* emu)
{
    return emu->get64kMode();
}

void emulator_set_64k_mode(Emulator* emu, bool enable)
{
    emu->set64kMode(enable);
}

void emulator_wait_microseconds(int microseconds)
{
    if(microseconds > 0)
    {
        std::this_thread::sleep_for(std::chrono::microseconds(microseconds));
    }
}

uint8_t emulator_get_xout(Emulator* emu)
{
    return emu->getXOUT();
}

uint8_t emulator_get_rom_type(Emulator* emu)
{
    return emu->getRomType();
}

int emulator_get_vblank(Emulator* emu)
{
    return emu->getVBlank();
}

void emulator_set_ram(Emulator* emu, uint16_t addr, uint8_t value)
{
    emu->setRAM(addr, value);
}
}
