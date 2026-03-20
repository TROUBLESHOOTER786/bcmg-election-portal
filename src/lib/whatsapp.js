// ============================================================
// src/lib/whatsapp.js — WhatsApp Integration Service
// ============================================================
// Supports: Direct wa.me links, Interakt API, Wati API, Twilio
// ============================================================

import { logWhatsAppMessage } from './api';

// ==================== CONFIGURATION ====================
const WHATSAPP_CONFIG = {
  // Your campaign WhatsApp number (with country code, no +)
  campaignNumber: process.env.NEXT_PUBLIC_CAMPAIGN_WHATSAPP || '919876543210',
  
  // Provider: 'wa_link' (free), 'interakt', 'wati', 'twilio'
  provider: process.env.NEXT_PUBLIC_WA_PROVIDER || 'wa_link',
  
  // API keys for paid providers (set in .env)
  interaktApiKey: process.env.INTERAKT_API_KEY || '',
  watiApiUrl: process.env.WATI_API_URL || '',
  watiApiKey: process.env.WATI_API_KEY || '',
  twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_WHATSAPP_FROM || '',
};

// ==================== MESSAGE TEMPLATES ====================

export function generateSlipMessage(voter, candidate) {
  return (
    `🗳️ *BCMG Election 2026*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `Dear *${voter.name}*,\n\n` +
    `📋 *Your Voter Details:*\n` +
    `• Enrolment: ${voter.enrolment}\n` +
    `• Sr. No: ${voter.sr_no}\n` +
    `• Booth: ${voter.booth_name}\n` +
    `• Bar Association: ${voter.bar_association}\n` +
    `• District: ${voter.district}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `✅ Please vote for *${candidate.name}*\n` +
    `🗳️ Ballot No. *${candidate.ballot_no}*\n` +
    `⭐ as *${candidate.tagline}*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🗓️ Election Date: *24 March 2026*\n` +
    `🏛️ Bar Council of Maharashtra & Goa`
  );
}

export function generateShareMessage(voter, candidate) {
  return (
    `🗳️ BCMG Election 2026 — Voter Slip\n\n` +
    `${voter.name}\n` +
    `Enrolment: ${voter.enrolment}\n` +
    `Booth: ${voter.booth_name}\n\n` +
    `Vote for *${candidate.name}* (Ballot No. ${candidate.ballot_no})\n` +
    `as *${candidate.tagline}*\n\n` +
    `🗓️ 24 March 2026`
  );
}

// ==================== SEND FUNCTIONS ====================

/**
 * Send voter slip via WhatsApp — opens wa.me link (free tier)
 */
export function sendViaWhatsAppLink(voter, candidate) {
  const message = generateSlipMessage(voter, candidate);
  const mobile = cleanMobile(voter.mobile);
  const url = `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
  
  // Log the attempt
  logWhatsAppMessage(voter, 'individual', 'wa_link');
  
  window.open(url, '_blank');
  return { success: true, method: 'wa_link' };
}

/**
 * Share voter slip on WhatsApp (user chooses recipient)
 */
export function shareViaWhatsApp(voter, candidate) {
  const message = generateShareMessage(voter, candidate);
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  
  logWhatsAppMessage(voter, 'share', 'wa_link');
  
  window.open(url, '_blank');
  return { success: true, method: 'share' };
}

/**
 * Send from campaign number directly (wa.me link with pre-set number)
 */
export function sendFromCampaignNumber(voter, candidate) {
  const message = generateSlipMessage(voter, candidate);
  const mobile = cleanMobile(voter.mobile);
  // This opens WhatsApp with YOUR campaign number sending TO the voter
  const url = `https://wa.me/91${mobile}?text=${encodeURIComponent(message)}`;
  
  logWhatsAppMessage(voter, 'individual', 'wa_link');
  
  window.open(url, '_blank');
  return { success: true, method: 'campaign_send' };
}

// ==================== API-BASED SENDING (Server-side) ====================
// These functions should be called from Next.js API routes, NOT from browser

/**
 * Send via Interakt API (call from /api/whatsapp/send route)
 */
export async function sendViaInterakt(voter, candidate, templateName = 'voter_slip') {
  if (!WHATSAPP_CONFIG.interaktApiKey) {
    throw new Error('Interakt API key not configured');
  }

  const mobile = cleanMobile(voter.mobile);
  
  const payload = {
    countryCode: '+91',
    phoneNumber: mobile,
    callbackData: `voter_${voter.id}`,
    type: 'Template',
    template: {
      name: templateName,
      languageCode: 'en',
      bodyValues: [
        voter.name,
        voter.enrolment,
        voter.booth_name,
        voter.bar_association,
        candidate.name,
        candidate.ballot_no,
        candidate.tagline,
      ],
    },
  };

  const response = await fetch('https://api.interakt.ai/v1/public/message/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${WHATSAPP_CONFIG.interaktApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  
  await logWhatsAppMessage(voter, 'individual', 'interakt');
  
  return { success: response.ok, result };
}

/**
 * Send via Wati API
 */
export async function sendViaWati(voter, candidate, templateName = 'voter_slip') {
  if (!WHATSAPP_CONFIG.watiApiUrl || !WHATSAPP_CONFIG.watiApiKey) {
    throw new Error('Wati API not configured');
  }

  const mobile = cleanMobile(voter.mobile);
  
  const payload = {
    template_name: templateName,
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
  };

  const response = await fetch(
    `${WHATSAPP_CONFIG.watiApiUrl}/api/v1/sendTemplateMessage?whatsappNumber=91${mobile}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_CONFIG.watiApiKey}`,
      },
      body: JSON.stringify(payload),
    }
  );

  const result = await response.json();
  await logWhatsAppMessage(voter, 'individual', 'wati');
  
  return { success: response.ok, result };
}

// ==================== BULK SEND ====================

/**
 * Bulk send to a list of voters (call from API route with rate limiting)
 */
export async function bulkSendSlips(voters, candidate, options = {}) {
  const {
    provider = 'wa_link',
    delayMs = 1000,  // Delay between messages to respect rate limits
    onProgress,
  } = options;

  const results = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i];
    
    try {
      if (provider === 'interakt') {
        await sendViaInterakt(voter, candidate);
      } else if (provider === 'wati') {
        await sendViaWati(voter, candidate);
      }
      results.sent++;
    } catch (err) {
      results.failed++;
      results.errors.push({ voter: voter.name, error: err.message });
    }

    if (onProgress) {
      onProgress({ current: i + 1, total: voters.length, ...results });
    }

    // Rate limiting delay
    if (i < voters.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return results;
}

// ==================== UTILITIES ====================

function cleanMobile(mobile) {
  if (!mobile) return '';
  // Remove all non-digit characters
  let cleaned = mobile.replace(/\D/g, '');
  // Remove leading 91 or 0 if present
  if (cleaned.startsWith('91') && cleaned.length > 10) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Check if a mobile number is valid Indian number
 */
export function isValidMobile(mobile) {
  const cleaned = cleanMobile(mobile);
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Format mobile for display
 */
export function formatMobile(mobile) {
  const cleaned = cleanMobile(mobile);
  if (cleaned.length === 10) {
    return `+91 ${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
  }
  return mobile;
}
