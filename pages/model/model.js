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
    headAngle: 0,
    motor24SpeedHz: 300,
    motor35SpeedHz: 300,
    bleReady: false,
    bleScanning: false,
    bleConnected: false,
    bleStatus: '蓝牙未初始化',
    bleDevices: [],
    bleDeviceName: '',
    bleDeviceId: '',
    bleServiceId: '',
    bleCharacteristicId: '',
    lastSentJson: '',
    autoMode: 'off',
    autoStatus: '关闭',
    soundLevelPct: 0,
    micSensitivity: 55,
    ledOn: true,
    ledMode: 'warm',
    ledBrightness: 75
  },

  onReady() {
    this.initScene();
    this.initBluetooth();
    this.initAutoSwing();
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

  onMotor24SpeedChanging(e) {
    const speed = Number(e.detail.value);
    this.applyMotor24Speed(speed, true);
  },

  onMotor24SpeedChange(e) {
    const speed = Number(e.detail.value);
    this.applyMotor24Speed(speed, true);
  },

  onMotor35SpeedChanging(e) {
    const speed = Number(e.detail.value);
    this.applyMotor35Speed(speed, true);
  },

  onMotor35SpeedChange(e) {
    const speed = Number(e.detail.value);
    this.applyMotor35Speed(speed, true);
  },

  onMicSensitivityChanging(e) {
    const value = Number(e.detail.value);
    this.applyMicSensitivity(value, true);
  },

  onMicSensitivityChange(e) {
    const value = Number(e.detail.value);
    this.applyMicSensitivity(value, true);
  },

  onLedSwitchChange(e) {
    this.applyLedOn(!!e.detail.value, true);
  },

  onTapWarmLight() {
    this.applyLedMode('warm', true);
  },

  onTapWhiteLight() {
    this.applyLedMode('white', true);
  },

  onLedBrightnessChanging(e) {
    const value = Number(e.detail.value);
    this.applyLedBrightness(value, true);
  },

  onLedBrightnessChange(e) {
    const value = Number(e.detail.value);
    this.applyLedBrightness(value, true);
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
    this.stopAutoSwing();
    this.cleanupAutoSwing();
    this.cleanupBluetooth();
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

  initAutoSwing() {
    this.baseArmAngle = this.data.armAngle || 0;
    this.baseHeadAngle = this.data.headAngle || 0;
    this._autoLoopTimer = null;
    this._autoLevel = 0;
    this._autoBeatPulse = 0;
    this._autoArmCurrent = this.baseArmAngle;
    this._autoHeadCurrent = this.baseHeadAngle;
    this._autoPhase = 0;
    this._uiLevelTimer = null;
    this._lastAutoUiAt = 0;
    this._lastAutoSendAt = 0;
    this.resetMicDynamics();

    this.musicAudio = wx.createInnerAudioContext();
    this.musicAudio.loop = true;
    this.musicAudio.autoplay = false;
    this._musicPrimarySrc = '/assets/music/ode_to_joy.mp3';
    this._musicFallbackSrc = '/assets/music/lamp_demo.wav';
    this._musicUsingFallback = false;
    this._musicResolved = false;
    this.musicAudio.onError(() => {
      if (!this._musicUsingFallback) {
        this._musicUsingFallback = true;
        this._musicResolved = true;
        this.musicAudio.src = this._musicFallbackSrc;
        this.setData({ autoStatus: '欢乐颂未找到，已切回默认音乐' });
        return;
      }
      this.setData({ autoStatus: '内置音乐加载失败' });
    });

    this.recorder = wx.getRecorderManager();
    this.recorder.onStart(() => {
      if (this.data.autoMode === 'mic') {
        this.setData({ autoStatus: '环境拾音中...' });
      }
    });
    this.recorder.onStop(() => {
      if (this.data.autoMode === 'mic') {
        this.setData({ autoStatus: '环境拾音已停止' });
      }
    });
    this.recorder.onError((err) => {
      console.error('recorder error:', err);
      if (this.data.autoMode === 'mic') {
        this.setData({ autoStatus: '录音失败，请检查麦克风权限' });
      }
    });
    this.recorder.onFrameRecorded((res) => {
      if (this.data.autoMode !== 'mic') return;
      const buffer = res.frameBuffer;
      if (!buffer || buffer.byteLength < 4) return;
      const view = new DataView(buffer);
      let sum = 0;
      let diffSum = 0;
      let count = 0;
      let prev = 0;
      for (let i = 0; i + 1 < view.byteLength; i += 2) {
        const s = view.getInt16(i, true);
        sum += s * s;
        if (count > 0) {
          const d = s - prev;
          diffSum += d * d;
        }
        prev = s;
        count += 1;
      }
      if (!count) return;
      const rms = Math.sqrt(sum / count) / 32768;
      const diffRms = count > 1 ? Math.sqrt(diffSum / (count - 1)) / 32768 : 0;
      this.updateMicDynamics(rms, diffRms);
    });
  },

  resetMicDynamics() {
    this._micNoiseFloor = 0.008;
    this._micGateOpen = false;
    this._micGainRef = 0.06;
    this._micFastEnv = 0;
    this._micSlowEnv = 0;
    this._micDiffEnv = 0;
    this._micFluxFloor = 0.01;
    this._micLastBeatAt = 0;
    this._autoBeatPulse = 0;
  },

  updateMicDynamics(rms, diffRms) {
    const sensitivity = (this.micSensitivity || this.data.micSensitivity || 55) / 100;
    const now = Date.now();
    const floorFollow = rms < this._micNoiseFloor * 1.8 ? 0.05 : 0.006;
    this._micNoiseFloor += (rms - this._micNoiseFloor) * floorFollow;
    this._micNoiseFloor = Math.max(0.004, Math.min(0.05, this._micNoiseFloor));

    const gateOpenMul = 2.45 - sensitivity * 1.05;
    const gateCloseMul = 1.85 - sensitivity * 0.8;
    const gateOpenTh = Math.max(0.009, this._micNoiseFloor * gateOpenMul);
    const gateCloseTh = Math.max(0.007, this._micNoiseFloor * gateCloseMul);
    if (this._micGateOpen) {
      this._micGateOpen = rms > gateCloseTh;
    } else {
      this._micGateOpen = rms > gateOpenTh;
    }

    const cleaned = this._micGateOpen ? Math.max(0, rms - this._micNoiseFloor * 1.1) : 0;
    this._micGainRef = Math.max(cleaned, this._micGainRef * 0.992);
    this._micGainRef = Math.max(0.03, Math.min(0.35, this._micGainRef));

    const gainScale = 1.24 - sensitivity * 0.56;
    const normalized = Math.max(0, Math.min(1, cleaned / (this._micGainRef * gainScale + 1e-6)));
    const compressed = Math.pow(normalized, 1.35);
    const atk = compressed > this._micFastEnv ? 0.28 : 0.08;
    this._micFastEnv += (compressed - this._micFastEnv) * atk;
    this._micSlowEnv += (this._micFastEnv - this._micSlowEnv) * 0.06;

    this._micDiffEnv += (diffRms - this._micDiffEnv) * 0.22;
    this._micFluxFloor += (this._micDiffEnv - this._micFluxFloor) * 0.03;
    const transient = Math.max(0, this._micDiffEnv - this._micFluxFloor * 1.08);
    const beatStrength = Math.max(0, Math.min(1, transient * (9 + sensitivity * 12)));

    if (beatStrength > 0.5 && now - this._micLastBeatAt > 170) {
      this._micLastBeatAt = now;
      this._autoBeatPulse = Math.max(this._autoBeatPulse, beatStrength);
    }

    this._autoLevel = this._micFastEnv;
  },

  cleanupAutoSwing() {
    if (this.musicAudio) {
      this.musicAudio.stop();
      this.musicAudio.destroy();
      this.musicAudio = null;
    }
    if (this.recorder) {
      this.recorder.stop();
      this.recorder = null;
    }
  },

  onTapStartMusicSwing() {
    this.stopAutoSwing();
    this.baseArmAngle = this.armAngle || this.data.armAngle || 0;
    this.baseHeadAngle = this.headAngle || this.data.headAngle || 0;
    this._autoLevel = 0.55;
    this._autoBeatPulse = 0.25;
    this._autoArmCurrent = this.baseArmAngle;
    this._autoHeadCurrent = this.baseHeadAngle;
    this._autoPhase = Math.random() * Math.PI * 2;
    this.setData({
      autoMode: 'music',
      autoStatus: '内置音乐自动摇摆',
      soundLevelPct: 55
    });
    this.resolveMusicSource(() => {
      if (this.musicAudio) {
        this.musicAudio.seek(0);
        this.musicAudio.play();
      }
    });
    this.startAutoLoop();
  },

  resolveMusicSource(done) {
    if (!this.musicAudio) {
      if (typeof done === 'function') done();
      return;
    }
    if (this._musicResolved) {
      if (typeof done === 'function') done();
      return;
    }
    const fs = wx.getFileSystemManager();
    const primaryPath = this._musicPrimarySrc.replace(/^\//, '');
    fs.access({
      path: primaryPath,
      success: () => {
        this._musicUsingFallback = false;
        this._musicResolved = true;
        this.musicAudio.src = this._musicPrimarySrc;
        if (typeof done === 'function') done();
      },
      fail: () => {
        this._musicUsingFallback = true;
        this._musicResolved = true;
        this.musicAudio.src = this._musicFallbackSrc;
        if (typeof done === 'function') done();
      }
    });
  },

  onTapStartMicSwing() {
    this.stopAutoSwing();
    wx.getSetting({
      success: (res) => {
        const granted = !!(res.authSetting && res.authSetting['scope.record']);
        if (granted) {
          this.startMicSwing();
          return;
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => this.startMicSwing(),
          fail: () => {
            this.setData({ autoStatus: '麦克风权限未开启，请到设置里授权' });
          }
        });
      },
      fail: () => {
        this.setData({ autoStatus: '读取权限状态失败' });
      }
    });
  },

  startMicSwing() {
    this.baseArmAngle = this.armAngle || this.data.armAngle || 0;
    this.baseHeadAngle = this.headAngle || this.data.headAngle || 0;
    this._autoLevel = 0;
    this._autoArmCurrent = this.baseArmAngle;
    this._autoHeadCurrent = this.baseHeadAngle;
    this._autoPhase = Math.random() * Math.PI * 2;
    this.resetMicDynamics();
    this.setData({
      autoMode: 'mic',
      autoStatus: '正在启动环境拾音...',
      soundLevelPct: 0
    });

    if (this.recorder) {
      this.recorder.start({
        duration: 600000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'PCM',
        frameSize: 4
      });
    }
    this.startAutoLoop();
  },

  onTapStopAutoSwing() {
    this.stopAutoSwing();
    this.applyArmAngle(this.baseArmAngle || 0, true);
    this.applyHeadAngle(this.baseHeadAngle || 0, true);
  },

  stopAutoSwing() {
    if (this._autoLoopTimer) {
      clearInterval(this._autoLoopTimer);
      this._autoLoopTimer = null;
    }
    if (this.musicAudio) {
      this.musicAudio.pause();
    }
    if (this.recorder) {
      this.recorder.stop();
    }
    this._autoLevel = 0;
    this._autoBeatPulse = 0;
    this._autoArmCurrent = this.armAngle || this.data.armAngle || 0;
    this._autoHeadCurrent = this.headAngle || this.data.headAngle || 0;
    this.setData({
      autoMode: 'off',
      autoStatus: '关闭',
      soundLevelPct: 0
    });
  },

  startAutoLoop() {
    if (this._autoLoopTimer) clearInterval(this._autoLoopTimer);
    this._autoLoopTimer = setInterval(() => {
      const mode = this.data.autoMode;
      if (mode === 'off') return;

      const t = Date.now() / 1000;
      let level = this._autoLevel;
      let beatPulse = this._autoBeatPulse || 0;
      if (mode === 'music') {
        const beat = Math.max(0, Math.sin(t * Math.PI * 2 * 2.0));
        const swing = 0.3 + beat * 0.55 + Math.max(0, Math.sin(t * Math.PI * 2 * 0.35)) * 0.18;
        level = Math.min(1, swing);
        this._autoLevel = level;
        beatPulse = Math.max(beatPulse * 0.9, beat * 0.8);
      } else {
        level = Math.max(0, Math.min(1, this._autoLevel || 0));
        beatPulse = Math.max(0, Math.min(1, beatPulse * 0.88));
      }
      this._autoBeatPulse = beatPulse;

      const armAmp = 8 + 36 * level;
      const headAmp = 6 + 30 * level;
      const armWave =
        Math.sin(t * Math.PI * 2 * 0.42 + this._autoPhase) * armAmp +
        Math.sin(t * Math.PI * 2 * 0.19 + this._autoPhase * 0.6) * (armAmp * 0.22) +
        beatPulse * 8;
      const headWave =
        (Math.sin(t * Math.PI * 2 * (0.72 + level * 0.2) + 1.1 + this._autoPhase) * 0.5 + 0.5) * headAmp +
        beatPulse * 6;

      const armTarget = Math.max(-135, Math.min(135, (this.baseArmAngle || 0) + armWave));
      const headTarget = Math.max(0, Math.min(50, (this.baseHeadAngle || 0) + headWave));

      const armFollow = mode === 'mic' ? 0.16 : 0.2;
      const headFollow = mode === 'mic' ? 0.2 : 0.24;
      this._autoArmCurrent += (armTarget - this._autoArmCurrent) * armFollow;
      this._autoHeadCurrent += (headTarget - this._autoHeadCurrent) * headFollow;
      const arm = this._autoArmCurrent;
      const head = this._autoHeadCurrent;

      this.armAngle = arm;
      this.headAngle = head;
      this.applyMotorPose();

      const now = Date.now();
      if (now - this._lastAutoUiAt > 120) {
        this._lastAutoUiAt = now;
        this.setData({
          armAngle: Number(arm.toFixed(1)),
          headAngle: Number(head.toFixed(1)),
          soundLevelPct: Math.round(Math.max(level, beatPulse * 0.75) * 100)
        });
      }
      if (now - this._lastAutoSendAt > 140) {
        this._lastAutoSendAt = now;
        this.scheduleSendMotorCommand('auto_' + mode);
      }
    }, 40);
  },

  initBluetooth() {
    wx.openBluetoothAdapter({
      success: () => {
        this.setData({
          bleReady: true,
          bleStatus: '蓝牙已就绪，等待连接'
        });
      },
      fail: () => {
        this.setData({
          bleReady: false,
          bleStatus: '请先开启手机蓝牙'
        });
      }
    });
  },

  cleanupBluetooth() {
    this._bleDeviceMap = null;
    this._sendTimer = null;
    wx.offBluetoothDeviceFound();
    wx.stopBluetoothDevicesDiscovery({ fail: () => {} });
    if (this.data.bleConnected && this.data.bleDeviceId) {
      wx.closeBLEConnection({
        deviceId: this.data.bleDeviceId,
        fail: () => {}
      });
    }
    wx.closeBluetoothAdapter({ fail: () => {} });
  },

  onTapScanBle() {
    if (!this.data.bleReady) {
      this.initBluetooth();
      return;
    }

    this._bleDeviceMap = {};
    this.setData({
      bleDevices: [],
      bleScanning: true,
      bleStatus: '正在扫描附近设备...'
    });

    wx.offBluetoothDeviceFound();
    wx.onBluetoothDeviceFound((res) => {
      const found = res.devices || [];
      if (!found.length) return;

      found.forEach((d) => {
        const name = d.name || d.localName || '未命名设备';
        if (!d.deviceId) return;
        this._bleDeviceMap[d.deviceId] = {
          deviceId: d.deviceId,
          name: name + ' (' + d.deviceId.slice(-6) + ')'
        };
      });

      const list = Object.keys(this._bleDeviceMap).map((id) => this._bleDeviceMap[id]);
      this.setData({ bleDevices: list });
    });

    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: () => {},
      fail: () => {
        this.setData({
          bleScanning: false,
          bleStatus: '扫描失败，请检查蓝牙权限'
        });
      }
    });
  },

  onTapStopScanBle() {
    wx.stopBluetoothDevicesDiscovery({
      complete: () => {
        this.setData({
          bleScanning: false,
          bleStatus: this.data.bleConnected ? '已连接，可发送控制数据' : '扫描已停止'
        });
      }
    });
  },

  onTapConnectBle(e) {
    const deviceId = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '';
    if (!deviceId) return;

    wx.stopBluetoothDevicesDiscovery({ fail: () => {} });
    this.setData({
      bleScanning: false,
      bleStatus: '正在连接设备...'
    });

    wx.createBLEConnection({
      deviceId,
      timeout: 10000,
      success: () => {
        this.resolveWritableCharacteristic(deviceId, name);
      },
      fail: () => {
        this.setData({
          bleConnected: false,
          bleStatus: '连接失败，请重试'
        });
      }
    });
  },

  resolveWritableCharacteristic(deviceId, name) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (sres) => {
        const services = sres.services || [];
        const walk = (idx) => {
          if (idx >= services.length) {
            this.setData({
              bleStatus: '未找到可写入特征值'
            });
            return;
          }
          const svc = services[idx];
          wx.getBLEDeviceCharacteristics({
            deviceId,
            serviceId: svc.uuid,
            success: (cres) => {
              const chars = cres.characteristics || [];
              const writable = chars.find((c) => c.properties && (c.properties.write || c.properties.writeNoResponse));
              if (writable) {
                this.setData({
                  bleConnected: true,
                  bleDeviceId: deviceId,
                  bleDeviceName: name || 'ESP32-S3',
                  bleServiceId: svc.uuid,
                  bleCharacteristicId: writable.uuid,
                  bleStatus: '已连接，可发送控制数据'
                });
                this.sendMotorCommand('connect');
              } else {
                walk(idx + 1);
              }
            },
            fail: () => walk(idx + 1)
          });
        };
        walk(0);
      },
      fail: () => {
        this.setData({ bleStatus: '读取服务失败' });
      }
    });
  },

  onTapDisconnectBle() {
    const deviceId = this.data.bleDeviceId;
    if (!deviceId) return;
    wx.closeBLEConnection({
      deviceId,
      complete: () => {
        this.setData({
          bleConnected: false,
          bleServiceId: '',
          bleCharacteristicId: '',
          bleDeviceId: '',
          bleDeviceName: '',
          bleStatus: '已断开连接'
        });
      }
    });
  },

  scheduleSendMotorCommand(reason) {
    if (this._sendTimer) {
      clearTimeout(this._sendTimer);
    }
    this._sendTimer = setTimeout(() => {
      this._sendTimer = null;
      this.sendMotorCommand(reason);
    }, 80);
  },

  sendMotorCommand(reason) {
    const ledOn = typeof this.ledOn === 'boolean' ? this.ledOn : !!this.data.ledOn;
    const ledMode = this.ledMode || this.data.ledMode || 'warm';
    const ledBrightness = Number(this.ledBrightness || this.data.ledBrightness || 75);
    const payload = {
      cmd: 'lamp_motor_set',
      reason: reason || 'update',
      motor24: {
        node: '斜杆_Arm_Oblique',
        angle: Number((this.armAngle || 0).toFixed(2)),
        speedHz: Number(this.motor24SpeedHz || this.data.motor24SpeedHz || 300)
      },
      motor35: {
        node: '灯头_Head',
        angle: Number((this.headAngle || 0).toFixed(2)),
        speedHz: Number(this.motor35SpeedHz || this.data.motor35SpeedHz || 300)
      },
      light: {
        on: ledOn,
        mode: ledMode,
        brightness: ledBrightness
      },
      ts: Date.now()
    };
    const json = JSON.stringify(payload);
    this.setData({ lastSentJson: json });

    if (!this.data.bleConnected || !this.data.bleDeviceId || !this.data.bleServiceId || !this.data.bleCharacteristicId) {
      return;
    }

    this.writeBleJson(json);
  },

  writeBleJson(text) {
    const maxLen = 20;
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLen) {
      chunks.push(text.slice(i, i + maxLen));
    }
    chunks.push('\n');

    const writeNext = (idx) => {
      if (idx >= chunks.length) return;
      wx.writeBLECharacteristicValue({
        deviceId: this.data.bleDeviceId,
        serviceId: this.data.bleServiceId,
        characteristicId: this.data.bleCharacteristicId,
        value: this.stringToArrayBuffer(chunks[idx]),
        success: () => writeNext(idx + 1),
        fail: () => {
          this.setData({ bleStatus: '发送失败，请检查连接' });
        }
      });
    };
    writeNext(0);
  },

  stringToArrayBuffer(str) {
    const buf = new ArrayBuffer(str.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < str.length; i += 1) {
      view[i] = str.charCodeAt(i) & 0xff;
    }
    return buf;
  },

  applyScalePercent(percent, syncData) {
    if (!this.camera || !this.modelRadius) return;
    const clamped = Math.max(60, Math.min(100, Number(percent) || 80));
    this.scalePercent = clamped;
    const fill = clamped / 100;
    // Keep the model comfortably inside the framed viewport.
    const visualFill = fill * 0.95;
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
    if (this.data.autoMode !== 'off') {
      this.baseArmAngle = clamped;
      if (syncData) this.setData({ armAngle: clamped });
      return;
    }
    this.armAngle = clamped;
    this.applyMotorPose();
    this.scheduleSendMotorCommand('motor24');
    if (syncData) {
      this.setData({ armAngle: clamped });
    }
  },

  applyHeadAngle(angle, syncData) {
    const clamped = Math.max(0, Math.min(50, Number(angle) || 0));
    if (this.data.autoMode !== 'off') {
      this.baseHeadAngle = clamped;
      if (syncData) this.setData({ headAngle: clamped });
      return;
    }
    this.headAngle = clamped;
    this.applyMotorPose();
    this.scheduleSendMotorCommand('motor35');
    if (syncData) {
      this.setData({ headAngle: clamped });
    }
  },

  applyMotor24Speed(speed, syncData) {
    const clamped = Math.max(100, Math.min(1000, Number(speed) || 300));
    this.motor24SpeedHz = clamped;
    this.scheduleSendMotorCommand('motor24_speed');
    if (syncData) {
      this.setData({ motor24SpeedHz: clamped });
    }
  },

  applyMotor35Speed(speed, syncData) {
    const clamped = Math.max(100, Math.min(800, Number(speed) || 300));
    this.motor35SpeedHz = clamped;
    this.scheduleSendMotorCommand('motor35_speed');
    if (syncData) {
      this.setData({ motor35SpeedHz: clamped });
    }
  },

  applyMicSensitivity(value, syncData) {
    const clamped = Math.max(10, Math.min(100, Number(value) || 55));
    this.micSensitivity = clamped;
    if (syncData) {
      this.setData({ micSensitivity: clamped });
    }
  },

  applyLedOn(value, syncData) {
    this.ledOn = !!value;
    this.applyLightVisualState();
    this.scheduleSendMotorCommand('light_power');
    if (syncData) {
      this.setData({ ledOn: this.ledOn });
    }
  },

  applyLedMode(mode, syncData) {
    const nextMode = mode === 'white' ? 'white' : 'warm';
    this.ledMode = nextMode;
    this.applyLightVisualState();
    this.scheduleSendMotorCommand('light_mode');
    if (syncData) {
      this.setData({ ledMode: nextMode });
    }
  },

  applyLedBrightness(value, syncData) {
    const clamped = Math.max(1, Math.min(100, Number(value) || 75));
    this.ledBrightness = clamped;
    this.applyLightVisualState();
    this.scheduleSendMotorCommand('light_brightness');
    if (syncData) {
      this.setData({ ledBrightness: clamped });
    }
  },

  setupLampLightVisual(modelRoot) {
    if (!this.THREE || !modelRoot) return;
    const THREE = this.THREE;
    const anchor = this.headNode || modelRoot.getObjectByName('灯头_Head') || modelRoot;

    this.lampEmissiveMaterials = [];
    this.lampLightAnchor = anchor;

    anchor.traverse((obj) => {
      if (!obj || !obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const cloned = mats.map((mat) => (mat && typeof mat.clone === 'function' ? mat.clone() : mat));
      obj.material = Array.isArray(obj.material) ? cloned : cloned[0];

      cloned.forEach((mat) => {
        if (!mat) return;
        const hasEmissive = !!(mat.emissive && typeof mat.emissive.clone === 'function');
        if (!hasEmissive) return;
        this.lampEmissiveMaterials.push({
          material: mat,
          baseEmissive: mat.emissive.clone(),
          baseEmissiveIntensity: typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 0
        });
      });
    });

    this.lampGlowLight = new THREE.PointLight(0xfff0d6, 0, 3.2, 2);
    this.lampGlowLight.position.set(0, 0.02, 0.14);
    anchor.add(this.lampGlowLight);

    this.applyLightVisualState();
  },

  applyLightVisualState() {
    if (!this.THREE) return;
    const THREE = this.THREE;
    const isOn = typeof this.ledOn === 'boolean' ? this.ledOn : !!this.data.ledOn;
    const mode = this.ledMode || this.data.ledMode || 'warm';
    const brightness = Number(this.ledBrightness || this.data.ledBrightness || 75);
    const normalized = Math.max(0, Math.min(1, brightness / 100));
    const tint = mode === 'white' ? 0xf2f7ff : 0xffe0b3;
    const emissiveBoost = isOn ? 0.06 + normalized * 0.52 : 0;

    if (this.lampGlowLight) {
      this.lampGlowLight.color.setHex(tint);
      this.lampGlowLight.intensity = isOn ? 0.28 + normalized * 1.25 : 0;
      this.lampGlowLight.distance = 2.4 + normalized * 3.6;
    }

    (this.lampEmissiveMaterials || []).forEach((entry) => {
      const mat = entry.material;
      if (!mat || !mat.emissive) return;
      mat.emissive.copy(entry.baseEmissive || new THREE.Color(0x000000));
      if (isOn) {
        mat.emissive.lerp(new THREE.Color(tint), 0.65);
      }
      mat.emissiveIntensity = (entry.baseEmissiveIntensity || 0) + emissiveBoost;
      mat.needsUpdate = true;
    });
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
      .fields({ node: true, size: true })
      .exec((res) => {
        const item = res && res[0] ? res[0] : null;
        const canvas = item ? item.node : null;
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
        const width = (item && item.width) || sysInfo.windowWidth;
        const height = (item && item.height) || sysInfo.windowHeight;
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

                  this.setupLampLightVisual(modelRoot);
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
