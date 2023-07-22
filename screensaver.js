let gridBounds = new THREE.Box3(
  new THREE.Vector3(-10, -10, -10),
  new THREE.Vector3(10, 10, 10)
);
let nodes = {};
function setAt(position, value) {
  nodes["(" + position.x + ", " + position.y + ", " + position.z + ")"] = value;
}
function getAt(position, value) {
  return nodes["(" + position.x + ", " + position.y + ", " + position.z + ")"];
}
function clearGrid() {
  nodes = {};
}

let textures = {};
let Pipe = function(scene, options) {
  let self = this;
  let pipeRadius = 0.2;
  let ballJointRadius = pipeRadius * 1.5;
  let teapotSize = ballJointRadius;

  self.currentPosition = randomIntegerVector3WithinBox(gridBounds);
  self.positions = [self.currentPosition];
  self.object3d = new THREE.Object3D();
  scene.add(self.object3d);
  if (options.texturePath) {
    self.material = new THREE.MeshLambertMaterial({
      map: textures[options.texturePath],
    });
  } else {
    let color = randomInteger(0, 0xffffff);
    let emissive = new THREE.Color(color).multiplyScalar(0.3);
    self.material = new THREE.MeshPhongMaterial({
      specular: 0xa9fcff,
      color: color,
      emissive: emissive,
      shininess: 100,
    });
  }
  let makeCylinderBetweenPoints = function(fromPoint, toPoint, material) {
    let deltaVector = new THREE.Vector3().subVectors(toPoint, fromPoint);
    let arrow = new THREE.ArrowHelper(
      deltaVector.clone().normalize(),
      fromPoint
    );
    let geometry = new THREE.CylinderGeometry(
      pipeRadius,
      pipeRadius,
      deltaVector.length(),
      10,
      4,
      true
    );
    let mesh = new THREE.Mesh(geometry, material);

    mesh.rotation.setFromQuaternion(arrow.quaternion);
    mesh.position.addVectors(fromPoint, deltaVector.multiplyScalar(0.5));
    mesh.updateMatrix();

    self.object3d.add(mesh);
  };
  let makeBallJoint = function(position) {
    let ball = new THREE.Mesh(
      new THREE.SphereGeometry(ballJointRadius, 8, 8),
      self.material
    );
    ball.position.copy(position);
    self.object3d.add(ball);
  };
  let makeTeapotJoint = function(position) {
    //let teapotTexture = textures[options.texturePath].clone();
    //teapotTexture.repeat.set(1, 1);

    // THREE.TeapotBufferGeometry = function ( size, segments, bottom, lid, body, fitLid, blinn )
    let teapot = new THREE.Mesh(
      new THREE.TeapotBufferGeometry(teapotSize, true, true, true, true, true),
      self.material
      //new THREE.MeshLambertMaterial({ map: teapotTexture })
    );
    teapot.position.copy(position);
    teapot.rotation.x = (Math.floor(random(0, 50)) * Math.PI) / 2;
    teapot.rotation.y = (Math.floor(random(0, 50)) * Math.PI) / 2;
    teapot.rotation.z = (Math.floor(random(0, 50)) * Math.PI) / 2;
    self.object3d.add(teapot);
  };
  let makeElbowJoint = function(fromPosition, toPosition, tangentVector) {
    // "elball" (not a proper elbow)
    let elball = new THREE.Mesh(
      new THREE.SphereGeometry(pipeRadius, 8, 8),
      self.material
    );
    elball.position.copy(fromPosition);
    self.object3d.add(elball);
  };

  // if (getAt(self.currentPosition)) {
  //   return; // TODO: find a position that's free
  // }
  setAt(self.currentPosition, self);

  makeBallJoint(self.currentPosition);

  self.update = function() {
    let lastPosition
    let lastDirectionVector

    if (self.positions.length > 1) {
      lastPosition = self.positions[self.positions.length - 2];
      lastDirectionVector = new THREE.Vector3().subVectors(
        self.currentPosition,
        lastPosition
      );
    }
    if (chance(1 / 2) && lastDirectionVector) {
      directionVector = lastDirectionVector;
    } else {
      directionVector = new THREE.Vector3();
      directionVector[chooseFrom("xyz")] += chooseFrom([+1, -1]);
    }
    let newPosition = new THREE.Vector3().addVectors(
      self.currentPosition,
      directionVector
    );

    // TODO: try other possibilities
    // ideally, have a pool of the 6 possible directions and try them in random order, removing them from the bag
    // (and if there's truly nowhere to go, maybe make a ball joint)
    if (!gridBounds.containsPoint(newPosition)) {
      return;
    }
    if (getAt(newPosition)) {
      return;
    }
    setAt(newPosition, self);

    // joint
    // (initial ball joint is handled elsewhere)
    if (lastDirectionVector && !lastDirectionVector.equals(directionVector)) {
      if (chance(options.teapotChance)) {
        makeTeapotJoint(self.currentPosition);
      } else if (chance(options.ballJointChance)) {
        makeBallJoint(self.currentPosition);
      } else {
        makeElbowJoint(self.currentPosition, newPosition, lastDirectionVector);
      }
    }

    // pipe
    makeCylinderBetweenPoints(self.currentPosition, newPosition, self.material);

    // update
    self.currentPosition = newPosition;
    self.positions.push(newPosition);

  };
};

let JOINTS_ELBOW = "elbow";
let JOINTS_BALL = "ball";
let JOINTS_MIXED = "mixed";
let JOINTS_CYCLE = "cycle";

let pipes = [];
let options = {
  multiple: true,
  texturePath: null,
  joints: JOINTS_MIXED,
  interval: [16, 24], // range of seconds between fade-outs... not necessarily anything like how the original works
};

// renderer
let canvasWebGL = document.getElementById("canvas-webgl");

let renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  canvas: canvasWebGL,
});
renderer.setSize(window.outerWidth, window.outerHeight);

// camera
let camera = new THREE.PerspectiveCamera(
  45,
  window.outerWidth / window.outerHeight,
  1,
  100000
);

// scene
let scene = new THREE.Scene();

// lighting
let ambientLight = new THREE.AmbientLight(0x111111);
scene.add(ambientLight);

let directionalLightL = new THREE.DirectionalLight(0xffffff, 0.9);
directionalLightL.position.set(-1.2, 1.5, 0.5);
scene.add(directionalLightL);

let textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

// this function is executed on each animation frame
function animate() {
  if (options.texturePath && !textures[options.texturePath]) {
    textureLoader.load(
      options.texturePath,
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        textures[options.texturePath] = texture;
      }
    )
  }
  // update
  for (let i = 0; i < pipes.length; i++) {
    pipes[i].update(scene);
  }
  if (pipes.length === 0) {
    let jointType = options.joints;
    if (options.joints === JOINTS_CYCLE) {
      jointType = jointsCycleArray[jointsCycleIndex++];
    }
    let pipeOptions = {
      teapotChance: 1 / 200, // 1 / 1000 in the original
      ballJointChance:
        jointType === JOINTS_BALL ? 1 : jointType === JOINTS_MIXED ? 1 / 3 : 0,
      texturePath: options.texturePath,
    };
    if (chance(1 / 5) && isWinter(new Date())) {
      pipeOptions.teapotChance = 1 / 20; // why not? :)
      pipeOptions.texturePath = "./images/textures/candycane.png";
      // TODO: DRY
      if (!textures[pipeOptions.texturePath]) {
        textureLoader.load(
          pipeOptions.texturePath,
          (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            textures[options.texturePath] = texture;
          }
        )
      }
    }
    // TODO: create new pipes over time?
    for (let i = 0; i < 1 + options.multiple * (1 + chance(1 / 10)); i++) {
      pipes.push(new Pipe(scene, pipeOptions));
    }
  }

  if (drawing) {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
    
  }
  // finish drawing if drawing == false
  return;
}

function look() {
  // TODO: never don't change the view (except maybe while clearing)
  if (chance(1 / 2)) {
    // head-on view
    camera.position.set(0, 0, 14);
  } else {
    // random view

    let vector = new THREE.Vector3(14, 0, 0);

    let axis = new THREE.Vector3(random(-1, 1), random(-1, 1), random(-1, 1));
    let angle = Math.PI / 2;
    let matrix = new THREE.Matrix4().makeRotationAxis(axis, angle);

    vector.applyMatrix4(matrix);
    camera.position.copy(vector);
  }
  let center = new THREE.Vector3(0, 0, 0);
  camera.lookAt(center);
}
look();


addEventListener(
  "resize",
  function() {
    camera.aspect = window.outerWidth / window.outerHeight;
    camera.updateProjectionMatrix();
    
    // fix aspect ratio after we've stopped drawing after the timeout
    renderer.setSize(window.outerWidth, window.outerHeight);
    renderer.render(scene, camera);
    requestAnimationFrame(()=>{});
  },
  false
);

// halt animation after a set timeout
drawing = true;
setTimeout(() => {
  drawing = false;
}, 5000);

// start animation
animate();

/**************\
|boring helpers|
\**************/
function isWinter(date = new Date()) {
  var start = new Date(date.getFullYear(), 2, 1);
  var end = new Date(date.getFullYear(), 11, 31);
  return !(date > start && date < end);
}

function random(x1, x2) {
  return Math.random() * (x2 - x1) + x1;
}

function randomInteger(x1, x2) {
  return Math.round(random(x1, x2));
}

function chance(value) {
  return Math.random() < value;
}

function chooseFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function shuffleArrayInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function randomIntegerVector3WithinBox(box) {
  return new THREE.Vector3(
    randomInteger(box.min.x, box.max.x),
    randomInteger(box.min.y, box.max.y),
    randomInteger(box.min.z, box.max.z)
  );
}