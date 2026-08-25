/**
 * Nexa Web Audio Ringtone Manager
 *
 * Plays audio feedback during 'ringing' and 'incoming' VoIP call states.
 * Uses HTML5 Audio with automatic seamless Web Audio API dual-tone synthesis fallback.
 */

class RingtoneManager {
  private audioElement: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private synthIntervalId: any = null;
  private isPlaying = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.audioElement = new Audio('/sounds/ringtone.mp3');
        this.audioElement.loop = true;
      } catch {
        this.audioElement = null;
      }
    }
  }

  /**
   * Starts looping the incoming/outgoing call ringtone.
   */
  public play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.audioElement) {
      this.audioElement.currentTime = 0;
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If HTML5 audio is blocked or asset not present, start Web Audio synthesizer
          this.startSynthesizedRingtone();
        });
      }
    } else {
      this.startSynthesizedRingtone();
    }
  }

  /**
   * Synthesizes realistic dual-tone phone ringing (440Hz + 480Hz US/VoIP standard)
   */
  private startSynthesizedRingtone(): void {
    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume();
      }

      const playBurst = () => {
        if (!this.isPlaying || !this.audioCtx || this.audioCtx.state === 'closed') return;

        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        // Soft envelope: attack 50ms, sustain, release 100ms over 2 seconds
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
        gain.gain.setValueAtTime(0.18, now + 1.9);
        gain.gain.linearRampToValueAtTime(0, now + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      };

      playBurst();
      this.synthIntervalId = setInterval(playBurst, 4000);
    } catch (err) {
      console.warn('Web Audio synthesized ringtone fallback error:', err);
    }
  }

  /**
   * Stops audio and resets oscillators immediately.
   */
  public stop(): void {
    this.isPlaying = false;

    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch {
        // Ignore
      }
    }

    if (this.synthIntervalId) {
      clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        void this.audioCtx.close();
      } catch {
        // Ignore
      }
      this.audioCtx = null;
    }
  }
}

export const ringtoneAudio = new RingtoneManager();
