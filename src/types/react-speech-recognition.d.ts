declare module "react-speech-recognition" {
  type StartListeningOptions = {
    continuous?: boolean;
    language?: string;
  };

  type SpeechRecognitionResult = {
    transcript: string;
    listening: boolean;
    resetTranscript: () => void;
    browserSupportsSpeechRecognition: boolean;
    browserSupportsContinuousListening: boolean;
    isMicrophoneAvailable: boolean;
  };

  type SpeechRecognitionController = {
    startListening: (options?: StartListeningOptions) => Promise<void>;
    stopListening: () => void;
    abortListening: () => void;
  };

  export function useSpeechRecognition(): SpeechRecognitionResult;

  const SpeechRecognition: SpeechRecognitionController;
  export default SpeechRecognition;
}
