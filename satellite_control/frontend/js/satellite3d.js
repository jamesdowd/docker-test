/**
 * Three.js 3D Satellite Model & Scene
 *
 * Procedurally generates a satellite with clickable subsystem parts.
 * Color-coded by status: green=on/nominal, gray=off, red=error, yellow=rebooting.
 */

const SatelliteColors = {
    on:        0x00e676,
    nominal:   0x00e676,
    off:       0x556680,
    unknown:   0x556680,
    error:     0xff5252,
    rebooting: 0xffab00,
};

const SatelliteEmissive = {
    on:        0x003d1f,
    nominal:   0x003d1f,
    off:       0x111111,
    unknown:   0x111111,
    error:     0x3d0000,
    rebooting: 0x3d2a00,
};

class Satellite3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.parts = {};          // subsystem_id -> THREE.Group
        this.partMaterials = {};  // subsystem_id -> THREE.Material[]
        this.onSubsystemClick = null;
        this.onSubsystemHover = null;
        this._hoveredPart = null;
        this._animationId = null;

        this._initScene();
        this._buildSatellite();
        this._initInteraction();
        this._animate();
    }

    _initScene() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x0a0e17);

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        this.camera.position.set(6, 4, 8);
        this.camera.lookAt(0, 0, 0);

        // Orbit controls
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 4;
        this.controls.maxDistance = 25;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.5;

        // Lighting
        const ambient = new THREE.AmbientLight(0x334466, 0.6);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
        sun.position.set(10, 8, 5);
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x4466aa, 0.3);
        fill.position.set(-5, -3, -5);
        this.scene.add(fill);

        // Starfield
        this._createStarfield();

        this.resize();
    }

    _createStarfield() {
        const starGeo = new THREE.BufferGeometry();
        const positions = [];
        for (let i = 0; i < 2000; i++) {
            const r = 100 + Math.random() * 400;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.sin(phi) * Math.sin(theta),
                r * Math.cos(phi)
            );
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, sizeAttenuation: true });
        this.scene.add(new THREE.Points(starGeo, starMat));
    }

    _makeMaterial(color, emissive) {
        return new THREE.MeshPhongMaterial({
            color: color || 0x556680,
            emissive: emissive || 0x111111,
            specular: 0x222222,
            shininess: 30,
            flatShading: false,
        });
    }

    _addPart(id, group) {
        this.parts[id] = group;
        group.userData.subsystemId = id;
        // Collect all materials in the group
        const mats = [];
        group.traverse((child) => {
            if (child.isMesh) {
                child.userData.subsystemId = id;
                mats.push(child.material);
            }
        });
        this.partMaterials[id] = mats;
        this.scene.add(group);
    }

    _buildSatellite() {
        // === Central Bus ===
        const bus = new THREE.Group();
        const busGeo = new THREE.BoxGeometry(2, 1.5, 2);
        const busMat = this._makeMaterial(0x3a4a6a, 0x0a1020);
        const busMesh = new THREE.Mesh(busGeo, busMat);
        bus.add(busMesh);
        // Add panel lines for detail
        const edges = new THREE.EdgesGeometry(busGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x556688 });
        bus.add(new THREE.LineSegments(edges, lineMat));
        this._addPart('obc', bus);

        // === Solar Panels (2 wings) ===
        const solarPanels = new THREE.Group();
        for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            // Panel arm
            const armGeo = new THREE.BoxGeometry(1.2, 0.08, 0.15);
            const armMat = this._makeMaterial(0x445566, 0x111111);
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.position.set(side * 1.6, 0, 0);
            wing.add(arm);
            // Panel cells (3 segments)
            for (let i = 0; i < 3; i++) {
                const cellGeo = new THREE.BoxGeometry(0.9, 0.04, 1.4);
                const cellMat = this._makeMaterial(0x1a237e, 0x000033);
                const cell = new THREE.Mesh(cellGeo, cellMat);
                cell.position.set(side * (2.6 + i * 1.0), 0, 0);
                wing.add(cell);
            }
            solarPanels.add(wing);
        }
        this._addPart('solar_panels', solarPanels);

        // === S-Band Antenna ===
        const sBand = new THREE.Group();
        // Dish
        const sDishGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.1, 16);
        const sDishMat = this._makeMaterial(0x8899aa, 0x111122);
        const sDish = new THREE.Mesh(sDishGeo, sDishMat);
        sDish.position.set(-0.6, 0.85, -0.6);
        sBand.add(sDish);
        // Feed horn
        const sFeedGeo = new THREE.CylinderGeometry(0.03, 0.06, 0.25, 8);
        const sFeed = new THREE.Mesh(sFeedGeo, sDishMat);
        sFeed.position.set(-0.6, 1.05, -0.6);
        sBand.add(sFeed);
        this._addPart('s_band_antenna', sBand);

        // === K-Band Antenna (larger) ===
        const kBand = new THREE.Group();
        const kDishGeo = new THREE.CylinderGeometry(0.5, 0.65, 0.12, 20);
        const kDishMat = this._makeMaterial(0x99aabb, 0x112233);
        const kDish = new THREE.Mesh(kDishGeo, kDishMat);
        kDish.position.set(0.6, 0.85, -0.6);
        kBand.add(kDish);
        const kFeedGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.35, 8);
        const kFeed = new THREE.Mesh(kFeedGeo, kDishMat);
        kFeed.position.set(0.6, 1.1, -0.6);
        kBand.add(kFeed);
        this._addPart('k_band_antenna', kBand);

        // === Laser ISL Terminal ===
        const laser = new THREE.Group();
        const laserBodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12);
        const laserMat = this._makeMaterial(0x667788, 0x112233);
        const laserBody = new THREE.Mesh(laserBodyGeo, laserMat);
        laserBody.position.set(0, 0.95, 0.7);
        laser.add(laserBody);
        // Lens
        const lensGeo = new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const lensMat = this._makeMaterial(0x00d4ff, 0x003344);
        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(0, 1.15, 0.7);
        laser.add(lens);
        this._addPart('laser_isl', laser);

        // === Reaction Wheels (4, internal but visible through cutaways) ===
        const rwGroup = new THREE.Group();
        const rwPositions = [
            [0.4, 0.2, 0.4],
            [-0.4, 0.2, 0.4],
            [0.4, 0.2, -0.4],
            [-0.4, 0.2, -0.4],
        ];
        for (const pos of rwPositions) {
            const rwGeo = new THREE.TorusGeometry(0.18, 0.04, 8, 16);
            const rwMat = this._makeMaterial(0x778899, 0x112233);
            const rw = new THREE.Mesh(rwGeo, rwMat);
            rw.position.set(...pos);
            rw.rotation.x = Math.PI / 2;
            rwGroup.add(rw);
            // Axis
            const axGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6);
            const ax = new THREE.Mesh(axGeo, rwMat);
            ax.position.set(...pos);
            rwGroup.add(ax);
        }
        this._addPart('reaction_wheels', rwGroup);

        // === Thrusters (4 nozzles) ===
        const thrusterGroup = new THREE.Group();
        const thrusterPositions = [
            [1.0, -0.5, 0],
            [-1.0, -0.5, 0],
            [0, -0.5, 1.0],
            [0, -0.5, -1.0],
        ];
        for (const pos of thrusterPositions) {
            const nozzleGeo = new THREE.ConeGeometry(0.08, 0.2, 8);
            const nozzleMat = this._makeMaterial(0xaa7744, 0x221100);
            const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
            nozzle.position.set(...pos);
            nozzle.rotation.x = Math.PI; // point down
            thrusterGroup.add(nozzle);
        }
        this._addPart('thrusters', thrusterGroup);

        // === Battery Pack (internal, shown on side) ===
        const battery = new THREE.Group();
        const battGeo = new THREE.BoxGeometry(0.6, 0.4, 0.8);
        const battMat = this._makeMaterial(0x558844, 0x112200);
        const batt = new THREE.Mesh(battGeo, battMat);
        batt.position.set(0, -0.55, 0);
        battery.add(batt);
        this._addPart('battery', battery);

        // === Payload — Optical (nadir face) ===
        const optical = new THREE.Group();
        const optGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 12);
        const optMat = this._makeMaterial(0x4488cc, 0x001133);
        const opt = new THREE.Mesh(optGeo, optMat);
        opt.position.set(-0.5, -0.92, 0.3);
        optical.add(opt);
        // Lens ring
        const optRingGeo = new THREE.TorusGeometry(0.2, 0.02, 8, 16);
        const optRing = new THREE.Mesh(optRingGeo, optMat);
        optRing.position.set(-0.5, -1.1, 0.3);
        optRing.rotation.x = Math.PI / 2;
        optical.add(optRing);
        this._addPart('payload_optical', optical);

        // === Payload — SWIR ===
        const swir = new THREE.Group();
        const swirGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.3, 12);
        const swirMat = this._makeMaterial(0xcc8844, 0x331100);
        const swirMesh = new THREE.Mesh(swirGeo, swirMat);
        swirMesh.position.set(0.1, -0.9, 0.3);
        swir.add(swirMesh);
        const swirRingGeo = new THREE.TorusGeometry(0.16, 0.02, 8, 16);
        const swirRing = new THREE.Mesh(swirRingGeo, swirMat);
        swirRing.position.set(0.1, -1.05, 0.3);
        swirRing.rotation.x = Math.PI / 2;
        swir.add(swirRing);
        this._addPart('payload_swir', swir);

        // === Payload — IR ===
        const ir = new THREE.Group();
        const irGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.3, 12);
        const irMat = this._makeMaterial(0xcc4444, 0x330000);
        const irMesh = new THREE.Mesh(irGeo, irMat);
        irMesh.position.set(0.5, -0.9, -0.3);
        ir.add(irMesh);
        const irRingGeo = new THREE.TorusGeometry(0.16, 0.02, 8, 16);
        const irRing = new THREE.Mesh(irRingGeo, irMat);
        irRing.position.set(0.5, -1.05, -0.3);
        irRing.rotation.x = Math.PI / 2;
        ir.add(irRing);
        this._addPart('payload_ir', ir);
    }

    _initInteraction() {
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        this.canvas.addEventListener('click', (e) => this._onClick(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    }

    _getIntersectedSubsystem(event) {
        const rect = this.canvas.getBoundingClientRect();
        this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this._raycaster.setFromCamera(this._mouse, this.camera);
        const meshes = [];
        Object.values(this.parts).forEach(group => {
            group.traverse(child => {
                if (child.isMesh) meshes.push(child);
            });
        });

        const intersects = this._raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            return intersects[0].object.userData.subsystemId;
        }
        return null;
    }

    _onClick(event) {
        const id = this._getIntersectedSubsystem(event);
        if (id && this.onSubsystemClick) {
            this.controls.autoRotate = false;
            this.onSubsystemClick(id);
        }
    }

    _onMouseMove(event) {
        const id = this._getIntersectedSubsystem(event);

        if (id !== this._hoveredPart) {
            // Reset previous hover
            if (this._hoveredPart) {
                this._setPartHighlight(this._hoveredPart, false);
            }
            this._hoveredPart = id;
            if (id) {
                this._setPartHighlight(id, true);
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'grab';
            }
        }

        if (this.onSubsystemHover) {
            this.onSubsystemHover(id, event.clientX, event.clientY);
        }
    }

    _setPartHighlight(id, highlight) {
        const mats = this.partMaterials[id];
        if (!mats) return;
        for (const mat of mats) {
            if (highlight) {
                mat._origEmissive = mat.emissive.getHex();
                mat.emissive.setHex(0x334466);
            } else if (mat._origEmissive !== undefined) {
                mat.emissive.setHex(mat._origEmissive);
            }
        }
    }

    /**
     * Update subsystem visual state (color-coding).
     */
    updateSubsystemState(subsystemId, state) {
        const mats = this.partMaterials[subsystemId];
        if (!mats) return;

        const color = SatelliteColors[state] || SatelliteColors.unknown;
        const emissive = SatelliteEmissive[state] || SatelliteEmissive.unknown;

        for (const mat of mats) {
            mat.color.setHex(color);
            mat.emissive.setHex(emissive);
            mat._origEmissive = emissive;
        }
    }

    resize() {
        const container = this.canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    _animate() {
        this._animationId = requestAnimationFrame(() => this._animate());
        this.controls.update();

        // Gentle rotation of reaction wheels
        const rw = this.parts['reaction_wheels'];
        if (rw) {
            rw.children.forEach((child, i) => {
                if (child.geometry && child.geometry.type === 'TorusGeometry') {
                    child.rotation.z += 0.02;
                }
            });
        }

        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
        }
        this.renderer.dispose();
    }
}
