import React from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const tcCard = 'border border-white/10 bg-white/[0.03]'

function PopupCard({ title, description, badges }: any) {
  return (
    <div className="min-w-[180px]">
      <h4 className="font-bold text-sm text-white">{title}</h4>
      {description && <p className="text-xs text-slate-300 mt-1">{description}</p>}
      {badges && badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {badges.map((b: string, i: number) => (
            <Badge key={i} className="bg-cyan-400/10 text-cyan-100 text-[10px]">{b}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NeighborMap({ events, businesses, mapCenter }: any) {
  return (
    <MapContainer center={mapCenter} zoom={6} className="h-full w-full">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {events.map((event: any) => (
        <Marker key={`event-${event.id}`} position={[event.latitude || mapCenter[0], event.longitude || mapCenter[1]]}>
          <Popup>
            <PopupCard
              title={event.title}
              description={event.description}
              badges={[event.category, `${event.reward_coins || 0} coins`]}
            />
          </Popup>
        </Marker>
      ))}

      {businesses.map((business: any) => (
        <Marker key={`business-${business.id}`} position={[business.latitude || mapCenter[0], business.longitude || mapCenter[1]]}>
          <Popup>
            <PopupCard
              title={business.business_name}
              description={business.description}
              badges={[business.category, business.verified ? 'Verified' : 'Pending']}
            />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
