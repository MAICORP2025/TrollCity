import { RequestHandler } from 'express';
import {
  submitCreatorApplication,
  getCreatorApplication,
  getAllCreatorApplications,
  approveCreatorApplication,
  denyCreatorApplication,
  getCreatorProfile,
  createCreatorPerk,
  getCreatorPerks,
  updateCreatorPerk,
  deleteCreatorPerk,
  getUserById,
} from '../supabaseClient';
import { getUserIdFromSession } from '../sessions';

const getUserFromRequest = async (req: any): Promise<any | null> => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return null;
  const userId = getUserIdFromSession(sessionId);
  if (!userId) return null;
  return await getUserById(userId);
};

export const handleCreatorApply: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const {
      legal_name,
      creator_name,
      email,
      phone,
      dob,
      location,
      bio,
      category,
      social_links,
    } = req.body;

    if (!legal_name || !creator_name || !email || !dob || !bio) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const files = req.files as Record<string, any>;
    if (!files || !files.id_file_front) {
      return res.status(400).json({
        success: false,
        error: 'ID front image is required',
      });
    }

    const applicationData = {
      legal_name,
      creator_name,
      email,
      phone: phone || null,
      dob,
      location: location || null,
      bio,
      category,
      social_links: social_links ? JSON.parse(social_links) : {},
      id_file_url_front: files.id_file_front[0].filename || files.id_file_front[0].path,
      id_file_url_back: files.id_file_back ? files.id_file_back[0].filename || files.id_file_back[0].path : null,
    };

    const application = await submitCreatorApplication(user.id, applicationData);

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Creator apply error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Application submission failed',
    });
  }
};

export const handleGetCreatorApplication: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const application = await getCreatorApplication(user.id);

    res.json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Get creator application error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load application',
    });
  }
};

export const handleGetAllCreatorApplications: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const applications = await getAllCreatorApplications();

    res.json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error('Get all creator applications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load applications',
    });
  }
};

export const handleApproveCreatorApplication: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { applicationId, creatorName, bio, category } = req.body;

    if (!applicationId || !creatorName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const creator = await approveCreatorApplication(
      applicationId,
      user.id,
      creatorName,
      bio || '',
      category || ''
    );

    res.json({
      success: true,
      creator,
    });
  } catch (error) {
    console.error('Approve creator application error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve application',
    });
  }
};

export const handleDenyCreatorApplication: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { applicationId, notes } = req.body;

    if (!applicationId) {
      return res.status(400).json({
        success: false,
        error: 'Application ID is required',
      });
    }

    const result = await denyCreatorApplication(applicationId, user.id, notes || '');

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Deny creator application error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deny application',
    });
  }
};

export const handleGetCreatorProfile: RequestHandler = async (req, res) => {
  try {
    const { creatorId } = req.params;

    if (!creatorId) {
      return res.status(400).json({
        success: false,
        error: 'Creator ID is required',
      });
    }

    const creator = await getCreatorProfile(creatorId);

    res.json({
      success: true,
      creator,
    });
  } catch (error) {
    console.error('Get creator profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load creator profile',
    });
  }
};

export const handleCreateCreatorPerk: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { creatorId, title, description, coin_cost, perk_type, perk_limit } = req.body;

    if (!creatorId || !title || !coin_cost) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const perk = await createCreatorPerk(creatorId, {
      title,
      description,
      coin_cost,
      perk_type,
      perk_limit,
    });

    res.json({
      success: true,
      perk,
    });
  } catch (error) {
    console.error('Create creator perk error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create perk',
    });
  }
};

export const handleGetCreatorPerks: RequestHandler = async (req, res) => {
  try {
    const { creatorId } = req.params;

    if (!creatorId) {
      return res.status(400).json({
        success: false,
        error: 'Creator ID is required',
      });
    }

    const perks = await getCreatorPerks(creatorId);

    res.json({
      success: true,
      perks,
    });
  } catch (error) {
    console.error('Get creator perks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load perks',
    });
  }
};

export const handleUpdateCreatorPerk: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { perkId } = req.params;
    const updates = req.body;

    if (!perkId) {
      return res.status(400).json({
        success: false,
        error: 'Perk ID is required',
      });
    }

    const perk = await updateCreatorPerk(perkId, updates);

    res.json({
      success: true,
      perk,
    });
  } catch (error) {
    console.error('Update creator perk error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update perk',
    });
  }
};

export const handleDeleteCreatorPerk: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
    }

    const { perkId } = req.params;

    if (!perkId) {
      return res.status(400).json({
        success: false,
        error: 'Perk ID is required',
      });
    }

    await deleteCreatorPerk(perkId);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete creator perk error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete perk',
    });
  }
};
