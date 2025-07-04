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
    updateVolumeDisplay();
}

function increaseVolume()
{
    currentVolume = Math.min(1, currentVolume + 0.1);
    updateVolumeDisplay();
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

    // Prevent tailTime from falling behind
    const minBufferLead = audioContext.baseLatency < 0.02 ? 0.030779490984919288 : 0.0; // dumb browsers like firefox need help
    if(tailTime < currentTime + minBufferLead) tailTime = currentTime + minBufferLead;

    let numAudioSamples = audioWriteIndex - audioReadIndex;

    //console.log(`Audio: ${numAudioSamples} : ${currentTime.toFixed(2)} : ${tailTime.toFixed(2)}`);

    // If muted or readindex is behind, then reset read pointer and return
    if(isMuted  ||  numAudioSamples <= 0)
    {
        audioReadIndex = audioWriteIndex;
        tailTime = currentTime;
        return;
    }

    // Get raw audio buffer from C++
    let bufferPtr = Module.ccall('emulator_get_audio_buffer', 'number', ['number'], [emulator]);
    let audioRingBuffer = new Float32Array(Module.HEAPF32.buffer, bufferPtr, RING_BUFFER_SIZE);

    // Create sample output buffer
    let outputSamples = new Float32Array(numAudioSamples);
    for(let i=0; i<numAudioSamples; i++)
    {
        outputSamples[i] = audioRingBuffer[(audioReadIndex + i) % RING_BUFFER_SIZE];
    }

    // Advance read pointer by actual samples consumed from producer
    audioReadIndex = audioReadIndex + numAudioSamples;

    // Create and schedule sample audio buffer
    let buffer = audioContext.createBuffer(1, numAudioSamples, SAMPLE_RATE);
    let channelData = buffer.getChannelData(0);

    buffer.getChannelData(0).set(outputSamples);
    let source = audioContext.createBufferSource();
    source.buffer = buffer;

    // Create gain node for volume control
    let gainNode = audioContext.createGain();
    gainNode.gain.value = currentVolume;

    // Connect source to gain to destination
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(tailTime);
    tailTime += numAudioSamples / SAMPLE_RATE;
}

function resetAudio()
{
    if(!audioContext || !emulator) return;

    let writeIndex = Module.ccall('emulator_get_audio_write_index', 'number', ['number'], [emulator]);

    tailTime = audioContext.currentTime;
    audioReadIndex = writeIndex;
}
