// TrollopolyCityDevTest.tsx
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Moon, Sun, Dice5, RotateCcw, MessageSquare, Send, ShoppingCart, X } from 'lucide-react';
import { LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';

// LiveKit Video Player Component
function LiveKitVideoPlayer({
  videoTrack,
  isLocal = false,
}: {
  videoTrack: LocalVideoTrack | RemoteVideoTrack | undefined;
  isLocal?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPlayedRef = useRef(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoTrack || !containerRef.current) return;
    if (hasPlayedRef.current && videoElementRef.current && containerRef.current.contains(videoElementRef.current)) return;
    if (hasPlayedRef.current) return;

    try {
      const el = videoTrack.attach();
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.objectFit = 'cover';
      el.autoplay = true;
      el.playsInline = true;
      if (isLocal) { el.muted = true; }
      containerRef.current!.appendChild(el);
      videoElementRef.current = el;
      hasPlayedRef.current = true;
    } catch (err) {
      console.error('[TrollopolyCityDevTest] Video attach error:', err);
    }

    return () => {
      if (videoTrack && videoElementRef.current && containerRef.current?.contains(videoElementRef.current)) {
        try { videoTrack.detach(); videoElementRef.current = null; hasPlayedRef.current = false; } catch {}
      }
    };
  }, [videoTrack, isLocal]);

  return <div ref={containerRef} className="w-full h-full bg-black" />;
}

const BOARD_CONFIG = { size: 80, tileSize: 5.5, streetWidth: 8, sidewalkWidth: 2 };

const createCityBoard = (scene: THREE.Scene) => {
  // Create a simple ground plane for the city board
  const groundGeometry = new THREE.PlaneGeometry(BOARD_CONFIG.size, BOARD_CONFIG.size);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Add some basic buildings/structures
  for (let i = 0; i < 8; i++) {
    const buildingGeometry = new THREE.BoxGeometry(3, Math.random() * 10 + 5, 3);
    const buildingMaterial = new THREE.MeshLambertMaterial({
      color: Math.random() * 0xffffff
    });
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(
      (Math.random() - 0.5) * BOARD_CONFIG.size * 0.8,
      buildingGeometry.parameters.height / 2,
      (Math.random() - 0.5) * BOARD_CONFIG.size * 0.8
    );
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
  }
};

const createVehicle = (scene: THREE.Scene, player: any, index: number) => {
  // Create a simple vehicle representation for each player
  const vehicleGeometry = new THREE.BoxGeometry(2, 1, 3);
  const vehicleMaterial = new THREE.MeshLambertMaterial({
    color: index === 0 ? 0xff0000 : index === 1 ? 0x0000ff : index === 2 ? 0x00ff00 : 0xffff00
  });
  const vehicle = new THREE.Mesh(vehicleGeometry, vehicleMaterial);
  vehicle.position.set(
    (index - 1.5) * 15,
    0.5,
    (Math.floor(index / 2) - 0.5) * 15
  );
  vehicle.castShadow = true;
  scene.add(vehicle);
};

const createCenterDecks = (scene: THREE.Scene) => {
  // Create center area
  const centerGeometry = new THREE.CylinderGeometry(10, 10, 2, 32);
  const centerMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  center.position.y = 1;
  center.receiveShadow = true;
  scene.add(center);
};
const SKY_CONFIG = {
  day: { background: 0x87CEEB, fog: 0x87CEEB, ambientIntensity: 0.6, sunIntensity: 1.2 },
  night: { background: 0x0a0a1a, fog: 0x0a0a1a, ambientIntensity: 0.2, sunIntensity: 0.1 }
};

const VEHICLE_COLORS = [0xff3333, 0x3366ff, 0x33cc33, 0xffcc00];

const TROLLOPOLY_PROPERTIES = [
  { id: 0, name: 'GO', type: 'special', color: 0xffffff, price: 0 },
  { id: 1, name: 'Downtown Diner', type: 'property', color: 0x8b4513, price: 60 },
  { id: 2, name: 'Community Chest', type: 'special', color: 0x4169e1, price: 0 },
  { id: 3, name: 'Corner Cafe', type: 'property', color: 0x8b4513, price: 70 },
  { id: 4, name: 'City Tax', type: 'special', color: 0xcccccc, price: 0 },
  { id: 5, name: 'Metro Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 6, name: 'Sunset Suites', type: 'property', color: 0x87ceeb, price: 100 },
  { id: 7, name: 'Chance', type: 'special', color: 0xff6b6b, price: 0 },
  { id: 8, name: 'Harbor View', type: 'property', color: 0x87ceeb, price: 120 },
  { id: 9, name: 'Bay Heights', type: 'property', color: 0x87ceeb, price: 140 },
  { id: 10, name: 'Troll Jail', type: 'special', color: 0x444444, price: 0 },
  { id: 11, name: 'Tech Plaza', type: 'property', color: 0xff69b4, price: 150 },
  { id: 12, name: 'Power Plant', type: 'utility', color: 0xffff00, price: 150 },
  { id: 13, name: 'Innovation Hub', type: 'property', color: 0xff69b4, price: 160 },
  { id: 14, name: 'Startup Street', type: 'property', color: 0xff69b4, price: 180 },
  { id: 15, name: 'Central Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 16, name: 'Parkside Manor', type: 'property', color: 0xffa500, price: 200 },
  { id: 17, name: 'Community Chest', type: 'special', color: 0x4169e1, price: 0 },
  { id: 18, name: 'Garden Villa', type: 'property', color: 0xffa500, price: 220 },
  { id: 19, name: 'Rose Residence', type: 'property', color: 0xffa500, price: 240 },
  { id: 20, name: 'Free Parking', type: 'special', color: 0x228b22, price: 0 },
  { id: 21, name: 'Golden Tower', type: 'property', color: 0xff0000, price: 260 },
  { id: 22, name: 'Chance', type: 'special', color: 0xff6b6b, price: 0 },
  { id: 23, name: 'Diamond Plaza', type: 'property', color: 0xff0000, price: 280 },
  { id: 24, name: 'Platinum Place', type: 'property', color: 0xff0000, price: 300 },
  { id: 25, name: 'West Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 26, name: 'Royal Gardens', type: 'property', color: 0xffff00, price: 320 },
  { id: 27, name: 'Luxury Suites', type: 'property', color: 0xffff00, price: 340 },
  { id: 28, name: 'Water Works', type: 'utility', color: 0x00ffff, price: 150 },
  { id: 29, name: 'Imperial Estate', type: 'property', color: 0xffff00, price: 360 },
  { id: 30, name: 'Go To Jail', type: 'special', color: 0xdc143c, price: 0 },
  { id: 31, name: 'Troll Palace', type: 'property', color: 0x00ff00, price: 400 },
  { id: 32, name: 'Fortune Court', type: 'property', color: 0x00ff00, price: 420 },
  { id: 33, name: 'Community Chest', type: 'special', color: 0x4169e1, price: 0 },
  { id: 34, name: 'Crown Heights', type: 'property', color: 0x00ff00, price: 440 },
  { id: 35, name: 'North Station', type: 'railroad', color: 0x333333, price: 200 },
  { id: 36, name: 'Chance', type: 'special', color: 0xff6b6b, price: 0 },
  { id: 37, name: 'Elite Towers', type: 'property', color: 0x4b0082, price: 500 },
  { id: 38, name: 'Luxury Tax', type: 'special', color: 0xffd700, price: 0 },
  { id: 39, name: 'City Penthouse', type: 'property', color: 0x4b0082, price: 600 }
];

const TEST_USERS = [
  { id: 'user-1', username: 'CryptoKing', color: VEHICLE_COLORS[0] },
  { id: 'user-2', username: 'MayorTroll', color: VEHICLE_COLORS[1] },
  { id: 'user-3', username: 'TycoonJane', color: VEHICLE_COLORS[2] },
  { id: 'user-4', username: 'PropertyPro', color: VEHICLE_COLORS[3] }
];

const calculateTilePosition = (index: number) => {
  const { size, tileSize, streetWidth, sidewalkWidth } = BOARD_CONFIG;
  const tilesPerSide = 10;
  const side = Math.floor(index / tilesPerSide);
  const posOnSide = index % tilesPerSide;
  const edge = size / 2 - streetWidth - sidewalkWidth - tileSize / 2;
  const offset = (posOnSide + 0.5) * tileSize - (tilesPerSide * tileSize) / 2;
  let x = 0, z = 0, rotation = 0;
  switch(side) {
    case 0: x = -offset; z = -edge; rotation = 0; break;
    case 1: x = edge; z = -offset; rotation = -Math.PI / 2; break;
    case 2: x = offset; z = edge; rotation = Math.PI; break;
    case 3: x = -edge; z = offset; rotation = Math.PI / 2; break;
  }
  return { x, z, rotation };
};

const getRoadPosition = (tileIndex: number, playerIndex: number) => {
  const { size, streetWidth } = BOARD_CONFIG;
  const tilesPerSide = 10;
  const side = Math.floor(tileIndex / tilesPerSide);
  const posOnSide = tileIndex % tilesPerSide;
  const roadOffset = size / 2 - streetWidth / 2;
  const laneOffset = (playerIndex % 2 === 0 ? -1 : 1) * 1.2;
  const spacing = (size - streetWidth * 2) / tilesPerSide;
  let x = 0, z = 0, rotation = 0;
  switch(side) {
    case 0: x = roadOffset - (posOnSide + 0.5) * spacing; z = -roadOffset + laneOffset; rotation = Math.PI / 2; break;
    case 1: x = roadOffset + laneOffset; z = -roadOffset + (posOnSide + 0.5) * spacing; rotation = Math.PI; break;
    case 2: x = -roadOffset + (posOnSide + 0.5) * spacing; z = roadOffset + laneOffset; rotation = -Math.PI / 2; break;
    case 3: x = -roadOffset + laneOffset; z = roadOffset - (posOnSide + 0.5) * spacing; rotation = 0; break;
  }
  return { x, z, rotation };
};

interface TrollopolyCityDevTestProps {
  videoTracks?: { [userId: string]: any };
  participants?: any[];
  gameBalance?: number;
  playerBalances?: { [userId: string]: number };
  onAddCoinsToGame?: (amount: number) => void;
  broadcasterId?: string;
}

export default function TrollopolyCityDevTest({
  videoTracks = {},
  participants = [],
  gameBalance = 0,
  playerBalances = {},
  onAddCoinsToGame,
  broadcasterId,
  players = []
}: TrollopolyCityDevTestProps & { players?: any[] } = {}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vehiclesRef = useRef<Map<string, THREE.Group>>(new Map());
  const tilesRef = useRef<Map<number, THREE.Group>>(new Map());
  const diceRef = useRef<THREE.Mesh[]>([]);
  const animationFrameRef = useRef<number>();
  const diceVelocityRef = useRef<{x: number, y: number, z: number, rotX: number, rotY: number, rotZ: number}[]>([]);
  
  const [isDayTime, setIsDayTime] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [diceValues, setDiceValues] = useState({ die1: 1, die2: 1 });
  const [isRolling, setIsRolling] = useState(false);
  const [diceAnimating, setDiceAnimating] = useState(false);
  const [movingVehicle, setMovingVehicle] = useState<string | null>(null);
  const [playerPositions, setPlayerPositions] = useState<number[]>([0, 0, 0, 0]);
  const [playerCoins, setPlayerCoins] = useState<number[]>([1500, 1500, 1500, 1500]);
  const [chatMessages, setChatMessages] = useState<{user: string; msg: string; time: string}[]>([
    { user: 'System', msg: 'Welcome to Trollopoly City! Roll the dice to start.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<typeof TROLLOPOLY_PROPERTIES[0] | null>(null);
  const [showPropertyPopup, setShowPropertyPopup] = useState(false);
  const [jailedPlayers, setJailedPlayers] = useState<boolean[]>([false, false, false, false]);
  const [showJailAnimation, setShowJailAnimation] = useState(false);
  // Video track management
  const videoMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  const [jailMessage, setJailMessage] = useState('');

  const createVideoPlanes = (scene: THREE.Scene) => {
    // Create video planes for each player in the game
    players.slice(0, 4).forEach((player, index) => {
      const videoPlaneGeometry = new THREE.PlaneGeometry(4, 3);
      const videoMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.9 });

      const videoMesh = new THREE.Mesh(videoPlaneGeometry, videoMaterial.clone());
      videoMesh.position.set(
        index === 0 ? -35 : index === 1 ? 35 : index === 2 ? -35 : 35,
        8,
        index === 0 || index === 1 ? -35 : 35
      );
      videoMesh.rotation.y = index === 0 ? Math.PI / 4 : index === 1 ? -Math.PI / 4 : index === 2 ? 3 * Math.PI / 4 : -3 * Math.PI / 4;

      // Attach video track if available
      const track = videoTracks[player.id];
      if (track) {
        try {
          const videoElement = track.attach();
          videoElement.style.width = '320px';
          videoElement.style.height = '240px';
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.muted = true;

          const texture = new THREE.VideoTexture(videoElement);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.format = THREE.RGBFormat;

          (videoMesh.material as THREE.MeshBasicMaterial).map = texture;
          (videoMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        } catch (err) {
          console.error(`Failed to attach video for ${player.username}:`, err);
        }
      }

      scene.add(videoMesh);
      videoMeshesRef.current.set(player.id, videoMesh);
    });
  };

  const createDice = (scene: THREE.Scene) => {
    // Dice implementation
  };

  useEffect(() => {
    // 3D Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 25, 40);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const mountRef = document.getElementById('trollopoly-3d-mount');
    if (mountRef) {
      mountRef.appendChild(renderer.domElement);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create the city board
    createCityBoard(scene);
    players.slice(0, 4).forEach((player, index) => createVehicle(scene, player, index));
    createCenterDecks(scene);
    createVideoPlanes(scene);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 20;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 2.1;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      if (mountRef && mountRef.contains(renderer.domElement)) {
        mountRef.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Show 3D scene with video planes integrated into the corners
  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-y-auto overflow-x-hidden md:overflow-hidden">
      {/* 3D Scene Container */}
      <div id="trollopoly-3d-mount" className="absolute inset-0" />

      {/* Video Plane Overlays - positioned over the 3D video planes */}
      <div>Video overlays here</div>

      {/* Game Balance Overlay */}
      <div>Game balance here</div>
    </div>
  );
}
