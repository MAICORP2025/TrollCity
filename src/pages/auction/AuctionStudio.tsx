import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Gavel,
  ImagePlus,
  Layers,
  Loader2,
  Package,
  Play,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

interface AuctionShow {
  id: string
  title: string
  description: string | null
  category: string | null
  thumbnail_url: string | null
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for: string | null
  live_started_at: string | null
  livekit_room_name: string | null
  created_at: string
  lot_count?: number
}

interface AuctionLot {
  id: string
  auction_show_id: string
  title: string
  description: string | null
  image_url: string | null
  starting_bid: number
  reserve_price: number | null
  bid_increment: number
  buy_now_price: number | null
  quantity: number
  condition: string
  status: 'draft' | 'queued' | 'active' | 'sold' | 'passed' | 'removed'
  queue_position: number
  created_at: string
}

const CATEGORIES = [
  'Collectibles',
  'Art',
  'Fashion',
  'Electronics',
  'Home & Garden',
  'Sports',
  'Toys & Games',
  'Vehicles',
  'Jewelry',
  'Books',
  'Other',
]

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Used', 'For Parts']

const panel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const card =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
const danger =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/20'

export default function AuctionStudio() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [auctioneerId, setAuctioneerId] = useState<string | null>(null)
  const [shows, setShows] = useState<AuctionShow[]>([])
  const [selectedShow, setSelectedShow] = useState<AuctionShow | null>(null)
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [loading, setLoading] = useState(true)
  const [lotsLoading, setLotsLoading] = useState(false)

  const [showCreator, setShowCreator] = useState(false)
  const [lotCreator, setLotCreator] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [query, setQuery] = useState('')

  const [showForm, setShowForm] = useState({
    title: '',
    description: '',
    category: 'Collectibles',
    thumbnail_url: '',
    scheduled_for: '',
  })

  const [lotForm, setLotForm] = useState({
    title: '',
    description: '',
    image_url: '',
    starting_bid: 100,
    reserve_price: 0,
    bid_increment: 500,
    buy_now_price: 0,
    quantity: 1,
    condition: 'Good',
  })

  const activeLot = useMemo(() => lots.find((lot) => lot.status === 'active') || null, [lots])
  const queuedLots = useMemo(
    () => lots.filter((lot) => lot.status === 'queued').sort((a, b) => a.queue_position - b.queue_position),
    [lots]
  )
  const nextLot = queuedLots[0] || null

  const filteredShows = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return shows
    return shows.filter((show) => {
      return (
        show.title?.toLowerCase().includes(value) ||
        show.category?.toLowerCase().includes(value) ||
        show.status?.toLowerCase().includes(value)
      )
    })
  }, [shows, query])

  const fetchMyShows = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)

    try {
      const { data: auctioneer } = await supabase
        .from('auctioneer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!auctioneer?.id) {
        toast.error('You must be an approved auctioneer to use the studio')
        navigate('/auctions')
        return
      }

      setAuctioneerId(auctioneer.id)

      const { data, error } = await supabase
        .from('auction_shows')
        .select('*')
        .eq('auctioneer_id', auctioneer.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const showsWithCounts = await Promise.all(
        (data || []).map(async (show) => {
          const { count } = await supabase
            .from('auction_lots')
            .select('*', { count: 'exact', head: true })
            .eq('auction_show_id', show.id)

          return { ...show, lot_count: count || 0 }
        })
      )

      setShows(showsWithCounts)

      if (!selectedShow && showsWithCounts.length > 0) {
        setSelectedShow(showsWithCounts[0])
      }
    } catch (error) {
      console.error('Error fetching shows:', error)
      toast.error('Failed to load auction studio')
    } finally {
      setLoading(false)
    }
  }, [user?.id, navigate, selectedShow])

  const fetchLots = useCallback(async (showId: string) => {
    setLotsLoading(true)

    try {
      const { data, error } = await supabase
        .from('auction_lots')
        .select('*')
        .eq('auction_show_id', showId)
        .neq('status', 'removed')
        .order('queue_position', { ascending: true })

      if (error) throw error
      setLots(data || [])
    } catch (error) {
      console.error('Error loading auction lots:', error)
      toast.error('Failed to load auction items')
    } finally {
      setLotsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMyShows()
  }, [fetchMyShows])

  useEffect(() => {
    if (selectedShow?.id) void fetchLots(selectedShow.id)
  }, [selectedShow?.id, fetchLots])

  const createShow = async () => {
    if (!showForm.title.trim()) {
      toast.error('Show title is required')
      return
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_auction_show', {
        p_title: showForm.title,
        p_description: showForm.description || null,
        p_category: showForm.category || null,
        p_thumbnail_url: showForm.thumbnail_url || null,
        p_scheduled_for: showForm.scheduled_for ? new Date(showForm.scheduled_for).toISOString() : null,
      })

      if (rpcError) throw rpcError

      const result = rpcData as any
      if (result && result.success === false) {
        toast.error(result.error || 'Failed to create show')
        return
      }

      toast.success('Auction show created')
      setShowCreator(false)
      setShowForm({
        title: '',
        description: '',
        category: 'Collectibles',
        thumbnail_url: '',
        scheduled_for: '',
      })

      await fetchMyShows()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create show')
    }
  }

  const deleteShow = async (showId: string) => {
    if (!window.confirm('Delete this auction show? Draft shows only.')) return

    try {
      const { error } = await supabase.from('auction_shows').delete().eq('id', showId)
      if (error) throw error

      toast.success('Show deleted')
      if (selectedShow?.id === showId) setSelectedShow(null)
      await fetchMyShows()
    } catch {
      toast.error('Failed to delete show')
    }
  }

  const uploadLotImage = async (file: File) => {
    if (!user?.id) return

    setUploadingImage(true)

    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { error } = await supabase.storage.from('auction-items').upload(path, file, {
        upsert: false,
        contentType: file.type,
      })

      if (error) throw error

      const { data } = supabase.storage.from('auction-items').getPublicUrl(path)

      setLotForm((prev) => ({ ...prev, image_url: data.publicUrl }))
      toast.success('Item image uploaded')
    } catch (error: any) {
      toast.error(error.message || 'Image upload failed')
    } finally {
      setUploadingImage(false)
    }
  }

  const createLot = async () => {
    if (!selectedShow) return toast.error('Select a show first')
    if (!lotForm.title.trim()) return toast.error('Item title is required')
    if (Number(lotForm.starting_bid) < 100) return toast.error('Starting bid must be at least 100 coins')

    try {
      const maxPosition = lots.reduce((max, lot) => Math.max(max, Number(lot.queue_position || 0)), 0)

      const payload = {
        auction_show_id: selectedShow.id,
        title: lotForm.title,
        description: lotForm.description || null,
        image_url: lotForm.image_url || null,
        starting_bid: Number(lotForm.starting_bid),
        reserve_price: Number(lotForm.reserve_price) > 0 ? Number(lotForm.reserve_price) : null,
        bid_increment: Number(lotForm.bid_increment || 500),
        buy_now_price: Number(lotForm.buy_now_price) > 0 ? Number(lotForm.buy_now_price) : null,
        quantity: Number(lotForm.quantity || 1),
        condition: lotForm.condition,
        status: 'queued',
        queue_position: maxPosition + 1,
      }

      const { error } = await supabase.from('auction_lots').insert(payload)

      if (error) throw error

      toast.success('Item added to auction queue')
      setLotCreator(false)
      setLotForm({
        title: '',
        description: '',
        image_url: '',
        starting_bid: 100,
        reserve_price: 0,
        bid_increment: 500,
        buy_now_price: 0,
        quantity: 1,
        condition: 'Good',
      })

      await fetchLots(selectedShow.id)
      await fetchMyShows()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add auction item')
    }
  }

  const updateLotStatus = async (lotId: string, status: AuctionLot['status']) => {
    if (!selectedShow) return

    try {
      const { error } = await supabase.from('auction_lots').update({ status }).eq('id', lotId)
      if (error) throw error

      await fetchLots(selectedShow.id)
      toast.success(`Lot marked ${status}`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to update lot')
    }
  }

  const sendLotToStage = async (lotId: string) => {
    if (!selectedShow) return

    try {
      if (activeLot) {
        await supabase.from('auction_lots').update({ status: 'passed' }).eq('id', activeLot.id)
      }

      const { error } = await supabase.from('auction_lots').update({ status: 'active' }).eq('id', lotId)
      if (error) throw error

      await fetchLots(selectedShow.id)
      toast.success('Lot is now showing on stage')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send lot to stage')
    }
  }

  const reorderLot = async (lot: AuctionLot, direction: 'up' | 'down') => {
    if (!selectedShow) return

    const sorted = [...queuedLots]
    const index = sorted.findIndex((item) => item.id === lot.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1

    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return

    const other = sorted[swapIndex]

    try {
      await Promise.all([
        supabase.from('auction_lots').update({ queue_position: other.queue_position }).eq('id', lot.id),
        supabase.from('auction_lots').update({ queue_position: lot.queue_position }).eq('id', other.id),
      ])

      await fetchLots(selectedShow.id)
    } catch {
      toast.error('Failed to reorder queue')
    }
  }

  const goLive = async (show: AuctionShow) => {
    if ((show.lot_count || lots.length) <= 0) {
      toast.error('Add at least one item before going live')
      return
    }

    try {
      const { error } = await supabase
        .from('auction_shows')
        .update({
          status: 'live',
          live_started_at: new Date().toISOString(),
          livekit_room_name: show.livekit_room_name || `auction-${show.id}`,
        })
        .eq('id', show.id)

      if (error) throw error

      toast.success('Auction show is live')
      navigate(`/auctions/studio/${show.id}/live`)
    } catch (error: any) {
      toast.error(error.message || 'Failed to go live')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'border-slate-400/30 bg-slate-500/10 text-slate-200',
      scheduled: 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100',
      live: 'border-red-300/30 bg-red-500/10 text-red-100',
      ended: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
      cancelled: 'border-red-300/30 bg-red-900/20 text-red-200',
    }

    return styles[status] || styles.draft
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050714] px-4 pb-10 pt-24 text-white md:px-6">
      <BackgroundFX />

      <main className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className={cn(panel, 'p-5 md:p-6')}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                <Gavel className="h-8 w-8 text-cyan-200" />
              </div>

              <div>
                <h1 className="bg-gradient-to-r from-cyan-200 via-blue-300 to-cyan-100 bg-clip-text text-4xl font-black tracking-tight text-transparent">
                  Auctioneer Studio
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Create shows, upload auction items, queue lots, and control what appears on stage.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedShow && (
                <button onClick={() => setLotCreator(true)} className={secondary}>
                  <Package className="h-4 w-4" />
                  Add Item
                </button>
              )}

              <button onClick={() => setShowCreator(true)} className={primary}>
                <Plus className="h-4 w-4" />
                New Show
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Shows" value={shows.length} />
          <Stat label="Lots" value={lots.length} />
          <Stat label="Queued" value={queuedLots.length} />
          <Stat label="On Stage" value={activeLot ? 'Yes' : 'No'} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[390px_1fr]">
          <aside className={cn(panel, 'h-[740px] overflow-hidden p-4')}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">My Shows</h2>
                <p className="text-xs text-slate-500">Select a show to manage queue</p>
              </div>
              <button onClick={() => void fetchMyShows()} className={secondary}>
                Refresh
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search shows..."
                className={cn(input, 'pl-10')}
              />
            </div>

            <div className="h-[620px] overflow-y-auto pr-1">
              {loading ? (
                <Loading label="Loading shows..." />
              ) : filteredShows.length === 0 ? (
                <Empty title="No auction shows yet" button={<button onClick={() => setShowCreator(true)} className={primary}>Create Show</button>} />
              ) : (
                <div className="space-y-3">
                  {filteredShows.map((show) => (
                    <button
                      key={show.id}
                      onClick={() => setSelectedShow(show)}
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left transition',
                        selectedShow?.id === show.id
                          ? 'border-cyan-300/45 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.14)]'
                          : 'border-white/10 bg-slate-950/50 hover:border-cyan-300/25'
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                          {show.thumbnail_url ? (
                            <img src={show.thumbnail_url} alt={show.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Gavel className="h-7 w-7 text-slate-600" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-black text-white">{show.title}</h3>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-black uppercase', getStatusBadge(show.status))}>
                              {show.status}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                              {show.lot_count || 0} lots
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{show.category || 'Uncategorized'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className={cn(panel, 'min-h-[740px] p-5')}>
            {!selectedShow ? (
              <Empty title="Select a show to manage auction items" />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 border-b border-cyan-300/15 pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{selectedShow.title}</h2>
                      <span className={cn('rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em]', getStatusBadge(selectedShow.status))}>
                        {selectedShow.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{selectedShow.description || 'No description yet.'}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => navigate(`/auctions/${selectedShow.id}`)} className={secondary}>
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>

                    <button onClick={() => setLotCreator(true)} className={secondary}>
                      <Plus className="h-4 w-4" />
                      Add Item
                    </button>

                    {(selectedShow.status === 'draft' || selectedShow.status === 'scheduled') && (
                      <button onClick={() => goLive(selectedShow)} className={primary}>
                        <Play className="h-4 w-4" />
                        Go Live
                      </button>
                    )}

                    {selectedShow.status === 'draft' && (
                      <button onClick={() => deleteShow(selectedShow.id)} className={danger}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className={cn(card, 'p-4')}>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-black">
                        <Layers className="h-5 w-5 text-cyan-300" />
                        Auction Queue
                      </h3>
                      <span className="text-xs font-bold text-slate-500">{queuedLots.length} queued</span>
                    </div>

                    {lotsLoading ? (
                      <Loading label="Loading lots..." />
                    ) : lots.length === 0 ? (
                      <Empty title="No items uploaded yet" button={<button onClick={() => setLotCreator(true)} className={primary}>Upload First Item</button>} />
                    ) : (
                      <div className="space-y-3">
                        {lots.map((lot) => (
                          <LotRow
                            key={lot.id}
                            lot={lot}
                            isActive={activeLot?.id === lot.id}
                            onStage={() => sendLotToStage(lot.id)}
                            onUp={() => reorderLot(lot, 'up')}
                            onDown={() => reorderLot(lot, 'down')}
                            onSold={() => updateLotStatus(lot.id, 'sold')}
                            onPass={() => updateLotStatus(lot.id, 'passed')}
                            onRemove={() => updateLotStatus(lot.id, 'removed')}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <aside className="space-y-4">
                    <div className={cn(card, 'p-4')}>
                      <h3 className="mb-3 text-lg font-black">On Stage</h3>
                      {activeLot ? (
                        <StageLot lot={activeLot} />
                      ) : (
                        <p className="text-sm text-slate-500">No item is currently showing.</p>
                      )}
                    </div>

                    <div className={cn(card, 'p-4')}>
                      <h3 className="mb-3 text-lg font-black">Next Item</h3>
                      {nextLot ? (
                        <>
                          <StageLot lot={nextLot} />
                          <button onClick={() => sendLotToStage(nextLot.id)} className={cn(primary, 'mt-4 w-full')}>
                            Show Next Lot
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">No queued item waiting.</p>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            )}
          </section>
        </section>
      </main>

      {showCreator && (
        <Modal title="Create Auction Show" onClose={() => setShowCreator(false)}>
          <Field label="Show Title">
            <input className={input} value={showForm.title} onChange={(e) => setShowForm({ ...showForm, title: e.target.value })} placeholder="Saturday Night Collectibles" />
          </Field>

          <Field label="Category">
            <select className={input} value={showForm.category} onChange={(e) => setShowForm({ ...showForm, category: e.target.value })}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat} className="bg-slate-950">{cat}</option>)}
            </select>
          </Field>

          <Field label="Description">
            <textarea className={cn(input, 'h-24 resize-none')} value={showForm.description} onChange={(e) => setShowForm({ ...showForm, description: e.target.value })} />
          </Field>

          <Field label="Thumbnail URL">
            <input className={input} value={showForm.thumbnail_url} onChange={(e) => setShowForm({ ...showForm, thumbnail_url: e.target.value })} placeholder="https://..." />
          </Field>

          <Field label="Schedule">
            <input type="datetime-local" className={input} value={showForm.scheduled_for} onChange={(e) => setShowForm({ ...showForm, scheduled_for: e.target.value })} />
          </Field>

          <button onClick={createShow} className={cn(primary, 'w-full')}>
            <Save className="h-4 w-4" />
            Create Show
          </button>
        </Modal>
      )}

      {lotCreator && (
        <Modal title="Upload Auction Item" onClose={() => setLotCreator(false)}>
          <Field label="Item Image">
            <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/60 p-4">
              {lotForm.image_url ? (
                <img src={lotForm.image_url} alt="Lot preview" className="mb-3 h-40 w-full rounded-xl object-cover" />
              ) : (
                <div className="mb-3 flex h-40 items-center justify-center rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/5">
                  <ImagePlus className="h-10 w-10 text-cyan-300/50" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadLotImage(file)
                }}
                className="hidden"
                id="auction-item-upload"
              />
              <label htmlFor="auction-item-upload" className={cn(secondary, 'w-full cursor-pointer')}>
                <Upload className="h-4 w-4" />
                {uploadingImage ? 'Uploading...' : 'Upload Image'}
              </label>
            </div>
          </Field>

          <Field label="Item Title">
            <input className={input} value={lotForm.title} onChange={(e) => setLotForm({ ...lotForm, title: e.target.value })} placeholder="Vintage watch, signed jersey, rare card..." />
          </Field>

          <Field label="Description">
            <textarea className={cn(input, 'h-24 resize-none')} value={lotForm.description} onChange={(e) => setLotForm({ ...lotForm, description: e.target.value })} />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Starting Bid">
              <input type="number" className={input} value={lotForm.starting_bid} onChange={(e) => setLotForm({ ...lotForm, starting_bid: Number(e.target.value) })} />
            </Field>

            <Field label="Bid Increment">
              <input type="number" className={input} value={lotForm.bid_increment} onChange={(e) => setLotForm({ ...lotForm, bid_increment: Number(e.target.value) })} />
            </Field>

            <Field label="Reserve Price">
              <input type="number" className={input} value={lotForm.reserve_price} onChange={(e) => setLotForm({ ...lotForm, reserve_price: Number(e.target.value) })} />
            </Field>

            <Field label="Buy Now Price">
              <input type="number" className={input} value={lotForm.buy_now_price} onChange={(e) => setLotForm({ ...lotForm, buy_now_price: Number(e.target.value) })} />
            </Field>

            <Field label="Quantity">
              <input type="number" className={input} value={lotForm.quantity} onChange={(e) => setLotForm({ ...lotForm, quantity: Number(e.target.value) })} />
            </Field>

            <Field label="Condition">
              <select className={input} value={lotForm.condition} onChange={(e) => setLotForm({ ...lotForm, condition: e.target.value })}>
                {CONDITIONS.map((condition) => <option key={condition} value={condition} className="bg-slate-950">{condition}</option>)}
              </select>
            </Field>
          </div>

          <button onClick={createLot} className={cn(primary, 'w-full')}>
            <Package className="h-4 w-4" />
            Add Item to Queue
          </button>
        </Modal>
      )}
    </div>
  )
}

function BackgroundFX() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
    </>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cn(card, 'p-5 text-center')}>
      <p className="text-3xl font-black text-cyan-100">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  )
}

function LotRow({ lot, isActive, onStage, onUp, onDown, onSold, onPass, onRemove }: any) {
  return (
    <article className={cn('rounded-2xl border p-3', isActive ? 'border-red-300/35 bg-red-500/10' : 'border-white/10 bg-white/5')}>
      <div className="flex gap-3">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
          {lot.image_url ? <img src={lot.image_url} className="h-full w-full object-cover" alt={lot.title} /> : <Package className="m-auto mt-6 h-8 w-8 text-slate-600" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-black">{lot.title}</h4>
            <span className="rounded-full border border-white/10 bg-slate-950/70 px-2 py-0.5 text-[10px] font-black uppercase text-slate-300">{lot.status}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{lot.description || 'No description'}</p>
          <p className="mt-2 text-sm font-black text-cyan-200">Start: {Number(lot.starting_bid).toLocaleString()} coins</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <button onClick={onStage} className={secondary}>Show</button>
        <button onClick={onUp} className={secondary}>Up</button>
        <button onClick={onDown} className={secondary}>Down</button>
        <button onClick={onSold} className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-100">Sold</button>
        <button onClick={onPass} className={secondary}>Pass</button>
        <button onClick={onRemove} className={danger}>Remove</button>
      </div>
    </article>
  )
}

function StageLot({ lot }: { lot: AuctionLot }) {
  return (
    <div>
      <div className="mb-3 h-40 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
        {lot.image_url ? <img src={lot.image_url} className="h-full w-full object-cover" alt={lot.title} /> : null}
      </div>
      <h4 className="font-black text-white">{lot.title}</h4>
      <p className="mt-1 text-sm text-slate-500">{lot.condition}</p>
      <p className="mt-2 text-lg font-black text-cyan-200">{Number(lot.starting_bid).toLocaleString()} coins</p>
    </div>
  )
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-cyan-300" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function Empty({ title, button }: { title: string; button?: React.ReactNode }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center text-center">
      <div>
        <Gavel className="mx-auto mb-4 h-12 w-12 text-slate-600" />
        <p className="font-black text-white">{title}</p>
        {button && <div className="mt-4">{button}</div>}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-black text-cyan-100">{label}</span>
      {children}
    </label>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className={cn(panel, 'max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6')}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className={danger}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}