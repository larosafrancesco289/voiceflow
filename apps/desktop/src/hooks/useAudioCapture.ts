import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioCaptureOptions {
  onAudioData?: (data: Int16Array) => void;
  onError?: (error: Error) => void;
}

const WORKLET_NAME = 'voiceflow-pcm-capture';
const WORKLET_MODULE_URL = new URL('../worklets/pcm-capture-processor.js', import.meta.url);

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

export function useAudioCapture({ onAudioData, onError }: AudioCaptureOptions = {}) {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mutedGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isCapturingRef = useRef(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

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
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      analyserNode.smoothingTimeConstant = 0.85;
      analyserNode.minDecibels = -90;
      analyserNode.maxDecibels = -25;
      analyserRef.current = analyserNode;
      setAnalyser(analyserNode);

      const mutedGain = audioContext.createGain();
      mutedGain.gain.value = 0;
      mutedGainRef.current = mutedGain;

      source.connect(analyserNode);

      if ('audioWorklet' in audioContext && typeof AudioWorkletNode !== 'undefined') {
        try {
          await audioContext.audioWorklet.addModule(WORKLET_MODULE_URL.href);

          const workletNode = new AudioWorkletNode(audioContext, WORKLET_NAME, {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 1,
          });

          workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
            if (!isCapturingRef.current) return;
            if (!(event.data instanceof Float32Array)) return;
            onAudioData?.(floatTo16BitPCM(event.data));
          };

          analyserNode.connect(workletNode);
          workletNode.connect(mutedGain);
          workletRef.current = workletNode;
        } catch (workletError) {
          console.warn(
            '[AudioCapture] AudioWorklet setup failed, falling back to ScriptProcessor:',
            workletError
          );
        }
      }

      if (!workletRef.current) {
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;
        processor.onaudioprocess = (event) => {
          if (!isCapturingRef.current) return;
          const inputData = event.inputBuffer.getChannelData(0);
          onAudioData?.(floatTo16BitPCM(inputData));
        };
        analyserNode.connect(processor);
        processor.connect(mutedGain);
      }

      mutedGain.connect(audioContext.destination);
      isCapturingRef.current = true;
    } catch (error) {
      console.error('[AudioCapture] Failed to start:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to capture audio'));
    }
  }, [onAudioData, onError]);

  const stop = useCallback(() => {
    isCapturingRef.current = false;

    if (workletRef.current) {
      workletRef.current.port.onmessage = null;
      workletRef.current.disconnect();
      workletRef.current = null;
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (mutedGainRef.current) {
      mutedGainRef.current.disconnect();
      mutedGainRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    setAnalyser(null);

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { start, stop, analyser };
}
