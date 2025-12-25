import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import { Series, CreateSeriesRequest, CreateSeriesResponse, ListSeriesResponse } from '../../shared/api';

export default function SeriesManagement() {
  const [series, setSeries] = useState<Series[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      const response = await fetch('/api/series');
      const result: ListSeriesResponse = await response.json();
      if (result.success) {
        setSeries(result.series || []);
      } else {
        setError(result.error || 'Failed to load series');
      }
    } catch {
      setError('Failed to load series');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Series name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const request: CreateSeriesRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      };

      const response = await fetch('/api/series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result: CreateSeriesResponse = await response.json();

      if (result.success) {
        setSeries(prev => [result.series!, ...prev]);
        setFormData({ name: '', description: '' });
        setDialogOpen(false);
        setSuccess('Series created successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || 'Failed to create series');
      }
    } catch {
      setError('Failed to create series');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="text-white">Loading series...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-20">
        <div className="container-wide max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-black text-gradient-gold-red mb-2">
              Series Management
            </h1>
            <p className="text-gray-400">
              Create and manage your video series
            </p>
          </div>

          <div className="card-glow rounded-lg p-8 border border-white/10 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Your Series</h2>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="neon-btn-gold">
                    <Plus size={20} className="mr-2" />
                    Create Series
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-black border-white/20">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Series</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateSeries} className="space-y-4">
                    <div>
                      <Label htmlFor="name" className="text-white font-semibold mb-2 block">
                        Series Name *
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter series name"
                        className="bg-black/50 border-white/20 text-white"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description" className="text-white font-semibold mb-2 block">
                        Description
                      </Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter series description (optional)"
                        className="bg-black/50 border-white/20 text-white min-h-[100px]"
                      />
                    </div>
                    {error && (
                      <Alert className="border-red-500/20 bg-red-500/10">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertDescription className="text-red-400">
                          {error}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isCreating}
                        className="flex-1 neon-btn-gold"
                      >
                        {isCreating ? 'Creating...' : 'Create Series'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {success && (
              <Alert className="border-green-500/20 bg-green-500/10 mb-6">
                <AlertDescription className="text-green-400">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {series.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Plus size={48} className="mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">No Series Yet</h3>
                  <p>Create your first series to organize your content</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {series.map((s) => (
                  <div key={s.id} className="card-glow rounded-lg p-6 border border-white/10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-lg truncate">
                          {s.name}
                        </h3>
                        {s.description && (
                          <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                          <Edit size={16} />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-400">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Created {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}