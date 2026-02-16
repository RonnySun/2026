function loadThreejsMiniprogram() {
  try {
    return require('../../libs/threejs-miniprogram');
  } catch (err) {
    console.error('load threejs-miniprogram failed:', err);
    return null;
  }
}

function registerGLTFLoader(THREE) {
  const g =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : {};
  g.THREE = THREE;

  if (THREE.GLTFLoader) return THREE.GLTFLoader;
  try {
    require('../../libs/GLTFLoader');
  } catch (err) {
    console.error('load GLTFLoader failed:', err);
    return null;
  }
  return THREE.GLTFLoader || null;
}

function registerOrbitControls(THREE) {
  const g =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : {};
  g.THREE = THREE;

  if (THREE.OrbitControls) return THREE.OrbitControls;
  try {
    require('../../libs/OrbitControls');
  } catch (err) {
    console.error('load OrbitControls failed:', err);
    return null;
  }
  return THREE.OrbitControls || null;
}

Page({
  data: {
    modelUrl: 'assets/models/model.glb',
    scalePercent: 80,
    armAngle: 0,
    headAngle: 0
  },

  onReady() {
    this.initScene();
  },

  onScaleChanging(e) {
    const percent = Number(e.detail.value);
    this.applyScalePercent(percent, true);
  },

  onScaleChange(e) {
    const percent = Number(e.detail.value);
    this.applyScalePercent(percent, true);
  },

  onArmAngleChanging(e) {
    const angle = Number(e.detail.value);
    this.applyArmAngle(angle, true);
  },

  onArmAngleChange(e) {
    const angle = Number(e.detail.value);
    this.applyArmAngle(angle, true);
  },

  onHeadAngleChanging(e) {
    const angle = Number(e.detail.value);
    this.applyHeadAngle(angle, true);
  },

  onHeadAngleChange(e) {
    const angle = Number(e.detail.value);
    this.applyHeadAngle(angle, true);
  },

  onUnload() {
    if (this._raf && this.canvas && this.canvas.cancelAnimationFrame) {
      this.canvas.cancelAnimationFrame(this._raf);
    }
    if (this.controls && this.controls.dispose) {
      this.controls.dispose();
    }
    if (this.renderer && this.renderer.dispose) {
      this.renderer.dispose();
    }
  },

  onCanvasTouchStart(e) {
    if (!this.modelRoot || !e.touches) return;

    if (e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      this._touchMode = 'pinch';
      this._pinchStartDistance = this.getTouchDistance(t0, t1);
      this._pinchStartPercent = this.scalePercent || this.data.scalePercent || 80;
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      this._touchMode = 'rotate';
      this._touchState = {
        x: typeof t.pageX === 'number' ? t.pageX : t.clientX,
        y: typeof t.pageY === 'number' ? t.pageY : t.clientY
      };
    }
  },

  onCanvasTouchMove(e) {
    if (!this.modelRoot || !e.touches) return;

    if (e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const currentDistance = this.getTouchDistance(t0, t1);
      const startDistance = this._pinchStartDistance || currentDistance;
      const basePercent = this._pinchStartPercent || this.scalePercent || this.data.scalePercent || 80;
      if (startDistance > 0) {
        const ratio = currentDistance / startDistance;
        const nextPercent = basePercent * ratio;
        this.applyScalePercent(nextPercent, true);
      }
      this._touchMode = 'pinch';
      return;
    }

    if (e.touches.length !== 1 || this._touchMode !== 'rotate' || !this._touchState) return;

    const t = e.touches[0];
    const x = typeof t.pageX === 'number' ? t.pageX : t.clientX;
    const y = typeof t.pageY === 'number' ? t.pageY : t.clientY;
    const dx = x - this._touchState.x;
    const dy = y - this._touchState.y;

    this._touchState = { x, y };

    const vw = (this.viewport && this.viewport.width) || 375;
    const vh = (this.viewport && this.viewport.height) || 667;
    const yawDelta = (dx / vw) * Math.PI;
    const pitchDelta = (dy / vh) * Math.PI;

    if (this.yawPivot) {
      this.yawPivot.rotation.y += yawDelta;
    }
    if (this.pitchPivot) {
      this.pitchPivot.rotation.x += pitchDelta;
      this.pitchPivot.rotation.x = Math.max(-0.9, Math.min(0.9, this.pitchPivot.rotation.x));
    }
  },

  onCanvasTouchEnd(e) {
    if (e && e.touches && e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      this._touchMode = 'pinch';
      this._pinchStartDistance = this.getTouchDistance(t0, t1);
      this._pinchStartPercent = this.scalePercent || this.data.scalePercent || 80;
      return;
    }

    if (e && e.touches && e.touches.length === 1) {
      const t = e.touches[0];
      this._touchMode = 'rotate';
      this._touchState = {
        x: typeof t.pageX === 'number' ? t.pageX : t.clientX,
        y: typeof t.pageY === 'number' ? t.pageY : t.clientY
      };
      return;
    }

    this._touchMode = null;
    this._touchState = null;
    this._pinchStartDistance = null;
    this._pinchStartPercent = null;
  },

  getTouchDistance(t0, t1) {
    const x0 = typeof t0.pageX === 'number' ? t0.pageX : t0.clientX;
    const y0 = typeof t0.pageY === 'number' ? t0.pageY : t0.clientY;
    const x1 = typeof t1.pageX === 'number' ? t1.pageX : t1.clientX;
    const y1 = typeof t1.pageY === 'number' ? t1.pageY : t1.clientY;
    const dx = x0 - x1;
    const dy = y0 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  applyScalePercent(percent, syncData) {
    if (!this.camera || !this.modelRadius) return;
    const clamped = Math.max(60, Math.min(100, Number(percent) || 80));
    this.scalePercent = clamped;
    const fill = clamped / 100;
    // Keep the model comfortably inside the framed viewport.
    const visualFill = fill * 0.82;
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const distance = this.modelRadius / (visualFill * Math.tan(fovRad / 2));

    this.camera.near = Math.max(0.01, distance / 100);
    this.camera.far = distance * 20;
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    if (syncData) {
      this.setData({ scalePercent: clamped });
    }
  },

  applyArmAngle(angle, syncData) {
    const clamped = Math.max(-135, Math.min(135, Number(angle) || 0));
    this.armAngle = clamped;
    this.applyMotorPose();
    if (syncData) {
      this.setData({ armAngle: clamped });
    }
  },

  applyHeadAngle(angle, syncData) {
    const clamped = Math.max(0, Math.min(50, Number(angle) || 0));
    this.headAngle = clamped;
    this.applyMotorPose();
    if (syncData) {
      this.setData({ headAngle: clamped });
    }
  },

  applyMotorPose() {
    if (!this.THREE || !this.armNode || !this.headNode || !this.armBaseQuat || !this.headBaseQuat) {
      return;
    }

    const THREE = this.THREE;
    const armRad = (this.armAngle || 0) * Math.PI / 180;
    const headPitchRad = -(this.headAngle || 0) * Math.PI / 180;

    const armYawQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, armRad, 0, 'XYZ'));
    // Yaw around model/world vertical axis for natural left-right motion.
    this.armNode.quaternion.copy(this.armBaseQuat);
    this.armNode.quaternion.premultiply(armYawQ);

    // Head pitch is independent; left-right follow comes from hierarchy re-parenting.
    const headPitchQ = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(headPitchRad, 0, 0, 'XYZ')
    );
    this.headNode.quaternion.copy(this.headBaseQuat);
    this.headNode.quaternion.multiply(headPitchQ);
  },

  reparentKeepWorldTransform(child, newParent) {
    if (!this.THREE || !child || !newParent || child === newParent || child.parent === newParent) return;
    const THREE = this.THREE;

    child.updateMatrixWorld(true);
    newParent.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    child.matrixWorld.decompose(worldPos, worldQuat, worldScale);

    if (child.parent) {
      child.parent.remove(child);
    }
    newParent.add(child);

    const parentWorldPos = new THREE.Vector3();
    const parentWorldQuat = new THREE.Quaternion();
    const parentWorldScale = new THREE.Vector3();
    newParent.matrixWorld.decompose(parentWorldPos, parentWorldQuat, parentWorldScale);

    const invParentQuat = parentWorldQuat.clone().inverse();
    child.position.copy(worldPos);
    newParent.worldToLocal(child.position);
    child.quaternion.copy(invParentQuat.multiply(worldQuat));
    child.scale.set(
      worldScale.x / (parentWorldScale.x || 1),
      worldScale.y / (parentWorldScale.y || 1),
      worldScale.z / (parentWorldScale.z || 1)
    );
    child.updateMatrixWorld(true);
  },

  initScene() {
    wx.createSelectorQuery()
      .in(this)
      .select('#webgl')
      .node()
      .exec((res) => {
        const canvas = res && res[0] ? res[0].node : null;
        if (!canvas) {
          wx.showToast({ title: '找不到 Canvas', icon: 'none' });
          return;
        }

        this.canvas = canvas;
        const threejsMP = loadThreejsMiniprogram();
        if (!threejsMP || typeof threejsMP.createScopedThreejs !== 'function') {
          wx.showToast({ title: '请先构建 npm', icon: 'none' });
          console.error(
            'threejs-miniprogram not found. Run npm install and "构建 npm" in WeChat DevTools.'
          );
          return;
        }

        const { createScopedThreejs } = threejsMP;
        const THREE = createScopedThreejs(canvas);
        this.THREE = THREE;
        const GLTFLoader = registerGLTFLoader(THREE);
        registerOrbitControls(THREE);

        if (!GLTFLoader) {
          wx.showToast({ title: 'GLTFLoader 未加载', icon: 'none' });
          return;
        }

        const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = sysInfo.pixelRatio || 1;
        const width = sysInfo.windowWidth;
        const height = sysInfo.windowHeight;
        this.viewport = { width, height };

        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          canvas
        });
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height);
        renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer = renderer;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xdddddf);

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        camera.position.set(1.8, 1.2, 2.2);
        this.camera = camera;

        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        scene.add(hemi);

        const dir = new THREE.DirectionalLight(0xffffff, 1.1);
        dir.position.set(3, 4, 2);
        scene.add(dir);

        // Remove grid helper to avoid the horizontal center line in preview.

        const loader = new GLTFLoader();
        const filePath = this.data.modelUrl.replace(/^\//, '');
        wx.getFileSystemManager().readFile({
          filePath,
          success: (res2) => {
            try {
              loader.parse(
                res2.data,
                '',
                (gltf) => {
                  const model = gltf.scene;
                  const modelRoot = new THREE.Group();
                  modelRoot.add(model);

                  const box = new THREE.Box3().setFromObject(modelRoot);
                  const sizeVec = box.getSize(new THREE.Vector3());
                  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;

                  // Normalize model to stable world size so different GLB exports look consistent.
                  const targetWorldSize = 1.0;
                  const uniformScale = targetWorldSize / maxDim;
                  modelRoot.scale.setScalar(uniformScale);
                  modelRoot.updateMatrixWorld(true);

                  const fittedBox = new THREE.Box3().setFromObject(modelRoot);
                  const center = fittedBox.getCenter(new THREE.Vector3());
                  const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());
                  const radius = Math.max(sphere.radius, 0.001);

                  modelRoot.position.sub(center);
                  modelRoot.updateMatrixWorld(true);

                  // Two-level pivot keeps rotation centered on the model and touch interaction intuitive.
                  const yawPivot = new THREE.Group();
                  const pitchPivot = new THREE.Group();
                  yawPivot.add(pitchPivot);
                  pitchPivot.add(modelRoot);
                  scene.add(yawPivot);

                  this.modelRoot = modelRoot;
                  this.yawPivot = yawPivot;
                  this.pitchPivot = pitchPivot;
                  this.modelRadius = radius;
                  this.applyScalePercent(this.data.scalePercent, false);

                  this.armNode = modelRoot.getObjectByName('斜杆_Arm_Oblique');
                  this.headNode = modelRoot.getObjectByName('灯头_Head');
                  this.headConnectorNode = modelRoot.getObjectByName('灯头连接件_Head_Connector');

                  if (!this.armNode || !this.headNode || !this.headConnectorNode) {
                    console.warn(
                      'motor nodes not found:',
                      !!this.armNode,
                      !!this.headNode,
                      !!this.headConnectorNode
                    );
                    wx.showToast({ title: '电机节点未找到', icon: 'none' });
                  } else {
                    // Re-parent head to connector while preserving world pose.
                    this.reparentKeepWorldTransform(this.headNode, this.headConnectorNode);
                    this.armBaseQuat = this.armNode.quaternion.clone();
                    this.headBaseQuat = this.headNode.quaternion.clone();
                    this.applyMotorPose();
                  }
                },
                (err) => {
                  console.error('GLB parse error:', err);
                  wx.showToast({ title: '模型解析失败', icon: 'none' });
                }
              );
            } catch (err) {
              console.error('GLB parse exception:', err);
              wx.showToast({ title: '模型解析异常', icon: 'none' });
            }
          },
          fail: (err) => {
            console.error('GLB read error:', err, 'path=', filePath);
            wx.showToast({ title: '模型读取失败', icon: 'none' });
          }
        });

        const renderLoop = () => {
          if (this.controls) this.controls.update();
          if (this.camera) this.camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
          if (canvas.requestAnimationFrame) {
            this._raf = canvas.requestAnimationFrame(renderLoop);
          }
        };
        renderLoop();
      });
  }
});
