import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

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
  const animationFrameRef = useRef<number | null>(null);

  const { setAudioLevel } = useAppStore();

  const floatTo16BitPCM = useCallback((input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isCapturingRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 128, 1);
    setAudioLevel(normalizedLevel);

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [setAudioLevel]);

  const start = useCallback(async () => {
    if (isCapturingRef.current) {
      console.log('[AudioCapture] Already capturing, skipping');
      return;
    }

    console.log('[AudioCapture] Starting capture...');

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

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        if (!isCapturingRef.current) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = floatTo16BitPCM(inputData);
        onAudioData?.(pcmData);

        chunkCount++;
        if (chunkCount % 10 === 0) {
          console.log(`[AudioCapture] Sent ${chunkCount} chunks`);
        }
      };

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioContext.destination);

      isCapturingRef.current = true;
      console.log('[AudioCapture] Capture started successfully');
      updateAudioLevel();
    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to capture audio'));
    }
  }, [floatTo16BitPCM, onAudioData, onError, updateAudioLevel]);

  const stop = useCallback(() => {
    isCapturingRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

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

    setAudioLevel(0);
  }, [setAudioLevel]);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, getAnalyser, isCapturing: isCapturingRef.current };
}
