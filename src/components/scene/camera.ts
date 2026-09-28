import * as THREE from 'three';
import { MAP_COLS, MAP_ROWS } from '../../game/layout';
import type { Tile } from '../../game/layout';

/** Góc nhìn xuống (radian) — khoảng 50°, kiểu game nấu ăn nhìn chéo từ trên. */
export const ELEVATION = 0.87;
/** Góc xoay ngang của camera: isometric khoá 45° (nhìn từ góc đông nam); người chơi xoay thêm theo nấc 90°. */
export const ISO_YAW = Math.PI / 4;

export type CameraCam = THREE.OrthographicCamera & { manual?: boolean };

export function makeCamera(): CameraCam {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200) as CameraCam;
  // Không để react-three-fiber tự chỉnh khung hình của camera này.
  cam.manual = true;
  return cam;
}

/** Khung nhìn đã căn: dùng để dời camera theo nhân vật mà vẫn không ra ngoài mép quán. */
export interface CameraFrame {
  /** Đơn vị thế giới trên mỗi px. */
  scale: number;
  halfW: number;
  halfH: number;
  minR: number;
  maxR: number;
  minU: number;
  maxU: number;
  baseR: number;
  baseU: number;
  panR: number;
  panU: number;
  right: THREE.Vector3;
  up: THREE.Vector3;
  center: THREE.Vector3;
}

function applyPan(cam: CameraCam, fr: CameraFrame) {
  cam.left = fr.panR - fr.halfW;
  cam.right = fr.panR + fr.halfW;
  cam.top = fr.panU + fr.halfH;
  cam.bottom = fr.panU - fr.halfH;
  cam.updateProjectionMatrix();
}

/**
 * Đặt camera nhìn quán trong khung w×h (px).
 * `yaw` = 0: camera ở phía nam nhìn lên bếp; π/2: ở phía đông (dùng cho màn dọc để chiều dài 12 ô nằm dọc).
 * `zoom` > 1: phóng to (không thấy hết quán, dùng `followCamera` để đi theo nhân vật).
 */
export function fitCamera(cam: CameraCam, w: number, h: number, yaw: number, zoom = 1): CameraFrame {
  const center = new THREE.Vector3(MAP_COLS / 2, 0, MAP_ROWS / 2);
  const flat = Math.cos(ELEVATION);
  const dir = new THREE.Vector3(Math.sin(yaw) * flat, Math.sin(ELEVATION), Math.cos(yaw) * flat);
  cam.position.copy(center).addScaledVector(dir, 40);
  cam.up.set(0, 1, 0);
  cam.lookAt(center);
  cam.updateMatrixWorld(true);

  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  let minR = Infinity;
  let maxR = -Infinity;
  let minU = Infinity;
  let maxU = -Infinity;
  for (const x of [0, MAP_COLS]) {
    for (const y of [0, 2.2]) {
      for (const z of [0, MAP_ROWS]) {
        const p = new THREE.Vector3(x, y, z).sub(center);
        const r = p.dot(right);
        const u = p.dot(up);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
      }
    }
  }
  const scale = (Math.max((maxR - minR) / w, (maxU - minU) / h) * 1.03) / zoom;
  const baseR = (maxR + minR) / 2;
  const baseU = (maxU + minU) / 2;
  const frame: CameraFrame = {
    scale,
    halfW: (w / 2) * scale,
    halfH: (h / 2) * scale,
    minR,
    maxR,
    minU,
    maxU,
    baseR,
    baseU,
    panR: baseR,
    panU: baseU,
    right,
    up,
    center,
  };
  applyPan(cam, frame);
  return frame;
}

const clampRange = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
const follow = new THREE.Vector3();

/**
 * Dời khung camera về phía nhân vật (toạ độ thế giới), kẹp trong mép quán, nội suy mượt theo `t` (0..1).
 * Trả về độ dời màn hình (px) so với khung gốc — dùng để dời lớp chữ nổi theo.
 */
export function followCamera(cam: CameraCam, fr: CameraFrame, x: number, z: number, t: number) {
  follow.set(x, 0.5, z).sub(fr.center);
  const r = clampRange(follow.dot(fr.right), fr.minR + fr.halfW, fr.maxR - fr.halfW);
  const u = clampRange(follow.dot(fr.up), fr.minU + fr.halfH, fr.maxU - fr.halfH);
  fr.panR += (r - fr.panR) * t;
  fr.panU += (u - fr.panU) * t;
  applyPan(cam, fr);
  return { x: -(fr.panR - fr.baseR) / fr.scale, y: (fr.panU - fr.baseU) / fr.scale };
}

const tmp = new THREE.Vector3();

/** Toạ độ màn hình (px) của một điểm 3D. */
export function project(cam: CameraCam, x: number, y: number, z: number, w: number, h: number) {
  tmp.set(x, y, z).project(cam);
  return { x: ((tmp.x + 1) / 2) * w, y: ((1 - tmp.y) / 2) * h };
}

/** Quy đổi phím hướng (theo màn hình) sang hướng đi trên lưới gần nhất, tùy góc camera. */
export function screenDirToTile(dir: Tile, yaw: number): Tile {
  // Trên mặt sàn: "lên màn hình" = (−sin, −cos), "phải màn hình" = (cos, −sin).
  const wx = dir.x * Math.cos(yaw) - -dir.y * Math.sin(yaw);
  const wz = -dir.x * Math.sin(yaw) - -dir.y * Math.cos(yaw);
  return Math.abs(wx) >= Math.abs(wz) ? { x: Math.sign(wx), y: 0 } : { x: 0, y: Math.sign(wz) };
}
