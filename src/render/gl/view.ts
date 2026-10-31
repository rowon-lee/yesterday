import * as THREE from 'three';
import { SCREEN_H, SCREEN_W, onFit } from '../screen';
import { makeCamera, MARGIN, placeCamera, RT_H, RT_W, type Placed, type View } from './core';
import { lightPool, shared } from './lights';
import { Post } from './post';

/**
 * three.js 2.5D 화면 (렌더 전용, ?render=3d). 3D 장면을 482×272 HDR 화면에 그리고 후처리를 거쳐
 * 정수배로 키운 캔버스에 얹는다. HUD는 위에 겹친 2D 캔버스(#screen)가 그린다.
 */
export class GlView {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = makeCamera();
  readonly post: Post;
  /** 캔버스를 담아 화면 크기로 잘라 내는 칸 */
  private readonly wrap: HTMLDivElement;
  private scale = 1;
  private dpr = 1;
  private shift = '';
  placed: Placed = { ix: 0, iy: 0, fx: 0, fy: 0 };
  bloom = true;

  /**
   * 캔버스는 482×272(둘레 1px 여유) 그대로 두고, 확대는 브라우저 합성기에 맡긴다 (CSS 정수배 + pixelated).
   * 카메라의 남는 소수점은 캔버스를 CSS로 그만큼(물리 픽셀 단위로 반올림) 밀어 처리하고, 바깥 칸이 화면 크기로 잘라 낸다.
   * 그래픽 칩이 휴대폰 화면 크기 전체를 다시 칠하지 않아도 된다.
   */
  constructor(overlay: HTMLCanvasElement) {
    const stage = overlay.parentElement!;
    this.wrap = document.createElement('div');
    this.wrap.style.overflow = 'hidden';
    this.canvas = document.createElement('canvas');
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.display = 'block';
    this.canvas.style.transformOrigin = '0 0';
    this.wrap.appendChild(this.canvas);
    stage.insertBefore(this.wrap, overlay);
    stage.classList.add('gl');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RT_W, RT_H, false);
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 1);
    this.post = new Post(this.renderer);
    onFit((scale, dpr) => {
      this.scale = scale;
      this.dpr = dpr;
      this.wrap.style.width = `${(SCREEN_W * scale) / dpr}px`;
      this.wrap.style.height = `${(SCREEN_H * scale) / dpr}px`;
      this.canvas.style.width = `${(RT_W * scale) / dpr}px`;
      this.canvas.style.height = `${(RT_H * scale) / dpr}px`;
      this.shift = '';
    });
  }

  /** 카메라를 놓는다 (정수 px + 남는 소수점). 이 뒤에 빛 후보를 채우고 render를 부른다 */
  begin(v: View, tick: number): Placed {
    this.renderer.info.autoReset = false;
    this.renderer.info.reset();
    this.placed = placeCamera(this.camera, v);
    lightPool.clear();
    shared.uTime.value = tick;
    return this.placed;
  }

  /** 빛 후보를 다 넣은 뒤: 화면에 닿는 빛만 광원 배열에 싣는다 (화면 둘레로 조금 넉넉히) */
  commitLights(): void {
    const p = this.placed;
    const top = this.camera.position.y + SCREEN_H / 2 + 40;
    const bottom = this.camera.position.y - SCREEN_H / 2 - 40;
    lightPool.commit(p.ix - 40, p.ix + SCREEN_W + 40, bottom, top);
  }

  render(): void {
    const p = this.placed;
    this.renderer.setRenderTarget(this.post.hdr);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    // 바닥선: 싸우는 면의 바닥(높이 0)이 렌더 타깃 위에서부터 몇째 줄인지
    this.post.horizon = RT_H / 2 + this.camera.position.y;
    this.post.run(this.renderer, p, { bloom: this.bloom }, shared.uTime.value);
    // 남는 소수점만큼 캔버스를 민다 (둘레 여유 1px 포함, 물리 픽셀로 반올림)
    const tx = Math.round((MARGIN + p.fx) * this.scale) / this.dpr;
    const ty = Math.round((MARGIN + p.fy) * this.scale) / this.dpr;
    const shift = `translate(${-tx}px, ${-ty}px)`;
    if (shift !== this.shift) {
      this.canvas.style.transform = shift;
      this.shift = shift;
    }
  }

  /** 확인 도구용: 마지막 화면(팔레트 화면 480×270) */
  read(): Uint8ClampedArray {
    return this.post.read(this.renderer, SCREEN_W, SCREEN_H);
  }

  /** 확인 도구용: 그리기 호출 수와 삼각형 수 (마지막 프레임 전체) */
  info(): { calls: number; triangles: number } {
    const r = this.renderer.info.render;
    return { calls: r.calls, triangles: r.triangles };
  }

  /** 확인 도구용: 그래픽 칩 일이 끝날 때까지 기다린다 (1px 읽기) */
  sync(): void {
    const buf = new Uint8Array(4);
    this.renderer.readRenderTargetPixels(this.post.final, 0, 0, 1, 1, buf);
  }
}
