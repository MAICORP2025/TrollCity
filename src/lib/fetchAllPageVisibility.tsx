// ============================================================
// PAGE VISIBILITY / UNDER CONSTRUCTION SERVICE
// ============================================================
// Manages the page_visibility table that controls which pages
// are marked as "Under Construction" and inaccessible to
// non-admin users.
// ============================================================

import { supabase } from '@/lib/supabase';

export interface PageVisibilityEntry {
  id: string;
  route_path: string;
  page_name: string;
  is_under_construction: boolean;
  uc_message: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all page visibility entries
 */
export async function fetchAllPageVisibility(): Promise<PageVisibilityEntry[]> {
  const { data, error } = await supabase
    .from('page_visibility')
    .select('*')
    .order('page_name', { ascending: true });

  if (error) {
    console.error('[PageVisibility] Error fetching:', error);
    throw error;
  }

  return (data || []) as PageVisibilityEntry[];
}

/**
 * Fetch only pages that are under construction
 */
export async function fetchUnderConstructionPages(): Promise<PageVisibilityEntry[]> {
  const { data, error } = await supabase
    .from('page_visibility')
    .select('*')
    .eq('is_under_construction', true)
    .order('page_name', { ascending: true });

  if (error) {
    console.error('[PageVisibility] Error fetching UC pages:', error);
    throw error;
  }

  return (data || []) as PageVisibilityEntry[];
}

/**
 * Check if a specific route is under construction
 */
export async function isRouteUnderConstruction(routePath: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('page_visibility')
    .select('is_under_construction')
    .eq('route_path', routePath)
    .maybeSingle();

  if (error) {
    console.error('[PageVisibility] Error checking route:', error);
    return false;
  }

  return data?.is_under_construction ?? false;
}

/**
 * Toggle the under-construction status of a page
 */
export async function togglePageUnderConstruction(
  id: string,
  currentStatus: boolean
): Promise<void> {
  const { error } = await supabase
    .from('page_visibility')
    .update({ is_under_construction: !currentStatus })
    .eq('id', id);

  if (error) {
    console.error('[PageVisibility] Error toggling:', error);
    throw error;
  }
}

/**
 * Set the under-construction status of a page
 */
export async function setPageUnderConstruction(
  id: string,
  isUnderConstruction: boolean
): Promise<void> {
  const { error } = await supabase
    .from('page_visibility')
    .update({ is_under_construction: isUnderConstruction })
    .eq('id', id);

  if (error) {
    console.error('[PageVisibility] Error setting UC status:', error);
    throw error;
  }
}

/**
 * Update the UC message for a page
 */
export async function updateUcMessage(
  id: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from('page_visibility')
    .update({ uc_message: message })
    .eq('id', id);

  if (error) {
    console.error('[PageVisibility] Error updating message:', error);
    throw error;
  }
}

/**
 * Add a new page to the visibility table
 */
export async function addPageVisibility(
  routePath: string,
  pageName: string
): Promise<void> {
  const { error } = await supabase
    .from('page_visibility')
    .insert({
      route_path: routePath,
      page_name: pageName,
      is_under_construction: false,
    });

  if (error) {
    console.error('[PageVisibility] Error adding page:', error);
    throw error;
  }
}

/**
 * Bulk set multiple pages under construction
 */
export async function bulkSetUnderConstruction(
  ids: string[],
  isUnderConstruction: boolean
): Promise<void> {
  const { error } = await supabase
    .from('page_visibility')
    .update({ is_under_construction: isUnderConstruction })
    .in('id', ids);

  if (error) {
    console.error('[PageVisibility] Error bulk updating:', error);
    throw error;
  }
}
