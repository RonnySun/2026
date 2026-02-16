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
    modelUrl: 'assets/models/model.glb'
  },

  onReady() {
    this.initScene();
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
        const GLTFLoader = registerGLTFLoader(THREE);
        const OrbitControls = registerOrbitControls(THREE);

        if (!GLTFLoader) {
          wx.showToast({ title: 'GLTFLoader 未加载', icon: 'none' });
          return;
        }

        const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        const dpr = sysInfo.pixelRatio || 1;
        const width = sysInfo.windowWidth;
        const height = sysInfo.windowHeight;

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

        const grid = new THREE.GridHelper(10, 20, 0xbbbbbb, 0xe2e2e2);
        grid.position.y = -0.001;
        scene.add(grid);

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
                  scene.add(model);

                  const box = new THREE.Box3().setFromObject(model);
                  const sizeVec = box.getSize(new THREE.Vector3());
                  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;

                  // Normalize model to stable world size so different GLB exports look consistent.
                  const targetWorldSize = 1.0;
                  const uniformScale = targetWorldSize / maxDim;
                  model.scale.setScalar(uniformScale);
                  model.updateMatrixWorld(true);

                  const fittedBox = new THREE.Box3().setFromObject(model);
                  const center = fittedBox.getCenter(new THREE.Vector3());
                  const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());
                  const radius = Math.max(sphere.radius, 0.001);

                  model.position.sub(center);
                  model.updateMatrixWorld(true);

                  // Keep model at roughly 20% of screen height (within your 10%-30% target range).
                  const desiredFill = 0.2;
                  const fovRad = (camera.fov * Math.PI) / 180;
                  const distance = radius / (desiredFill * Math.tan(fovRad / 2));

                  camera.near = Math.max(0.01, distance / 100);
                  camera.far = distance * 20;
                  camera.position.set(distance * 0.18, distance * 0.08, distance);
                  camera.lookAt(0, 0, 0);
                  camera.updateProjectionMatrix();

                  if (OrbitControls) {
                    try {
                      const controls = new OrbitControls(camera, canvas);
                      controls.target.set(0, 0, 0);
                      controls.enableDamping = true;
                      controls.dampingFactor = 0.08;
                      controls.update();
                      this.controls = controls;
                    } catch (controlErr) {
                      console.warn('OrbitControls disabled in mini program runtime:', controlErr);
                    }
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
          renderer.render(scene, camera);
          if (canvas.requestAnimationFrame) {
            this._raf = canvas.requestAnimationFrame(renderLoop);
          }
        };
        renderLoop();
      });
  }
});
