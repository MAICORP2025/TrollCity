import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const { incidentId } = await req.json();

    if (!incidentId) {
      return new Response(
        JSON.stringify({ error: 'Incident ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Get incident details
    const { data: incident, error: incidentError } = await supabaseClient
      .from('safety_incidents')
      .select(`
        *,
        user:auth.users!user_id(id, email, raw_user_meta_data),
        keyword:safety_keywords!detected_keyword_id(keyword, category, severity_level)
      `)
      .eq('id', incidentId)
      .single();

    if (incidentError || !incident) {
      return new Response(
        JSON.stringify({ error: 'Incident not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Only notify police for severity 5 incidents
    if (incident.severity_level < 5) {
      return new Response(
        JSON.stringify({ message: 'Police notification not required for this severity level' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Get emergency contacts (police)
    const { data: emergencyContacts } = await supabaseClient
      .from('emergency_contacts')
      .select('*')
      .eq('contact_type', 'police')
      .eq('is_active', true);

    if (!emergencyContacts || emergencyContacts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No emergency contacts configured' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    // Prepare notification data
    const notificationData = {
      incident_id: incident.id,
      user_email: incident.user?.email,
      keyword: incident.keyword?.keyword,
      category: incident.keyword?.category,
      severity_level: incident.severity_level,
      context_text: incident.context_text,
      location: {
        latitude: incident.location_latitude,
        longitude: incident.location_longitude,
        accuracy: incident.location_accuracy
      },
      ip_address: incident.ip_address,
      created_at: incident.created_at,
      video_clip_url: incident.video_clip_url
    };

    // Send notifications to all emergency contacts
    const notifications = [];
    
    for (const contact of emergencyContacts) {
      try {
        let messageContent = `🚨 EMERGENCY SAFETY ALERT 🚨\n\n`;
        messageContent += `Platform: TrollCity Live Streaming\n`;
        messageContent += `Incident ID: ${notificationData.incident_id}\n`;
        messageContent += `User: ${notificationData.user_email}\n`;
        messageContent += `Detected Keyword: "${notificationData.keyword}"\n`;
        messageContent += `Category: ${notificationData.category}\n`;
        messageContent += `Severity: Level ${notificationData.severity_level}/5\n`;
        messageContent += `Context: "${notificationData.context_text}"\n`;
        
        if (notificationData.location.latitude && notificationData.location.longitude) {
          messageContent += `Location: ${notificationData.location.latitude}, ${notificationData.location.longitude}\n`;
          messageContent += `Accuracy: ±${notificationData.location.accuracy} meters\n`;
        }
        
        if (notificationData.ip_address) {
          messageContent += `IP Address: ${notificationData.ip_address}\n`;
        }
        
        if (notificationData.video_clip_url) {
          messageContent += `Video Evidence: ${notificationData.video_clip_url}\n`;
        }
        
        messageContent += `Incident Time: ${new Date(notificationData.created_at).toLocaleString()}\n\n`;
        messageContent += `This is an automated alert from TrollCity safety monitoring system. Immediate intervention may be required.`;

        // Create notification record
        const { data: notification, error: notificationError } = await supabaseClient
          .from('safety_notifications')
          .insert({
            incident_id: incidentId,
            notification_type: 'police',
            notification_method: contact.api_endpoint ? 'api' : 'email',
            recipient_contact: contact.email || contact.phone_number,
            message_content: messageContent,
            is_sent: true,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        if (notificationError) throw notificationError;

        // If contact has API endpoint, attempt to send via API
        if (contact.api_endpoint) {
          try {
            const apiResponse = await fetch(contact.api_endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('EMERGENCY_API_KEY') || ''}`
              },
              body: JSON.stringify({
                type: 'safety_incident',
                priority: 'emergency',
                data: notificationData,
                message: messageContent
              })
            });

            const apiResult = await apiResponse.json();
            
            // Update notification with API response
            await supabaseClient
              .from('safety_notifications')
              .update({
                delivery_status: apiResponse.ok ? 'delivered' : 'failed',
                error_message: apiResponse.ok ? null : apiResult.message || 'API delivery failed'
              })
              .eq('id', notification.id);

            notifications.push({
              contact: contact.name,
              method: 'api',
              status: apiResponse.ok ? 'success' : 'failed',
              error: apiResponse.ok ? null : apiResult.message
            });

          } catch (apiError) {
            console.error('API notification failed:', apiError);
            
            await supabaseClient
              .from('safety_notifications')
              .update({
                delivery_status: 'failed',
                error_message: apiError.message
              })
              .eq('id', notification.id);

            notifications.push({
              contact: contact.name,
              method: 'api',
              status: 'failed',
              error: apiError.message
            });
          }
        } else {
          // For non-API contacts, mark as sent (would be sent via email/SMS service)
          notifications.push({
            contact: contact.name,
            method: 'manual',
            status: 'sent',
            error: null
          });
        }

      } catch (contactError) {
        console.error(`Error notifying ${contact.name}:`, contactError);
        notifications.push({
          contact: contact.name,
          method: 'error',
          status: 'failed',
          error: contactError.message
        });
      }
    }

    // Update incident to mark police notification as sent
    await supabaseClient
      .from('safety_incidents')
      .update({ 
        police_notified: true,
        notification_sent: true 
      })
      .eq('id', incidentId);

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notifications.length,
        notification_results: notifications
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in notifyPolice function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});