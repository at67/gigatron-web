let audioContext = null;
let audioWorkletNode = null;
let gainNode = null;
let currentVolume = 0.5;
let isMuted = false;
let wasAutoMuted = false;
let userMutedState = false;

const SAMPLE_BUFFER_SIZE = 260; // samples per Gigatron frame, (130 x2 to get the sample rate over 8000Hz for some browsers)
const SAMPLE_RATE = SAMPLE_BUFFER_SIZE*59.98;

// The audio clock paces the emulator, frames are emulated until the worklet holds this much audio
const AUDIO_TARGET_FILL = Math.round(SAMPLE_RATE*0.060);

// Wall time without the audio clock advancing before the emulator falls back to pacing by the wall clock
const AUDIO_STALL_TIME = 50;

// Fill accounting, samples sent to the worklet against the consumed count it reports back, extrapolated by the
// audio clock between reports; the epoch changes on every flush so reports from before a flush are ignored
let audioSamplesSent = 0;
let audioReportConsumed = 0;
let audioReportTime = 0;
let audioEpoch = 0;

let lastAudioClock = -1;
let lastAudioClockWall = 0;

// Reported by the worklet, (type audioStats in the console)
let audioStats = {underruns: 0, underrunSamples: 0, overflowSamples: 0};


// Runs on the audio thread, its source text is loaded through a Blob URL; it is never called on the main thread
function gigatronAudioWorklet()
{
    const RING_SIZE = 8192;       // samples, ~0.5 seconds
    const REPORT_INTERVAL = 4;    // render quanta, (128 samples each), between reports to the main thread
    const UNDERRUN_FADE = 0.999;  // per sample decay of the held value while starved

    class GigatronAudioProcessor extends AudioWorkletProcessor
    {
        constructor()
        {
            super();

            this.ring = new Float32Array(RING_SIZE);
            this.readIndex = 0;
            this.writeIndex = 0;
            this.consumed = 0;
            this.epoch = 0;
            this.held = 0.0;
            this.primed = false;
            this.starved = false;
            this.underruns = 0;
            this.underrunSamples = 0;
            this.overflowSamples = 0;
            this.quanta = 0;

            this.port.onmessage = (event) => this.onMessage(event.data);
        }

        onMessage(data)
        {
            if(data instanceof Float32Array)
            {
                for(let i=0; i<data.length; i++)
                {
                    if(this.writeIndex - this.readIndex >= RING_SIZE)
                    {
                        this.overflowSamples += data.length - i;
                        break;
                    }
                    this.ring[this.writeIndex++ % RING_SIZE] = data[i];
                }
            }
            else if(data.flush !== undefined)
            {
                // Drop anything queued, the held value fades out by itself
                this.readIndex = this.writeIndex;
                this.consumed = 0;
                this.epoch = data.flush;
                this.primed = false;
            }
        }

        process(inputs, outputs)
        {
            const output = outputs[0][0];
            for(let i=0; i<output.length; i++)
            {
                if(this.readIndex < this.writeIndex)
                {
                    this.held = this.ring[this.readIndex++ % RING_SIZE];
                    this.consumed++;
                    this.primed = true;
                    this.starved = false;
                }
                else
                {
                    // Starved, hold the last value and let it decay rather than dropping straight to zero; running
                    // dry before any audio has arrived since a flush is not counted as an underrun
                    if(this.primed)
                    {
                        if(!this.starved) this.underruns++;
                        this.underrunSamples++;
                        this.starved = true;
                    }
                    this.held *= UNDERRUN_FADE;
                    if(Math.abs(this.held) < 1e-6) this.held = 0.0;
                }
                output[i] = this.held;
            }

            if(++this.quanta % REPORT_INTERVAL === 0)
            {
                this.port.postMessage({epoch: this.epoch, consumed: this.consumed, time: currentTime,
                                       underruns: this.underruns, underrunSamples: this.underrunSamples, overflowSamples: this.overflowSamples});
            }

            return true;
        }
    }

    registerProcessor('gigatron-audio', GigatronAudioProcessor);
}


function handleVisibilityChange()
{
    if(document.hidden)
    {
        autoMute();
    }
    else
    {
        autoUnmute();
    }
}

function handleWindowFocus()
{
    autoUnmute();
}

function handleWindowBlur()
{
    autoMute();
}

function autoMute()
{
    if(!isMuted)
    {
        userMutedState = false;
        wasAutoMuted = true;
        toggleMute();
    }
}

function autoUnmute()
{
    if(isMuted && wasAutoMuted && !userMutedState)
    {
        wasAutoMuted = false;
        toggleMute();
    }
}

function decreaseVolume()
{
    currentVolume = Math.max(0, currentVolume - 0.1);
    updateGain();
    updateVolumeDisplay();
}

function increaseVolume()
{
    currentVolume = Math.min(1, currentVolume + 0.1);
    updateGain();
    updateVolumeDisplay();
}

function updateGain()
{
    if(gainNode)
    {
        // Short ramp rather than a step, so volume and mute changes don't click
        gainNode.gain.setTargetAtTime(isMuted ? 0.0 : currentVolume, audioContext.currentTime, 0.01);
    }
}

function toggleMute()
{
    isMuted = !isMuted;

    if(!wasAutoMuted) userMutedState = isMuted;

    const muteBtn = document.getElementById('mute-btn');
    if(muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔊';

    updateGain();
    updateVolumeDisplay();
}

function updateVolumeDisplay()
{
    const volumeIndicator = document.getElementById('volume-indicator');
    if(!volumeIndicator) return;

    const dots = volumeIndicator.querySelectorAll('.volume-dot');
    const activeLevel = Math.round(currentVolume * 10);

    dots.forEach((dot, index) =>
    {
        if(isMuted)
        {
            dot.classList.remove('active');
        }
        else
        {
            dot.classList.toggle('active', index < activeLevel);
        }
    });
}

function initAudio()
{
    // One context and worklet for the life of the page, later starts only flush
    if(audioContext) return;

    audioContext = new AudioContext({sampleRate: SAMPLE_RATE});

    gainNode = audioContext.createGain();
    gainNode.gain.value = isMuted ? 0.0 : currentVolume;
    gainNode.connect(audioContext.destination);

    // Until the worklet is running the emulator paces itself by the wall clock, without audio
    if(audioContext.audioWorklet)
    {
        const workletUrl = URL.createObjectURL(new Blob([`(${gigatronAudioWorklet.toString()})();`], {type: 'application/javascript'}));
        audioContext.audioWorklet.addModule(workletUrl).then(() =>
        {
            URL.revokeObjectURL(workletUrl);

            audioWorkletNode = new AudioWorkletNode(audioContext, 'gigatron-audio', {numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1]});
            audioWorkletNode.port.onmessage = (event) => onAudioReport(event.data);
            audioWorkletNode.connect(gainNode);
            resetAudio();
        }).catch((error) =>
        {
            console.error('Audio worklet failed to load:', error);
        });
    }
    else
    {
        console.error('AudioWorklet is not available, (it needs HTTPS), the emulator will run without audio');
    }

    // The autoplay policy keeps the context suspended until a user gesture
    document.addEventListener('pointerdown', resumeAudio);
    document.addEventListener('keydown', resumeAudio);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
}

function resumeAudio()
{
    if(audioContext  &&  audioContext.state !== 'running') audioContext.resume();
}

function onAudioReport(report)
{
    audioStats.underruns = report.underruns;
    audioStats.underrunSamples = report.underrunSamples;
    audioStats.overflowSamples = report.overflowSamples;

    // Ignore fill reports from before the last flush, or before the first frame was sent after it
    if(report.epoch === audioEpoch  &&  audioSamplesSent > 0)
    {
        audioReportConsumed = report.consumed;
        audioReportTime = report.time;
    }
}

// True when the worklet is running on an audio clock that is actually advancing
function isAudioClockRunning()
{
    if(!audioWorkletNode  ||  audioContext.state !== 'running') return false;

    const wallTime = performance.now();
    if(audioContext.currentTime !== lastAudioClock)
    {
        lastAudioClock = audioContext.currentTime;
        lastAudioClockWall = wallTime;
    }

    return wallTime - lastAudioClockWall <= AUDIO_STALL_TIME;
}

// Samples queued in the worklet that have not been played yet
function getAudioFill()
{
    let consumed = audioReportConsumed + Math.max(0.0, audioContext.currentTime - audioReportTime)*SAMPLE_RATE;
    if(consumed > audioSamplesSent) consumed = audioSamplesSent;

    return audioSamplesSent - consumed;
}

// Sends the frame just emulated to the worklet, or discards it when the audio clock isn't pacing the emulator
function queueAudioFrame(audioPaced)
{
    const numSamples = Module.ccall('emulator_get_audio_write_index', 'number', ['number'], [emulator]);
    if(!audioPaced  ||  numSamples <= 0) return;

    // Consumption starts with the first frame after a flush
    if(audioSamplesSent === 0)
    {
        audioReportConsumed = 0;
        audioReportTime = audioContext.currentTime;
    }

    const bufferPtr = Module.ccall('emulator_get_audio_buffer', 'number', ['number'], [emulator]);
    const samples = Module.HEAPF32.slice(bufferPtr >> 2, (bufferPtr >> 2) + numSamples);
    audioWorkletNode.port.postMessage(samples, [samples.buffer]);
    audioSamplesSent += numSamples;
}

// Drops queued audio and restarts the fill accounting
function resetAudio()
{
    audioEpoch++;
    audioSamplesSent = 0;
    audioReportConsumed = 0;
    audioReportTime = audioContext ? audioContext.currentTime : 0;

    if(audioWorkletNode) audioWorkletNode.port.postMessage({flush: audioEpoch});
}