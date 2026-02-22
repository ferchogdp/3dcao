import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'https://unpkg.com/three@0.180.0/examples/jsm/controls/DragControls.js';

const collisionMesh = [];
let gravityOnOff = true;
const worldFloor = -0.768;
let contadorIteraciones = 0;

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

controls2.addEventListener('dragstart', () => {
  controls.enabled = false;
  gravityOnOff = false;
});

controls2.addEventListener('dragend', () => {
  controls.enabled = true;
  gravityOnOff = true;
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
    cube.userData = [];

    scene.add(cube);
    objetos.push(cube);
    objetos2.push(cube);
    collisionMesh.push(cube);
  });
}

document.getElementById('botonCrear').addEventListener('click', createPiece);

function distanceToNextObject(obj, axis) {
  let [x, y, z] = [0, 0, 0];
  switch (axis) {
    case 'y':
      y = -1;
      break;
    case 'x':
      x = -1;
      break;
    case 'z':
      z = -1;
      break;
    default:
      break;
  }

  const raycaster = new THREE.Raycaster();
  raycaster.set(obj.position, new THREE.Vector3(x, y, z));
  const intersects = raycaster.intersectObjects(collisionMesh, true);

  return intersects.length > 0 ? intersects[0].point.y : worldFloor;
}

function gravity(mesh) {
  const anyTarget = new THREE.Vector3();
  const floorY = distanceToNextObject(mesh, 'y');

  const box = new THREE.Box3().setFromObject(mesh);
  const halfPc = box.getSize(anyTarget).y / 2;

  if (gravityOnOff) {
    mesh.position.y = floorY + halfPc + 0.01;
  }
}

function checkCollision2(mesh) {
  let collisionBoolAll = false;
  let collisionPoint;
  const collisionBoolArray = [];

  const originPoint = mesh.position.clone();
  const vertices = getBoxGeometryVertices(mesh);

  for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex++) {
    const localVertex = vertices[vertexIndex].clone();
    const globalVertex = localVertex.applyMatrix4(mesh.matrixWorld);
    const directionVector = globalVertex.sub(mesh.position);

    const ray = new THREE.Raycaster(originPoint, directionVector.clone().normalize());
    const collisionResults = ray.intersectObjects(collisionMesh, true);

    if (collisionResults.length > 0 && collisionResults[0].object !== mesh && collisionResults[0].distance < directionVector.length()) {
      collisionBoolArray.push(true);
      collisionPoint = collisionResults[0].point;
      controls2.enabled = false;
    } else {
      controls2.enabled = true;
      collisionBoolArray.push(false);
    }
  }

  collisionBoolAll = collisionBoolArray.some((value) => value === true);
  return [collisionBoolAll, collisionPoint];
}

function savePos(mesh) {
  const [collisionBoolAll] = checkCollision2(mesh);
  const posVector = mesh.position.clone();

  mesh.userData.push([posVector, collisionBoolAll]);
  if (mesh.userData.length > 50) {
    mesh.userData.shift();
  }
}

const loader = new GLTFLoader();
loader.load('mdcao767v3.gltf', handleLoad);

function handleLoad(gltf) {
  const mesh = gltf.scene.children[2];
  mesh.position.set(0, 0, 0);
  scene.add(mesh);

  mesh.children[0].material.color.setHex(0xb2b9c1);
  mesh.children[0].material.transparent = true;
  mesh.children[0].material.opacity = 0.1;

  collisionMesh.push(mesh.children[0]);
  collisionMesh.push(mesh.children[1]);
}

window.addEventListener('resize', () => {
  camera.aspect = container.offsetWidth / container.offsetHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.offsetWidth, container.offsetHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  for (let i = 0; i < objetos.length; i++) {
    gravity(objetos[i]);
    savePos(objetos[i]);
    const collvar = checkCollision2(objetos[i]);

    if (collvar[0]) {
      contadorIteraciones += 1;
      const j = Math.max(objetos[i].userData.length - contadorIteraciones - 1, 0);
      const mesh = objetos[i];
      mesh.position.y = mesh.userData[j][0].y;
      mesh.position.x = mesh.userData[j][0].x;
      mesh.position.z = mesh.userData[j][0].z;
    }

    if (!collvar[0]) {
      contadorIteraciones = 0;
    }
  }

  renderer.render(scene, camera);
}

animate();
