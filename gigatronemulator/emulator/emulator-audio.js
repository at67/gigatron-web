let audioContext = null;
let currentVolume = 0.5;
let isMuted = false;
let wasAutoMuted = false;
let userMutedState = false;

let tailTime = 0;
let SAMPLE_BUFFER_SIZE = 260
let SAMPLE_RATE = SAMPLE_BUFFER_SIZE*59.98;
let RING_BUFFER_SIZE = SAMPLE_BUFFER_SIZE*4

let audioReadIndex = 0;

// Drift correction: the emulator is paced by the system clock and playback by the audio clock, so the
// scheduled lead slowly drifts; hold it near the lead measured after start-up by dropping or repeating one
// copy of a duplicated sample pair when the smoothed lead leaves the dead band
const LEAD_SMOOTHING = 0.05;     // exponential average over ~20 updates
const LEAD_DEAD_BAND = 0.010;    // seconds either side of the target
const LEAD_SETTLE_TIME = 1.0;    // seconds after start/reset before the target is captured
let leadAverage = null;
let leadTarget = null;
let leadCaptureTime = 0;

let gainNode = null;

// A suspended context or a waking audio device holds currentTime still; scheduling against a still clock
// builds a backlog that later plays late, so resync on every update until the clock moves again
const AUDIO_STALL_TIME = 50;     // milliseconds of wall time without the audio clock advancing
let lastAudioClock = -1;
let lastAudioClockWall = 0;


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
        // Short ramp rather than a step, so volume changes don't click
        gainNode.gain.setTargetAtTime(currentVolume, audioContext.currentTime, 0.01);
    }
}

function toggleMute()
{
    isMuted = !isMuted;

    if(!wasAutoMuted) userMutedState = isMuted;

    const muteBtn = document.getElementById('mute-btn');
    if(muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔊';

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
    audioContext = new AudioContext({sampleRate: SAMPLE_RATE}); // latencyHint: 0.06, 'interactive', 'balanced', 'playback'
    console.log(`Audio: ${SAMPLE_RATE} : ${audioContext.sampleRate}`);
    console.log(`Requested latency: 0.05, Actual baseLatency: ${audioContext.baseLatency}`);

    tailTime = 0;
    audioReadIndex = 0;

    leadAverage = null;
    leadTarget = null;
    leadCaptureTime = LEAD_SETTLE_TIME;

    // One persistent gain node for volume, shared by every scheduled buffer
    gainNode = audioContext.createGain();
    gainNode.gain.value = currentVolume;
    gainNode.connect(audioContext.destination);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
}

function updateAudio()
{
    if(!audioContext || !emulator) return;
    if(audioContext.state === 'suspended') audioContext.resume();

    let currentTime = audioContext.currentTime;

    let audioWriteIndex = Module.ccall('emulator_get_audio_write_index', 'number', ['number'], [emulator]);

    // If the audio clock is not advancing then resync and return
    let wallTime = performance.now();
    if(currentTime !== lastAudioClock)
    {
        lastAudioClock = currentTime;
        lastAudioClockWall = wallTime;
    }
    if(audioContext.state !== 'running'  ||  wallTime - lastAudioClockWall > AUDIO_STALL_TIME)
    {
        // Cut anything queued against the stalled clock, so it can't play late once the clock moves again
        if(gainNode  &&  tailTime > currentTime)
        {
            gainNode.disconnect();
            gainNode = audioContext.createGain();
            gainNode.gain.value = currentVolume;
            gainNode.connect(audioContext.destination);
        }

        resetAudio();
        return;
    }

    // Prevent tailTime from falling behind
    const minBufferLead = audioContext.baseLatency < 0.02 ? 0.030779490984919288 : 0.0; // dumb browsers like firefox need help
    if(tailTime < currentTime + minBufferLead) tailTime = currentTime + minBufferLead;

    let numAudioSamples = audioWriteIndex - audioReadIndex;

    //console.log(`Audio: ${numAudioSamples} : ${currentTime.toFixed(2)} : ${tailTime.toFixed(2)}`);

    // If muted then reset audio and return
    if(isMuted)
    {
        resetAudio();
        return;
    }

    // If readindex is behind, then return
    if(numAudioSamples <= 0) return;

    // Get raw audio buffer from C++
    let bufferPtr = Module.ccall('emulator_get_audio_buffer', 'number', ['number'], [emulator]);
    let audioRingBuffer = new Float32Array(Module.HEAPF32.buffer, bufferPtr, RING_BUFFER_SIZE);

    // Outside the dead band, drop (lead too large) or repeat (lead too small) one copy of a duplicated sample pair
    let correction = 0;
    let correctionIndex = -1;
    if(leadTarget !== null)
    {
        if(leadAverage > leadTarget + LEAD_DEAD_BAND)
        {
            correction = -1;
        }
        else if(leadAverage < leadTarget - LEAD_DEAD_BAND)
        {
            correction = 1;
        }
    }
    if(correction !== 0)
    {
        for(let i=0; i<numAudioSamples-1; i++)
        {
            if(audioRingBuffer[(audioReadIndex + i) % RING_BUFFER_SIZE] === audioRingBuffer[(audioReadIndex + i + 1) % RING_BUFFER_SIZE])
            {
                correctionIndex = i;
                break;
            }
        }
        if(correctionIndex < 0)
        {
            correction = 0;
        }
    }

    // Copy straight from the ring buffer into the audio buffer, applying any correction
    let numOutputSamples = numAudioSamples + correction;
    let buffer = audioContext.createBuffer(1, numOutputSamples, SAMPLE_RATE);
    let channelData = buffer.getChannelData(0);
    let outputIndex = 0;
    for(let i=0; i<numAudioSamples; i++)
    {
        let sample = audioRingBuffer[(audioReadIndex + i) % RING_BUFFER_SIZE];
        if(i === correctionIndex)
        {
            if(correction < 0)
            {
                continue;
            }
            channelData[outputIndex++] = sample;
        }
        channelData[outputIndex++] = sample;
    }

    // Advance read pointer by actual samples consumed from producer
    audioReadIndex = audioReadIndex + numAudioSamples;

    // Schedule the buffer through the shared gain node
    let source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.start(tailTime);
    tailTime += numOutputSamples / SAMPLE_RATE;

    // Track the smoothed lead and capture the target once settled
    let lead = tailTime - currentTime;
    leadAverage = (leadAverage === null) ? lead : leadAverage + (lead - leadAverage)*LEAD_SMOOTHING;
    if(leadTarget === null  &&  currentTime >= leadCaptureTime)
    {
        leadTarget = leadAverage;
    }
}

function resetAudio()
{
    if(!audioContext || !emulator) return;

    tailTime = audioContext.currentTime;
    audioReadIndex = Module.ccall('emulator_get_audio_write_index', 'number', ['number'], [emulator]);

    // Re-measure the natural lead after every resync
    leadAverage = null;
    leadTarget = null;
    leadCaptureTime = audioContext.currentTime + LEAD_SETTLE_TIME;
}