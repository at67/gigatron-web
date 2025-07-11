#ifndef CONFIG_H
#define CONFIG_H


#define ROM_ROMv7_INTERPRETER  0x0029
#define ROM_ROMvX0_INTERPRETER 0x003a
#define ROM_ROMvX1_INTERPRETER 0x0029
#define ROM_ACTIVE_INTERPRETER 0x0047
#define ROM_OLD_INTERPRETER    0x004F

#define CLOCK_FREQUENCY  6250000.0
#define EMU_CYCLE_TIME	 16666.0

#define ROM_SIZE (1<<16)
#define RAM_SIZE (1<<16)

#define ROM_INST 0
#define ROM_DATA 1

#define HLINE_START     0
#define HLINE_END       200
#define HPIXELS_START   13
#define HPIXELS_END     173
#define VSYNC_START     -36
#define COLOUR_PALETTE  64
#define DISPLAY_WIDTH   160
#define DISPLAY_HEIGHT  120
#define SCREEN_WIDTH    640
#define SCREEN_HEIGHT   480
#define VIDEO_RAM_START 0x0800

#define WAVE_TABLE_SIZE	  256
#define WAVE_TABLE_START  0x0700

#define AUDIO_INITIALISED (CLOCK_FREQUENCY * 0.5)
#define AUDIO_CHANNELS    4
#define AUDIO_PER_FRAME	  260	// x2 here to get sample rate over 8000Hz for some browsers
#define AUDIO_SAMPLE_RATE (AUDIO_PER_FRAME*59.98)
#define AUDIO_BUFFER_SIZE (AUDIO_PER_FRAME*4)

#define ZERO_CONST_ADDRESS 0x0000
#define ONE_CONST_ADDRESS  0x0080

#define VIDEO_TABLE 0x0100
#define VBLANK_PROC 0x01F6
#define VIDEO_TOP   0x01F9

#define VCPU_VPC 0x0016
#define VCPU_VAC 0x0018
#define VCPU_VLR 0x001A
#define VCPU_SP  0x001C

#define AUDIO_CHAN_START 0x0100
#define AUDIO_TICK_TIMER 0x002C

#define AUDIO_CH0_WAV_A  0x01FA
#define AUDIO_CH0_WAV_X  0x01FB
#define AUDIO_CH0_KEY_L  0x01FC
#define AUDIO_CH0_KEY_H  0x01FD
#define AUDIO_CH0_OSC_L  0x01FE
#define AUDIO_CH0_OSC_H  0x01FF

#define AUDIO_CH1_WAV_A  0x02FA
#define AUDIO_CH1_WAV_X  0x02FB
#define AUDIO_CH1_KEY_L  0x02FC
#define AUDIO_CH1_KEY_H  0x02FD
#define AUDIO_CH1_OSC_L  0x02FE
#define AUDIO_CH1_OSC_H  0x02FF

#define AUDIO_CH2_WAV_A  0x03FA
#define AUDIO_CH2_WAV_X  0x03FB
#define AUDIO_CH2_KEY_L  0x03FC
#define AUDIO_CH2_KEY_H  0x03FD
#define AUDIO_CH2_OSC_L  0x03FE
#define AUDIO_CH2_OSC_H  0x03FF

#define AUDIO_CH3_WAV_A  0x04FA
#define AUDIO_CH3_WAV_X  0x04FB
#define AUDIO_CH3_KEY_L  0x04FC
#define AUDIO_CH3_KEY_H  0x04FD
#define AUDIO_CH3_OSC_L  0x04FE
#define AUDIO_CH3_OSC_H  0x04FF

#define LO_BYTE(a)  ((a) & 0x00FF)
#define HI_BYTE(a)  (((a) >>8) & 0x00FF)
#define BYTE_0(a)   ((a) & 0x000000FF)
#define BYTE_1(a)   (((a) >>8) & 0x000000FF)
#define BYTE_2(a)   (((a) >>16) & 0x000000FF)
#define BYTE_3(a)   (((a) >>24) & 0x000000FF)
#define HI_MASK(a)  ((a) & 0xFF00)

#define MAKE_ADDR(a, b) ((LO_BYTE(a) <<8) | LO_BYTE(b))

#endif
