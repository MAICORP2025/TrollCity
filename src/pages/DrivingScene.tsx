import React, { useEffect, useRef, useState } from 'react';
import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, SceneLoader, FollowCamera, KeyboardEventTypes, GlowLayer, Color4 } from '@babylonjs/core';
import '@babylonjs/loaders';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

interface UserCar {
  id: string;
  car_id: string;
  model_url: string;
  is_active: boolean;
  customization_json: any;
}

interface UserProperty {
  id: string;
  // properties table fields
  base_value: number;
  is_starter: boolean;
  model_url?: string;
  is_active_home: boolean;
}

const DrivingScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !canvasRef.current) return;

    let engine: Engine;
    let scene: Scene;

    const initScene = async () => {
      try {
        // 1. Fetch Active Assets
        const [carRes, propRes] = await Promise.all([
          supabase
            .from('user_cars')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle(),
          supabase
            .from('properties')
            .select('*')
            .eq('owner_user_id', user.id)
            .eq('is_active_home', true)
            .maybeSingle()
        ]);

        let activeCar: UserCar | null = carRes.data;
        let activeProperty: UserProperty | null = propRes.data;

        // Fallback if no active car (Auto-select most recent or default)
        if (!activeCar) {
          const { data: recentCars } = await supabase
            .from('user_cars')
            .select('*')
            .eq('user_id', user.id)
            .order('purchased_at', { ascending: false })
            .limit(1);
          
          if (recentCars && recentCars.length > 0) {
            activeCar = recentCars[0];
            // Auto-activate in background (non-blocking)
            supabase.rpc('set_active_car', { p_car_row_id: activeCar.id });
          } else {
            // Default starter car
            activeCar = {
              id: 'default',
              car_id: 'starter_sedan',
              model_url: '/models/vehicles/sedan-car.glb', // Assumes this exists or will fallback
              is_active: true,
              customization_json: { color: '#00ffff' }
            };
          }
        }

        // Fallback if no active property
        if (!activeProperty) {
           const { data: recentProps } = await supabase
            .from('properties')
            .select('*')
            .eq('owner_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentProps && recentProps.length > 0) {
            activeProperty = recentProps[0];
            supabase.rpc('set_active_property', { p_property_id: activeProperty.id });
          } else {
             // Default starter property
             activeProperty = {
              id: 'default',
              base_value: 0,
              is_starter: true,
              model_url: '/models/buildings/starter-house.glb',
              is_active_home: true,
            };
          }
        }

        // 2. Setup Babylon Scene
        engine = new Engine(canvasRef.current, true);
        scene = new Scene(engine);
        scene.clearColor = new Color4(0.05, 0.05, 0.1, 1); // Dark neon background
        
        // Optimize for mobile
        scene.createDefaultCameraOrLight(true, true, true);
        const light = scene.lights[0] as HemisphericLight;
        light.intensity = 0.7;
        
        // Neon Glow
        const gl = new GlowLayer("glow", scene);
        gl.intensity = 0.5;

        // Ground
        const ground = MeshBuilder.CreateGround("ground", { width: 500, height: 500 }, scene);
        const groundMat = new StandardMaterial("groundMat", scene);
        groundMat.diffuseColor = new Color3(0.1, 0.1, 0.2);
        groundMat.emissiveColor = new Color3(0.05, 0.05, 0.1);
        groundMat.specularColor = new Color3(0, 0, 0);
        // Add grid texture if available, else solid color
        ground.material = groundMat;

        // 3. Load Property (Destination)
        if (activeProperty?.model_url) {
          try {
            const result = await SceneLoader.ImportMeshAsync("", "", activeProperty.model_url, scene);
            const root = result.meshes[0];
            root.position = new Vector3(0, 0, 100); // Place ahead
            root.scaling = new Vector3(2, 2, 2);
          } catch (e) {
            console.error("Failed to load property:", e);
            // Fallback mesh
            const box = MeshBuilder.CreateBox("fallbackHouse", { size: 10 }, scene);
            box.position = new Vector3(0, 5, 100);
            const mat = new StandardMaterial("houseMat", scene);
            mat.emissiveColor = Color3.Purple();
            box.material = mat;
          }
        }

        // 4. Load Car
        let carMesh = MeshBuilder.CreateBox("fallbackCar", { width: 2, height: 1, depth: 4 }, scene); // Default
        carMesh.position.y = 0.5;
        
        if (activeCar?.model_url) {
            try {
                // Check if url is absolute or relative
                const url = activeCar.model_url.startsWith('http') ? activeCar.model_url : activeCar.model_url;
                // Split folder and filename if needed, but SceneLoader handles full URLs too if first arg is ""
                // However, for local files like /models/..., we might need to be careful.
                // Assuming model_url is full path or URL.
                
                // Hack for relative paths in Babylon: 
                // SceneLoader.ImportMeshAsync("", "path/to/", "file.glb")
                // If model_url is "http://.../car.glb", split it.
                let rootUrl = "";
                let fileName = url;
                const lastSlash = url.lastIndexOf('/');
                if (lastSlash !== -1) {
                    rootUrl = url.substring(0, lastSlash + 1);
                    fileName = url.substring(lastSlash + 1);
                }

                const result = await SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene);
                const root = result.meshes[0];
                // Normalize scale and rotation
                root.scaling = new Vector3(1, 1, 1); 
                root.rotation = Vector3.Zero();
                
                // Find the main body to act as the "car" for physics/movement
                // For simplicity, we parent everything to a root or use the root itself
                carMesh.dispose(); // Remove fallback
                carMesh = root as any; // Cast to Mesh
                
                // Apply customization (Color)
                if (activeCar.customization_json?.color) {
                    const colorHex = activeCar.customization_json.color;
                    const color = Color3.FromHexString(colorHex);
                    // Naive material replacement - in real GLB, need to find specific material
                    root.getChildMeshes().forEach(m => {
                        if (m.material && m.material instanceof StandardMaterial) {
                             m.material.diffuseColor = color;
                        }
                    });
                }
                
            } catch (e) {
                console.error("Failed to load car:", e);
                // Keep fallback box
                const mat = new StandardMaterial("carMat", scene);
                mat.emissiveColor = Color3.Teal();
                carMesh.material = mat;
            }
        }

        // 5. Setup Camera
        const camera = new FollowCamera("FollowCam", new Vector3(0, 10, -10), scene);
        camera.lockedTarget = carMesh;
        camera.radius = 15;
        camera.heightOffset = 5;
        camera.rotationOffset = 180;
        camera.cameraAcceleration = 0.05;
        camera.maxCameraSpeed = 20;
        scene.activeCamera = camera;

        // 6. Driving Logic
        const inputMap: any = {};
        scene.onKeyboardObservable.add((kbInfo) => {
            const type = kbInfo.type;
            const evt = kbInfo.event;
            if (type === KeyboardEventTypes.KEYDOWN) {
                inputMap[evt.key] = true;
            } else if (type === KeyboardEventTypes.KEYUP) {
                inputMap[evt.key] = false;
            }
        });

        // Simple movement loop
        const speed = 0.5;
        const rotationSpeed = 0.05;
        
        scene.onBeforeRenderObservable.add(() => {
            if (inputMap["w"] || inputMap["ArrowUp"]) {
                carMesh.moveWithCollisions(carMesh.forward.scale(speed));
            }
            if (inputMap["s"] || inputMap["ArrowDown"]) {
                carMesh.moveWithCollisions(carMesh.forward.scale(-speed / 2));
            }
            if (inputMap["a"] || inputMap["ArrowLeft"]) {
                carMesh.rotate(Vector3.Up(), -rotationSpeed);
            }
            if (inputMap["d"] || inputMap["ArrowRight"]) {
                carMesh.rotate(Vector3.Up(), rotationSpeed);
            }
        });

        setLoading(false);

        // Render Loop
        engine.runRenderLoop(() => {
            scene.render();
        });

        // Resize
        const handleResize = () => engine.resize();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            engine.dispose();
        };

      } catch (err: any) {
        console.error("Scene init error:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    initScene();

  }, [user]);

  if (loading) return <div className="w-full h-screen flex items-center justify-center bg-black text-white">Loading Driving Scene...</div>;
  if (error) return <div className="w-full h-screen flex items-center justify-center bg-black text-red-500">Error: {error}</div>;

  return (
    <div className="w-full h-screen relative">
      <canvas ref={canvasRef} className="w-full h-full outline-none touch-none" />
      
      {/* Mobile Controls Overlay */}
      <div className="absolute bottom-10 left-10 flex gap-4">
        <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur" 
                onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', {'key': 'ArrowLeft'} as any))}
                onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', {'key': 'ArrowLeft'} as any))}
        >←</button>
        <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur"
                onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', {'key': 'ArrowRight'} as any))}
                onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', {'key': 'ArrowRight'} as any))}
        >→</button>
      </div>
      <div className="absolute bottom-10 right-10 flex flex-col gap-4">
         <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur"
                onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', {'key': 'ArrowUp'} as any))}
                onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', {'key': 'ArrowUp'} as any))}
        >↑</button>
         <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur"
                onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', {'key': 'ArrowDown'} as any))}
                onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', {'key': 'ArrowDown'} as any))}
        >↓</button>
      </div>

      <div className="absolute top-4 left-4 text-white font-mono text-sm bg-black/50 p-2 rounded">
        Use WASD or Arrows to drive
      </div>
    </div>
  );
};

export default DrivingScene;
