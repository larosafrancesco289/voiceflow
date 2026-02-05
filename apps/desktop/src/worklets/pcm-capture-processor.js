class VoiceflowPcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) {
      return true;
    }

    // Copy the frame before posting because the input buffer is recycled.
    this.port.postMessage(new Float32Array(channel));
    return true;
  }
}

registerProcessor('voiceflow-pcm-capture', VoiceflowPcmCaptureProcessor);
