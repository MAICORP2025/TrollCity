import React, { useMemo, useRef, useState, useEffect } from 'react'
import {
  AlertCircle,
  Car,
  Coins,
  Crown,
  Home,
  Lock,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { useNeighborhood, useHouseRaids } from '../lib/hooks/useNeighborhood'
import { useVehicleSystem } from '../lib/hooks/useVehicleSystem'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import useSEO from '@/hooks/useSEO';

type PropertyStatus = 'owned' | 'available' | 'raided' | 'locked'
type PropertySize = 'sm' | 'md' | 'lg'
type PropertyKind = 'house' | 'mansion' | 'tower'

interface PropertyCard {
  id: string
  address: string
  owner?: string
  ownerId?: string | null
  status: PropertyStatus
  label: string
  top: string
  left: string
  size: PropertySize
  rotate: string
  car?: boolean
  isAdmin?: boolean
  kind?: PropertyKind
  lotShape?: 'square' | 'wide' | 'corner'
  house?: any
  ownerUser?: any
  isLive?: boolean
  inSeat?: boolean
  seatIndex?: number | null
  viewerCount?: number
  licenseStatus?: string
  hasHomeInsurance?: boolean
  insuranceExpiry?: string | null
}

const RAID_COST = 100

const districtZones = [
  {
    label: 'Admin Heights',
    top: '8%',
    left: '5%',
    width: '32%',
    height: '24%',
    color: 'gold',
  },
  {
    label: 'Creator Row',
    top: '11%',
    left: '53%',
    width: '34%',
    height: '24%',
    color: 'cyan',
  },
  {
    label: 'Main Troll Blvd',
    top: '39%',
    left: '14%',
    width: '44%',
    height: '24%',
    color: 'violet',
  },
  {
    label: 'Raid Zone',
    top: '58%',
    left: '5%',
    width: '30%',
    height: '30%',
    color: 'red',
  },
  {
    label: 'Gold District',
    top: '62%',
    left: '52%',
    width: '36%',
    height: '26%',
    color: 'gold',
  },
]

export default function NeighborhoodMapHub() {
   const { neighborhood, members, house, loading } = useNeighborhood()
    const profile = useAuthStore((s) => s.profile)
    const { vehicles } = useVehicleSystem()
    const { raids, isRaided } = useHouseRaids(house?.id || null)
    const navigate = useNavigate();

    // Redirect users without neighborhood_id to setup
    useEffect(() => {
      if (!loading && !profile?.neighborhood_id) {
        console.log('[NeighborhoodMapHub] No neighborhood_id, redirecting to setup');
        navigate('/neighborhood-setup', { replace: true });
      }
    }, [loading, profile?.neighborhood_id, navigate]);

    useSEO({
    title: 'Neighborhoods | Online Digital Communities & Social Groups | Troll City',
    description: 'Explore Troll City neighborhoods. Join digital communities, own virtual property, participate in house raids, and connect with neighbors in our social metaverse.',
    keywords: [
      'online neighborhoods', 'digital communities', 'social groups',
      'virtual property', 'Troll City neighborhoods', 'community map',
      'house raids', 'virtual homes', 'social metaverse', 'digital society',
      'neighborhood map', 'online community'
    ]
  });

  const [ownedHouses, setOwnedHouses] = useState<any[]>([])
  const [houseOwners, setHouseOwners] = useState<Map<string, any>>(new Map())
  const [ownerStreams, setOwnerStreams] = useState<Map<string, any>>(new Map())
  const [ownerSeatMap, setOwnerSeatMap] = useState<Map<string, any>>(new Map())
  const [ownerLicenses, setOwnerLicenses] = useState<Map<string, string>>(new Map())
  const [ownerInsurances, setOwnerInsurances] = useState<Map<string, any>>(new Map())
  const [neighborhoodNames, setNeighborhoodNames] = useState<Map<string, string>>(new Map())
  const [mapLoading, setMapLoading] = useState(true)

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        setMapLoading(true)

        const { data: houses, error } = await supabase
          .from('houses')
          .select(`
            id,
            neighborhood_id,
            owner_user_id,
            upgrade_level,
            condition,
            is_reposessed,
            electric_on,
            water_on,
            internet_on,
            created_at
          `)
          .not('owner_user_id', 'is', null)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('[NeighborhoodMapHub] Error fetching houses:', error)
          return
        }

        const filtered = (houses || []).filter((h) => h.owner_user_id)
        setOwnedHouses(filtered)

        const ownerIds = [...new Set(filtered.map((h) => h.owner_user_id).filter(Boolean))]
        const neighborhoodIds = [...new Set(filtered.map((h) => h.neighborhood_id).filter(Boolean))]

        if (neighborhoodIds.length > 0) {
          const { data: neighborhoods } = await supabase
            .from('neighborhoods')
            .select('id, name')
            .in('id', neighborhoodIds)

          const nameMap = new Map()
          ;(neighborhoods || []).forEach((n) => nameMap.set(n.id, n.name))
          setNeighborhoodNames(nameMap)
        } else {
          setNeighborhoodNames(new Map())
        }

        if (ownerIds.length > 0) {
          const { data: owners } = await supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url, is_admin, is_superadmin, vehicle_id, license_plate')
            .in('id', ownerIds)

          const ownerMap = new Map()
          ;(owners || []).forEach((o) => ownerMap.set(o.id, o))
          setHouseOwners(ownerMap)
        } else {
          setHouseOwners(new Map())
        }

        // Fetch active streams for owners (owner -> stream)
        if (ownerIds.length > 0) {
          const { data: streams } = await supabase
            .from('streams')
            .select('id, broadcaster_id, is_live, status, current_viewers')
            .in('broadcaster_id', ownerIds)
            .eq('is_live', true)

          const streamMap = new Map()
          ;(streams || []).forEach((s: any) => {
            if (s.broadcaster_id) streamMap.set(s.broadcaster_id, s)
          })
          setOwnerStreams(streamMap)

          // Fetch any active participant seats for these owners (if they're seated in other streams)
          const { data: participants } = await supabase
            .from('stream_participants')
            .select('id, stream_id, user_id, slot, is_active')
            .in('user_id', ownerIds)
            .eq('is_active', true)

          const seatMap = new Map()
          ;(participants || []).forEach((p: any) => {
            if (p.user_id) seatMap.set(p.user_id, p)
          })
          setOwnerSeatMap(seatMap)

          // Fetch user licenses
          const { data: licenses } = await supabase
            .from('user_licenses')
            .select('user_id, status')
            .in('user_id', ownerIds)

          const licenseMap = new Map()
          ;(licenses || []).forEach((l: any) => {
            if (l.user_id) licenseMap.set(l.user_id, l.status || 'none')
          })
          setOwnerLicenses(licenseMap)

          // Fetch homeowners insurances (pick latest expiry per user)
          const { data: ins } = await supabase
            .from('homeowners_insurances')
            .select('user_id, house_id, expires_at')
            .in('user_id', ownerIds)

          const insMap = new Map()
          ;(ins || []).forEach((r: any) => {
            const prev = insMap.get(r.user_id)
            if (!prev) insMap.set(r.user_id, r)
            else if (r.expires_at && (!prev.expires_at || new Date(r.expires_at) > new Date(prev.expires_at))) {
              insMap.set(r.user_id, r)
            }
          })
          setOwnerInsurances(insMap)
        } else {
          setOwnerStreams(new Map())
          setOwnerSeatMap(new Map())
          setOwnerLicenses(new Map())
          setOwnerInsurances(new Map())
        }
      } catch (error) {
        console.error('[NeighborhoodMapHub] Error fetching map data:', error)
      } finally {
        setMapLoading(false)
      }
    }

    fetchMapData()

    const channel = supabase
      .channel('all-neighborhood-houses')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'houses',
        },
        (payload) => {
          const record = payload.new || payload.old
          if (record && (record as any).owner_user_id) {
            fetchMapData()
          } else if (payload.eventType === 'UPDATE') {
            fetchMapData()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'neighborhoods',
        },
        () => {
          fetchMapData()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          const updated = payload.new as any
          if (updated?.id && houseOwners.has(updated.id)) {
            fetchMapData()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
        },
        (payload) => {
          // If a stream changed for an owner, refresh
          const rec = (payload.new || payload.old) as any
          if (rec && rec.broadcaster_id && houseOwners.has(rec.broadcaster_id)) {
            fetchMapData()
          } else {
            fetchMapData()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_participants',
        },
        (payload) => {
          const rec = (payload.new || payload.old) as any
          if (rec && rec.user_id && houseOwners.has(rec.user_id)) {
            fetchMapData()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const mapRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 })

  const [selectedProperty, setSelectedProperty] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'owned' | 'raided' | 'locked'>('all')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const raidWindowActive = false

  const propertyCards = useMemo<PropertyCard[]>(() => {
    if (ownedHouses.length === 0) return []

    const total = ownedHouses.length
    const gridCols = Math.max(3, Math.ceil(Math.sqrt(total * 1.5)))
    const marginTop = 8
    const marginBottom = 8
    const marginLeft = 5
    const marginRight = 5
    const usableWidth = 100 - marginLeft - marginRight
    const usableHeight = 100 - marginTop - marginBottom
    const rows = Math.ceil(total / gridCols)
    const cellWidth = usableWidth / gridCols
    const cellHeight = rows > 0 ? usableHeight / rows : usableHeight

    const sizes: PropertySize[] = ['sm', 'md', 'lg']
    const shapes: Array<'square' | 'wide' | 'corner'> = ['square', 'wide', 'corner']

    return ownedHouses.map((house, index) => {
      const row = Math.floor(index / gridCols)
      const col = index % gridCols
      const jitterTop = ((index * 7) % 7) - 3
      const jitterLeft = ((index * 11) % 7) - 3

      const top = `${marginTop + row * cellHeight + cellHeight / 2 + jitterTop}%`
      const left = `${marginLeft + col * cellWidth + cellWidth / 2 + jitterLeft}%`

      const owner = house.owner_user_id ? houseOwners.get(house.owner_user_id) : null
      const isCurrentUser = house.owner_user_id === profile?.id
      const isOwnerAdmin = owner?.is_admin || owner?.is_superadmin
      const neighborhoodName = house.neighborhood_id ? neighborhoodNames.get(house.neighborhood_id) || 'Troll City' : 'Troll City'

      let status: PropertyStatus = 'owned'
      if (house.is_reposessed) status = 'locked'
      if (house.condition !== null && house.condition <= 0) status = 'raided'

      const kind: PropertyKind =
        isOwnerAdmin && isCurrentUser
          ? 'tower'
          : isOwnerAdmin || house.upgrade_level >= 3
            ? 'mansion'
            : 'house'

      const size = isCurrentUser
        ? 'lg'
        : isOwnerAdmin
          ? 'md'
          : sizes[index % 3]

      const lotShape = shapes[index % 3]
      const rotateStr = `${((index * 13) % 11) - 5}deg`

      const ownerStream = house.owner_user_id ? ownerStreams.get(house.owner_user_id) : undefined
      const ownerSeat = house.owner_user_id ? ownerSeatMap.get(house.owner_user_id) : undefined
      const licenseStatus = house.owner_user_id ? ownerLicenses.get(house.owner_user_id) : 'none'
      const insuranceRec = house.owner_user_id ? ownerInsurances.get(house.owner_user_id) : undefined

      return {
        id: house.id,
        address: `${neighborhoodName}`,
        owner: isCurrentUser
          ? profile?.username || 'You'
          : owner?.username || undefined,
        ownerId: house.owner_user_id,
        isLive: !!ownerStream?.is_live,
        viewerCount: ownerStream?.current_viewers || ownerStream?.viewer_count || 0,
        inSeat: !!ownerSeat,
        seatIndex: ownerSeat?.slot,
        status,
        label: isCurrentUser
          ? 'Your House'
          : isOwnerAdmin
            ? 'Admin Property'
            : status === 'raided'
              ? 'Raided'
              : status === 'locked'
                ? 'Locked'
                : `${owner?.username || 'Owner'}'s House`,
        top,
        left,
        size,
        rotate: rotateStr,
        isAdmin: isOwnerAdmin,
        kind,
        lotShape,
        car: isCurrentUser || (owner?.vehicle_id != null) || index % 3 === 0,
        house,
        ownerUser: owner,
        licenseStatus,
        hasHomeInsurance: !!insuranceRec,
        insuranceExpiry: insuranceRec?.expires_at || null,
      }
    })
  }, [ownedHouses, houseOwners, neighborhoodNames, profile?.id, profile?.username, ownerStreams, ownerSeatMap, ownerLicenses, ownerInsurances])

  useEffect(() => {
    if (!selectedProperty && propertyCards.length > 0) {
      setSelectedProperty(propertyCards[0].id)
    }
  }, [propertyCards, selectedProperty])

  const filteredProperties = useMemo(() => {
    if (selectedFilter === 'all') return propertyCards
    return propertyCards.filter((property) => property.status === selectedFilter)
  }, [propertyCards, selectedFilter])

  const selectedPropertyData =
    propertyCards.find((property) => property.id === selectedProperty) || propertyCards[0]

  const clampZoom = (value: number) => Math.max(0.7, Math.min(value, 2.4))

  const zoomIn = () => setZoom((z) => clampZoom(z + 0.15))
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.15))
  const resetMap = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    dragRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: pan.x,
      baseY: pan.y,
    }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return

    setPan({
      x: dragRef.current.baseX + event.clientX - dragRef.current.startX,
      y: dragRef.current.baseY + event.clientY - dragRef.current.startY,
    })
  }

  const stopDragging = () => {
    dragRef.current.dragging = false
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    const direction = event.deltaY > 0 ? -0.08 : 0.08
    setZoom((z) => clampZoom(z + direction))
  }

  // Attach wheel with passive:false so preventDefault works
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => { el.removeEventListener('wheel', handleWheel) }
  }, [])

  if (loading || mapLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-300" />
          <p className="text-sm font-semibold text-cyan-100">Loading city map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="absolute left-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-180px] top-[180px] h-[520px] w-[520px] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute bottom-[-180px] left-[20%] h-[460px] w-[460px] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <header className="absolute left-4 right-4 top-4 z-50 rounded-3xl border border-cyan-300/15 bg-slate-950/80 px-4 py-3 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge className="border border-cyan-300/30 bg-cyan-400/10 text-cyan-100">
                <MapPin className="mr-1 h-3.5 w-3.5" />
                Troll City — {neighborhoodNames.size} Neighborhoods
              </Badge>
              <Badge className="border border-red-300/30 bg-red-500/10 text-red-100">
                <Coins className="mr-1 h-3.5 w-3.5" />
                Raid Cost: {RAID_COST} TC
              </Badge>
              <Badge className="border border-amber-300/30 bg-amber-400/10 text-amber-100">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                2.5D City Map
              </Badge>
            </div>

            <h1 className="text-xl font-black leading-tight text-white md:text-2xl">
              Troll City — All Neighborhoods
            </h1>
            <p className="text-xs text-slate-400">{ownedHouses.length} properties across {neighborhoodNames.size} neighborhoods • Drag and zoom to explore</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'owned', 'raided', 'locked'] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant="outline"
                onClick={() => setSelectedFilter(filter)}
                className={
                  selectedFilter === filter
                    ? 'border-cyan-300 bg-cyan-400/20 text-cyan-50 shadow-lg shadow-cyan-500/10 hover:bg-cyan-400/30'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main
        ref={mapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing"
      >
        <div
          className="absolute left-1/2 top-1/2 h-[1500px] w-[2300px] origin-center transition-transform duration-75"
          style={{
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-[4rem] border border-cyan-300/10 bg-[#07111f] shadow-inner shadow-black/70">
            <div className="absolute inset-0 rounded-[4rem] bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_80%_75%,rgba(168,85,247,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(3,7,18,0.98))]" />
            <div className="absolute inset-0 opacity-40 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:80px_80px]" />

            {districtZones.map((zone) => (
              <DistrictZone key={zone.label} {...zone} />
            ))}

            <Road className="left-[-8%] top-[47%] h-[96px] w-[116%] rotate-[-8deg]" name="Main Troll Blvd" />
            <Road className="left-[48%] top-[-10%] h-[120%] w-[118px] rotate-[12deg]" vertical name="Utromail Ave" />
            <Road className="left-[4%] top-[32%] h-[80px] w-[96%] rotate-[18deg]" name="Creator Row" />
            <Road className="left-[6%] top-[69%] h-[88px] w-[90%] rotate-[-22deg]" name="Raid Zone Road" />
            <Road className="left-[20%] top-[15%] h-[74px] w-[70%] rotate-[-28deg]" name="Officer Lane" />
            <Road className="left-[67%] top-[0%] h-[120%] w-[96px] rotate-[-7deg]" vertical name="Gold District Dr" />

            <Intersection top="45%" left="49%" />
            <Intersection top="30%" left="68%" />
            <Intersection top="67%" left="64%" />
            <Crosswalk top="43%" left="43%" rotate="-8deg" />
            <Crosswalk top="27%" left="63%" rotate="18deg" />
            <Crosswalk top="65%" left="55%" rotate="-22deg" />

            <MapLabel top="9%" left="8%" text="North Gate" />
            <MapLabel top="50%" left="43%" text="Main Troll Blvd" />
            <MapLabel top="87%" left="62%" text="Gold District" />
            <MapLabel top="22%" left="68%" text="Creator Row" />
            <MapLabel top="71%" left="12%" text="Raid Zone" />
            <MapLabel top="13%" left="24%" text="Admin Heights" />

            {Array.from({ length: 42 }).map((_, index) => (
              <Tree
                key={index}
                top={`${7 + ((index * 19) % 84)}%`}
                left={`${4 + ((index * 29) % 92)}%`}
                size={index % 3 === 0 ? 'lg' : index % 3 === 1 ? 'md' : 'sm'}
              />
            ))}

            <MovingCar top="48%" left="10%" rotate="-8deg" delay="0s" />
            <MovingCar top="33%" left="75%" rotate="18deg" delay="3s" />
            <MovingCar top="70%" left="31%" rotate="-22deg" delay="6s" />

            {filteredProperties.map((property) => (
              <button
                key={property.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedProperty(property.id)
                }}
                className="absolute z-20 text-left transition duration-300 hover:z-30 hover:scale-110 focus:outline-none"
                style={{
                  top: property.top,
                  left: property.left,
                  transform: `translate(-50%, -50%) rotate(${property.rotate})`,
                }}
              >
                <PropertyMarker property={property} selected={selectedProperty === property.id} />
              </button>
            ))}
          </div>
        </div>
      </main>

      <section className="absolute bottom-4 left-4 z-50 w-[min(440px,calc(100vw-2rem))] rounded-3xl border border-cyan-300/15 bg-slate-950/85 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              {selectedPropertyData?.isAdmin ? (
                <Crown className="h-5 w-5 text-amber-300" />
              ) : (
                <Home className="h-5 w-5 text-cyan-200" />
              )}
              <p className="truncate text-lg font-black text-white">{selectedPropertyData.label}</p>
            </div>
            <p className="text-sm text-slate-400">{selectedPropertyData.address}</p>
            {selectedPropertyData.owner && (
              <p className="mt-1 text-xs text-cyan-200">Owner: {selectedPropertyData.owner}</p>
            )}
            {selectedPropertyData.isLive && (
              <p className="mt-1 text-xs text-emerald-300">Live Now • {selectedPropertyData.viewerCount || 0} viewers</p>
            )}
            {selectedPropertyData.inSeat && (
              <p className="mt-1 text-xs text-violet-300">Currently on a live seat{selectedPropertyData.seatIndex != null ? ` — Seat ${selectedPropertyData.seatIndex}` : ''}</p>
            )}
          </div>
          <StatusBadge status={selectedPropertyData.status} label={selectedPropertyData.status} />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-28 shrink-0">
              <PropertyMarker property={{ ...selectedPropertyData, top: '0', left: '0', rotate: '0deg' }} selected />
            </div>
            <div className="min-w-0">
              <p className="font-black text-white">
                {selectedPropertyData.isAdmin ? 'Premium protected property' : 'Neighborhood property'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Status, vehicles, raids, and member activity are tracked through Troll City neighborhood systems.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <InfoPill icon={<Home className="h-4 w-4" />} label="Properties" value={ownedHouses.length} />
          <InfoPill icon={<Car className="h-4 w-4" />} label="Cars" value={vehicles.length} />
          <InfoPill icon={<Shield className="h-4 w-4" />} label="Raids" value={raids.length} />
        </div>

        <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-red-100">Raid Cost</span>
            <Badge className="bg-red-500/20 text-red-100 ring-1 ring-red-300/20">
              {RAID_COST} TC
            </Badge>
          </div>

          <Button
            disabled={!raidWindowActive || selectedPropertyData.status === 'owned'}
            className="mt-3 w-full cursor-not-allowed bg-slate-800 text-slate-400"
          >
            <Lock className="mr-2 h-4 w-4" />
            {!raidWindowActive ? 'Raids Locked' : 'Cannot Raid'}
          </Button>
        </div>
      </section>

      <section className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
        <Button onClick={zoomIn} className="h-11 w-11 rounded-2xl bg-slate-950/90 p-0 text-white ring-1 ring-white/10 hover:bg-slate-800">
          <Plus className="h-5 w-5" />
        </Button>
        <Button onClick={zoomOut} className="h-11 w-11 rounded-2xl bg-slate-950/90 p-0 text-white ring-1 ring-white/10 hover:bg-slate-800">
          <Minus className="h-5 w-5" />
        </Button>
        <Button onClick={resetMap} className="h-11 w-11 rounded-2xl bg-slate-950/90 p-0 text-white ring-1 ring-white/10 hover:bg-slate-800">
          <RotateCcw className="h-5 w-5" />
        </Button>
      </section>

      <section className="absolute right-4 top-[140px] z-50 hidden w-[310px] space-y-3 xl:block">
        <FloatingPanel title="City Legend" icon={<MapPin className="h-4 w-4 text-cyan-300" />}>
          <MapLegend />
        </FloatingPanel>

        <FloatingPanel title="Security" icon={<Shield className="h-4 w-4 text-amber-300" />}>
          <div className={`rounded-2xl border p-3 ${isRaided ? 'border-red-400/30 bg-red-500/10' : 'border-emerald-400/20 bg-emerald-500/10'}`}>
            <p className="font-bold text-white">{isRaided ? 'Property Raided' : 'Property Secure'}</p>
            <p className="text-xs text-slate-400">
              {raids.length > 0 ? `${raids.length} raid records` : 'No active raids detected'}
            </p>
          </div>
        </FloatingPanel>

        <FloatingPanel title="Vehicles" icon={<Car className="h-4 w-4 text-violet-300" />}>
          <p className="text-2xl font-black text-white">{vehicles.length}</p>
          <p className="text-xs text-slate-400">Active vehicles in this neighborhood</p>
        </FloatingPanel>

        <FloatingPanel title="Map Controls" icon={<Zap className="h-4 w-4 text-cyan-300" />}>
          <p className="text-xs leading-5 text-slate-400">
            Click and drag to explore. Use your mouse wheel or the zoom buttons to move through the neighborhood.
          </p>
        </FloatingPanel>
      </section>
    </div>
  )
}

function Road({
  className,
  vertical = false,
  name,
}: {
  className: string
  vertical?: boolean
  name: string
}) {
  return (
    <div className={`absolute overflow-hidden rounded-full bg-slate-900 shadow-2xl shadow-black/60 ring-1 ring-white/10 ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/30" />
      <div
        className={
          vertical
            ? 'absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-[repeating-linear-gradient(to_bottom,rgba(250,204,21,0.9)_0_24px,transparent_24px_48px)]'
            : 'absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-[repeating-linear-gradient(to_right,rgba(250,204,21,0.9)_0_32px,transparent_32px_64px)]'
        }
      />
      <div
        className={
          vertical
            ? 'absolute left-3 top-0 h-full w-px bg-cyan-200/15'
            : 'absolute left-0 top-3 h-px w-full bg-cyan-200/15'
        }
      />
      <div
        className={
          vertical
            ? 'absolute right-3 top-0 h-full w-px bg-cyan-200/15'
            : 'absolute bottom-3 left-0 h-px w-full bg-cyan-200/15'
        }
      />
      <div className="absolute left-1/2 top-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-300 opacity-60 backdrop-blur"
        style={{ transform: `translate(-50%, -50%) rotate(${vertical ? '-90deg' : '0deg'})` }}
      >
        {name}
      </div>
    </div>
  )
}

function Intersection({ top, left }: { top: string; left: string }) {
  return (
    <div
      className="absolute z-10 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10 bg-slate-900 shadow-2xl shadow-cyan-950/40"
      style={{ top, left }}
    >
      <div className="absolute inset-5 rounded-full border border-dashed border-yellow-300/30" />
      <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-yellow-300/35" />
      <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 bg-yellow-300/35" />
    </div>
  )
}

function Crosswalk({ top, left, rotate }: { top: string; left: string; rotate: string }) {
  return (
    <div
      className="absolute z-20 flex h-12 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1"
      style={{ top, left, transform: `translate(-50%, -50%) rotate(${rotate})` }}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-10 w-2 rounded-full bg-white/40" />
      ))}
    </div>
  )
}

function DistrictZone({
  label,
  top,
  left,
  width,
  height,
  color,
}: {
  label: string
  top: string
  left: string
  width: string
  height: string
  color: string
}) {
  const classes: Record<string, string> = {
    cyan: 'border-cyan-300/15 bg-cyan-400/5 shadow-cyan-500/10',
    violet: 'border-violet-300/15 bg-violet-400/5 shadow-violet-500/10',
    red: 'border-red-300/15 bg-red-500/5 shadow-red-500/10',
    gold: 'border-amber-300/15 bg-amber-400/5 shadow-amber-500/10',
  }

  return (
    <div
      className={`absolute rounded-[2rem] border border-dashed shadow-2xl ${classes[color] || classes.cyan}`}
      style={{ top, left, width, height }}
    >
      <div className="absolute left-4 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/70">
        {label}
      </div>
    </div>
  )
}

function PropertyMarker({ property, selected }: { property: PropertyCard; selected: boolean }) {
  const lotSizeClasses: Record<PropertySize, string> = {
    sm: 'h-28 w-32',
    md: 'h-32 w-40',
    lg: 'h-40 w-52',
  }

  const isTower = property.kind === 'tower'
  const isMansion = property.kind === 'mansion'

  return (
    <div className="relative">
      <div
        className={`${lotSizeClasses[property.size]} relative rounded-[1.8rem] border shadow-2xl transition ${
          selected ? 'border-white/60 ring-4 ring-cyan-200/25' : 'border-white/10'
        } ${property.status === 'raided' ? 'animate-pulse' : ''}`}
      >
        <PropertyLot status={property.status} shape={property.lotShape || 'square'} />
        <Driveway />
        <Sidewalk />

        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-[58%]">
          {isTower ? (
            <AdminTower status={property.status} selected={selected} />
          ) : isMansion ? (
            <AdminMansion status={property.status} isAdmin={!!property.isAdmin} selected={selected} />
          ) : (
            <CityHouse2D status={property.status} selected={selected} />
          )}
        </div>

        {property.car && <ParkedCar status={property.status} />}

        {property.status === 'locked' && (
          <div className="absolute right-3 top-3 z-30 rounded-xl border border-slate-200/20 bg-black/60 p-1.5">
            <Lock className="h-4 w-4 text-slate-200" />
          </div>
        )}

        {property.status === 'raided' && (
          <div className="absolute right-3 top-3 z-30 rounded-xl border border-red-200/30 bg-red-500/30 p-1.5">
            <AlertCircle className="h-4 w-4 text-red-100" />
          </div>
        )}

        {property.isAdmin && (
          <div className="absolute left-3 top-3 z-30 rounded-xl border border-amber-200/30 bg-amber-400/20 p-1.5">
            <Crown className="h-4 w-4 text-amber-100" />
          </div>
        )}
        {property.isLive && (
          <div className="absolute left-3 bottom-3 z-30 flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/80 px-2 py-1 text-[10px] font-black text-white">
            <span className="h-2 w-2 rounded-full bg-white/90 shadow" />
            <span>LIVE{property.viewerCount ? ` • ${property.viewerCount}` : ''}</span>
          </div>
        )}

        {property.inSeat && (
          <div className="absolute right-3 bottom-3 z-30 flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-500/80 px-2 py-1 text-[10px] font-black text-white">
            <Sparkles className="h-3 w-3" />
            <span>ON SEAT{property.seatIndex != null ? ` ${property.seatIndex}` : ''}</span>
          </div>
        )}
      </div>

      <div className="absolute left-1/2 top-full mt-3 -translate-x-1/2 rounded-xl border border-white/10 bg-black/75 px-3 py-1 text-center shadow-xl backdrop-blur">
        <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-wide text-white">
          {property.label}
        </p>
      </div>
    </div>
  )
}

function PropertyLot({ status, shape }: { status: PropertyStatus; shape: 'square' | 'wide' | 'corner' }) {
  const classes: Record<PropertyStatus, string> = {
    owned: 'from-cyan-400/20 via-emerald-400/10 to-cyan-950/30 shadow-cyan-500/20',
    available: 'from-emerald-400/20 via-lime-400/10 to-emerald-950/30 shadow-emerald-500/20',
    raided: 'from-red-500/25 via-orange-500/10 to-red-950/40 shadow-red-500/20',
    locked: 'from-slate-400/15 via-slate-500/10 to-slate-950/40 shadow-black/20',
  }

  const shapeClass =
    shape === 'wide'
      ? 'rounded-[2.2rem]'
      : shape === 'corner'
        ? 'rounded-[2.4rem] rounded-br-lg'
        : 'rounded-[1.8rem]'

  return (
    <div className={`absolute inset-0 ${shapeClass} bg-gradient-to-br ${classes[status]} shadow-2xl`}>
      <div className="absolute inset-3 rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent_28%)]" />
      <div className="absolute inset-x-4 bottom-4 h-5 rounded-full bg-black/20 blur-md" />
    </div>
  )
}

function Driveway() {
  return (
    <div className="absolute bottom-0 left-1/2 z-10 h-16 w-14 -translate-x-1/2 rounded-t-2xl bg-slate-800/90 shadow-inner shadow-black/50 ring-1 ring-white/10">
      <div className="mx-auto mt-2 h-10 w-1 rounded-full bg-yellow-200/50" />
    </div>
  )
}

function Sidewalk() {
  return (
    <>
      <div className="absolute bottom-8 left-0 z-10 h-3 w-full bg-slate-400/25" />
      <div className="absolute bottom-8 left-0 z-10 h-px w-full bg-cyan-100/20" />
    </>
  )
}

function CityHouse2D({ status, selected }: { status: PropertyStatus; selected: boolean }) {
  const wallClasses: Record<PropertyStatus, string> = {
    owned: 'from-cyan-950 to-slate-950 border-cyan-300/50 shadow-cyan-400/30',
    available: 'from-emerald-950 to-slate-950 border-emerald-300/40 shadow-emerald-400/20',
    raided: 'from-red-950 to-slate-950 border-red-300/50 shadow-red-400/30',
    locked: 'from-slate-800 to-slate-950 border-slate-300/30 shadow-black/30',
  }

  const roofClasses: Record<PropertyStatus, string> = {
    owned: 'from-cyan-300 to-blue-700',
    available: 'from-emerald-300 to-green-700',
    raided: 'from-red-300 to-orange-800',
    locked: 'from-slate-300 to-slate-700',
  }

  return (
    <div className={`relative h-24 w-24 ${selected ? 'scale-105' : ''} transition`}>
      <div className={`absolute left-1/2 top-0 h-16 w-16 -translate-x-1/2 rotate-45 rounded-xl bg-gradient-to-br ${roofClasses[status]} shadow-xl`} />
      <div className={`absolute bottom-0 left-1/2 h-16 w-20 -translate-x-1/2 rounded-2xl border bg-gradient-to-b ${wallClasses[status]} shadow-2xl`}>
        <Window left="14%" top="22%" status={status} />
        <Window left="62%" top="22%" status={status} />
        <div className="absolute bottom-0 left-1/2 h-8 w-5 -translate-x-1/2 rounded-t-lg bg-amber-300/90 shadow-lg shadow-amber-400/20" />
      </div>
    </div>
  )
}

function AdminMansion({
  status,
  isAdmin,
  selected,
}: {
  status: PropertyStatus
  isAdmin: boolean
  selected: boolean
}) {
  const glow = isAdmin ? 'shadow-amber-300/40 border-amber-200/50' : 'shadow-cyan-400/25 border-cyan-200/35'

  return (
    <div className={`relative h-32 w-36 ${selected ? 'scale-105' : ''} transition`}>
      <div className={`absolute left-1/2 top-1 h-20 w-24 -translate-x-1/2 rotate-45 rounded-2xl bg-gradient-to-br ${isAdmin ? 'from-amber-200 to-yellow-700' : 'from-cyan-200 to-blue-800'} shadow-2xl`} />
      <div className={`absolute bottom-0 left-1/2 h-22 w-32 -translate-x-1/2 rounded-3xl border bg-gradient-to-b from-slate-800 to-slate-950 shadow-2xl ${glow}`}>
        <div className="absolute inset-x-4 top-3 h-5 rounded-full bg-white/5" />
        <Window left="12%" top="28%" status={status} gold={isAdmin} />
        <Window left="42%" top="22%" status={status} gold={isAdmin} />
        <Window left="72%" top="28%" status={status} gold={isAdmin} />
        <div className={`absolute bottom-0 left-1/2 h-10 w-8 -translate-x-1/2 rounded-t-xl ${isAdmin ? 'bg-amber-300/90' : 'bg-cyan-200/90'} shadow-lg`} />
        <div className="absolute -left-3 bottom-0 h-16 w-5 rounded-t-xl border border-white/10 bg-slate-900" />
        <div className="absolute -right-3 bottom-0 h-16 w-5 rounded-t-xl border border-white/10 bg-slate-900" />
      </div>
    </div>
  )
}

function AdminTower({ status, selected }: { status: PropertyStatus; selected: boolean }) {
  return (
    <div className={`relative h-40 w-32 ${selected ? 'scale-105' : ''} transition`}>
      <div className="absolute bottom-0 left-1/2 h-36 w-24 -translate-x-1/2 rounded-t-[2rem] border border-cyan-200/50 bg-gradient-to-b from-cyan-800 via-slate-900 to-slate-950 shadow-2xl shadow-cyan-400/40">
        <div className="absolute -top-8 left-1/2 h-12 w-12 -translate-x-1/2 rotate-45 rounded-xl bg-gradient-to-br from-amber-200 to-yellow-700 shadow-xl shadow-amber-300/40" />
        <Crown className="absolute -top-10 left-1/2 h-7 w-7 -translate-x-1/2 text-amber-200" />
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className={`absolute h-3 w-3 rounded ${status === 'raided' ? 'bg-red-300/80' : 'bg-cyan-200/80'} shadow-lg`}
            style={{
              left: `${22 + (index % 3) * 24}%`,
              top: `${18 + Math.floor(index / 3) * 17}%`,
            }}
          />
        ))}
        <div className="absolute bottom-0 left-1/2 h-12 w-8 -translate-x-1/2 rounded-t-xl bg-amber-300/95 shadow-lg shadow-amber-400/30" />
      </div>
    </div>
  )
}

function Window({
  left,
  top,
  status,
  gold = false,
}: {
  left: string
  top: string
  status: PropertyStatus
  gold?: boolean
}) {
  const color =
    status === 'raided'
      ? 'bg-red-300/80 shadow-red-300/50'
      : gold
        ? 'bg-amber-200/90 shadow-amber-300/50'
        : 'bg-cyan-200/90 shadow-cyan-300/50'

  return (
    <div
      className={`absolute h-4 w-4 rounded-md ${color} shadow-lg`}
      style={{ left, top }}
    />
  )
}

function ParkedCar({ status }: { status: PropertyStatus }) {
  const color =
    status === 'raided'
      ? 'bg-red-500'
      : status === 'owned'
        ? 'bg-cyan-400'
        : status === 'locked'
          ? 'bg-slate-400'
          : 'bg-emerald-400'

  return (
    <div className={`absolute bottom-5 right-5 z-30 h-6 w-12 rounded-xl ${color} shadow-xl shadow-black/40`}>
      <div className="absolute left-2 top-1 h-2 w-3 rounded bg-white/70" />
      <div className="absolute right-2 top-1 h-2 w-3 rounded bg-white/70" />
      <div className="absolute -bottom-1 left-2 h-2 w-2 rounded-full bg-black" />
      <div className="absolute -bottom-1 right-2 h-2 w-2 rounded-full bg-black" />
    </div>
  )
}

function MovingCar({
  top,
  left,
  rotate,
  delay,
}: {
  top: string
  left: string
  rotate: string
  delay: string
}) {
  return (
    <div
      className="absolute z-30 h-7 w-14 rounded-xl bg-violet-400 shadow-xl shadow-violet-500/30"
      style={{
        top,
        left,
        transform: `rotate(${rotate})`,
        animation: `cityCarFloat 9s ease-in-out ${delay} infinite`,
      }}
    >
      <div className="absolute left-2 top-1 h-2 w-3 rounded bg-white/70" />
      <div className="absolute right-2 top-1 h-2 w-3 rounded bg-white/70" />
      <div className="absolute -bottom-1 left-2 h-2 w-2 rounded-full bg-black" />
      <div className="absolute -bottom-1 right-2 h-2 w-2 rounded-full bg-black" />
      <style>{`
        @keyframes cityCarFloat {
          0%, 100% { margin-left: 0px; filter: brightness(1); }
          50% { margin-left: 90px; filter: brightness(1.25); }
        }
      `}</style>
    </div>
  )
}

function StatusBadge({ status, label }: { status: PropertyStatus; label: string }) {
  const classes: Record<PropertyStatus, string> = {
    owned: 'bg-cyan-400/15 text-cyan-100 ring-cyan-300/25',
    available: 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/25',
    raided: 'bg-red-500/15 text-red-100 ring-red-300/25',
    locked: 'bg-slate-400/15 text-slate-100 ring-slate-300/20',
  }

  return <Badge className={`${classes[status]} capitalize ring-1`}>{label}</Badge>
}

function InfoPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-cyan-200">{icon}</div>
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  )
}

function FloatingPanel({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/85 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <p className="font-black text-white">{title}</p>
      </div>
      {children}
    </div>
  )
}

function MapLegend() {
  const items = [
    { label: 'Owned', className: 'bg-cyan-400' },
    { label: 'Raided', className: 'bg-red-500' },
    { label: 'Locked', className: 'bg-slate-400' },
    { label: 'Admin', className: 'bg-amber-300' },
  ]

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${item.className} shadow-lg`} />
            <span className="text-xs font-bold text-slate-200">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Tree({ top, left, size }: { top: string; left: string; size: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
  }

  return (
    <div className="absolute z-10" style={{ top, left }}>
      <div className={`${sizes[size]} rounded-full bg-emerald-400/60 shadow-lg shadow-emerald-900/40`} />
      <div className="mx-auto -mt-1 h-6 w-2 rounded bg-amber-900/80" />
    </div>
  )
}

function MapLabel({ top, left, text }: { top: string; left: string; text: string }) {
  return (
    <div
      className="absolute z-30 rounded-full border border-white/10 bg-black/55 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-100 shadow-xl backdrop-blur"
      style={{ top, left }}
    >
      {text}
    </div>
  )
}