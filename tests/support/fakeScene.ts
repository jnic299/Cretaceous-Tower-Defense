import type Phaser from 'phaser';

/**
 * A minimal stand-in for a Phaser scene.
 *
 * The timing model under test lives inside the real `Dino`, `DefenderUnit`
 * and `FixtureUnit` classes, and those classes create sprites in their
 * constructors. Rather than testing a reimplementation of the model, these
 * stubs let the genuine classes run headlessly so the tests exercise the code
 * the game actually ships.
 *
 * Every method returns `this`, matching Phaser's chainable game objects.
 */
export interface StubGameObject {
  x: number;
  y: number;
  rotation: number;
  alpha: number;
  visible: boolean;
  active: boolean;
  scaleX: number;
  scaleY: number;
  texture: { key: string };
  tint: number | null;
  destroyed: boolean;
  [key: string]: unknown;
}

function makeGameObject(key = ''): StubGameObject {
  const obj: Partial<StubGameObject> = {
    x: 0,
    y: 0,
    rotation: 0,
    alpha: 1,
    visible: true,
    active: true,
    scaleX: 1,
    scaleY: 1,
    texture: { key },
    tint: null,
    destroyed: false,
  };
  const self = obj as StubGameObject;
  const chain = <T>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    return self;
  };

  self.setDepth = () => self;
  self.setOrigin = () => self;
  self.setBlendMode = () => self;
  self.setRotation = chain<number>((v) => {
    self.rotation = v;
  });
  self.setAlpha = chain<number>((v) => {
    self.alpha = v;
  });
  self.setVisible = chain<boolean>((v) => {
    self.visible = v;
  });
  self.setActive = chain<boolean>((v) => {
    self.active = v;
  });
  self.setTexture = chain<string>((v) => {
    self.texture = { key: v };
  });
  self.setTint = chain<number>((v) => {
    self.tint = v;
  });
  self.setTintFill = chain<number>((v) => {
    self.tint = v;
  });
  self.clearTint = () => {
    self.tint = null;
    return self;
  };
  self.setScale = (sx: number, sy?: number) => {
    self.scaleX = sx;
    self.scaleY = sy ?? sx;
    return self;
  };
  self.setPosition = (x: number, y: number) => {
    self.x = x;
    self.y = y;
    return self;
  };
  self.destroy = () => {
    self.destroyed = true;
  };
  return self;
}

export interface FakeScene {
  created: StubGameObject[];
  tweensAdded: number;
  add: { image: () => StubGameObject; sprite: (x: number, y: number, key: string) => StubGameObject };
  tweens: { add: (config: unknown) => unknown };
}

/**
 * Returns an object shaped enough like a scene for the entity constructors,
 * cast at the call site because it deliberately implements only what they use.
 */
export function fakeScene(): FakeScene {
  const created: StubGameObject[] = [];
  const track = (o: StubGameObject) => {
    created.push(o);
    return o;
  };
  const scene: FakeScene = {
    created,
    tweensAdded: 0,
    add: {
      image: () => track(makeGameObject()),
      sprite: (_x: number, _y: number, key: string) => track(makeGameObject(key)),
    },
    tweens: {
      add: () => {
        scene.tweensAdded += 1;
        return {};
      },
    },
  };
  return scene;
}

/** Cast helper so tests read cleanly at the constructor call. */
export function asScene(scene: FakeScene): Phaser.Scene {
  return scene as unknown as Phaser.Scene;
}
