import { useCallback, useRef, useEffect } from 'react';

interface AudioCaptureOptions {
  onAudioData?: (data: Int16Array) => void;
  onError?: (error: Error) => void;
}

export function useAudioCapture({ onAudioData, onError }: AudioCaptureOptions = {}) {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isCapturingRef = useRef(false);

  const floatTo16BitPCM = useCallback((input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }, []);

  const start = useCallback(async () => {
    if (isCapturingRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!isCapturingRef.current) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        onAudioData?.(pcmData);
      };

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioContext.destination);

      isCapturingRef.current = true;
    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to capture audio'));
    }
  }, [floatTo16BitPCM, onAudioData, onError]);

  const stop = useCallback(() => {
    isCapturingRef.current = false;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, getAnalyser, isCapturing: isCapturingRef.current };
}
