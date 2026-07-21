import { Arrow } from "./../geometry/arrow";
import { Object3D } from "../geometry/object3d";
import { Geometry } from "../geometry/geometry";
import { Group } from "../geometry/group";
import { Camera } from "./camera";
import { Renderer } from "./renderer";
import { Scene } from "./scene";
import { applyTransformations } from "./utils";
import { Face, IFace } from "../geometry/face";
import { Vector3 } from "../math/vector";
import { Matrix4 } from "../math/matrix";

export interface Polygon {
  points: Vector3[]; // Screen points for the polygon to render
  face: Face; // original geometry face the polygon comes from
  object: Geometry; // parent geometry
  centroid: Vector3; // centroid of the face in 3d space
}

/**
 * Renderer class to take scene geometry and render it to 2d
 * polygon coordinates.
 *
 * 1. Takes a scene and camera
 * 2. converts the scene 3d geometry to 2d screen geometry based on the camera
 * 3. tries to render each face in order from furthest from camera to closest
 * 4. finally, draws the lines (arrows) over top of everything
 *
 * Implementers need just implement
 *   - drawPolygon - a method that draws polygons on some 2d graphics area
 *   - drawArrow - a method that draws an arrow
 *   - onBeforeRender - do any prep work necessary before rendering a frame
 *   - onComplete - handle any final logic
 */
/**
 * Fork change: sq1's piece builders pin their `#333` inner faces' centroids to force
 * them behind outward stickers in the painter sort — a hack that only holds near the
 * default view and leaks dark slivers over colored faces at the kerf cuts once tilted.
 * Real kerf cuts contain no sticker geometry, so an inner face is only ever "wrong"
 * when it would paint over a colored sticker → render all `#333` faces in a first
 * pass; colored stickers always win. (Was a runtime prototype patch in the app.)
 */
function isInnerGray(p: Polygon): boolean {
  const v = p.face.color?.value;
  return typeof v === "string" && v.toLowerCase() === "#333";
}

export abstract class PolygonRenderer implements Renderer {
  protected polygons: Polygon[] = [];
  protected arrows: { p1: Vector3; p2: Vector3; uid: number }[] = [];

  abstract drawPolygon(polygon: Polygon): void;
  abstract drawArrow(p1: Vector3, p2: Vector3, uid: number): void;
  abstract onBeforeRender(): void;
  abstract onComplete(): void;

  render(scene: Scene, camera: Camera): void {
    this.polygons = [];

    scene.objects.forEach((object) => {
      this.renderObject3D(object, camera, []);
    });

    this.onBeforeRender();
    this.renderPolygons();
    this.renderArrows();
    this.onComplete();
  }

  protected renderPolygons() {
    const cmp = (a: Polygon, b: Polygon) => a.centroid.z - b.centroid.z;
    const gray = this.polygons.filter(isInnerGray).sort(cmp);
    const colored = this.polygons.filter((p) => !isInnerGray(p)).sort(cmp);
    gray.forEach((p) => this.drawPolygon(p));
    colored.forEach((p) => this.drawPolygon(p));
  }

  protected renderArrows() {
    this.arrows.forEach(({ p1, p2, uid }) => {
      this.drawArrow(p1, p2, uid);
    });
  }

  protected renderObject3D(
    object: Object3D,
    camera: Camera,
    transformations: Matrix4[]
  ) {
    if (object instanceof Geometry) {
      this.renderGeometry(object, camera, transformations);
    } else if (object instanceof Arrow) {
      this.renderArrow(object, camera, transformations);
    } else if (object instanceof Group) {
      let group = <Group>object;
      // let sorted = this.sortObjects(group.objects, camera, [
      //   group.matrix,
      //   ...transformations,
      // ]);
      group.objects.forEach((object) => {
        this.renderObject3D(object, camera, [group.matrix, ...transformations]);
      });
    }
  }

  protected renderGeometry(
    object: Geometry,
    camera: Camera,
    transformations: Matrix4[]
  ) {
    // this.sortFaces(object.faces, object, transformations);

    object.faces.forEach((face) => {
      let points: Vector3[] = [];
      face.indices
        .map((index) => object.vertices[index])
        .forEach((vertex) => {
          let objectToScreen = [
            object.matrix,
            ...transformations,
            camera.matrix,
          ];
          let screenPoint: Vector3 = applyTransformations(
            vertex,
            objectToScreen
          );

          // Need to flip y to look correct on svg viewbox
          screenPoint.multiply(1, -1, 1);
          points.push(screenPoint);
        });

      this.addPolygon(points, face, object, transformations);
    });
  }

  protected renderArrow(
    object: Arrow,
    camera: Camera,
    transformations: Matrix4[]
  ) {
    let objectToScreen = [object.matrix, ...transformations, camera.matrix];
    let p1Screen = applyTransformations(object.p1, objectToScreen);
    let p2Screen = applyTransformations(object.p2, objectToScreen);

    this.arrows.push({ p1: p1Screen, p2: p2Screen, uid: object.uid });
  }

  protected addPolygon(
    points: Vector3[],
    face: IFace,
    object: Geometry,
    transformations: Matrix4[]
  ) {
    this.polygons.push({
      points,
      face,
      object,
      centroid: applyTransformations(face.centroid, [
        object.matrix,
        ...transformations,
      ]),
    } as Polygon);
  }

  protected sortObjects(
    objects: Object3D[],
    _camera: Camera,
    transformations: Matrix4[]
  ): Object3D[] {
    let sorted = [...objects];
    sorted.sort((a, b) => {
      let aToWorld = [a.matrix, ...transformations];
      let bToWorld = [b.matrix, ...transformations];

      let aCentroid: Vector3 = applyTransformations(a.centroid, aToWorld);
      let bCentroid: Vector3 = applyTransformations(b.centroid, bToWorld);

      // TODO actually use camera, currently only sorting by Z
      return aCentroid.z - bCentroid.z;
    });
    return sorted;
  }
}
