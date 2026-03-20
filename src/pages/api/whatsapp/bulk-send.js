// ============================================================
// src/pages/api/whatsapp/bulk-send.js — Bulk WhatsApp Send
// ============================================================
// POST /api/whatsapp/bulk-send
// Body: { filters: { booth?, bar?, district? }, provider?, limit? }
// ============================================================

import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filters = {}, provider = 'interakt', limit = 100 } = req.body;

    // Build voter query
    let query = supabaseAdmin
      .from('voters')
      .select('id, name, enrolment, sr_no, mobile, booth_name, bar_association, district')
      .not('mobile', 'is', null)
      .neq('mobile', '');

    if (filters.booth) query = query.eq('booth_name', filters.booth);
    if (filters.bar) query = query.eq('bar_association', filters.bar);
    if (filters.district) query = query.eq('district', filters.district);

    const { data: voters, error: votersErr } = await query
      .order('name')
      .limit(Math.min(limit, 500)); // Cap at 500 per batch

    if (votersErr) {
      return res.status(500).json({ error: 'Failed to fetch voters', details: votersErr });
    }

    // Get active candidate
    const { data: candidate } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!candidate) {
      return res.status(404).json({ error: 'No active candidate configured' });
    }

    // Skip voters already contacted today
    const today = new Date().toISOString().split('T')[0];
    const { data: alreadySent } = await supabaseAdmin
      .from('whatsapp_log')
      .select('voter_id')
      .gte('created_at', today)
      .in('voter_id', voters.map(v => v.id));

    const sentIds = new Set((alreadySent || []).map(s => s.voter_id));
    const toSend = voters.filter(v => !sentIds.has(v.id));

    const results = {
      total: voters.length,
      skipped: voters.length - toSend.length,
      sent: 0,
      failed: 0,
      errors: [],
    };

    // Process in sequence with rate limiting
    for (const voter of toSend) {
      let mobile = voter.mobile.replace(/\D/g, '');
      if (mobile.startsWith('91') && mobile.length > 10) mobile = mobile.slice(2);
      if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
        results.failed++;
        results.errors.push({ name: voter.name, reason: 'Invalid mobile' });
        continue;
      }

      try {
        if (provider === 'interakt') {
          await fetch('https://api.interakt.ai/v1/public/message/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${process.env.INTERAKT_API_KEY}`,
            },
            body: JSON.stringify({
              countryCode: '+91',
              phoneNumber: mobile,
              type: 'Template',
              template: {
                name: 'voter_slip_bcmg',
                languageCode: 'en',
                bodyValues: [
                  voter.name, voter.enrolment, voter.booth_name,
                  voter.bar_association, candidate.name,
                  candidate.ballot_no, candidate.tagline,
                ],
              },
            }),
          });
        }

        // Log sent message
        await supabaseAdmin.from('whatsapp_log').insert({
          voter_id: voter.id,
          voter_name: voter.name,
          mobile: mobile,
          message_type: 'bulk',
          status: 'sent',
          provider: provider,
        });

        results.sent++;
      } catch (err) {
        results.failed++;
        results.errors.push({ name: voter.name, reason: err.message });
      }

      // Rate limit: 1 message per second
      await new Promise(r => setTimeout(r, 1000));
    }

    // Log bulk event
    await supabaseAdmin.from('analytics_events').insert({
      event_type: 'bulk_send',
      metadata: {
        filters,
        total: results.total,
        sent: results.sent,
        failed: results.failed,
      },
    });

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Bulk send error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
