// ============================================================
// src/pages/api/whatsapp/send.js — WhatsApp Send API Route
// ============================================================
// POST /api/whatsapp/send
// Body: { voterId, provider? }
// ============================================================

import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { voterId, provider = 'wa_link' } = req.body;

    if (!voterId) {
      return res.status(400).json({ error: 'voterId is required' });
    }

    // Get voter details
    const { data: voter, error: voterErr } = await supabaseAdmin
      .from('voters')
      .select('*')
      .eq('id', voterId)
      .single();

    if (voterErr || !voter) {
      return res.status(404).json({ error: 'Voter not found' });
    }

    if (!voter.mobile) {
      return res.status(400).json({ error: 'Voter has no mobile number' });
    }

    // Get active candidate
    const { data: candidate, error: candErr } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (candErr || !candidate) {
      return res.status(404).json({ error: 'No active candidate configured' });
    }

    // Clean mobile number
    let mobile = voter.mobile.replace(/\D/g, '');
    if (mobile.startsWith('91') && mobile.length > 10) mobile = mobile.slice(2);
    if (mobile.startsWith('0')) mobile = mobile.slice(1);

    // Generate message
    const message = [
      `🗳️ *BCMG Election 2026*`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `Dear *${voter.name}*,`,
      ``,
      `📋 *Your Voter Details:*`,
      `• Enrolment: ${voter.enrolment}`,
      `• Sr. No: ${voter.sr_no}`,
      `• Booth: ${voter.booth_name}`,
      `• Bar: ${voter.bar_association}`,
      `• District: ${voter.district}`,
      ``,
      `━━━━━━━━━━━━━━━━━━`,
      `✅ Please vote for *${candidate.name}*`,
      `🗳️ Ballot No. *${candidate.ballot_no}*`,
      `⭐ as *${candidate.tagline}*`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `🗓️ Election Date: *24 March 2026*`,
      `🏛️ Bar Council of Maharashtra & Goa`,
    ].join('\n');

    let result = {};

    if (provider === 'wa_link') {
      // Generate wa.me link (client opens it)
      const waLink = `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
      result = { method: 'wa_link', link: waLink };
    }
    else if (provider === 'interakt') {
      // Interakt API call
      const interaktRes = await fetch('https://api.interakt.ai/v1/public/message/', {
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
      result = { method: 'interakt', response: await interaktRes.json() };
    }
    else if (provider === 'wati') {
      // Wati API call
      const watiRes = await fetch(
        `${process.env.WATI_API_URL}/api/v1/sendTemplateMessage?whatsappNumber=91${mobile}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.WATI_API_KEY}`,
          },
          body: JSON.stringify({
            template_name: 'voter_slip_bcmg',
            broadcast_name: `slip_${voter.id}_${Date.now()}`,
            parameters: [
              { name: 'voter_name', value: voter.name },
              { name: 'enrolment', value: voter.enrolment },
              { name: 'booth', value: voter.booth_name },
              { name: 'bar', value: voter.bar_association },
              { name: 'candidate_name', value: candidate.name },
              { name: 'ballot_no', value: candidate.ballot_no },
              { name: 'tagline', value: candidate.tagline },
            ],
          }),
        }
      );
      result = { method: 'wati', response: await watiRes.json() };
    }

    // Log to database
    await supabaseAdmin.from('whatsapp_log').insert({
      voter_id: voter.id,
      voter_name: voter.name,
      mobile: mobile,
      message_type: 'individual',
      status: provider === 'wa_link' ? 'sent' : 'pending',
      provider: provider,
      metadata: { result },
    });

    // Log analytics event
    await supabaseAdmin.from('analytics_events').insert({
      event_type: 'whatsapp_send',
      voter_id: voter.id,
      voter_name: voter.name,
      voter_enrolment: voter.enrolment,
      booth_name: voter.booth_name,
      bar_association: voter.bar_association,
      district: voter.district,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
