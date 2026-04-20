import { CallPriority } from '../types';

export type SoundTone = 'emergency' | 'nurse_call' | 'medication' | 'other' | 'dismiss';

interface ToneStep {
  frequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}

interface ToneConfig {
  steps: ToneStep[];
  repeat: number;
}

const TONE_CONFIGS: Record<SoundTone, ToneConfig> = {
  emergency: {
    steps: [
      { frequency: 1200, duration: 0.16, gain: 0.28, type: 'square' },
      { frequency: 900, duration: 0.14, gain: 0.28, type: 'square' },
      { frequency: 1200, duration: 0.16, gain: 0.28, type: 'square' },
      { frequency: 900, duration: 0.14, gain: 0.28, type: 'square' }
    ],
    repeat: 3
  },
  nurse_call: {
    steps: [
      { frequency: 920, duration: 0.22, gain: 0.18, type: 'sine' },
      { frequency: 720, duration: 0.22, gain: 0.18, type: 'sine' }
    ],
    repeat: 2
  },
  medication: {
    steps: [
      { frequency: 660, duration: 0.28, gain: 0.15, type: 'sine' },
      { frequency: 880, duration: 0.28, gain: 0.15, type: 'sine' }
    ],
    repeat: 1
  },
  other: {
    steps: [
      { frequency: 520, duration: 0.38, gain: 0.12, type: 'sine' }
    ],
    repeat: 1
  },
  dismiss: {
    steps: [
      { frequency: 440, duration: 0.18, gain: 0.1, type: 'sine' },
      { frequency: 330, duration: 0.2, gain: 0.1, type: 'sine' }
    ],
    repeat: 1
  }
};

const playSteps = (ctx: AudioContext, steps: ToneStep[], startTime: number): number => {
  let t = startTime;
  for (const step of steps) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = step.type;
    oscillator.frequency.setValueAtTime(step.frequency, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(step.gain, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + step.duration - 0.01);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(t);
    oscillator.stop(t + step.duration);
    t += step.duration;
  }
  return t;
};

export const playTone = (tone: SoundTone): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass() as AudioContext;
    const config = TONE_CONFIGS[tone];
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < config.repeat; i++) {
      t = playSteps(ctx, config.steps, t);
      t += 0.08; // gap between repeats
    }
    setTimeout(() => void ctx.close(), (t - ctx.currentTime + 0.5) * 1000);
  } catch {
    // Ignore audio API failures
  }
};

export const toneForPriority = (priority: CallPriority | undefined): SoundTone => {
  switch (priority) {
    case CallPriority.EMERGENCY: return 'emergency';
    case CallPriority.NURSE_CALL: return 'nurse_call';
    case CallPriority.MEDICATION: return 'medication';
    default: return 'other';
  }
};

export const priorityBadge = (priority: CallPriority | undefined): {
  bg: string;
  text: string;
  border: string;
  pulseClass: string;
  label: string;
  labelEn: string;
} => {
  switch (priority) {
    case CallPriority.EMERGENCY:
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        pulseClass: 'emergency-pulse',
        label: 'طارئ',
        labelEn: 'Emergency'
      };
    case CallPriority.NURSE_CALL:
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
        pulseClass: 'nurse-pulse',
        label: 'مهم',
        labelEn: 'Urgent'
      };
    case CallPriority.MEDICATION:
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-300',
        pulseClass: '',
        label: 'دواء',
        labelEn: 'Medication'
      };
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        pulseClass: '',
        label: 'عادي',
        labelEn: 'General'
      };
  }
};

export const PRIORITY_ORDER: Record<CallPriority, number> = {
  [CallPriority.EMERGENCY]: 0,
  [CallPriority.NURSE_CALL]: 1,
  [CallPriority.MEDICATION]: 2,
  [CallPriority.OTHER]: 3
};

export const sortByPriority = <T extends { priority?: CallPriority; createdAt: number }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority ?? CallPriority.OTHER];
    const pb = PRIORITY_ORDER[b.priority ?? CallPriority.OTHER];
    if (pa !== pb) return pa - pb;
    return a.createdAt - b.createdAt;
  });
};
