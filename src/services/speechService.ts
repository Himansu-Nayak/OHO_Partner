interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

const win = window as unknown as IWindow;
const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

let recognition: any = null;
let currentLanguage = 'en-IN';

export const setVernacularLanguage = (langCode: string) => {
  currentLanguage = langCode;
  if (recognition) {
    recognition.lang = langCode;
  }
};

export const getVernacularLanguage = () => currentLanguage;

export const speak = (text: string, lang?: string) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const safeLang = lang || currentLanguage;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = safeLang;
    window.speechSynthesis.speak(utterance);
  }
};

export const listenForCommand = (
  commands: Record<string, (matchText?: string) => void>,
  onStart?: () => void,
  onEnd?: () => void
) => {
  if (!SpeechRecognition) {
    console.warn("Speech recognition not supported in this browser.");
    return;
  }

  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = currentLanguage;
  }

  recognition.onstart = () => {
    console.log("Voice listening started...");
    onStart?.();
  };

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    console.log("Heard:", transcript);
    
    for (const [cmd, action] of Object.entries(commands)) {
      if (transcript.includes(cmd.toLowerCase())) {
        action(transcript);
        return;
      }
    }

    // Check for PIN matching (e.g. "pin 1 2 3 4" or "verify 1234")
    const pinMatch = transcript.match(/\b(\d\s*){4}\b/);
    if (pinMatch && commands["pin"]) {
      commands["pin"](pinMatch[0].replace(/\s+/g, ''));
    }
  };

  recognition.onerror = (event: any) => {
    console.error("Speech error:", event.error);
  };

  recognition.onend = () => {
    onEnd?.();
  };

  try {
    recognition.start();
  } catch (e) {
    console.warn("Recognition already started or error:", e);
  }
};
