import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/DragControls.js';

const collisionMesh = [];
let gravityOnOff = true;
const worldFloor = 0;
const gravityAcceleration = 9.81;
const skin = 0.002;
const clock = new THREE.Clock();
let draggedObject = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xecf7f9);

const container = document.getElementById('canvas2');
const camera = new THREE.PerspectiveCamera(25, container.offsetWidth / container.offsetHeight, 0.1, 1000);
camera.position.set(1, 1, 12);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.offsetWidth, container.offsetHeight);
container.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xcccccc));

const directionalLight = new THREE.DirectionalLight(0xf5f5f5, 0.3);
directionalLight.position.set(50, 20, 200).normalize();
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xf5f5f5, 0.3);
directionalLight2.position.set(-50, -20, -200).normalize();
scene.add(directionalLight2);

const objetos = [];
const objetos2 = [];

const controls2 = new DragControls(objetos2, camera, renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

controls2.addEventListener('dragstart', (event) => {
  draggedObject = event.object;
  controls.enabled = false;
  gravityOnOff = false;

  if (draggedObject?.userData?.physics) {
    draggedObject.userData.physics.velocityY = 0;
  }
});

controls2.addEventListener('dragend', (event) => {
  draggedObject = event.object;
  controls.enabled = true;
  gravityOnOff = true;

  if (draggedObject?.userData?.physics) {
    draggedObject.userData.physics.lastSafePosition.copy(draggedObject.position);
  }

  draggedObject = null;
});

let sphere;
function creationPoint() {
  const geometry = new THREE.SphereGeometry(0.05);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  sphere = new THREE.Mesh(geometry, material);
  sphere.name = 'sphere';
  scene.add(sphere);
  objetos2.push(sphere);
}
creationPoint();

const getBoxGeometryVertices = (mesh) => {
  const position = mesh.geometry?.attributes?.position;
  if (!position) return [];

  const vertices = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    vertices.push(v.clone());
  }
  return vertices;
};

function createPiece() {
  const loaderTexture = new THREE.TextureLoader();
  loaderTexture.load('images/crate.jpg', (texture) => {
    const material = new THREE.MeshBasicMaterial({ map: texture });
    let geometry;

    if (document.getElementsByName('unidades')[0].checked) {
      geometry = new THREE.BoxGeometry(
        document.getElementsByName('largo')[0].value / 100,
        document.getElementsByName('alto')[0].value / 100,
        document.getElementsByName('ancho')[0].value / 100,
      );
    }
    if (document.getElementsByName('unidades')[1].checked) {
      geometry = new THREE.BoxGeometry(
        document.getElementsByName('largo')[0].value / 39.37,
        document.getElementsByName('alto')[0].value / 39.37,
        document.getElementsByName('ancho')[0].value / 39.37,
      );
    }

    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(sphere.position.x, sphere.position.y, sphere.position.z);
    cube.userData.physics = {
      velocityY: 0,
      lastSafePosition: cube.position.clone(),
    };

    scene.add(cube);
    objetos.push(cube);
    objetos2.push(cube);
    collisionMesh.push(cube);
  });
}

document.getElementById('botonCrear').addEventListener('click', createPiece);

function getDownwardIntersections(obj, origin) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(origin, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObjects(collisionMesh, true);
  return intersects.filter((hit) => hit.object !== obj);
}

function getSupportY(mesh) {
  const bbox = new THREE.Box3().setFromObject(mesh);
  const halfSize = bbox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const x = mesh.position.x;
  const z = mesh.position.z;
  const sampleOffsets = [
    [0, 0],
    [halfSize.x * 0.8, halfSize.z * 0.8],
    [-halfSize.x * 0.8, halfSize.z * 0.8],
    [halfSize.x * 0.8, -halfSize.z * 0.8],
    [-halfSize.x * 0.8, -halfSize.z * 0.8],
  ];

  let maxSupportY = worldFloor;
  for (let i = 0; i < sampleOffsets.length; i++) {
    const [dx, dz] = sampleOffsets[i];
    const origin = new THREE.Vector3(x + dx, bbox.max.y + skin, z + dz);
    const intersections = getDownwardIntersections(mesh, origin);
    if (intersections.length > 0) {
      maxSupportY = Math.max(maxSupportY, intersections[0].point.y);
    }
  }

  return maxSupportY;
}

function hasCollision(mesh) {
  const originPoint = mesh.position.clone();
  const vertices = getBoxGeometryVertices(mesh);

  for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
    const localVertex = vertices[vertexIndex].clone();
    const globalVertex = localVertex.applyMatrix4(mesh.matrixWorld);
    const directionVector = globalVertex.sub(mesh.position);
    const ray = new THREE.Raycaster(originPoint, directionVector.clone().normalize());
    const collisionResults = ray.intersectObjects(collisionMesh, true);

    if (collisionResults.length > 0 && collisionResults[0].object !== mesh && collisionResults[0].distance < directionVector.length() - skin) {
      return true;
    }
  }

  return false;
}

function applyGravity(mesh, deltaTime) {
  const physics = mesh.userData.physics;
  if (!physics) return;

  const box = new THREE.Box3().setFromObject(mesh);
  const halfHeight = box.getSize(new THREE.Vector3()).y / 2;

  physics.velocityY -= gravityAcceleration * deltaTime;
  mesh.position.y += physics.velocityY * deltaTime;
  mesh.updateMatrixWorld(true);

  const supportY = getSupportY(mesh);
  const bottomY = mesh.position.y - halfHeight;

  if (bottomY <= supportY + skin) {
    mesh.position.y = supportY + halfHeight + skin;
    physics.velocityY = 0;
  }

  mesh.updateMatrixWorld(true);
  if (hasCollision(mesh)) {
    mesh.position.copy(physics.lastSafePosition);
    physics.velocityY = 0;
  } else {
    physics.lastSafePosition.copy(mesh.position);
  }
}

const loader = new GLTFLoader();
loader.load('mdcao767v3.gltf', handleLoad);

function handleLoad(gltf) {
  const modelMeshes = [];
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      modelMeshes.push(child);
    }
  });

  if (modelMeshes.length === 0) {
    console.error('No mesh found in mdcao767v3.gltf');
    return;
  }

  const modelBounds = new THREE.Box3().setFromObject(gltf.scene);
  const modelFloorOffset = -modelBounds.min.y;
  gltf.scene.position.set(0, modelFloorOffset, 0);
  gltf.scene.updateMatrixWorld(true);
  scene.add(gltf.scene);

  for (let i = 0; i < modelMeshes.length; i++) {
    const mesh = modelMeshes[i];
    if (!mesh.material) continue;

    mesh.material = mesh.material.clone();
    mesh.material.color.setHex(0xb2b9c1);
    mesh.material.transparent = true;
    mesh.material.opacity = 0.1;

    collisionMesh.push(mesh);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.offsetWidth, container.offsetHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const deltaTime = Math.min(clock.getDelta(), 0.033);
  controls.update();

  for (let i = 0; i < objetos.length; i++) {
    const mesh = objetos[i];
    const isDragged = mesh === draggedObject;

    if (!isDragged && gravityOnOff) {
      applyGravity(mesh, deltaTime);
    } else if (mesh.userData.physics) {
      mesh.updateMatrixWorld(true);
      if (hasCollision(mesh)) {
        mesh.position.copy(mesh.userData.physics.lastSafePosition);
      } else {
        mesh.userData.physics.lastSafePosition.copy(mesh.position);
      }
    }
  }

  renderer.render(scene, camera);
}

animate();
