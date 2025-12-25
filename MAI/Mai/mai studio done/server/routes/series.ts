import { RequestHandler } from 'express';
import { getUserIdFromSession } from '../sessions';
import { supabase } from '../supabaseClient';
import { CreateSeriesRequest, CreateSeriesResponse, ListSeriesResponse } from '../../shared/api';

const getUserFromRequest = async (req: any): Promise<any | null> => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return null;
  const userId = getUserIdFromSession(sessionId);
  if (!userId) return null;

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  return user;
};

export const handleCreateSeries: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { name, description }: CreateSeriesRequest = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Series name is required',
      });
    }

    const { data: series, error } = await supabase
      .from('series')
      .insert({
        creator_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Create series error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create series',
      });
    }

    const response: CreateSeriesResponse = {
      success: true,
      series,
    };

    res.json(response);
  } catch (error) {
    console.error('Create series error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Create series failed',
    });
  }
};

export const handleListSeries: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { data: series, error } = await supabase
      .from('series')
      .select('*')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('List series error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to list series',
      });
    }

    const response: ListSeriesResponse = {
      success: true,
      series,
    };

    res.json(response);
  } catch (error) {
    console.error('List series error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'List series failed',
    });
  }
};