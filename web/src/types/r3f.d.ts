// web/src/types/r3f.d.ts
import { ThreeElements } from '@react-three/fiber';

declare global {
  namespace JSX {
    // Allow JSX tags like <mesh/>, <ambientLight/>, <sphereGeometry/>, etc.
    interface IntrinsicElements extends ThreeElements {}
  }
}
export {};
