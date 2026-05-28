import React, { useState, useEffect } from 'react';
import { useSecurityEvents } from '../../hooks/useSecurityEvents';
import { logSecurityEvent } from '../../lib/securityLogger';
import { Tabs, TabsList, TabsContent, Tab } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead, TableCaption } from '@/components/ui/table';
import { AlertTriangle, Shield, Zap, DollarSign, User, ClipboardList, List, Megaphone, Settings } from 'lucide-react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import { Toaster, toast } from 'sonner';

const SecurityCommandCenter: React.FC = () => {
  const router = useRouter();
  const { events, riskScores, loading, error, filters, setFilters, refresh, resolveEvent, markFalsePositive, ignoreEvent } = useSecurityEvents();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  useEffect(() => {
    // Initial load
    refresh();
  }, [refresh]);

  if (loading) {
    return <div className="flex items-center justify-center py-8">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 bg-red-50 text-red-500">Error: {error.message}</div>;
  }

  const handleResolve = (eventId: uuid, status: 'resolved' | 'ignored' | 'false_positive') => {
    resolveEvent(eventId, status, 'Resolved via Security Command Center');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Security Command Center</h1>
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          <Button variant="outline" onClick={refresh}>
            Refresh
          </Button>
          <Button onClick={() => {
            // Example: log a test event
            logSecurityEvent({
              event_type: 'test_event',
              title: 'Test Event',
              description: 'This is a test event from the Security Command Center',
              risk_score: 10,
              severity: 'low'
            });
          }}>
            Log Test Event
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-[200px_1fr]">
          <Tab value="overview">Overview</Tab>
          <Tab value="threat-feed">Threat Feed</Tab>
          <Tab value="risk-users">Risk Users</Tab>
          <Tab value="rate-limits">Rate Limits</Tab>
          <Tab value="cashout-risk">Cashout Risk</Tab>
          <Tab value="admin-audit">Admin Audit</Tab>
          <Tab value="incident-reports">Incident Reports</Tab>
          <Tab value="settings">Settings</Tab>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Overview Cards */}
            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">Open Threats</span>
                <h2 className="text-xl font-bold text-white">{events.filter(e => e.status === 'open').length}</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Events requiring immediate attention
              </CardContent>
            </Card>

            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">Critical Threats</span>
                <h2 className="text-xl font-bold text-white">{events.filter(e => e.severity === 'critical').length}</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Highest severity threats
              </CardContent>
            </Card>

            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">High Risk Users</span>
                <h2 className="text-xl font-bold text-white">{riskScores.filter(r => r.risk_level === 'high' || r.risk_level === 'critical').length}</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Users with elevated risk scores
              </CardContent>
            </Card>

            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">Failed Login Spikes</span>
                <h2 className="text-xl font-bold text-white">{events.filter(e => e.event_type === 'failed_login' && e.created_at > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Failed login attempts in last 24h
              </CardContent>
            </Card>

            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">Cashout Risk Flags</span>
                <h2 className="text-xl font-bold text-white">{events.filter(e => e.event_type.includes('cashout') && e.severity === 'high').length}</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Suspicious cashout activities
              </CardContent>
            </Card>

            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">Admin Actions Today</span>
                <h2 className="text-xl font-bold text-white">0</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Security-related admin actions
              </CardContent>
            </Card>

            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">Broadcast Abuse Events</span>
                <h2 className="text-xl font-bold text-white">{events.filter(e => e.event_type.includes('broadcast') && e.severity === 'high').length}</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Suspicious broadcast activities
              </CardContent>
            </Card>

            <Card className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20">
              <CardHeader className="flex flex-col space-y-2">
                <span className="text-xs font-medium text-cyan-400">RLS/API Security Errors</span>
                <h2 className="text-xl font-bold text-white">{events.filter(e => e.source === 'backend' && (e.metadata?.error_code === '401' || e.metadata?.error_code === '403' || e.metadata?.error_code === '42501' || e.metadata?.error_code === '23514' || e.metadata?.error_code === 'PGRST301')).length}</h2>
              </CardHeader>
              <CardContent className="text-sm text-cyan-300">
                Authentication and authorization errors
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="threat-feed">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold">Threat Feed</h2>
              <div className="flex items-center space-x-3 mt-2 sm:mt-0">
                <input
                  type="text"
                  placeholder="Search events..."
                  className="input input-sm w-full max-w-xs"
                />
                <Button variant="outline" size="sm">
                  Filter
                </Button>
              </div>
            </div>

            {events.length > 0 ? (
              <Table className="table-sm">
                <TableCaption className="text-left text-sm font-medium text-white mb-2">
                  Security Events
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Severity</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-40">Title</TableHead>
                    <TableHead className="w-16">User</TableHead>
                    <TableHead className="w-16">Route</TableHead>
                    <TableHead className="w-12">Score</TableHead>
                    <TableHead className="w-16">Source</TableHead>
                    <TableHead className="w-16">Time</TableHead>
                    <TableHead className="w-12">Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <Badge variant={getSeverityVariant(event.severity)}>{event.severity}</Badge>
                      </TableCell>
                      <TableCell>{event.event_type}</TableCell>
                      <TableCell className="max-w-40 truncate" title={event.title}>
                        {event.title}
                      </TableCell>
                      <TableCell>
                        {event.user_id ? (
                          <Button variant="link" size="xs" onClick={() => {
                            // Navigate to user profile
                            router.push(`/profile/${event.user_id}`);
                          }}>
                            {event.user_id}
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="truncate" title={event.route || '-'}>
                        {event.route || '-'}
                      </TableCell>
                      <TableCell>{event.risk_score}</TableCell>
                      <TableCell>{event.source}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(event.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(event.status)}>{event.status}</Badge>
                      </TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="xs" onClick={() => handleResolve(event.id, 'investigating')}>
                          Investigate
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => handleResolve(event.id, 'resolved')}>
                          Resolve
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => handleResolve(event.id, 'ignored')}>
                          Ignore
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => handleResolve(event.id, 'false_positive')}>
                          False Positive
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => {
                          setSelectedEvent(event);
                        }}>
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8">No security events found.</p>
            )}
          </div>
        </TabsContent>

        {/* We'll create the other tabs similarly, but for brevity, we'll outline them */}
        <TabsContent value="risk-users">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Risk Users</h2>
            <div className="overflow-x-auto">
              <Table className="table-sm">
                <TableCaption className="text-left text-sm font-medium text-white mb-2">
                  User Risk Scores
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead className="w-20">Risk Score</TableHead>
                    <TableHead className="w-20">Risk Level</TableHead>
                    <TableHead className="w-20">Failed Logins</TableHead>
                    <TableHead className="w-20">Suspicious Actions</TableHead>
                    <TableHead className="w-20">Last Event</TableHead>
                    <TableHead className="w-20">Last IP</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskScores.map((score) => (
                    <TableRow key={score.id}>
                      <TableCell>
                        <Button variant="link" size="xs" onClick={() => {
                          router.push(`/profile/${score.user_id}`);
                        }}>
                          {score.user_id}
                        </Button>
                      </TableCell>
                      <TableCell>{score.risk_score}</TableCell>
                      <TableCell>
                        <Badge variant={getRiskLevelVariant(score.risk_level)}>{score.risk_level}</Badge>
                      </TableCell>
                      <TableCell>{score.failed_login_count}</TableCell>
                      <TableCell>{score.suspicious_action_count}</TableCell>
                      <TableCell className="text-xs">
                        {score.last_event_at ? new Date(score.last_event_at).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>{score.last_ip_address || '-'}</TableCell>
                      <TableCell className="flex space-x-2">
                        <Button variant="ghost" size="xs" onClick={() => {
                          // Open user profile
                          router.push(`/profile/${score.user_id}`);
                        }}>
                          Profile
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => {
                          // Add admin note (placeholder)
                          toast.info('Add admin note functionality coming soon');
                        }}>
                          Note
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => {
                          // Reset risk score (placeholder)
                          toast.warning('Risk score reset functionality coming soon');
                        }}>
                          Reset
                        </Button>
                        <Button variant="ghost" size="xs" onClick={() => {
                          // Create incident report (placeholder)
                          toast.info('Create incident report functionality coming soon');
                        }}>
                          Report
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rate-limits">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Rate Limits</h2>
            <p className="text-sm text-muted-foreground">
              Note: Cloudflare should handle edge blocking while app-level rate limits protect Supabase actions.
            </p>
            {/* We would fetch rate limits from security_rate_limits table */}
            <div className="text-center py-8">
              <p>Rate limit data would be displayed here.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cashout-risk">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Cashout Risk</h2>
            <div className="flex items-center space-x-3 mt-2 sm:mt-0">
              <Button variant="default" onClick={() => {
                router.push('/admin/payouts');
              }}>
                Go to Payout Dashboard
              </Button>
            </div>
            {/* We would filter events by cashout-related types */}
            <div className="text-center py-8">
              <p>Cashout-related security events would be displayed here.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="admin-audit">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Admin Audit Log</h2>
            {/* We would fetch from security_admin_audit_log table */}
            <div className="text-center py-8">
              <p>Admin audit log would be displayed here.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="incident-reports">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Incident Reports</h2>
            {/* We would fetch from security_incident_reports table */}
            <div class="flex items-center space-x-3 mt-2 sm:mt-0">
              <Button variant="default" onClick={() => {
                // Open modal to create incident report
                toast.info('Create incident report modal coming soon');
              }}>
                New Incident Report
              </Button>
            </div>
            <div className="text-center py-8">
              <p>Incident reports would be displayed here.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Settings</h2>
            <div className="space-y-6">
              <div className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20 rounded-lg p-6">
                <h3 className="font-bold mb-4">Recommended External Tools</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-8 w-8 text-cyan-400">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="ml-4">
                      <h4 className="font-medium">Cloudflare WAF + Turnstile</h4>
                      <p className="text-sm text-muted-foreground">
                        Edge-level protection against bots and automated threats.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-8 w-8 text-cyan-400">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="ml-4">
                      <h4 className="font-medium">Supabase RLS and Audit Tables</h4>
                      <p className="text-sm text-muted-foreground">
                        Row-level security and comprehensive audit logging.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-8 w-8 text-cyan-400">
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <div className="ml-4">
                      <h4 className="font-medium">Sentry/Better Stack</h4>
                      <p className="text-sm text-muted-foreground">
                        Application monitoring and error tracking.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-8 w-8 text-cyan-400">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div className="ml-4">
                      <h4 className="font-medium">GitHub Security Tools</h4>
                      <p className="text-sm text-muted-foreground">
                        CodeQL, Dependabot, and Snyk for vulnerability scanning.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20 rounded-lg p-6">
                <h3 className="font-bold mb-4">Environment Variables</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium mb-1">VITE_TURNSTILE_SITE_KEY</p>
                      <p className="text-sm text-muted-foreground">
                        Can be exposed in frontend for Turnstile widget.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">CLOUDFLARE_API_TOKEN</p>
                      <p className="text-sm text-muted-foreground">
                        Must be backend only - never expose in frontend.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium mb-1">SENTRY_DSN</p>
                      <p className="text-sm text-muted-foreground">
                        Can be frontend if using Sentry client-side monitoring.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#0A0814/50] backdrop-blur border border-cyan-500/20 rounded-lg p-6">
                <h3 className="font-bold mb-4">Coming Soon</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-8 w-8 text-cyan-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="ml-4">
                      <h4 className="font-medium">Cloudflare Integration</h4>
                      <p className="text-sm text-muted-foreground">
                        Direct integration with Cloudflare API for automated threat response.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal for event details */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center ${selectedEvent ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/50 backdrop-blur"></div>
        <div className="bg-[#0A0814] border border-cyan-500/20 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold">Event Details</h2>
            <Button variant="ghost" size="xs" onClick={() => setSelectedEvent(null)}>
              <AlertTriangle className="h-4 w-4" /> Close
            </Button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p className="text-white">{selectedEvent?.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Event Type</p>
                <p className="text-white">{selectedEvent?.event_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Severity</p>
                <Badge variant={getSeverityVariant(selectedEvent?.severity)}>{selectedEvent?.severity}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={getStatusVariant(selectedEvent?.status)}>{selectedEvent?.status}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Risk Score</p>
                <p className="text-white">{selectedEvent?.risk_score}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">User ID</p>
                <p className="text-white">{selectedEvent?.user_id || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Route</p>
                <p className="text-white">{selectedEvent?.route || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Source</p>
                <p className="text-white">{selectedEvent?.source}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                <p className="text-white">{new Date(selectedEvent?.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                <p className="text-white">{selectedEvent?.ip_address || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">User Agent</p>
                <p className="text-white break-all">{selectedEvent?.user_agent || '-'}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Title</p>
              <p className="text-white">{selectedEvent?.title}</p>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
              <p className="text-white whitespace-pre-wrap">{selectedEvent?.description}</p>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-muted-foreground mb-2">Metadata</p>
              <pre className="bg-[#121212] p-3 rounded text-xs overflow-auto whitespace-pre-wrap">
{selectedEvent?.metadata ? JSON.stringify(selectedEvent?.metadata, null, 2) : '{}'}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
};

// Helper functions for badge variants
function getSeverityVariant(severity: string) {
  switch (severity) {
    case 'low': return 'secondary';
    case 'medium': return 'warning';
    case 'high': return 'destructive';
    case 'critical': return 'destructive';
    default: return 'secondary';
  }
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'open': return 'secondary';
    case 'investigating': return 'warning';
    case 'resolved': return 'success';
    case 'ignored': return 'ghost';
    case 'false_positive': return 'ghost';
    default: return 'secondary';
  }
}

function getRiskLevelVariant(riskLevel: string) {
  switch (riskLevel) {
    case 'low': return 'secondary';
    case 'medium': return 'warning';
    case 'high': return 'destructive';
    case 'critical': return 'destructive';
    default: return 'secondary';
  }
}

export default SecurityCommandCenter;