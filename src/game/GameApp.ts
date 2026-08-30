import Phaser from 'phaser';
import { MatchScene, type MatchConfig } from './scenes/MatchScene';

/** Fixed world size every map is authored against. */
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

/**
 * Owns the Phaser instance. React mounts this once per match and tears it
 * down on exit; the simulation never outlives the screen that owns it.
 */
export class GameApp {
  private game: Phaser.Game | null = null;

  start(parent: HTMLElement, config: MatchConfig): void {
    this.destroy();
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      backgroundColor: '#0a0e12',
      antialias: true,
      roundPixels: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        powerPreference: 'high-performance',
        transparent: false,
      },
      fps: { target: 60, forceSetTimeOut: false },
      scene: [MatchScene],
      audio: { noAudio: true },
      banner: false,
    });
    this.game.scene.start(MatchScene.KEY, config);
  }

  isRunning(): boolean {
    return this.game !== null;
  }

  destroy(): void {
    if (!this.game) return;
    this.game.destroy(true, false);
    this.game = null;
  }
}

export type { MatchConfig };
