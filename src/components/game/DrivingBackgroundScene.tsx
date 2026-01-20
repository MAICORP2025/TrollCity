import React, { useEffect, useRef } from 'react';
import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4, AbstractMesh, DefaultRenderingPipeline, ImageProcessingConfiguration, PointLight, TransformNode, DynamicTexture, DirectionalLight, FollowCamera, Texture, SceneLoader } from '@babylonjs/core';
import '@babylonjs/loaders';

interface DrivingBackgroundSceneProps {
  destination?: string;
  carColor?: string;
  carSpeed?: number;
  routeLength?: number;
  onProgress?: (distanceTravelled: number, speed: number) => void;
  onArrive?: () => void;
  vehicleType?: 'car' | 'motorcycle' | 'suv' | 'truck' | 'supercar';
  windowTintPercent?: number;
  modelUrl?: string;
}

export default function DrivingBackgroundScene({
  destination,
  carColor = '#8b5cf6',
  carSpeed = 60,
  routeLength,
  onProgress,
  onArrive,
  vehicleType = 'car',
  windowTintPercent = 20,
  modelUrl
}: DrivingBackgroundSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let engine: Engine | null = null;
    let scene: Scene | null = null;
     let engineAudio: HTMLAudioElement | null = null;

    try {
      engine = new Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true });
      scene = new Scene(engine);
      scene.clearColor = new Color4(0.05, 0.08, 0.15, 1);
      scene.ambientColor = new Color3(0.2, 0.2, 0.3);

      const isNight = true;

      const route = (() => {
        const d = (destination || '').toLowerCase();
        if (d.includes('hospital')) return 'hospital';
        if (d.includes('court')) return 'court';
        if (d.includes('gas') || d.includes('station') || d.includes('fuel')) return 'gas';
        if (d.includes('dealership') || d.includes('garage')) return 'dealership';
        return 'city';
      })();

      const skyBox = MeshBuilder.CreateBox('skyBox', { size: 800 }, scene);
      const skyMat = new StandardMaterial('skyMat', scene);
      skyMat.backFaceCulling = false;
      skyMat.disableLighting = true;
      skyMat.emissiveColor = isNight ? new Color3(0.05, 0.08, 0.15) : new Color3(0.25, 0.45, 0.9);
      skyBox.material = skyMat;

      if (isNight) {
        for (let i = 0; i < 140; i += 1) {
          const star = MeshBuilder.CreateDisc(`star_${i}`, { radius: 0.25 + Math.random() * 0.2, tessellation: 1 }, scene);
          const starMat = new StandardMaterial(`starMat_${i}`, scene);
          const brightness = 0.5 + Math.random() * 0.5;
          starMat.emissiveColor = new Color3(brightness, brightness, brightness);
          star.material = starMat;
          const sx = (Math.random() * 2 - 1) * 380;
          const sy = 35 + Math.random() * 70;
          const sz = 120 + Math.random() * 260;
          star.position = new Vector3(sx, sy, sz);
          star.rotation = new Vector3(Math.PI / 2, 0, 0);
        }
      }

      const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
      light.intensity = isNight ? 1.2 : 1.5;
      light.groundColor = new Color3(0.1, 0.1, 0.2);

      if (isNight) {
        const moonLight = new DirectionalLight('moonLight', new Vector3(0.3, -1, 0.4), scene);
        moonLight.intensity = 2.0;
        moonLight.diffuse = new Color3(0.7, 0.8, 1);
        moonLight.specular = new Color3(0.85, 0.9, 1);
      }

      const ground = MeshBuilder.CreateGround('ground', { width: 60, height: 260 }, scene);
      const groundMat = new StandardMaterial('groundMat', scene);
      groundMat.diffuseColor = new Color3(0.04, 0.09, 0.06);
      groundMat.specularColor = new Color3(0, 0, 0);
      groundMat.ambientColor = new Color3(0.05, 0.1, 0.08);
      ground.material = groundMat;
      ground.position = new Vector3(0, 0, 60);

      const centerLine = MeshBuilder.CreateBox('centerLine', { width: 0.3, height: 0.02, depth: 120 }, scene);
      const centerMat = new StandardMaterial('centerMat', scene);
      centerMat.diffuseColor = new Color3(1, 1, 1);
      centerMat.emissiveColor = new Color3(0.9, 0.9, 1);
      centerLine.material = centerMat;
      centerLine.position = new Vector3(0, 0.01, 20);

      const road = MeshBuilder.CreateGround('road', { width: 8, height: 220 }, scene);
      const roadMat = new StandardMaterial('roadMat', scene);
      roadMat.diffuseColor = new Color3(0.08, 0.08, 0.09);
      roadMat.specularColor = new Color3(0.05, 0.05, 0.06);
      roadMat.ambientColor = new Color3(0.08, 0.08, 0.1);
      road.material = roadMat;
      road.position = new Vector3(0, 0.015, 60);

      const carRoot = new TransformNode('carRoot', scene);
      const vehicleCategory = vehicleType || 'car';

      let bodyWidth = 2.2;
      let bodyHeight = 0.8;
      let bodyDepth = 3.2;
      
      // Default positions for lights if using model
      let headlightZ = 1.8;
      let headlightY = 0.6;
      let headlightX = 0.8;

      if (modelUrl) {
        // Load custom model
        SceneLoader.ImportMeshAsync('', modelUrl, '', scene).then((result) => {
          const root = result.meshes[0];
          root.parent = carRoot;
          
          // Normalize scale - assume models might vary, try to fit in box approx 4x2x2
          root.scaling = new Vector3(1, 1, 1); 
          root.rotation = new Vector3(0, Math.PI, 0); // Face forward if needed

          // Calculate tint color
          const clampedTint = Math.min(40, Math.max(5, windowTintPercent));
          const tintStrength = (45 - clampedTint) / 40;
          const baseGlass = new Color3(0.1, 0.12, 0.16);
          const darkGlass = new Color3(0.02, 0.03, 0.06);
          const glassColor = new Color3(
            baseGlass.r * (1 - tintStrength) + darkGlass.r * tintStrength,
            baseGlass.g * (1 - tintStrength) + darkGlass.g * tintStrength,
            baseGlass.b * (1 - tintStrength) + darkGlass.b * tintStrength
          );

          // Try to apply color to meshes that look like body or glass
          const carColor3 = Color3.FromHexString(carColor);
          
          result.meshes.forEach((m) => {
            const meshName = m.name.toLowerCase();
            const isGlass = meshName.includes('glass') || meshName.includes('window') || meshName.includes('windshield');
            
            if (m.material) {
               if (isGlass) {
                  // Apply tint
                  if (m.material instanceof StandardMaterial) {
                     m.material.diffuseColor = glassColor;
                     // Optional: make it semi-transparent if not already
                     if (m.material.alpha === 1) m.material.alpha = 0.8; 
                  } else if ((m.material as any).albedoColor) {
                     (m.material as any).albedoColor = glassColor;
                     if ((m.material as any).alpha === 1) (m.material as any).alpha = 0.8;
                  }
               } else {
                  // Avoid wheels/interior for body color
                  const isWheel = meshName.includes('wheel') || meshName.includes('rim') || meshName.includes('tire');
                  const isInterior = meshName.includes('interior') || meshName.includes('seat') || meshName.includes('dash') || meshName.includes('steering');
                  
                  if (!isWheel && !isInterior) {
                      if (m.material instanceof StandardMaterial) {
                        m.material.diffuseColor = carColor3;
                      } else if ((m.material as any).albedoColor) {
                        (m.material as any).albedoColor = carColor3;
                      }
                  }
               }
            }
          });
        }).catch(err => {
            console.error("Failed to load car model, falling back to primitive", err);
        });
        
        // Adjust light positions for generic model
        headlightZ = 2.0;
        headlightY = 0.8;
        headlightX = 0.9;
        
        carRoot.position = new Vector3(0, 0.5, 0);

      } else {
          // Primitive Construction
          let cabinWidth = 1.6;
          let cabinHeight = 0.7;
          let cabinDepth = 1.7;
          let cabinOffsetY = 0.7;
          let cabinOffsetZ = 0.1;
          let wheelRadius = 0.45;
          let carRootHeight = 0.9;
          let wheelPositions: Vector3[] = [
            new Vector3(-0.9, -0.4, 1.1),
            new Vector3(0.9, -0.4, 1.1),
            new Vector3(-0.9, -0.4, -1.1),
            new Vector3(0.9, -0.4, -1.1)
          ];

          if (vehicleCategory === 'motorcycle') {
            bodyWidth = 0.8;
            bodyHeight = 0.6;
            bodyDepth = 2.4;
            cabinWidth = 0.4;
            cabinHeight = 0.4;
            cabinDepth = 0.8;
            cabinOffsetY = 0.5;
            cabinOffsetZ = 0;
            wheelRadius = 0.55;
            carRootHeight = 0.7;
            wheelPositions = [
              new Vector3(0, -0.5, 1.1),
              new Vector3(0, -0.5, -1.1)
            ];
          } else if (vehicleCategory === 'suv' || vehicleCategory === 'truck') {
            bodyWidth = 2.6;
            bodyHeight = 1.0;
            bodyDepth = 3.6;
            cabinWidth = 1.9;
            cabinHeight = 0.9;
            cabinDepth = 2.1;
            cabinOffsetY = 0.9;
            cabinOffsetZ = 0.1;
            wheelRadius = 0.6;
            carRootHeight = 1.0;
            const zOffset = bodyDepth / 2 - 0.7;
            const xOffset = bodyWidth / 2 - 0.5;
            wheelPositions = [
              new Vector3(-xOffset, -0.5, zOffset),
              new Vector3(xOffset, -0.5, zOffset),
              new Vector3(-xOffset, -0.5, -zOffset),
              new Vector3(xOffset, -0.5, -zOffset)
            ];
          } else if (vehicleCategory === 'supercar') {
            bodyWidth = 2.4;
            bodyHeight = 0.6;
            bodyDepth = 3.6;
            cabinWidth = 1.5;
            cabinHeight = 0.5;
            cabinDepth = 1.6;
            cabinOffsetY = 0.6;
            cabinOffsetZ = 0;
            wheelRadius = 0.5;
            carRootHeight = 0.8;
            const zOffset = bodyDepth / 2 - 0.6;
            const xOffset = bodyWidth / 2 - 0.6;
            wheelPositions = [
              new Vector3(-xOffset, -0.45, zOffset),
              new Vector3(xOffset, -0.45, zOffset),
              new Vector3(-xOffset, -0.45, -zOffset),
              new Vector3(xOffset, -0.45, -zOffset)
            ];
          }

          carRoot.position = new Vector3(0, carRootHeight, 0);

          const body = MeshBuilder.CreateBox('carBody', { width: bodyWidth, height: bodyHeight, depth: bodyDepth }, scene);
          const bodyMat = new StandardMaterial('carBodyMat', scene);
          const bodyColor = Color3.FromHexString(carColor);
          bodyMat.diffuseColor = bodyColor;
          bodyMat.emissiveColor = new Color3(bodyColor.r * 0.25, bodyColor.g * 0.25, bodyColor.b * 0.25);
          body.material = bodyMat;
          body.parent = carRoot;

          const cabin = MeshBuilder.CreateBox('carCabin', { width: cabinWidth, height: cabinHeight, depth: cabinDepth }, scene);
          const cabinMat = new StandardMaterial('carCabinMat', scene);
          const clampedTint = Math.min(40, Math.max(5, windowTintPercent));
          const tintStrength = (45 - clampedTint) / 40;
          const baseGlass = new Color3(0.1, 0.12, 0.16);
          const darkGlass = new Color3(0.02, 0.03, 0.06);
          cabinMat.diffuseColor = new Color3(
            baseGlass.r * (1 - tintStrength) + darkGlass.r * tintStrength,
            baseGlass.g * (1 - tintStrength) + darkGlass.g * tintStrength,
            baseGlass.b * (1 - tintStrength) + darkGlass.b * tintStrength
          );
          cabinMat.emissiveColor = new Color3(0.05, 0.06, 0.08);
          cabin.material = cabinMat;
          cabin.parent = carRoot;
          cabin.position = new Vector3(0, cabinOffsetY, cabinOffsetZ);

          const wheelMat = new StandardMaterial('wheelMat', scene);
          wheelMat.diffuseColor = new Color3(0.04, 0.04, 0.05);

          const wheels: AbstractMesh[] = [];
          wheelPositions.forEach((pos, index) => {
            const wheel = MeshBuilder.CreateCylinder(`wheel_${index}`, { diameter: wheelRadius * 2, height: 0.4, tessellation: 18 }, scene);
            wheel.rotation.z = Math.PI / 2;
            wheel.material = wheelMat;
            wheel.parent = carRoot;
            wheel.position = pos;
            wheels.push(wheel);
          });
          
          // Update headlight positions based on calculated dimensions
          headlightZ = bodyDepth / 2 + 0.2;
          headlightY = 0.1;
          headlightX = bodyWidth / 2 - 0.6;
      }

      const headlightLeft = new PointLight('headlightLeft', new Vector3(-headlightX, headlightY, headlightZ), scene);
      headlightLeft.parent = carRoot;
      headlightLeft.diffuse = new Color3(1, 1, 0.9);
      headlightLeft.specular = new Color3(1, 1, 0.9);
      headlightLeft.intensity = isNight ? 2.4 : 0;
      headlightLeft.range = 32;

      const headlightRight = new PointLight('headlightRight', new Vector3(headlightX, headlightY, headlightZ), scene);
      headlightRight.parent = carRoot;
      headlightRight.diffuse = headlightLeft.diffuse.clone();
      headlightRight.specular = headlightLeft.specular.clone();
      headlightRight.intensity = headlightLeft.intensity;
      headlightRight.range = headlightLeft.range;

      const followCamera = new FollowCamera('followCamera', new Vector3(0, 6, -12), scene);
      followCamera.lockedTarget = carRoot as unknown as AbstractMesh;
      followCamera.radius = 14;
      followCamera.heightOffset = 4;
      followCamera.rotationOffset = 180;
      followCamera.cameraAcceleration = 0.05;
      followCamera.maxCameraSpeed = 1.2;
      scene.activeCamera = followCamera;

      const sunMoon = MeshBuilder.CreateDisc('sunMoon', { radius: 22, tessellation: 64 }, scene);
      const sunMoonMat = new StandardMaterial('sunMoonMat', scene);
      const orbColor = isNight ? new Color3(0.7, 0.8, 1) : new Color3(1, 0.95, 0.8);
      sunMoonMat.diffuseColor = orbColor;
      sunMoonMat.emissiveColor = orbColor;
      sunMoonMat.backFaceCulling = false;
      sunMoon.material = sunMoonMat;
      sunMoon.position = new Vector3(0, isNight ? 30 : 40, 260);
      sunMoon.rotation = new Vector3(Math.PI / 2.2, 0, 0);

      scene.fogMode = Scene.FOGMODE_EXP;
      scene.fogColor = new Color3(0.05, 0.08, 0.15);
      scene.fogDensity = isNight ? 0.008 : 0.004;

      // Removed environment texture for StandardMaterial workflow

      const pipeline = new DefaultRenderingPipeline('defaultPipeline', true, scene, scene.cameras);
      if (pipeline.imageProcessing instanceof ImageProcessingConfiguration) {
        pipeline.imageProcessing.toneMappingEnabled = true;
        pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        pipeline.imageProcessing.exposure = isNight ? 1.2 : 1.0;
      }
      pipeline.bloomEnabled = isNight;
      pipeline.bloomThreshold = 0.6;
      pipeline.bloomWeight = isNight ? 0.5 : 0.3;

      const createHouseMat = (name: string, color: Color3, emissive?: Color3) => {
        const mat = new StandardMaterial(name, scene);
        mat.diffuseColor = color;

        const brickTex = new Texture('/assets/textures/brick.jpg', scene);
        brickTex.uScale = 2;
        brickTex.vScale = 2;
        mat.diffuseTexture = brickTex;

        const brickNormal = new Texture('/assets/textures/rockn.png', scene);
        brickNormal.uScale = 2;
        brickNormal.vScale = 2;
        mat.bumpTexture = brickNormal;

        mat.specularColor = new Color3(0.1, 0.1, 0.1);
        mat.ambientColor = new Color3(0.2, 0.2, 0.2);

        if (emissive) {
          mat.emissiveColor = emissive;
        }

        return mat;
      };

      const houseMaterials: StandardMaterial[] = [
        createHouseMat('houseMatStarter', new Color3(0.6, 0.4, 0.3)),
        createHouseMat('houseMatMid', new Color3(0.55, 0.35, 0.3)),
        createHouseMat('houseMatApartment', new Color3(0.5, 0.5, 0.55)),
        createHouseMat('houseMatLuxury', new Color3(0.7, 0.55, 0.35), new Color3(0.15, 0.12, 0.07)),
        createHouseMat('houseMatMansion', new Color3(0.65, 0.3, 0.25)),
        createHouseMat('houseMatMega', new Color3(0.2, 0.2, 0.23), new Color3(0.2, 0.8, 1))
      ];

      const windowMat = new StandardMaterial('windowMatDriving', scene);
      windowMat.specularColor = new Color3(1, 1, 1);
      if (isNight) {
        windowMat.diffuseColor = new Color3(0.95, 0.9, 0.75);
        windowMat.emissiveColor = new Color3(0.8, 0.7, 0.5);
      } else {
        windowMat.diffuseColor = new Color3(0.45, 0.55, 0.7);
        windowMat.emissiveColor = new Color3(0.08, 0.1, 0.15);
      }

      const doorMat = new StandardMaterial('doorMatDriving', scene);
      doorMat.diffuseColor = new Color3(0.35, 0.25, 0.18);
      doorMat.specularColor = new Color3(0.1, 0.1, 0.1);

      const curbMat = new StandardMaterial('curbMat', scene);
      curbMat.diffuseColor = new Color3(0.6, 0.6, 0.65);

      const sidewalkMat = new StandardMaterial('sidewalkMat', scene);
      sidewalkMat.diffuseColor = new Color3(0.45, 0.45, 0.47);
      sidewalkMat.specularColor = new Color3(0.1, 0.1, 0.1);
      sidewalkMat.ambientColor = new Color3(0.2, 0.2, 0.22);

      const lampPoleMat = new StandardMaterial('lampPoleMat', scene);
      lampPoleMat.diffuseColor = new Color3(0.2, 0.2, 0.25);

      const lampHeadMat = new StandardMaterial('lampHeadMat', scene);
      lampHeadMat.emissiveColor = new Color3(1, 0.95, 0.8);

      const roadHalfWidth = 4;
      const sidewalkWidth = 2.5;
      const buildingBaseOffset = roadHalfWidth + sidewalkWidth;

      const curbLeft = MeshBuilder.CreateBox('curbLeft', { width: 0.5, height: 0.3, depth: 220 }, scene);
      curbLeft.material = curbMat;
      curbLeft.position = new Vector3(-roadHalfWidth, 0.15, 60);

      const curbRight = curbLeft.clone('curbRight');
      curbRight.position.x = roadHalfWidth;

      const sidewalkLeft = MeshBuilder.CreateGround('sidewalkLeft', { width: sidewalkWidth, height: 220 }, scene);
      sidewalkLeft.material = sidewalkMat;
      sidewalkLeft.position = new Vector3(-roadHalfWidth - sidewalkWidth / 2, 0.02, 60);

      const sidewalkRight = sidewalkLeft.clone('sidewalkRight');
      sidewalkRight.position.x = roadHalfWidth + sidewalkWidth / 2;

      const buildingCount = 16;
      const buildings: AbstractMesh[] = [];
      for (let i = 0; i < buildingCount; i += 1) {
        const styleIndex = i % houseMaterials.length;
        const styleMat = houseMaterials[styleIndex];

        let width = 6;
        let height = 6;
        let depth = 6;

        if (styleIndex === 0) {
          width = 6;
          height = 5;
          depth = 6;
        } else if (styleIndex === 1) {
          width = 7;
          height = 7;
          depth = 6;
        } else if (styleIndex === 2) {
          width = 10;
          height = 10;
          depth = 8;
        } else if (styleIndex === 3) {
          width = 8;
          height = 8;
          depth = 7;
        } else if (styleIndex === 4) {
          width = 9;
          height = 9;
          depth = 8;
        } else {
          width = 11;
          height = 11;
          depth = 9;
        }

        const mesh = MeshBuilder.CreateBox(`building_${i}`, { width, height, depth }, scene);
        mesh.material = styleMat;

        const side = i % 2 === 0 ? 1 : -1;
        const jitter = Math.random() * 2 - 1;
        const x = side * (buildingBaseOffset + jitter + width / 2);
        const z = 10 + i * 14;
        mesh.position = new Vector3(x, height / 2, z);

        const roof = MeshBuilder.CreateBox(`roof_${i}`, { width: width * 1.05, height: height * 0.2, depth: depth * 1.05 }, scene);
        roof.position = new Vector3(0, height / 2 + (height * 0.1), 0);
        roof.parent = mesh;

        const roofMat = new StandardMaterial(`roofMat_${i}`, scene);
        roofMat.diffuseColor = new Color3(0.12, 0.12, 0.18);
        roofMat.specularColor = new Color3(0.1, 0.1, 0.1);
        roof.material = roofMat;

        const doorWidth = width * 0.25;
        const doorHeight = 2;
        const door = MeshBuilder.CreateBox(`door_${i}`, { width: doorWidth, height: doorHeight, depth: 0.3 }, scene);
        door.material = doorMat;
        door.parent = mesh;
        door.position = new Vector3(0, -height / 2 + doorHeight / 2, -depth / 2 - 0.15);

        const windowRows = 2;
        const windowCols = 2;
        const windowWidth = width * 0.22;
        const windowHeight = 1.2;
        const windowDepth = 0.12;
        const rowSpacing = height / 3;
        const colSpacing = width / 3;

        for (let row = 0; row < windowRows; row += 1) {
          for (let col = 0; col < windowCols; col += 1) {
            const w = MeshBuilder.CreateBox(`win_${i}_${row}_${col}`, { width: windowWidth, height: windowHeight, depth: windowDepth }, scene);
            const materialInstance = windowMat.clone(`windowMat_${i}_${row}_${col}`) as StandardMaterial;
            if (isNight) {
              const lit = Math.random() > 0.35;
              if (lit) {
                materialInstance.emissiveColor = new Color3(0.95, 0.9, 0.7);
                materialInstance.diffuseColor = new Color3(1, 0.98, 0.9);
              } else {
                materialInstance.emissiveColor = new Color3(0.04, 0.05, 0.08);
                materialInstance.diffuseColor = new Color3(0.18, 0.2, 0.25);
              }
            }
            w.material = materialInstance;
            w.parent = mesh;
            const offsetX = (col === 0 ? -1 : 1) * colSpacing * 0.5;
            const offsetY = -height / 2 + doorHeight + (row + 1) * rowSpacing * 0.6;
            const frontZ = -depth / 2 - windowDepth / 2 - 0.06;
            w.position = new Vector3(offsetX, offsetY, frontZ);
          }
        }

        if (i % 2 === 0) {
          const pole = MeshBuilder.CreateCylinder(`lampPole_${i}`, { diameter: 0.12, height: 4.2 }, scene);
          pole.material = lampPoleMat;
          pole.parent = mesh;
          const poleOffsetX = side * (-(width / 2) + 0.2);
          pole.position = new Vector3(poleOffsetX, 2.1, -depth / 2 + 0.8);

          const lampHead = MeshBuilder.CreateBox(`lampHead_${i}`, { width: 0.6, height: 0.35, depth: 0.6 }, scene);
          lampHead.material = lampHeadMat;
          lampHead.parent = pole;
          lampHead.position = new Vector3(0, 2.1, 0);

          const lampLight = new PointLight(`lampLight_${i}`, Vector3.Zero(), scene);
          lampLight.parent = lampHead;
          lampLight.intensity = isNight ? 2.5 : 0;
          lampLight.range = 26;
          lampLight.diffuse = new Color3(1, 0.96, 0.85);
          lampLight.specular = new Color3(1, 0.96, 0.9);
        }

        buildings.push(mesh);
      }

      if (route === 'gas' || route === 'dealership') {
        const gasRoot = MeshBuilder.CreateBox('gasRoot', { width: 14, height: 4, depth: 10 }, scene);
        const gasMat = new StandardMaterial('gasMat', scene);
        gasMat.diffuseColor = new Color3(0.2, 0.25, 0.3);
        gasMat.specularColor = new Color3(0.1, 0.1, 0.1);
        gasRoot.material = gasMat;
        gasRoot.position = new Vector3(-buildingBaseOffset - 6, 2, 80);

        const gasCanopy = MeshBuilder.CreateBox('gasCanopy', { width: 16, height: 0.6, depth: 12 }, scene);
        gasCanopy.parent = gasRoot;
        gasCanopy.position = new Vector3(0, 2.5, 0);
        const gasCanopyMat = new StandardMaterial('gasCanopyMat', scene);
        gasCanopyMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
        gasCanopyMat.emissiveColor = new Color3(0.1, 0.3, 0.9);
        gasCanopyMat.specularColor = new Color3(0.2, 0.2, 0.2);
        gasCanopy.material = gasCanopyMat;

        for (let i = -1; i <= 1; i += 2) {
          const pillar = MeshBuilder.CreateBox(`gasPillar_${i}`, { width: 0.6, height: 2.5, depth: 0.6 }, scene);
          pillar.parent = gasRoot;
          pillar.material = gasMat;
          pillar.position = new Vector3(i * 5, 1.25, -3);
        }

        buildings.push(gasRoot);
      }

      if (route === 'hospital') {
        const hospitalRoot = MeshBuilder.CreateBox('hospitalRoot', { width: 16, height: 7, depth: 10 }, scene);
        const hospitalMat = new StandardMaterial('hospitalMat', scene);
        hospitalMat.diffuseColor = new Color3(0.9, 0.9, 0.95);
        hospitalMat.specularColor = new Color3(0.1, 0.1, 0.1);
        hospitalRoot.material = hospitalMat;
        hospitalRoot.position = new Vector3(buildingBaseOffset + 7, 3.5, 110);

        const crossV = MeshBuilder.CreateBox('hospitalCrossV', { width: 1, height: 3.5, depth: 0.3 }, scene);
        const crossH = MeshBuilder.CreateBox('hospitalCrossH', { width: 3.5, height: 1, depth: 0.3 }, scene);
        const crossMat = new StandardMaterial('hospitalCrossMat', scene);
        crossMat.diffuseColor = new Color3(0.9, 0.1, 0.1);
        crossMat.emissiveColor = new Color3(0.9, 0.2, 0.2);
        crossV.material = crossMat;
        crossH.material = crossMat;
        crossV.parent = hospitalRoot;
        crossH.parent = hospitalRoot;
        crossV.position = new Vector3(0, 2.5, -5.1);
        crossH.position = new Vector3(0, 2.5, -5.1);

        buildings.push(hospitalRoot);
      }

      if (route === 'court') {
        const courtRoot = MeshBuilder.CreateBox('courtRoot', { width: 18, height: 6, depth: 11 }, scene);
        const courtMat = new StandardMaterial('courtMat', scene);
        courtMat.diffuseColor = new Color3(0.7, 0.65, 0.55);
        courtMat.specularColor = new Color3(0.1, 0.1, 0.1);
        courtRoot.material = courtMat;
        courtRoot.position = new Vector3(-buildingBaseOffset - 8, 3, 140);

        const pediment = MeshBuilder.CreateBox('courtPediment', { width: 18, height: 1.5, depth: 1.5 }, scene);
        pediment.parent = courtRoot;
        pediment.position = new Vector3(0, 4.5, -5.5);
        const pedimentMat = new StandardMaterial('courtPedimentMat', scene);
        pedimentMat.diffuseColor = new Color3(0.8, 0.75, 0.6);
        pedimentMat.specularColor = new Color3(0.1, 0.1, 0.1);
        pediment.material = pedimentMat;

        for (let i = -2; i <= 2; i += 1) {
          const col = MeshBuilder.CreateCylinder(`courtCol_${i}`, { diameter: 0.6, height: 4 }, scene);
          col.parent = courtRoot;
          col.material = courtMat;
          col.position = new Vector3(i * 2, 2, -5.3);
        }

        buildings.push(courtRoot);
      }

      const towerMat = new StandardMaterial('towerMat', scene);
      towerMat.diffuseColor = new Color3(0.12, 0.12, 0.18);
      towerMat.specularColor = new Color3(0.1, 0.1, 0.1);

      for (let i = 0; i < 8; i += 1) {
        const tWidth = 10 + Math.random() * 8;
        const tHeight = 40 + Math.random() * 25;
        const tDepth = 10 + Math.random() * 8;
        const tower = MeshBuilder.CreateBox(`tower_${i}`, { width: tWidth, height: tHeight, depth: tDepth }, scene);
        tower.material = towerMat;
        const side = i % 2 === 0 ? 1 : -1;
        const tx = side * (buildingBaseOffset + 18 + Math.random() * 20);
        const tz = 160 + i * 12;
        tower.position = new Vector3(tx, tHeight / 2, tz);

        const bandCount = 4;
        for (let b = 0; b < bandCount; b += 1) {
          const band = MeshBuilder.CreateBox(`towerBand_${i}_${b}`, { width: tWidth * 0.95, height: 0.4, depth: 0.4 }, scene);
          const bandMat = new StandardMaterial(`towerBandMat_${i}_${b}`, scene);
          bandMat.emissiveColor = new Color3(0.2, 0.4, 0.9);
          band.material = bandMat;
          band.parent = tower;
          const by = -tHeight / 2 + (b + 1) * (tHeight / (bandCount + 1));
          band.position = new Vector3(0, by, -tDepth / 2 - 0.25);
        }

        buildings.push(tower);
      }

      SceneLoader.ImportMeshAsync('', '/models/', 'street-building.glb', scene)
        .then(result => {
          const template = result.meshes[0] as AbstractMesh | undefined;
          if (!template) return;
          template.setEnabled(false);
          buildings.forEach((mesh, index) => {
            if (!mesh.name.startsWith('building_')) return;
            const instance = template.clone(`streetBuilding_${index}`, mesh.parent) as AbstractMesh;
            instance.position = mesh.position.clone();
            instance.rotation = mesh.rotation.clone();
            instance.scaling = new Vector3(1, 1, 1);
            mesh.setEnabled(false);
            buildings[index] = instance;
          });
        })
        .catch(() => {
        });

      if (route === 'gas' || route === 'dealership') {
        const gasBannerPlane = MeshBuilder.CreatePlane('gasBanner', { width: 8, height: 1.8 }, scene);
        const gasBannerMat = new StandardMaterial('gasBannerMat', scene);
        const gasBannerTex = new DynamicTexture('gasBannerTex', { width: 512, height: 256 }, scene, true);
        gasBannerTex.hasAlpha = true;
        gasBannerTex.drawText(route === 'dealership' ? 'DEALERSHIP' : 'GAS STATION', null, 180, 'bold 96px Arial', '#ffffff', 'transparent', true);
        gasBannerMat.diffuseTexture = gasBannerTex;
        gasBannerMat.emissiveColor = new Color3(1, 1, 1);
        gasBannerPlane.material = gasBannerMat;
        gasBannerPlane.position = new Vector3(-buildingBaseOffset - 6, 4.6, 74);
        gasBannerPlane.rotation = new Vector3(0, 0, 0);
      }

      if (route === 'hospital') {
        const hospitalBannerPlane = MeshBuilder.CreatePlane('hospitalBanner', { width: 9, height: 2 }, scene);
        const hospitalBannerMat = new StandardMaterial('hospitalBannerMat', scene);
        const hospitalBannerTex = new DynamicTexture('hospitalBannerTex', { width: 512, height: 256 }, scene, true);
        hospitalBannerTex.hasAlpha = true;
        hospitalBannerTex.drawText('HOSPITAL', null, 180, 'bold 96px Arial', '#ffffff', 'transparent', true);
        hospitalBannerMat.diffuseTexture = hospitalBannerTex;
        hospitalBannerMat.emissiveColor = new Color3(1, 1, 1);
        hospitalBannerPlane.material = hospitalBannerMat;
        hospitalBannerPlane.position = new Vector3(buildingBaseOffset + 7, 5.6, 104);
        hospitalBannerPlane.rotation = new Vector3(0, 0, 0);
      }

      if (route === 'court') {
        const courtBannerPlane = MeshBuilder.CreatePlane('courtBanner', { width: 10, height: 2 }, scene);
        const courtBannerMat = new StandardMaterial('courtBannerMat', scene);
        const courtBannerTex = new DynamicTexture('courtBannerTex', { width: 512, height: 256 }, scene, true);
        courtBannerTex.hasAlpha = true;
        courtBannerTex.drawText('COURT', null, 180, 'bold 96px Arial', '#ffffff', 'transparent', true);
        courtBannerMat.diffuseTexture = courtBannerTex;
        courtBannerMat.emissiveColor = new Color3(1, 1, 1);
        courtBannerPlane.material = courtBannerMat;
        courtBannerPlane.position = new Vector3(-buildingBaseOffset - 8, 5.6, 134);
        courtBannerPlane.rotation = new Vector3(0, 0, 0);
      }

      const baseRoadSpeed = 22;
      const roadSpeed = typeof carSpeed === 'number'
        ? Math.max(14, Math.min(42, baseRoadSpeed + carSpeed / 6))
        : baseRoadSpeed;

      const resolveEngineSoundUrl = () => {
        // Allow for future expansion where specific engine sounds are passed via props or customization
        if (vehicleCategory === 'motorcycle') {
          return '/sounds/motorcycle.mp3'; // Expecting user to add this, or fallback logic handled by browser/audio
        }
        if (vehicleCategory === 'supercar') {
          return '/sounds/supercar.mp3';
        }
        if (vehicleCategory === 'suv') {
          return '/sounds/suv.mp3';
        }
        if (vehicleCategory === 'truck') {
          return '/sounds/truck.mp3';
        }
        return '/sounds/car.mp3';
      };

      try {
        const soundUrl = resolveEngineSoundUrl();
        const audio = new Audio(soundUrl);
        audio.loop = true;
        audio.volume = 0.4;
        
        // Add error handling to fallback to generic car sound if specific one is missing
        audio.onerror = () => {
            if (soundUrl !== '/sounds/car.mp3') {
                const fallbackAudio = new Audio('/sounds/car.mp3');
                fallbackAudio.loop = true;
                fallbackAudio.volume = 0.4;
                fallbackAudio.play().catch(() => {});
                engineAudio = fallbackAudio;
            }
        };

        audio.play().catch(() => {});
        engineAudio = audio;
      } catch {
        engineAudio = null;
      }

      const resetZ = -40;
      const maxZ = 140;
      let carTime = 0;

      const effectiveRouteLength = typeof routeLength === 'number' && routeLength > 0 ? routeLength : 400;
      let distanceTravelled = 0;
      let hasArrived = false;

      scene.onBeforeRenderObservable.add(() => {
        if (!scene) return;
        const dt = scene.getEngine().getDeltaTime() / 1000;
        const dz = roadSpeed * dt;

        distanceTravelled += dz;

        if (onProgress) {
          onProgress(distanceTravelled, roadSpeed);
        }

        if (!hasArrived && distanceTravelled >= effectiveRouteLength) {
          hasArrived = true;
          if (onArrive) {
            onArrive();
          }
        }

        centerLine.position.z -= dz;
        if (centerLine.position.z < -40) {
          centerLine.position.z += 80;
        }

        buildings.forEach(mesh => {
          mesh.position.z -= dz;
          if (mesh.position.z < resetZ) {
            mesh.position.z = maxZ + Math.random() * 40;
          }
        });

        carTime += dt;
        // Drive straight - minimal wobble, no tilt
        carRoot.position.y = 0.6 + Math.sin(carTime * 10) * 0.01; // Tiny engine vibration only
        carRoot.rotation.y = 0; // No weaving left/right
      });

      engine.runRenderLoop(() => {
        if (scene) {
          scene.render();
        }
      });

      const handleResize = () => {
        if (engine) {
          engine.resize();
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (scene) {
          scene.dispose();
        }
        if (engine) {
          engine.dispose();
        }
        if (engineAudio) {
          engineAudio.pause();
          engineAudio.currentTime = 0;
          engineAudio = null;
        }
      };
    } catch {
      if (scene) {
        scene.dispose();
      }
      if (engine) {
        engine.dispose();
      }
    }
  }, [destination, carColor, carSpeed, vehicleType, windowTintPercent, routeLength, onProgress, onArrive, modelUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block"
    />
  );
}
