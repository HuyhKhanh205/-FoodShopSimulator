import * as THREE from 'three';
import { MAP_COLS, MAP_ROWS } from '../../game/layout';
import type { Tile } from '../../game/layout';

/** Góc nhìn xuống (radian) — khoảng 50°, kiểu game nấu ăn nhìn chéo từ trên. */
const ELEVATION = 0.87;
/** Góc xoay ngang của camera: màn ngang nhìn từ hướng nam lệch đông; màn dọc nhìn từ hướng đông lệch nam. */
export const LANDSCAPE_YAW = 0.32;
export const PORTRAIT_YAW = Math.PI / 2 - 0.32;

export type CameraCam = THREE.OrthographicCamera & { manual?: boolean };

export function makeCamera(): CameraCam {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200) as CameraCam;
  // Không để react-three-fiber tự chỉnh khung hình của camera này.
  cam.manual = true;
  return cam;
}

/**
 * Đặt camera để thấy trọn quán trong khung w×h (px).
 * `yaw` = 0: camera ở phía nam nhìn lên bếp; π/2: ở phía đông (dùng cho màn dọc để chiều dài 12 ô nằm dọc).
 */
export function fitCamera(cam: CameraCam, w: number, h: number, yaw: number) {
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
  const scale = Math.max((maxR - minR) / w, (maxU - minU) / h) * 1.03;
  const cr = (maxR + minR) / 2;
  const cu = (maxU + minU) / 2;
  cam.left = cr - (w / 2) * scale;
  cam.right = cr + (w / 2) * scale;
  cam.top = cu + (h / 2) * scale;
  cam.bottom = cu - (h / 2) * scale;
  cam.updateProjectionMatrix();
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
