// ============================================================
// src/lib/api.js — All Supabase API Operations
// ============================================================

import { supabase } from './supabase';

// ==================== VOTER SEARCH ====================

export async function searchVoters(query, searchType = 'name', limit = 20) {
  if (!query || query.trim().length < 2) return { data: [], error: null };

  // Use the database function for optimized search
  const { data, error } = await supabase.rpc('search_voters', {
    search_query: query.trim(),
    search_type: searchType,
    result_limit: limit,
  });

  if (error) {
    console.error('Search error:', error);
    // Fallback to direct query if RPC fails
    return fallbackSearch(query, searchType, limit);
  }

  return { data: data || [], error: null };
}

async function fallbackSearch(query, searchType, limit) {
  let queryBuilder = supabase.from('voters').select('*');
  const q = query.trim();

  switch (searchType) {
    case 'name':
      queryBuilder = queryBuilder.ilike('name', `%${q}%`);
      break;
    case 'enrolment':
      queryBuilder = queryBuilder.ilike('enrolment', `%${q}%`);
      break;
    case 'sr':
      queryBuilder = queryBuilder.eq('sr_no', parseInt(q) || 0);
      break;
    case 'mobile':
      queryBuilder = queryBuilder.like('mobile', `%${q}%`);
      break;
    default:
      queryBuilder = queryBuilder.or(
        `name.ilike.%${q}%,enrolment.ilike.%${q}%`
      );
  }

  const { data, error } = await queryBuilder.limit(limit).order('name');
  return { data: data || [], error };
}

// ==================== VOTER BY ID ====================

export async function getVoterById(id) {
  const { data, error } = await supabase
    .from('voters')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function getVoterByEnrolment(enrolment) {
  const { data, error } = await supabase
    .from('voters')
    .select('*')
    .eq('enrolment', enrolment)
    .single();
  return { data, error };
}

// ==================== CANDIDATE ====================

export async function getActiveCandidate() {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();
  return { data, error };
}

export async function updateCandidate(id, updates) {
  const { data, error } = await supabase
    .from('candidates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function createCandidate(candidate) {
  // Deactivate all existing candidates first
  await supabase.from('candidates').update({ is_active: false }).eq('is_active', true);
  
  const { data, error } = await supabase
    .from('candidates')
    .insert({ ...candidate, is_active: true })
    .select()
    .single();
  return { data, error };
}

// ==================== ANALYTICS ====================

export async function logEvent(eventType, details = {}) {
  const { error } = await supabase.from('analytics_events').insert({
    event_type: eventType,
    voter_id: details.voterId || null,
    voter_name: details.voterName || null,
    voter_enrolment: details.voterEnrolment || null,
    search_query: details.searchQuery || null,
    search_type: details.searchType || null,
    results_count: details.resultsCount || null,
    booth_name: details.boothName || null,
    bar_association: details.barAssociation || null,
    district: details.district || null,
    metadata: details.metadata || {},
  });
  if (error) console.error('Analytics log error:', error);
}

export async function getDashboardStats() {
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  return { data, error };
}

export async function getAnalyticsTimeline(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_type, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function getRecentActivity(limit = 50) {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: data || [], error };
}

// ==================== WHATSAPP LOG ====================

export async function logWhatsAppMessage(voter, messageType = 'individual', provider = 'wa_link') {
  const { data, error } = await supabase.from('whatsapp_log').insert({
    voter_id: voter.id,
    voter_name: voter.name,
    mobile: voter.mobile,
    message_type: messageType,
    status: provider === 'wa_link' ? 'sent' : 'pending',
    provider: provider,
  }).select().single();
  return { data, error };
}

export async function getWhatsAppStats() {
  const { data, error } = await supabase
    .from('whatsapp_log')
    .select('status, message_type, created_at')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

// ==================== BOOTH DATA ====================

export async function getBoothStats() {
  const { data, error } = await supabase
    .from('booth_voter_counts')
    .select('*')
    .order('total_voters', { ascending: false });
  return { data: data || [], error };
}

export async function getVotersByBooth(boothName, limit = 100) {
  const { data, error } = await supabase
    .from('voters')
    .select('*')
    .eq('booth_name', boothName)
    .order('name')
    .limit(limit);
  return { data: data || [], error };
}

// ==================== BULK OPERATIONS ====================

export async function getVotersForBulkSend(filters = {}) {
  let query = supabase
    .from('voters')
    .select('id, name, enrolment, mobile, booth_name, bar_association, district')
    .not('mobile', 'is', null)
    .neq('mobile', '');

  if (filters.booth) query = query.eq('booth_name', filters.booth);
  if (filters.bar) query = query.eq('bar_association', filters.bar);
  if (filters.district) query = query.eq('district', filters.district);

  const { data, error } = await query.order('name').limit(filters.limit || 500);
  return { data: data || [], error };
}

// ==================== CANDIDATE PHOTO UPLOAD ====================

export async function uploadCandidatePhoto(file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `candidate_${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('campaign-assets')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) return { url: null, error };

  const { data: urlData } = supabase.storage
    .from('campaign-assets')
    .getPublicUrl(fileName);

  return { url: urlData.publicUrl, error: null };
}
