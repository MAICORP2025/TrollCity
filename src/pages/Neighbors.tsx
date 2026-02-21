import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Slider from '../components/ui/slider';
import { 
  Map as MapIcon, 
  Calendar as CalendarIcon, 
  Users as UsersIcon, 
  Plus as PlusIcon, 
  Briefcase as BriefcaseIcon, 
  Trophy as TrophyIcon, 
  Navigation as NavigationIcon, 
  CheckCircle2 as CheckCircleIcon, 
  XCircle as XCircleIcon 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Event categories
const eventCategories = [
  'Cleanup', 'Volunteer', 'Fitness', 'Social', 'Food', 'Education',
  'Animal Care', 'Safety', 'Other'
];

// Business categories
const businessCategories = [
  'Restaurant', 'Retail', 'Healthcare', 'Education', 'Entertainment',
  'Service', 'Other'
];

// Participant statuses
const participantStatuses = ['joined', 'checked_in', 'completed', 'verified'];

// Main Neighbors page component
const NeighborsPage = () => {
  const [activeTab, setActiveTab] = useState('nearby');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [searchRadius, setSearchRadius] = useState(40);
  const [events, setEvents] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Event creation form state
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    category: '',
    latitude: 0,
    longitude: 0,
    city: '',
    state: '',
    start_time: '',
    end_time: '',
    duration_minutes: 60,
    max_participants: 10,
    reward_coins: 100,
    requirements: '',
    images: [],
    visibility: 'public'
  });
  
  // Business registration form state
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [businessFormData, setBusinessFormData] = useState({
    business_name: '',
    description: '',
    category: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    latitude: 0,
    longitude: 0,
    city: '',
    state: '',
    logo_url: ''
  });

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setUser(data.user);
      }
    };

    getUser();
  }, []);

  // Get user's location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error('Error getting user location:', error);
          // Default to center of USA if geolocation fails
          setUserLocation([39.8283, -98.5795]);
        }
      );
    } else {
      // Default to center of USA if geolocation not available
      setUserLocation([39.8283, -98.5795]);
    }
  }, []);

  // Fetch nearby events
  useEffect(() => {
    const fetchNearbyEvents = async () => {
      if (!userLocation) return;

      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_nearby_neighbors_events', {
          lat: userLocation[0],
          lng: userLocation[1],
          radius: searchRadius
        });

        if (error) {
          console.error('Error fetching nearby events:', error);
        } else {
          setEvents(data || []);
        }
      } catch (error) {
        console.error('Error fetching nearby events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNearbyEvents();
  }, [userLocation, searchRadius]);

  // Fetch nearby businesses
  useEffect(() => {
    const fetchNearbyBusinesses = async () => {
      if (!userLocation) return;

      try {
        const { data, error } = await supabase
          .from('neighbors_businesses')
          .select('*')
          .eq('verified', true);

        if (error) {
          console.error('Error fetching nearby businesses:', error);
        } else {
          // Filter businesses by distance
          const nearbyBusinesses = data.filter(business => {
            const distance = getDistanceFromLatLonInKm(
              userLocation[0],
              userLocation[1],
              business.latitude,
              business.longitude
            );
            return distance <= searchRadius;
          });

          setBusinesses(nearbyBusinesses);
        }
      } catch (error) {
        console.error('Error fetching nearby businesses:', error);
      }
    };

    fetchNearbyBusinesses();
  }, [userLocation, searchRadius]);

  // Fetch participants
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const { data, error } = await supabase
          .from('neighbors_participants')
          .select('*');

        if (error) {
          console.error('Error fetching participants:', error);
        } else {
          setParticipants(data || []);
        }
      } catch (error) {
        console.error('Error fetching participants:', error);
      }
    };

    fetchParticipants();
  }, []);

  // Calculate distance between two coordinates
  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  // Create new event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: eventData, error: eventError } = await supabase
        .from('neighbors_events')
        .insert([
          {
            ...eventFormData,
            created_by_user_id: userData.user?.id,
            start_time: new Date(eventFormData.start_time).toISOString(),
            end_time: new Date(eventFormData.end_time).toISOString()
          }
        ])
        .select()
        .single();

      if (eventError) throw eventError;

      // Reset form and close modal
      setEventFormData({
        title: '',
        description: '',
        category: '',
        latitude: 0,
        longitude: 0,
        city: '',
        state: '',
        start_time: '',
        end_time: '',
        duration_minutes: 60,
        max_participants: 10,
        reward_coins: 100,
        requirements: '',
        images: [],
        visibility: 'public'
      });
      setCreatingEvent(false);

      // Refresh events list
      const { data: updatedEvents } = await supabase.rpc('get_nearby_neighbors_events', {
        lat: userLocation?.[0] || 0,
        lng: userLocation?.[1] || 0,
        radius: searchRadius
      });
      setEvents(updatedEvents || []);
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  // Register new business
  const handleRegisterBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: businessData, error: businessError } = await supabase
        .from('neighbors_businesses')
        .insert([
          {
            ...businessFormData,
            owner_user_id: userData.user?.id
          }
        ])
        .select()
        .single();

      if (businessError) throw businessError;

      // Reset form and close modal
      setBusinessFormData({
        business_name: '',
        description: '',
        category: '',
        phone: '',
        email: '',
        website: '',
        address: '',
        latitude: 0,
        longitude: 0,
        city: '',
        state: '',
        logo_url: ''
      });
      setCreatingBusiness(false);

      // Refresh businesses list
      const { data: allBusinesses } = await supabase
        .from('neighbors_businesses')
        .select('*')
        .eq('verified', true);

      const nearbyBusinesses = allBusinesses.filter(business => {
        const distance = getDistanceFromLatLonInKm(
          userLocation?.[0] || 0,
          userLocation?.[1] || 0,
          business.latitude,
          business.longitude
        );
        return distance <= searchRadius;
      });

      setBusinesses(nearbyBusinesses);
    } catch (error) {
      console.error('Error registering business:', error);
    }
  };

  // Join event
  const handleJoinEvent = async (eventId: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data, error } = await supabase
        .from('neighbors_participants')
        .insert([
          {
            event_id: eventId,
            user_id: userData.user?.id,
            status: 'joined'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Refresh participants list
      const { data: updatedParticipants } = await supabase
        .from('neighbors_participants')
        .select('*');
      setParticipants(updatedParticipants || []);
    } catch (error) {
      console.error('Error joining event:', error);
    }
  };

  // Leave event
  const handleLeaveEvent = async (eventId: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { error } = await supabase
        .from('neighbors_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userData.user?.id);

      if (error) throw error;

      // Refresh participants list
      const { data: updatedParticipants } = await supabase
        .from('neighbors_participants')
        .select('*');
      setParticipants(updatedParticipants || []);
    } catch (error) {
      console.error('Error leaving event:', error);
    }
  };

  // Check in to event
  const handleCheckIn = async (participantId: string) => {
    try {
      const { data, error } = await supabase
        .from('neighbors_participants')
        .update({ status: 'checked_in' })
        .eq('id', participantId)
        .select()
        .single();

      if (error) throw error;

      // Refresh participants list
      const { data: updatedParticipants } = await supabase
        .from('neighbors_participants')
        .select('*');
      setParticipants(updatedParticipants || []);
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  // Mark event as complete
  const handleMarkComplete = async (participantId: string) => {
    try {
      const { data, error } = await supabase
        .from('neighbors_participants')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', participantId)
        .select()
        .single();

      if (error) throw error;

      // Refresh participants list
      const { data: updatedParticipants } = await supabase
        .from('neighbors_participants')
        .select('*');
      setParticipants(updatedParticipants || []);
    } catch (error) {
      console.error('Error marking as complete:', error);
    }
  };

  // Verify participant completion
  const handleVerifyParticipation = async (participantId: string) => {
    try {
      const { data, error } = await supabase.rpc('verify_event_participation', {
        participant_id: participantId
      });

      if (error) throw error;

      // Refresh participants list
      const { data: updatedParticipants } = await supabase
        .from('neighbors_participants')
        .select('*');
      setParticipants(updatedParticipants || []);
    } catch (error) {
      console.error('Error verifying participation:', error);
    }
  };

  // Get participant status for an event
  const getParticipantStatus = (eventId: string, userId: string) => {
    const participant = participants.find(p => 
      p.event_id === eventId && p.user_id === userId
    );
    return participant?.status;
  };

  // Get number of participants for an event
  const getParticipantCount = (eventId: string) => {
    return participants.filter(p => p.event_id === eventId).length;
  };

  // Render event marker on map
  const renderEventMarker = (event: any) => {
    const participantCount = getParticipantCount(event.id);
    
    return (
      <Marker position={[event.latitude, event.longitude]}>
        <Popup>
          <div className="p-3">
            <h3 className="font-bold text-lg mb-2">{event.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{event.description}</p>
            <div className="space-y-1 text-sm">
              <div>
                <Badge variant="secondary" className="mr-1">
                  {event.category}
                </Badge>
                {event.business_id && (
                  <Badge variant="outline" className="mr-1">
                    Business Event
                  </Badge>
                )}
              </div>
              <div>
                <UsersIcon className="w-4 h-4 inline mr-1" />
                {participantCount} participants
              </div>
              <div>
                <TrophyIcon className="w-4 h-4 inline mr-1" />
                {event.reward_coins} coins
              </div>
              <div>
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                {new Date(event.start_time).toLocaleString()}
              </div>
              <div>
                <NavigationIcon className="w-4 h-4 inline mr-1" />
                {event.city}, {event.state}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Button 
                className="w-full"
                onClick={() => handleJoinEvent(event.id)}
                disabled={getParticipantStatus(event.id, user?.id)}
              >
                Join Event
              </Button>
              <Button variant="outline" className="w-full">
                Get Directions
              </Button>
            </div>
          </div>
        </Popup>
      </Marker>
    );
  };

  // Render business marker on map
  const renderBusinessMarker = (business: any) => {
    return (
      <Marker position={[business.latitude, business.longitude]}>
        <Popup>
          <div className="p-3">
            <h3 className="font-bold text-lg mb-2">{business.business_name}</h3>
            <p className="text-sm text-gray-600 mb-2">{business.description}</p>
            <div className="space-y-1 text-sm">
              <div>
                <Badge variant="secondary" className="mr-1">
                  {business.category}
                </Badge>
                {business.verified && (
                  <Badge variant="outline" className="mr-1">
                    Verified
                  </Badge>
                )}
              </div>
              <div>
                <BriefcaseIcon className="w-4 h-4 inline mr-1" />
                {business.address}
              </div>
              <div>
                <NavigationIcon className="w-4 h-4 inline mr-1" />
                {business.city}, {business.state}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Button variant="outline" className="w-full">
                View Profile
              </Button>
              <Button variant="outline" className="w-full">
                Get Directions
              </Button>
            </div>
          </div>
        </Popup>
      </Marker>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Neighbors</h1>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setCreatingEvent(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Event
            </Button>
            <Button 
              onClick={() => setCreatingBusiness(true)}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <BriefcaseIcon className="w-4 h-4 mr-2" />
              Register Business
            </Button>
          </div>
        </div>

        <Tabs defaultValue="nearby" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-6 mb-6">
            <TabsTrigger value="nearby">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Nearby Events
            </TabsTrigger>
            <TabsTrigger value="map">
              <MapIcon className="w-4 h-4 mr-2" />
              Map View
            </TabsTrigger>
            <TabsTrigger value="my-events">
              <UsersIcon className="w-4 h-4 mr-2" />
              My Events
            </TabsTrigger>
            <TabsTrigger value="create-event">
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Event
            </TabsTrigger>
            <TabsTrigger value="businesses">
              <BriefcaseIcon className="w-4 h-4 mr-2" />
              Businesses
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <TrophyIcon className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nearby" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Nearby Events</h2>
                <div className="flex items-center space-x-2">
                  <Label className="text-sm text-gray-600">Radius:</Label>
                  <div className="flex items-center space-x-2 w-48">
                    <Slider
                      value={searchRadius}
                      onValueChange={setSearchRadius}
                      min={5}
                      max={100}
                      step={5}
                      className="w-32"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {searchRadius} km
                    </span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No events nearby</h3>
                  <p className="text-gray-500">Try increasing your search radius or check back later.</p>
                  <Button 
                    onClick={() => setCreatingEvent(true)}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create an Event
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {events.map(event => (
                    <Card key={event.id} className="overflow-hidden">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg">{event.title}</h3>
                            <p className="text-sm text-gray-600">{event.description}</p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {event.category}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                          <div>
                            <CalendarIcon className="w-4 h-4 inline mr-1" />
                            {new Date(event.start_time).toLocaleString()}
                          </div>
                          <div>
                            <NavigationIcon className="w-4 h-4 inline mr-1" />
                            {event.city}, {event.state}
                          </div>
                          <div>
                            <UsersIcon className="w-4 h-4 inline mr-1" />
                            {getParticipantCount(event.id)} participants
                          </div>
                          <div>
                            <TrophyIcon className="w-4 h-4 inline mr-1" />
                            {event.reward_coins} coins
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button 
                            className="flex-1"
                            onClick={() => handleJoinEvent(event.id)}
                            disabled={getParticipantStatus(event.id, user?.id)}
                          >
                            Join Event
                          </Button>
                          <Button variant="outline" size="sm">
                            Details
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Map View</h2>
                <div className="flex items-center space-x-2">
                  <Label className="text-sm text-gray-600">Radius:</Label>
                  <div className="flex items-center space-x-2 w-48">
                    <Slider
                      value={searchRadius}
                      onValueChange={setSearchRadius}
                      min={5}
                      max={100}
                      step={5}
                      className="w-32"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {searchRadius} km
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-[500px] rounded-lg overflow-hidden">
                {userLocation && (
                  <MapContainer
                    center={userLocation}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="© OpenStreetMap contributors"
                    />
                    
                    {/* User location marker */}
                    <Marker position={userLocation}>
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-lg mb-2">Your Location</h3>
                          <p className="text-sm text-gray-600">You are here</p>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Event markers */}
                    {events.map(event => renderEventMarker(event))}

                    {/* Business markers */}
                    {businesses.map(business => renderBusinessMarker(business))}
                  </MapContainer>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="my-events" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">My Events</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* TODO: Implement my events list */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">No events yet</h3>
                    <Button 
                      onClick={() => setCreatingEvent(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Create Event
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="create-event" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Event</h2>
              
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-title">Event Title</Label>
                    <Input
                      id="event-title"
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({...eventFormData, title: e.target.value})}
                      placeholder="Enter event title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-category">Category</Label>
                    <Select
                      value={eventFormData.category}
                      onValueChange={(value) => setEventFormData({...eventFormData, category: value})}
                    >
                      <SelectTrigger id="event-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({...eventFormData, description: e.target.value})}
                    placeholder="Enter event description"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-city">City</Label>
                    <Input
                      id="event-city"
                      value={eventFormData.city}
                      onChange={(e) => setEventFormData({...eventFormData, city: e.target.value})}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-state">State</Label>
                    <Input
                      id="event-state"
                      value={eventFormData.state}
                      onChange={(e) => setEventFormData({...eventFormData, state: e.target.value})}
                      placeholder="Enter state"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-start-time">Start Time</Label>
                    <Input
                      id="event-start-time"
                      type="datetime-local"
                      value={eventFormData.start_time}
                      onChange={(e) => setEventFormData({...eventFormData, start_time: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-end-time">End Time</Label>
                    <Input
                      id="event-end-time"
                      type="datetime-local"
                      value={eventFormData.end_time}
                      onChange={(e) => setEventFormData({...eventFormData, end_time: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="event-max-participants">Max Participants</Label>
                    <Input
                      id="event-max-participants"
                      type="number"
                      value={eventFormData.max_participants}
                      onChange={(e) => setEventFormData({...eventFormData, max_participants: parseInt(e.target.value)})}
                      min="1"
                      max="100"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="event-reward-coins">Reward Coins</Label>
                    <Input
                      id="event-reward-coins"
                      type="number"
                      value={eventFormData.reward_coins}
                      onChange={(e) => setEventFormData({...eventFormData, reward_coins: parseInt(e.target.value)})}
                      min="0"
                      max="10000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="event-requirements">Requirements (Optional)</Label>
                  <Textarea
                    id="event-requirements"
                    value={eventFormData.requirements}
                    onChange={(e) => setEventFormData({...eventFormData, requirements: e.target.value})}
                    placeholder="Enter any specific requirements or instructions"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="event-visibility">Visibility</Label>
                  <Select
                    value={eventFormData.visibility}
                    onValueChange={(value) => setEventFormData({...eventFormData, visibility: value})}
                  >
                    <SelectTrigger id="event-visibility">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="neighborhood">Neighborhood Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create Event
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setEventFormData({
                      title: '',
                      description: '',
                      category: '',
                      latitude: 0,
                      longitude: 0,
                      city: '',
                      state: '',
                      start_time: '',
                      end_time: '',
                      duration_minutes: 60,
                      max_participants: 10,
                      reward_coins: 100,
                      requirements: '',
                      images: [],
                      visibility: 'public'
                    })}
                  >
                    Clear Form
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="businesses" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Businesses</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {businesses.length === 0 ? (
                  <Card className="p-4 col-span-full">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg">No businesses nearby</h3>
                      <Button 
                        onClick={() => setCreatingBusiness(true)}
                        variant="outline"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                      >
                        Register Business
                      </Button>
                    </div>
                  </Card>
                ) : (
                  businesses.map(business => (
                    <Card key={business.id} className="overflow-hidden">
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg">{business.business_name}</h3>
                            <p className="text-sm text-gray-600">{business.description}</p>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {business.category}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 mb-4">
                          <div>
                            <NavigationIcon className="w-4 h-4 inline mr-1" />
                            {business.address}
                          </div>
                          <div>
                            <NavigationIcon className="w-4 h-4 inline mr-1" />
                            {business.city}, {business.state}
                          </div>
                          {business.phone && (
                            <div>
                              <UsersIcon className="w-4 h-4 inline mr-1" />
                              {business.phone}
                            </div>
                          )}
                          {business.email && (
                            <div>
                              <UsersIcon className="w-4 h-4 inline mr-1" />
                              {business.email}
                            </div>
                          )}
                        </div>

                        <div className="flex space-x-2">
                          <Button variant="outline" className="flex-1">
                            View Profile
                          </Button>
                          <Button variant="outline" size="sm">
                            Get Directions
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Leaderboard (Coming Soon)</h2>
              
              <div className="text-center py-12">
                <TrophyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Leaderboard Coming Soon</h3>
                <p className="text-gray-500">Check back later to see the top participants in your area.</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Event Modal */}
      {creatingEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Event</h2>
                <button
                  onClick={() => setCreatingEvent(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-title">Event Title</Label>
                    <Input
                      id="modal-event-title"
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({...eventFormData, title: e.target.value})}
                      placeholder="Enter event title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-category">Category</Label>
                    <Select
                      value={eventFormData.category}
                      onValueChange={(value) => setEventFormData({...eventFormData, category: value})}
                    >
                      <SelectTrigger id="modal-event-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="modal-event-description">Description</Label>
                  <Textarea
                    id="modal-event-description"
                    value={eventFormData.description}
                    onChange={(e) => setEventFormData({...eventFormData, description: e.target.value})}
                    placeholder="Enter event description"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-city">City</Label>
                    <Input
                      id="modal-event-city"
                      value={eventFormData.city}
                      onChange={(e) => setEventFormData({...eventFormData, city: e.target.value})}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-state">State</Label>
                    <Input
                      id="modal-event-state"
                      value={eventFormData.state}
                      onChange={(e) => setEventFormData({...eventFormData, state: e.target.value})}
                      placeholder="Enter state"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-start-time">Start Time</Label>
                    <Input
                      id="modal-event-start-time"
                      type="datetime-local"
                      value={eventFormData.start_time}
                      onChange={(e) => setEventFormData({...eventFormData, start_time: e.target.value})}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-end-time">End Time</Label>
                    <Input
                      id="modal-event-end-time"
                      type="datetime-local"
                      value={eventFormData.end_time}
                      onChange={(e) => setEventFormData({...eventFormData, end_time: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modal-event-max-participants">Max Participants</Label>
                    <Input
                      id="modal-event-max-participants"
                      type="number"
                      value={eventFormData.max_participants}
                      onChange={(e) => setEventFormData({...eventFormData, max_participants: parseInt(e.target.value)})}
                      min="1"
                      max="100"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="modal-event-reward-coins">Reward Coins</Label>
                    <Input
                      id="modal-event-reward-coins"
                      type="number"
                      value={eventFormData.reward_coins}
                      onChange={(e) => setEventFormData({...eventFormData, reward_coins: parseInt(e.target.value)})}
                      min="0"
                      max="10000"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="modal-event-requirements">Requirements (Optional)</Label>
                  <Textarea
                    id="modal-event-requirements"
                    value={eventFormData.requirements}
                    onChange={(e) => setEventFormData({...eventFormData, requirements: e.target.value})}
                    placeholder="Enter any specific requirements or instructions"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="modal-event-visibility">Visibility</Label>
                  <Select
                    value={eventFormData.visibility}
                    onValueChange={(value) => setEventFormData({...eventFormData, visibility: value})}
                  >
                    <SelectTrigger id="modal-event-visibility">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="neighborhood">Neighborhood Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Create Event
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEventFormData({
                        title: '',
                        description: '',
                        category: '',
                        latitude: 0,
                        longitude: 0,
                        city: '',
                        state: '',
                        start_time: '',
                        end_time: '',
                        duration_minutes: 60,
                        max_participants: 10,
                        reward_coins: 100,
                        requirements: '',
                        images: [],
                        visibility: 'public'
                      });
                      setCreatingEvent(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Register Business Modal */}
      {creatingBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Register Business</h2>
                <button
                  onClick={() => setCreatingBusiness(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleRegisterBusiness} className="space-y-4">
                <div>
                  <Label htmlFor="business-name">Business Name</Label>
                  <Input
                    id="business-name"
                    value={businessFormData.business_name}
                    onChange={(e) => setBusinessFormData({...businessFormData, business_name: e.target.value})}
                    placeholder="Enter business name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="business-category">Category</Label>
                  <Select
                    value={businessFormData.category}
                    onValueChange={(value) => setBusinessFormData({...businessFormData, category: value})}
                  >
                    <SelectTrigger id="business-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="business-description">Description</Label>
                  <Textarea
                    id="business-description"
                    value={businessFormData.description}
                    onChange={(e) => setBusinessFormData({...businessFormData, description: e.target.value})}
                    placeholder="Enter business description"
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="business-phone">Phone</Label>
                    <Input
                      id="business-phone"
                      value={businessFormData.phone}
                      onChange={(e) => setBusinessFormData({...businessFormData, phone: e.target.value})}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="business-email">Email</Label>
                    <Input
                      id="business-email"
                      type="email"
                      value={businessFormData.email}
                      onChange={(e) => setBusinessFormData({...businessFormData, email: e.target.value})}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="business-website">Website</Label>
                  <Input
                    id="business-website"
                    type="url"
                    value={businessFormData.website}
                    onChange={(e) => setBusinessFormData({...businessFormData, website: e.target.value})}
                    placeholder="Enter website URL"
                  />
                </div>

                <div>
                  <Label htmlFor="business-address">Address</Label>
                  <Input
                    id="business-address"
                    value={businessFormData.address}
                    onChange={(e) => setBusinessFormData({...businessFormData, address: e.target.value})}
                    placeholder="Enter full address"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="business-city">City</Label>
                    <Input
                      id="business-city"
                      value={businessFormData.city}
                      onChange={(e) => setBusinessFormData({...businessFormData, city: e.target.value})}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="business-state">State</Label>
                    <Input
                      id="business-state"
                      value={businessFormData.state}
                      onChange={(e) => setBusinessFormData({...businessFormData, state: e.target.value})}
                      placeholder="Enter state"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="business-logo">Logo URL</Label>
                  <Input
                    id="business-logo"
                    type="url"
                    value={businessFormData.logo_url}
                    onChange={(e) => setBusinessFormData({...businessFormData, logo_url: e.target.value})}
                    placeholder="Enter logo URL"
                  />
                </div>

                <div className="flex space-x-4">
                  <Button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Register Business
                  </Button>
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBusinessFormData({
                        business_name: '',
                        description: '',
                        category: '',
                        phone: '',
                        email: '',
                        website: '',
                        address: '',
                        latitude: 0,
                        longitude: 0,
                        city: '',
                        state: '',
                        logo_url: ''
                      });
                      setCreatingBusiness(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NeighborsPage;
