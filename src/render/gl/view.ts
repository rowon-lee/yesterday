import * as THREE from 'three';
import { startSoftware } from '../light';
import { SCREEN_H, SCREEN_W, onFit } from '../screen';
import { makeCamera, MARGIN, placeCamera, RT_H, RT_W, type Placed, type View } from './core';
import { lightPool, loadedLights, shared } from './lights';
import { Post } from './post';

/** 표시 그림 형식: 반정밀 부동소수에 그릴 수 있으면 그것으로 (가장 어두운 외곽선 색도 0이 되지 않게) */
const r0 = (r: THREE.WebGLRenderer): THREE.TextureDataType =>
  r.extensions.has('EXT_color_buffer_float') || r.extensions.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;

/**
 * three.js 2.5D 화면 (렌더 전용). 3D 장면을 482×272 HDR 화면에 그리고 후처리를 거쳐
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
   * 캐릭터·이펙트 묶음 (render/gl/actors.ts의 group). 이 묶음만 따로 표시 그림에 그려, 후처리 팔레트가 캐릭터·이펙트 칸은
   * 늘 쓰는 색(COMMON)으로, 무대 칸은 구간 계단으로만 줄이게 한다. 없으면 장면에서 캐릭터 판(테두리 빛 재질)을 가진 묶음을 찾는다
   */
  maskRoot: THREE.Object3D | null = null;
  private maskRT: THREE.WebGLRenderTarget | null = null;
  private maskSearched = 0;
  /** 확대 (필살기 연출, 렌더 전용): 정수 배율과 보이는 칸의 왼쪽 위 (게임 화면 px) */
  private zoomZ = 1;
  private zoomX = 0;
  private zoomY = 0;

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
    // 소프트웨어 그래픽이면 처음부터 낮은 품질 (light.ts)
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    startSoftware(String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''));
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
    // 화면에 닿는 빛만 후보로 받는다 (commitLights와 같은 둘레)
    const top = this.camera.position.y + SCREEN_H / 2 + 40;
    const bottom = this.camera.position.y - SCREEN_H / 2 - 40;
    lightPool.clear(this.placed.ix - 40, this.placed.ix + SCREEN_W + 40, bottom, top);
    shared.uTime.value = tick;
    return this.placed;
  }

  /** 빛 후보를 다 넣은 뒤: 화면에 닿는 빛만 광원 배열에 싣는다 (화면 둘레로 조금 넉넉히) */
  commitLights(): void {
    const p = this.placed;
    const top = this.camera.position.y + SCREEN_H / 2 + 40;
    const bottom = this.camera.position.y - SCREEN_H / 2 - 40;
    lightPool.commit(p.ix - 40, p.ix + SCREEN_W + 40, bottom, top, shared.uTime.value as number);
  }

  /** 캐릭터·이펙트 묶음 찾기: 테두리 빛(rimColor)을 쓰는 캐릭터 판이 든 장면 바로 아래 묶음 */
  private findMaskRoot(): THREE.Object3D | null {
    for (const child of this.scene.children) {
      let hit = false;
      child.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
        if (!hit && m && (m as THREE.ShaderMaterial).uniforms?.rimColor) hit = true;
      });
      if (hit) return child;
    }
    return null;
  }

  /** 캐릭터·이펙트 표시 그림: 그 묶음만 검은 바탕에 그린다 (그린 칸은 색이 0이 아니다). 보이는 것이 없으면 표시를 끈다 */
  private drawMask(): void {
    if (!this.maskRoot && this.maskSearched < 3) {
      this.maskSearched++;
      this.maskRoot = this.findMaskRoot();
    }
    const root = this.maskRoot;
    let any = false;
    if (root && root.visible) {
      root.traverse((o) => {
        if (any || !(o as THREE.Mesh).isMesh || !o.visible) return;
        const u = ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
        if (u?.map?.value) any = true;
      });
    }
    if (!any || !root) {
      this.post.setMask(null);
      return;
    }
    if (!this.maskRT) {
      this.maskRT = new THREE.WebGLRenderTarget(RT_W, RT_H, {
        type: r0(this.renderer),
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: false,
      });
    }
    const r = this.renderer;
    const clear = r.getClearColor(this.clearColor);
    const alpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.maskRT);
    r.clear();
    r.render(root, this.camera);
    r.setClearColor(clear, alpha);
    this.post.setMask(this.maskRT.texture);
  }
  private readonly clearColor = new THREE.Color();

  render(): void {
    const p = this.placed;
    this.renderer.setRenderTarget(this.post.hdr);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.drawMask();
    // 바닥선: 싸우는 면의 바닥(높이 0)이 렌더 타깃 위에서부터 몇째 줄인지
    this.post.horizon = RT_H / 2 + this.camera.position.y;
    this.post.run(this.renderer, p, { bloom: this.bloom }, shared.uTime.value, this.camera);
    // 남는 소수점만큼 캔버스를 민다 (둘레 여유 1px 포함, 물리 픽셀로 반올림). 확대 중이면 보이는 칸이 화면을 채우게 키운다
    const z = this.zoomZ;
    const tx = Math.round(z * (MARGIN + p.fx + this.zoomX) * this.scale) / this.dpr;
    const ty = Math.round(z * (MARGIN + p.fy + this.zoomY) * this.scale) / this.dpr;
    const shift = z > 1 ? `translate(${-tx}px, ${-ty}px) scale(${z})` : `translate(${-tx}px, ${-ty}px)`;
    if (shift !== this.shift) {
      this.canvas.style.transform = shift;
      this.shift = shift;
    }
  }

  /**
   * 확대 (필살기 발동·연출): z배(정수만, 도트가 고르게 커지도록)로 (cx, cy)를 가운데에 둔다. 화면 밖으로는 나가지 않게
   * 보이는 칸을 화면 안으로 민다. z = 1이면 풀린다. 확대는 캔버스를 CSS로 키우는 것이라 3D 그리기 비용은 그대로다.
   */
  setZoom(z: number, cx = SCREEN_W / 2, cy = SCREEN_H / 2): void {
    this.zoomZ = Math.max(1, Math.round(z));
    const w = SCREEN_W / this.zoomZ;
    const h = SCREEN_H / this.zoomZ;
    this.zoomX = Math.round(Math.max(0, Math.min(SCREEN_W - w, cx - w / 2)));
    this.zoomY = Math.round(Math.max(0, Math.min(SCREEN_H - h, cy - h / 2)));
  }

  /** 지금 확대 (확인 도구가 캡처에 같은 확대를 입힐 때) */
  zoomRect(): { z: number; x: number; y: number } {
    return { z: this.zoomZ, x: this.zoomX, y: this.zoomY };
  }

  /** 확인 도구용: 마지막 화면(팔레트 화면 480×270) */
  read(): Uint8ClampedArray {
    return this.post.read(this.renderer, SCREEN_W, SCREEN_H);
  }

  /** 확인 도구용: 마지막 프레임의 칸마다 카메라에서의 거리 (화면 480×270, 하늘은 FAR) */
  readDepth(): Float32Array {
    return this.post.readDepth(this.renderer, SCREEN_W, SCREEN_H);
  }

  /** 확인 도구용: 지금 실린 광원 (자리, 선형 색 × 세기 × 밝기, 이펙트 빛인지) */
  lights(): Array<{ x: number; y: number; z: number; r: number; g: number; b: number; fx: boolean }> {
    const out = [];
    for (let i = 0; i < loadedLights.count(); i++) {
      const p = loadedLights.pos[i];
      const c = loadedLights.col[i];
      out.push({ x: p.x, y: p.y, z: p.z, r: c.x, g: c.y, b: c.z, fx: loadedLights.fx[i] });
    }
    return out;
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
