let audioContext = null;
let currentVolume = 0.5;
let isMuted = false;
let wasAutoMuted = false;
let userMutedState = false;

let tailTime = 0;
let duration = 0;
let SAMPLE_BUFFER_SIZE = 130
let SAMPLE_RATE = SAMPLE_BUFFER_SIZE*58.82;
let RING_BUFFER_SIZE = SAMPLE_BUFFER_SIZE*4

let audioReadIndex = 0;
let lastSample = 0.0;

let debugCounter = 0;


function handleVisibilityChange()
{
    if(document.hidden)
    {
        // Page is hidden/minimized
        autoMute();
    }
    else
    {
        // Page is visible again
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
    audioContext = new AudioContext({sampleRate: SAMPLE_RATE});

    // Fixed duration for SAMPLE_BUFFER_SIZE samples
    duration = SAMPLE_BUFFER_SIZE / SAMPLE_RATE;

    // Start 4 buffers ahead
    tailTime = audioContext.currentTime + (duration * 4);
    audioReadIndex = 0;
    lastSample = 0.0;

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
}

function updateAudio()
{
    if(!audioContext || !emulator) return;
    if(audioContext.state === 'suspended') audioContext.resume();

    let currentTime = audioContext.currentTime;
    let queuedTime = tailTime - currentTime;

    // Only add buffer if queue is getting low (less than 5 buffers ahead)
    if(queuedTime < (duration * 5))
    {
        // Get indices
        let writeIndex = Module.ccall('emulator_get_audio_write_index', 'number', ['number'], [emulator]);

        // If muted, just advance read pointer and return
        if(isMuted)
        {
            audioReadIndex = writeIndex;
            return;
        }

        // Get raw audio buffer from C++
        let bufferPtr = Module.ccall('emulator_get_audio_buffer', 'number', ['number'], [emulator]);
        let audioRingBuffer = new Float32Array(Module.HEAPF32.buffer, bufferPtr, RING_BUFFER_SIZE);

        // Create sample output buffer
        let outputSamples = new Float32Array(SAMPLE_BUFFER_SIZE);

        // Read exactly SAMPLE_BUFFER_SIZE samples from ring buffer
        for(let i=0; i<SAMPLE_BUFFER_SIZE; i++)
        {
            outputSamples[i] = audioRingBuffer[(audioReadIndex + i) % RING_BUFFER_SIZE];
        }

        // Advance read pointer by actual samples consumed from producer
        audioReadIndex = (audioReadIndex + SAMPLE_BUFFER_SIZE) % RING_BUFFER_SIZE;

        // Prevent tailTime from falling behind
        if(tailTime < currentTime) tailTime = currentTime;

        // Create and schedule sample audio buffer
        let buffer = audioContext.createBuffer(1, SAMPLE_BUFFER_SIZE, SAMPLE_RATE);
        let channelData = buffer.getChannelData(0);

        let volume = currentVolume;
        for(let i=0; i<SAMPLE_BUFFER_SIZE; i++)
        {
            channelData[i] = outputSamples[i] * volume;
        }

        let source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(tailTime);
        tailTime += duration;
    }

    // DEBUG logging
    //queuedTime = tailTime - currentTime;
    //let queuedBuffers = Math.round(queuedTime / duration);
    //if(++debugCounter >= 60)
    //{
    //    console.log(`Audio queue: ${queuedBuffers} buffers, ${queuedTime.toFixed(3)}s queued`);
    //    debugCounter = 0;
    //}
}

function resetAudio()
{
    if (!audioContext || !emulator) return;

    let writeIndex = Module.ccall('emulator_get_audio_write_index', 'number', ['number'], [emulator]);

    tailTime = audioContext.currentTime;
    audioReadIndex = writeIndex;
    lastSample = 0.0;
}
