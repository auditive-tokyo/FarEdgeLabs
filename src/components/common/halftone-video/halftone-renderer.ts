/**
 * WebGL2 renderer behind `<HalftoneVideo>`.
 *
 * Owns the GL resources (program, quad, source texture) and exposes a plain
 * imperative surface — `resize` / `render` / `dispose` — so the component stays
 * a thin React shell and the per-frame path allocates nothing.
 *
 * It draws whatever image it is handed, and knows nothing about video: the
 * component decides whether that is a playing `<video>` or a decoded frame, and
 * the renderer only re-uploads when `sourceKey` changes.
 *
 * Raw WebGL2 rather than a 3D library: this is one fullscreen quad, so a scene
 * graph would be all cost and no benefit. ADR: obsidian/meta/decisions-log.md
 * (ADR-0014).
 *
 * 📖 Docs: obsidian/frontend/components/common.md
 */

import type { Rgb } from "@/utils/color";

import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";

/** Two triangles covering clip space, drawn as a strip. */
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

export interface HalftoneRendererOptions {
  canvas: HTMLCanvasElement;
}

/** Per-frame shader inputs. */
export interface HalftoneFrame {
  /** Image to sample — a `<video>`, a decoded frame, any `TexImageSource`. */
  source: TexImageSource;
  /** Re-upload only when this changes. */
  sourceKey: number;
  /** Intrinsic size of `source`, px — drives the cover fit. */
  sourceSize: [number, number];
  /** Dot cell size, device px. */
  cell: number;
  /** Exposure applied to the sampled luminance. */
  gain: number;
  /** <1 lifts midtones into larger dots. */
  gamma: number;
  /** Dot diameter at full brightness, in cells. */
  dotScale: number;
  /** Edge feather, in cells. */
  softness: number;
  /** Flip the sampled image horizontally. */
  mirror: boolean;
  /** Perspective lean, per axis. `[0, 0]` is flat on. */
  tilt: [number, number];
  /** How tightly the ink ramp packs around the centre of the frame. */
  inkSpread: number;
  /** The developing wave's travel, 0 (blank) → 1 (fully settled). */
  reveal: number;
  /** Wave thickness, in screen heights. */
  revealBand: number;
  bg: Rgb;
  inkLight: Rgb;
  inkMid: Rgb;
  inkDeep: Rgb;
}

export interface HalftoneRenderer {
  resize: (width: number, height: number) => void;
  render: (frame: HalftoneFrame) => void;
  dispose: () => void;
}

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

  // A compile failure is a developer bug — surface it rather than silently
  // dropping to the fallback video.
  console.error(
    "[halftone-video] shader compile failed:",
    gl.getShaderInfoLog(shader),
  );
  gl.deleteShader(shader);
  return null;
};

const createProgram = (gl: WebGL2RenderingContext): WebGLProgram | null => {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // The shaders live on in the linked program; drop our references either way.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;

  console.error(
    "[halftone-video] program link failed:",
    gl.getProgramInfoLog(program),
  );
  gl.deleteProgram(program);
  return null;
};

/**
 * Build the renderer, or return `null` when the platform can't run it (no
 * WebGL2, shader failure) so the caller can fall back to the plain video
 * element.
 */
export const createHalftoneRenderer = ({
  canvas,
}: HalftoneRendererOptions): HalftoneRenderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const program = createProgram(gl);
  if (!program) return null;

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const locations = {
    source: uniform("u_source"),
    resolution: uniform("u_resolution"),
    sourceSize: uniform("u_sourceSize"),
    cell: uniform("u_cell"),
    gain: uniform("u_gain"),
    gamma: uniform("u_gamma"),
    dotScale: uniform("u_dotScale"),
    softness: uniform("u_softness"),
    mirror: uniform("u_mirror"),
    tilt: uniform("u_tilt"),
    inkSpread: uniform("u_inkSpread"),
    reveal: uniform("u_reveal"),
    revealBand: uniform("u_revealBand"),
    bg: uniform("u_bg"),
    inkLight: uniform("u_inkLight"),
    inkMid: uniform("u_inkMid"),
    inkDeep: uniform("u_inkDeep"),
  };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // Sources are uploaded top-row-first so v=1 is the top of the image, matching
  // v_uv (see shaders.ts).
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.useProgram(program);
  gl.uniform1i(locations.source, 0);

  let uploadedKey = Number.NaN;

  return {
    resize: (width, height) => {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    },

    render: (frame) => {
      gl.useProgram(program);
      gl.bindVertexArray(vao);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (frame.sourceKey !== uploadedKey) {
        uploadedKey = frame.sourceKey;
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          frame.source,
        );
      }

      gl.uniform2f(locations.resolution, canvas.width, canvas.height);
      gl.uniform2f(locations.sourceSize, frame.sourceSize[0], frame.sourceSize[1]);
      gl.uniform1f(locations.cell, frame.cell);
      gl.uniform1f(locations.gain, frame.gain);
      gl.uniform1f(locations.gamma, frame.gamma);
      gl.uniform1f(locations.dotScale, frame.dotScale);
      gl.uniform1f(locations.softness, frame.softness);
      gl.uniform1f(locations.mirror, frame.mirror ? 1 : 0);
      gl.uniform2f(locations.tilt, frame.tilt[0], frame.tilt[1]);
      gl.uniform1f(locations.inkSpread, frame.inkSpread);
      gl.uniform1f(locations.reveal, frame.reveal);
      gl.uniform1f(locations.revealBand, frame.revealBand);
      gl.uniform3fv(locations.bg, frame.bg);
      gl.uniform3fv(locations.inkLight, frame.inkLight);
      gl.uniform3fv(locations.inkMid, frame.inkMid);
      gl.uniform3fv(locations.inkDeep, frame.inkDeep);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    // Frees every GL object we own, but deliberately does *not* call
    // `WEBGL_lose_context` — a canvas hands back the same context object on
    // every `getContext`, so losing it would leave the element permanently
    // unusable for the next renderer (e.g. a remount).
    dispose: () => {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
};
