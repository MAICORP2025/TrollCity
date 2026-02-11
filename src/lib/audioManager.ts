
class AudioManager {
  private originalVolumes: Map<HTMLMediaElement, number> = new Map();
  private isDucked: boolean = false;

  duck() {
    if (this.isDucked) return;
    
    console.log('[AudioManager] Ducking global audio...');
    const mediaElements = document.querySelectorAll('audio, video');
    
    mediaElements.forEach((el) => {
      const mediaEl = el as HTMLMediaElement;
      
      // Store original volume if not already stored (and if not muted)
      if (!this.originalVolumes.has(mediaEl)) {
        this.originalVolumes.set(mediaEl, mediaEl.volume);
      }
      
      // Mute or lower volume
      // Requirement: "mute or duck... set volume 0"
      mediaEl.volume = 0;
    });
    
    this.isDucked = true;
  }

  unduck() {
    if (!this.isDucked) return;

    console.log('[AudioManager] Restoring global audio...');
    this.originalVolumes.forEach((vol, el) => {
      // Restore volume only if it's still in the DOM
      if (document.body.contains(el)) {
        el.volume = vol;
      }
    });
    
    this.originalVolumes.clear();
    this.isDucked = false;
  }
}

export const audioManager = new AudioManager();
