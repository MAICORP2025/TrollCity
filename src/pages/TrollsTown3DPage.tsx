import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Engine, Scene, Vector3, HemisphericLight, MeshBuilder, Color3, StandardMaterial, FollowCamera, Mesh } from '@babylonjs/core'
import '@babylonjs/core/Materials/standardMaterial'
import '@babylonjs/core/Lights/hemisphericLight'
import '@babylonjs/core/Culling/ray'
import '@babylonjs/core/Meshes/meshBuilder'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { TrollCitySpinner } from '../components/TrollCitySpinner'
import { toast } from 'sonner'

interface InputState {
  forward: number
  steer: number
  brake: boolean
  boost: boolean
  interact: boolean
  cancel: boolean
}

interface TownHouse {
  id: string
  owner_user_id: string
  parcel_id: string
  position_x: number
  position_z: number
  metadata: any
  parcel_center_x: number
  parcel_center_z: number
  parcel_size_x: number
  parcel_size_z: number
  parcel_building_style?: string | null
  owner_username: string | null
  is_own: boolean
  last_raid_at: string | null
  last_raid_outcome: string | null
}

interface PlayerStateRow {
  user_id: string
  position_x: number
  position_z: number
  rotation_y: number
  vehicle: string | null
}

interface TownLocation {
  id: string
  name: string
  route: string
  position_x: number
  position_z: number
}

const TOWN_LOCATIONS: TownLocation[] = [
  {
    id: 'dealership',
    name: 'Car Dealership',
    route: '/dealership',
    position_x: 80,
    position_z: -20
  },
  {
    id: 'mechanic',
    name: 'Mechanic Shop',
    route: '/mechanic',
    position_x: -80,
    position_z: -20
  },
  {
    id: 'general_store',
    name: 'General Store',
    route: '/general-store',
    position_x: 20,
    position_z: 80
  },
  {
    id: 'hospital',
    name: 'Hospital',
    route: '/hospital',
    position_x: -20,
    position_z: 80
  },
  {
    id: 'coin_store',
    name: 'Coin Store',
    route: '/store',
    position_x: 120,
    position_z: 40
  },
  {
    id: 'marketplace',
    name: 'Marketplace',
    route: '/marketplace',
    position_x: -120,
    position_z: 40
  },
  {
    id: 'auctions',
    name: 'Vehicle Auctions',
    route: '/auctions',
    position_x: 0,
    position_z: -140
  },
  {
    id: 'inventory',
    name: 'Inventory',
    route: '/inventory',
    position_x: 0,
    position_z: 140
  },
  {
    id: 'wall',
    name: 'The Wall',
    route: '/wall',
    position_x: -140,
    position_z: -60
  },
  {
    id: 'leaderboard',
    name: 'Leaderboard',
    route: '/leaderboard',
    position_x: 140,
    position_z: -60
  }
]

const TrollsTown3DPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<Engine | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const carMeshRef = useRef<any>(null)
  const avatarMeshRef = useRef<any>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const lastStateSyncRef = useRef<number>(0)
  const housesRef = useRef<TownHouse[]>([])
  const ghostMeshesRef = useRef<Map<string, Mesh>>(new Map())
  const lastInteractRef = useRef(false)
  const raidTimerRef = useRef<number | null>(null)
  const lastChunkCenterRef = useRef<{ x: number; z: number } | null>(null)
  const isInCarRef = useRef(true)
  const [houses, setHouses] = useState<TownHouse[]>([])
  const [speedKmh, setSpeedKmh] = useState(0)
  const [headingDeg, setHeadingDeg] = useState(0)
  const [isInCar, setIsInCar] = useState(true)
  const [nearHouse, setNearHouse] = useState<TownHouse | null>(null)
  const [nearLocation, setNearLocation] = useState<TownLocation | null>(null)
  const [showHousePanel, setShowHousePanel] = useState(false)
  const [activeRaid, setActiveRaid] = useState<{
    raidId: string
    houseId: string
    outcome?: 'success' | 'failure'
    loot?: number
  } | null>(null)
  const [raidTimeRemaining, setRaidTimeRemaining] = useState<number | null>(null)
  const [loadingHouses, setLoadingHouses] = useState(true)
  const [loadingMultiplayer, setLoadingMultiplayer] = useState(false)
  const inputRef = useRef<InputState>({
    forward: 0,
    steer: 0,
    brake: false,
    boost: false,
    interact: false,
    cancel: false
  })

  const { user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    engineRef.current = engine
    sceneRef.current = scene

    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)
    light.intensity = 0.9
    light.groundColor = new Color3(0.02, 0.02, 0.04)

    const ground = MeshBuilder.CreateGround('ground', { width: 400, height: 400 }, scene)
    const groundMaterial = new StandardMaterial('groundMat', scene)
    groundMaterial.diffuseColor = new Color3(0.05, 0.05, 0.08)
    groundMaterial.specularColor = new Color3(0, 0, 0)
    ground.material = groundMaterial

    const roadMaterial = new StandardMaterial('roadMat', scene)
    roadMaterial.diffuseColor = new Color3(0.05, 0.05, 0.05)
    roadMaterial.specularColor = new Color3(0, 0, 0)

    const roadMain = MeshBuilder.CreateBox('roadMain', { width: 12, height: 0.1, depth: 400 }, scene)
    roadMain.position.y = 0.05
    roadMain.material = roadMaterial

    const roadCross = MeshBuilder.CreateBox('roadCross', { width: 400, height: 0.1, depth: 12 }, scene)
    roadCross.position.y = 0.05
    roadCross.material = roadMaterial

    const dividerMaterial = new StandardMaterial('dividerMat', scene)
    dividerMaterial.diffuseColor = new Color3(0.9, 0.9, 0.2)
    dividerMaterial.emissiveColor = new Color3(0.5, 0.5, 0.1)

    for (let i = -180; i <= 180; i += 16) {
      const strip = MeshBuilder.CreateBox(`divider_z_${i}`, { width: 0.4, height: 0.1, depth: 4 }, scene)
      strip.position = new Vector3(0, 0.06, i)
      strip.material = dividerMaterial

      const strip2 = strip.clone(`divider_x_${i}`)
      if (strip2) {
        strip2.rotation.y = Math.PI / 2
        strip2.position = new Vector3(i, 0.06, 0)
      }
    }

    const buildingMaterialA = new StandardMaterial('buildingMatA', scene)
    buildingMaterialA.diffuseColor = new Color3(0.15, 0.2, 0.45)
    buildingMaterialA.specularColor = new Color3(0.1, 0.1, 0.2)

    const buildingMaterialB = new StandardMaterial('buildingMatB', scene)
    buildingMaterialB.diffuseColor = new Color3(0.25, 0.12, 0.3)
    buildingMaterialB.specularColor = new Color3(0.1, 0.05, 0.15)

    const buildings: any[] = []
    const blockSize = 40
    const marginFromRoad = 18
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue
        const centerX = x * blockSize
        const centerZ = z * blockSize
        const offsetX = centerX + (centerX > 0 ? marginFromRoad : -marginFromRoad)
        const offsetZ = centerZ + (centerZ > 0 ? marginFromRoad : -marginFromRoad)
        const height = 6 + Math.random() * 24
        const building = MeshBuilder.CreateBox(`b_${x}_${z}`, { width: 18, depth: 18, height }, scene)
        building.position = new Vector3(offsetX, height / 2, offsetZ)
        building.material = (x + z) % 2 === 0 ? buildingMaterialA : buildingMaterialB
        buildings.push(building)
      }
    }

    TOWN_LOCATIONS.forEach(loc => {
      const height = 10
      const marker = MeshBuilder.CreateBox(
        `loc_${loc.id}`,
        { width: 14, height, depth: 10 },
        scene
      )
      marker.position = new Vector3(loc.position_x, height / 2, loc.position_z)
      const markerMaterial = new StandardMaterial(`locMat_${loc.id}`, scene)
      markerMaterial.diffuseColor = new Color3(0.15, 0.5, 0.2)
      markerMaterial.emissiveColor = new Color3(0.05, 0.2, 0.1)
      marker.material = markerMaterial
      buildings.push(marker)
    })

    const carBody = MeshBuilder.CreateBox('carBody', { width: 2, height: 1, depth: 4 }, scene)
    carBody.position = new Vector3(0, 0.6, -10)
    const carMaterial = new StandardMaterial('carMat', scene)
    carMaterial.diffuseColor = new Color3(0.7, 0.1, 0.3)
    carMaterial.emissiveColor = new Color3(0.2, 0.02, 0.05)
    carBody.material = carMaterial
    carBody.checkCollisions = true

    const avatarBody = MeshBuilder.CreateBox('avatarBody', { width: 1, height: 2, depth: 1 }, scene)
    avatarBody.position = new Vector3(carBody.position.x, 1, carBody.position.z - 3)
    const avatarMaterial = new StandardMaterial('avatarMat', scene)
    avatarMaterial.diffuseColor = new Color3(0.9, 0.9, 0.9)
    avatarMaterial.emissiveColor = new Color3(0.2, 0.2, 0.2)
    avatarBody.material = avatarMaterial
    avatarBody.checkCollisions = true
    avatarBody.setEnabled(false)

    const houseTemplate = MeshBuilder.CreateBox('houseTemplate', { width: 8, height: 4, depth: 8 }, scene)
    const houseMaterial = new StandardMaterial('houseMat', scene)
    houseMaterial.diffuseColor = new Color3(0.25, 0.7, 0.9)
    houseMaterial.emissiveColor = new Color3(0.1, 0.3, 0.5)
    houseTemplate.material = houseMaterial
    houseTemplate.position.y = 2

    const ghostTemplate = MeshBuilder.CreateBox('ghostCarTemplate', { width: 2, height: 1, depth: 4 }, scene)
    const ghostMaterial = new StandardMaterial('ghostMat', scene)
    ghostMaterial.diffuseColor = new Color3(0.2, 0.8, 0.9)
    ghostMaterial.alpha = 0.3
    ghostTemplate.material = ghostMaterial
    ghostTemplate.position.y = 0.6

    const camera = new FollowCamera('followCam', new Vector3(0, 5, -10), scene)
    camera.radius = 10
    camera.heightOffset = 4
    camera.rotationOffset = 0
    camera.cameraAcceleration = 0.05
    camera.maxCameraSpeed = 4
    camera.lockedTarget = carBody
    scene.activeCamera = camera
    camera.attachControl(true)

    const collidables: Mesh[] = [ground as Mesh, roadMain as Mesh, roadCross as Mesh, ...(buildings as Mesh[])]
    collidables.forEach(m => {
      m.checkCollisions = true
    })

    carMeshRef.current = carBody
    avatarMeshRef.current = avatarBody
    isInCarRef.current = true
    lastFrameTimeRef.current = performance.now()

    const applyHousesToScene = (houseRows: TownHouse[]) => {
      housesRef.current = houseRows
      setHouses(houseRows)
      ghostMeshesRef.current.forEach(mesh => {
        mesh.dispose()
      })
      ghostMeshesRef.current.clear()

      for (const existing of scene.meshes.filter(m => m.name.startsWith('houseInstance_'))) {
        existing.dispose()
      }

      const allCollidables: Mesh[] = [...collidables]

      houseRows.forEach(h => {
        const instance = houseTemplate.createInstance(`houseInstance_${h.id}`)
        const style = h.parcel_building_style || h.metadata?.visual_tier || 'starter'
        const baseHeight = 4
        let scaleY = 1
        let scaleXZ = 1
        if (style === 'apartment') {
          scaleY = 3
          scaleXZ = 1.1
        } else if (style === 'luxury' || style === 'mansion' || style === 'mega') {
          scaleY = 1.4
          scaleXZ = 1.6
        } else if (style === 'mid') {
          scaleY = 1.2
          scaleXZ = 1.2
        }
        instance.scaling = new Vector3(scaleXZ, scaleY, scaleXZ)
        instance.position = new Vector3(h.position_x, (baseHeight * scaleY) / 2, h.position_z)
        instance.checkCollisions = true
        allCollidables.push(instance as unknown as Mesh)
      })

      allCollidables.forEach(m => {
        m.checkCollisions = true
      })
    }

    const loadHouses = async () => {
      setLoadingHouses(true)
      try {
        const { data, error } = await supabase.rpc('get_town_houses')
        if (error) {
          throw error
        }
        if (Array.isArray(data)) {
          const normalized: TownHouse[] = data.map((row: any) => ({
            id: row.id,
            owner_user_id: row.owner_user_id,
            parcel_id: row.parcel_id,
            position_x: Number(row.position_x ?? 0),
            position_z: Number(row.position_z ?? 0),
            metadata: row.metadata || {},
            parcel_center_x: Number(row.parcel_center_x ?? 0),
            parcel_center_z: Number(row.parcel_center_z ?? 0),
            parcel_size_x: Number(row.parcel_size_x ?? 12),
            parcel_size_z: Number(row.parcel_size_z ?? 12),
            parcel_building_style: row.parcel_building_style ?? null,
            owner_username: row.owner_username ?? null,
            is_own: Boolean(row.is_own),
            last_raid_at: row.last_raid_at ?? null,
            last_raid_outcome: row.last_raid_outcome ?? null
          }))
          applyHousesToScene(normalized)
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load houses')
      } finally {
        setLoadingHouses(false)
      }
    }

    const refreshMultiplayerGhosts = async () => {
      if (!user) return
      if (!scene) return
      setLoadingMultiplayer(true)
      try {
        const { data, error } = await supabase
          .from('town_player_state')
          .select('user_id, position_x, position_z, rotation_y, vehicle, updated_at')
          .neq('user_id', user.id)
        if (error) {
          throw error
        }
        const rows: PlayerStateRow[] = (data || []).map(row => ({
          user_id: row.user_id,
          position_x: Number(row.position_x ?? 0),
          position_z: Number(row.position_z ?? 0),
          rotation_y: Number(row.rotation_y ?? 0),
          vehicle: row.vehicle ?? null
        }))

        const existing = ghostMeshesRef.current
        const seenUserIds = new Set<string>()

        rows.forEach(row => {
          seenUserIds.add(row.user_id)
          let mesh = existing.get(row.user_id)
          if (!mesh) {
            mesh = ghostTemplate.createInstance(`ghost_${row.user_id}`) as unknown as Mesh
            existing.set(row.user_id, mesh)
          }
          mesh.position = new Vector3(row.position_x, ghostTemplate.position.y, row.position_z)
          mesh.rotation.y = row.rotation_y
        })

        existing.forEach((mesh, userId) => {
          if (!seenUserIds.has(userId)) {
            mesh.dispose()
            existing.delete(userId)
          }
        })
      } catch (err) {
        setLoadingMultiplayer(false)
        return
      }
      setLoadingMultiplayer(false)
    }

    loadHouses()
    const multiplayerInterval = window.setInterval(() => {
      refreshMultiplayerGhosts()
    }, 2000)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyW') inputRef.current.forward = 1
      if (event.code === 'KeyS') inputRef.current.forward = -1
      if (event.code === 'KeyA') inputRef.current.steer = -1
      if (event.code === 'KeyD') inputRef.current.steer = 1
      if (event.code === 'Space') inputRef.current.brake = true
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') inputRef.current.boost = true
      if (event.code === 'KeyE') inputRef.current.interact = true
      if (event.code === 'KeyQ' || event.code === 'Escape') inputRef.current.cancel = true
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyW' && inputRef.current.forward > 0) inputRef.current.forward = 0
      if (event.code === 'KeyS' && inputRef.current.forward < 0) inputRef.current.forward = 0
      if (event.code === 'KeyA' && inputRef.current.steer < 0) inputRef.current.steer = 0
      if (event.code === 'KeyD' && inputRef.current.steer > 0) inputRef.current.steer = 0
      if (event.code === 'Space') inputRef.current.brake = false
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') inputRef.current.boost = false
      if (event.code === 'KeyE') inputRef.current.interact = false
      if (event.code === 'KeyQ' || event.code === 'Escape') inputRef.current.cancel = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    let velocity = 0
    let heading = 0
    let avatarHeading = 0
    const maxSpeed = 40
    const acceleration = 18
    const brakeForce = 40
    const friction = 6
    const boostFactor = 1.6
    const turnRate = 1.6
    const onFootSpeed = 10
    const onFootTurnRate = 2.4

    const updateFromGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
      const pad = gamepads[0]
      if (!pad) return
      const lx = pad.axes[0] || 0
      const ly = pad.axes[1] || 0
      const rt = pad.buttons[7]?.value ?? 0
      const lt = pad.buttons[6]?.value ?? 0

      if (Math.abs(ly) > 0.15 || rt > 0.05 || lt > 0.05) {
        if (rt > lt) {
          inputRef.current.forward = rt
        } else if (lt > rt) {
          inputRef.current.forward = -lt
        } else {
          inputRef.current.forward = -ly
        }
      }

      if (Math.abs(lx) > 0.15) {
        inputRef.current.steer = lx
      } else if (Math.abs(inputRef.current.steer) !== 0 && Math.abs(lx) <= 0.15) {
        inputRef.current.steer = 0
      }

      inputRef.current.brake = lt > 0.05
      inputRef.current.boost = pad.buttons[5]?.pressed ?? inputRef.current.boost
      inputRef.current.interact = pad.buttons[0]?.pressed ?? inputRef.current.interact
      inputRef.current.cancel = pad.buttons[1]?.pressed ?? inputRef.current.cancel
    }

    let dayNightTime = 0

    const step = () => {
      const now = performance.now()
      const last = lastFrameTimeRef.current || now
      const dt = Math.min((now - last) / 1000, 0.05)
      lastFrameTimeRef.current = now

      dayNightTime += dt * 0.05
      const cycle = (Math.sin(dayNightTime) + 1) / 2
      light.intensity = 0.5 + cycle * 0.7
      light.groundColor = new Color3(0.01 + cycle * 0.05, 0.01 + cycle * 0.05, 0.03 + cycle * 0.12)
      groundMaterial.diffuseColor = new Color3(0.03 + cycle * 0.04, 0.03 + cycle * 0.04, 0.06 + cycle * 0.08)

      updateFromGamepad()

      const car = carMeshRef.current
      const avatar = avatarMeshRef.current
      const isInCarNow = isInCarRef.current

      let activePosition: Vector3 | null = null
      let headingForState = 0

      if (isInCarNow && car) {
        const forwardInput = inputRef.current.forward
        const steerInput = inputRef.current.steer
        const isBraking = inputRef.current.brake
        const isBoosting = inputRef.current.boost

        const accel = acceleration * (isBoosting ? boostFactor : 1)
        velocity += forwardInput * accel * dt

        const frictionForce = friction * dt
        if (Math.abs(velocity) < frictionForce) {
          velocity = 0
        } else {
          velocity -= Math.sign(velocity) * frictionForce
        }

        if (isBraking && Math.abs(velocity) > 0) {
          const brakeStep = brakeForce * dt
          if (Math.abs(velocity) <= brakeStep) {
            velocity = 0
          } else {
            velocity -= Math.sign(velocity) * brakeStep
          }
        }

        const speedLimit = maxSpeed * (isBoosting ? boostFactor : 1)
        if (velocity > speedLimit) velocity = speedLimit
        if (velocity < -speedLimit * 0.5) velocity = -speedLimit * 0.5

        if (Math.abs(velocity) > 0.1 && Math.abs(steerInput) > 0.01) {
          const turnAmount = steerInput * turnRate * dt * (Math.min(Math.abs(velocity) / maxSpeed, 1) + 0.2)
          heading += turnAmount
        }

        const prevPosition = car.position.clone()
        const dir = new Vector3(Math.sin(heading), 0, Math.cos(heading))
        car.rotation.y = heading
        car.position = car.position.add(dir.scale(velocity * dt))

        let collided = false
        for (const m of buildings) {
          if (car.intersectsMesh(m, false)) {
            collided = true
            break
          }
        }
        if (collided) {
          car.position.copyFrom(prevPosition)
          velocity = 0
        }

        activePosition = car.position
        headingForState = heading
      } else if (!isInCarNow && avatar) {
        const forwardInput = inputRef.current.forward
        const steerInput = inputRef.current.steer

        avatarHeading += steerInput * onFootTurnRate * dt

        const prevPosition = avatar.position.clone()
        const dir = new Vector3(Math.sin(avatarHeading), 0, Math.cos(avatarHeading))
        avatar.rotation.y = avatarHeading
        avatar.position = avatar.position.add(dir.scale(forwardInput * onFootSpeed * dt))

        let collided = false
        for (const m of buildings) {
          if (avatar.intersectsMesh(m, false)) {
            collided = true
            break
          }
        }
        if (collided) {
          avatar.position.copyFrom(prevPosition)
        }

        activePosition = avatar.position
        headingForState = avatarHeading
      }

      if (camera.lockedTarget !== (isInCarNow ? car : avatar) && (car || avatar)) {
        camera.lockedTarget = isInCarNow ? car : avatar
      }

      if (!activePosition) {
        scene.render()
        return
      }

      const chunkSize = 120
      const currentChunkX = Math.round(activePosition.x / chunkSize)
      const currentChunkZ = Math.round(activePosition.z / chunkSize)
      const lastChunk = lastChunkCenterRef.current
      if (!lastChunk || lastChunk.x !== currentChunkX || lastChunk.z !== currentChunkZ) {
        lastChunkCenterRef.current = { x: currentChunkX, z: currentChunkZ }
        const activeRadiusChunks = 1
        const centerXWorld = currentChunkX * chunkSize
        const centerZWorld = currentChunkZ * chunkSize
        scene.meshes.forEach(mesh => {
          if (mesh === car || mesh === avatar) return
          if (mesh.name.startsWith('ground') || mesh.name.startsWith('road')) return
          const dx = mesh.position.x - centerXWorld
          const dz = mesh.position.z - centerZWorld
          const distanceChunksX = Math.abs(dx) / chunkSize
          const distanceChunksZ = Math.abs(dz) / chunkSize
          const within = distanceChunksX <= activeRadiusChunks && distanceChunksZ <= activeRadiusChunks
          mesh.setEnabled(within)
        })
      }

      const houseRows = housesRef.current
      let closestHouse: TownHouse | null = null
      let closestHouseDist = Number.POSITIVE_INFINITY
      for (const h of houseRows) {
        const dx = activePosition.x - h.position_x
        const dz = activePosition.z - h.position_z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < closestHouseDist) {
          closestHouseDist = dist
          closestHouse = h
        }
      }

      if (closestHouse && closestHouseDist <= 5) {
        setNearHouse(prev => {
          if (!prev || prev.id !== closestHouse.id) {
            return closestHouse
          }
          return prev
        })
      } else {
        setNearHouse(prev => (prev ? null : prev))
      }

      let closestLocation: TownLocation | null = null
      let closestLocationDist = Number.POSITIVE_INFINITY
      for (const loc of TOWN_LOCATIONS) {
        const dx = activePosition.x - loc.position_x
        const dz = activePosition.z - loc.position_z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < closestLocationDist) {
          closestLocationDist = dist
          closestLocation = loc
        }
      }

      if (closestLocation && closestLocationDist <= 10) {
        setNearLocation(prev => {
          if (!prev || prev.id !== closestLocation.id) {
            return closestLocation
          }
          return prev
        })
      } else {
        setNearLocation(prev => (prev ? null : prev))
      }

      const interactPressed = inputRef.current.interact
      if (interactPressed && !lastInteractRef.current) {
        lastInteractRef.current = true

        if (!isInCarNow && car && avatar) {
          const dxCar = avatar.position.x - car.position.x
          const dzCar = avatar.position.z - car.position.z
          const distCar = Math.sqrt(dxCar * dxCar + dzCar * dzCar)
          if (distCar <= 4) {
            avatar.setEnabled(false)
            isInCarRef.current = true
            setIsInCar(true)
          } else if (closestHouse && !activeRaid) {
            setShowHousePanel(true)
          } else if (closestLocation) {
            navigate(closestLocation.route)
          }
        } else if (isInCarNow && car && avatar) {
          if (closestLocation && closestLocationDist <= 10) {
            navigate(closestLocation.route)
          } else {
            avatar.position = new Vector3(car.position.x, avatar.position.y, car.position.z - 3)
            avatar.setEnabled(true)
            isInCarRef.current = false
            setIsInCar(false)
          }
        }
      } else if (!interactPressed) {
        lastInteractRef.current = false
      }

      if (inputRef.current.cancel && showHousePanel) {
        setShowHousePanel(false)
      }

      let speedMetersPerSec = 0
      if (isInCarNow) {
        speedMetersPerSec = Math.abs(velocity)
      } else {
        const scalar = Math.abs(inputRef.current.forward)
        speedMetersPerSec = scalar * onFootSpeed
      }
      const speed = speedMetersPerSec * 3.6
      setSpeedKmh(speed)

      let deg = (headingForState * 180) / Math.PI
      deg = ((deg % 360) + 360) % 360
      setHeadingDeg(deg)

      const sinceLastSync = now - lastStateSyncRef.current
      if (sinceLastSync > 1000) {
        lastStateSyncRef.current = now
        void supabase.rpc('update_player_state', {
          p_position_x: activePosition.x,
          p_position_z: activePosition.z,
          p_rotation_y: headingForState,
          p_vehicle: isInCarNow ? 'car' : 'foot'
        })
      }

      scene.render()
    }

    engine.runRenderLoop(step)

    const handleResize = () => {
      engine.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (raidTimerRef.current !== null) {
        window.clearInterval(raidTimerRef.current)
        raidTimerRef.current = null
      }
      window.clearInterval(multiplayerInterval)
      engine.stopRenderLoop(step)
      scene.dispose()
      engine.dispose()
      engineRef.current = null
      sceneRef.current = null
      carMeshRef.current = null
      avatarMeshRef.current = null
    }
  }, [user, navigate])

  if (!user) return null

  const headingLabel = (() => {
    const deg = headingDeg
    if (deg >= 315 || deg < 45) return 'N'
    if (deg >= 45 && deg < 135) return 'E'
    if (deg >= 135 && deg < 225) return 'S'
    return 'W'
  })()

  const handleStartRaid = async () => {
    if (!nearHouse || nearHouse.is_own || activeRaid) return
    try {
      const { data, error } = await supabase.rpc('start_raid', {
        p_target_house_id: nearHouse.id
      })
      if (error) {
        throw error
      }
      if (!data?.success) {
        if (data?.message) toast.error(data.message)
        return
      }
      const raidId = data.raid_id as string
      const durationSeconds = Number(data.duration_seconds ?? 30)
      const endTime = Date.now() + durationSeconds * 1000
      setActiveRaid({
        raidId,
        houseId: nearHouse.id
      })
      setRaidTimeRemaining(durationSeconds)
      if (raidTimerRef.current !== null) {
        window.clearInterval(raidTimerRef.current)
      }
      raidTimerRef.current = window.setInterval(() => {
        setRaidTimeRemaining(prev => {
          const now = Date.now()
          const remaining = Math.max(0, Math.round((endTime - now) / 1000))
          if (remaining <= 0) {
            if (raidTimerRef.current !== null) {
              window.clearInterval(raidTimerRef.current)
              raidTimerRef.current = null
            }
            return 0
          }
          return remaining
        })
      }, 1000)
      toast.info('Raid started')
      setShowHousePanel(false)

      window.setTimeout(async () => {
        await handleFinishRaid(raidId, nearHouse)
      }, durationSeconds * 1000 + 200)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start raid')
    }
  }

  const handleFinishRaid = async (raidId: string, house: TownHouse) => {
    const defense = Number(house.metadata?.defense_rating ?? 1)
    const attack = 1.2
    const successChance = attack / (attack + defense)
    const roll = Math.random()
    const outcome: 'success' | 'failure' = roll <= successChance ? 'success' : 'failure'
    let loot = 0
    if (outcome === 'success') {
      loot = Math.round(10 + Math.random() * 40)
    }

    try {
      const { data, error } = await supabase.rpc('finish_raid', {
        p_raid_id: raidId,
        p_outcome: outcome,
        p_loot: loot
      })
      if (error) {
        throw error
      }
      setActiveRaid({
        raidId,
        houseId: house.id,
        outcome,
        loot
      })
      if (outcome === 'success') {
        toast.success(`Raid success! Looted ${loot} TrollCoins`)
      } else {
        toast.error('Raid failed. Heat increased.')
      }
      void (async () => {
        try {
          const { data: refreshed, error: refreshError } = await supabase.rpc('get_town_houses')
          if (!refreshError && Array.isArray(refreshed)) {
            const normalized: TownHouse[] = refreshed.map((row: any) => ({
              id: row.id,
              owner_user_id: row.owner_user_id,
              parcel_id: row.parcel_id,
              position_x: Number(row.position_x ?? 0),
              position_z: Number(row.position_z ?? 0),
              metadata: row.metadata || {},
              parcel_center_x: Number(row.parcel_center_x ?? 0),
              parcel_center_z: Number(row.parcel_center_z ?? 0),
              parcel_size_x: Number(row.parcel_size_x ?? 12),
              parcel_size_z: Number(row.parcel_size_z ?? 12),
              owner_username: row.owner_username ?? null,
              is_own: Boolean(row.is_own),
              last_raid_at: row.last_raid_at ?? null,
              last_raid_outcome: row.last_raid_outcome ?? null
            }))
            housesRef.current = normalized
            setHouses(normalized)
          }
        } catch {
        }
      })()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to finish raid')
    }
  }

  return (
    <div className="relative w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full outline-none touch-none" />
      <div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-2 text-xs sm:text-sm">
        <div className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 backdrop-blur">
          <div className="font-semibold text-white">Speed</div>
          <div className="text-emerald-400 text-lg font-bold">
            {Math.round(speedKmh).toString().padStart(2, '0')} km/h
          </div>
        </div>
        <div className="px-3 py-2 rounded-lg bg-black/60 border border-white/10 backdrop-blur mt-1">
          <div className="font-semibold text-white">Compass</div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-300 font-bold">{headingLabel}</span>
            <span className="text-gray-400">{Math.round(headingDeg)}°</span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs text-gray-300 px-3 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur flex flex-wrap gap-x-4 gap-y-1 justify-center">
        <span>W/S: throttle</span>
        <span>A/D: steer</span>
        <span>Space: handbrake</span>
        <span>Shift: boost</span>
        <span>Gamepad: sticks + triggers, A interact, B cancel, RB boost</span>
      </div>
      {nearLocation && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 text-xs sm:text-sm text-cyan-300 px-3 py-2 rounded-full bg-black/70 border border-cyan-500/40 backdrop-blur flex items-center gap-2">
          <span className="font-semibold">Press E / A to enter</span>
          <span className="text-gray-300">{nearLocation.name}</span>
        </div>
      )}
      {loadingHouses && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <TrollCitySpinner text="Spawning Trolls Town houses..." subtext="Assigning your home on the map" />
          </div>
        </div>
      )}
      {nearHouse && !showHousePanel && !activeRaid && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 text-xs sm:text-sm text-emerald-300 px-3 py-2 rounded-full bg-black/70 border border-emerald-500/40 backdrop-blur flex items-center gap-2">
          <span className="font-semibold">Press E / A to interact</span>
          <span className="text-gray-400">
            {nearHouse.is_own ? 'Your house' : `House of ${nearHouse.owner_username || 'Citizen'}`}
          </span>
        </div>
      )}
      {(showHousePanel || activeRaid) && nearHouse && (
        <div className="pointer-events-auto absolute bottom-4 right-4 w-72 max-w-[90vw] bg-black/80 border border-white/15 rounded-2xl p-4 text-xs sm:text-sm text-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-gray-400">Trolls Town House</div>
              <div className="font-semibold text-white">
                {nearHouse.is_own ? 'Your House' : `${nearHouse.owner_username || 'Citizen'}'s House`}
              </div>
            </div>
            <button
              onClick={() => setShowHousePanel(false)}
              className="text-[11px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Close
            </button>
          </div>

          <div className="space-y-1 text-[11px] text-gray-400">
            <div>
              Level: {Number(nearHouse.metadata?.level ?? 1)}
            </div>
            <div>
              Defense: {Number(nearHouse.metadata?.defense_rating ?? 1).toFixed(2)}
            </div>
            {nearHouse.last_raid_at && (
              <div>
                Last raid: {nearHouse.last_raid_outcome || 'unknown'}
              </div>
            )}
          </div>

          {activeRaid && activeRaid.houseId === nearHouse.id ? (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-purple-300">Raid In Progress</div>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {raidTimeRemaining !== null && raidTimeRemaining > 0
                    ? `Time remaining: ${raidTimeRemaining}s`
                    : activeRaid.outcome
                      ? activeRaid.outcome === 'success'
                        ? `Raid success. Looted ${activeRaid.loot ?? 0} coins.`
                        : 'Raid failed.'
                      : 'Resolving raid...'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setShowHousePanel(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold"
              >
                View House
              </button>
              {!nearHouse.is_own && (
                <button
                  onClick={handleStartRaid}
                  className="flex-1 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-[11px] font-semibold"
                >
                  Raid House
                </button>
              )}
            </div>
          )}

          {loadingMultiplayer && (
            <div className="text-[10px] text-gray-500">
              Syncing nearby players...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TrollsTown3DPage
