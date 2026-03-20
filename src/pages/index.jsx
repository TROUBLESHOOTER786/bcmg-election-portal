import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as htmlToImage from 'html-to-image';
import { searchVoters, logEvent as apiLogEvent } from "../lib/api";/*
 ╔══════════════════════════════════════════════════════════════╗
 ║  BCMG Election 2026 — Production Voter Outreach Portal      ║
 ║  With Supabase Backend Integration                          ║
 ║                                                              ║
 ║  Features:                                                   ║
 ║  • Voter search by name / enrolment / sr.no / mobile        ║
 ║  • Personalised branded voter slips                          ║
 ║  • One-click WhatsApp send to voter's number                ║
 ║  • WhatsApp share for general forwarding                    ║
 ║  • Candidate config panel (name, photo, ballot no)          ║
 ║  • Admin dashboard with analytics                           ║
 ║  • Booth-wise filtering and coverage tracking               ║
 ║  • Bulk WhatsApp send capability                            ║
 ║  • Download slip as image                                   ║
 ║  • Full analytics event logging                             ║
 ╚══════════════════════════════════════════════════════════════╝

 SUPABASE SETUP:
 This app uses Supabase for backend. In production, replace the
 DEMO_MODE flag with real Supabase calls from src/lib/api.js.
 The demo mode below uses localStorage so you can preview the UI.
*/

// ═══════════════════════════════════════════
//  DEMO MODE — Replace with Supabase in prod
// ═══════════════════════════════════════════
const DEMO_MODE = false; // Set to false when Supabase is connected

const DEMO_VOTERS = [
  { id: 1, sr_no: 110440, enrolment: "MAH/4334/2015", year: 2015, name: "SARANG SHUBHANGI SANDEEP", sex: "Female", mobile: "8698143698", address: "260-M, ROOM NO 26, 1ST FLOOR, KRANTINAGAR, THAKURLI", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "Mah. Co-Op. Court.", bar_association: "MAH CO-OPERATIVE COURT BAR ASSOCIATION" },
  { id: 2, sr_no: 110441, enrolment: "MAH/4030/2015", year: 2015, name: "JOSHI AMRUTA HARISH", sex: "Female", mobile: "9137333621", address: "202, AMI VILLA, AMRUT NAGAR, GHATKOPAR WEST, MUMBAI", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "City Civil & Sessions Court", bar_association: "BOMBAY CIVIL & SESSIONS COURT BAR" },
  { id: 3, sr_no: 110442, enrolment: "MAH/6448/2015", year: 2015, name: "BANERJEE KHUSHNUMAH", sex: "Female", mobile: "9152547225", address: "B-903, PRINCETON, HIRANANDANI ESTATE, GHODBUNDER", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "B.B.A (High Court Original Side)", bar_association: "BOMBAY BAR ASSOCIATION, MUMBAI" },
  { id: 4, sr_no: 110443, enrolment: "MAH/2198/2015", year: 2015, name: "BADAR AJINKYA ANANT", sex: "Male", mobile: "9158698877", address: "1501, B, BOLIVAN ALPS, IVORY TOWERS CHSL, BHAKTI PARK", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "City Civil & Sessions Court", bar_association: "BOMBAY CITY CIVIL & SESSIONS COURT BAR" },
  { id: 5, sr_no: 110444, enrolment: "MAH/4948/2015", year: 2015, name: "SHAIKH SAJID IQBAL", sex: "Male", mobile: "9167004264", address: "FLAT NO 3, ADVANI APT, LBS MARG, OPP JOHNSON", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "", booth_name: "Court of Civil Judge, Vashi", bar_association: "NAVI MUMBAI (VASHI) ADVOCATES ASSOCIATION" },
  { id: 6, sr_no: 110445, enrolment: "MAH/3836/2015", year: 2015, name: "PANDEY KRIPASHANKAR NARENDRA", sex: "Male", mobile: "9167099508", address: "701/702 JAY GURUDEV BHAVANI LIC COLONY", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Borivali", bar_association: "BORIVALI ADVOCATES BAR ASSOCIATION, MUMBAI" },
  { id: 7, sr_no: 110446, enrolment: "MAH/4082/2015", year: 2015, name: "PALEKAR LAUKIK DATTATRAY", sex: "Male", mobile: "9167146455", address: "707/B, KUMAR CHS, MHADA COLONY, MULUND EAST", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "B.B.A (High Court Original Side)", bar_association: "BOMBAY BAR ASSOCIATION, MUMBAI" },
  { id: 8, sr_no: 110447, enrolment: "MAH/799/2015", year: 2015, name: "OJHA ANKIT RAJENDRAPRASAD", sex: "Male", mobile: "9167147383", address: "ROOM NO 2, CHANDRAKANT BHAVAN, CHIMMATPADA", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "City Civil & Sessions Court", bar_association: "BOMBAY CITY CIVIL & SESSIONS COURT BAR" },
  { id: 9, sr_no: 110448, enrolment: "MAH/6775/2015", year: 2015, name: "ANSARI SHAGUFA ISRAIL", sex: "Female", mobile: "9167209701", address: "11, PETER FERNANDES, B/H TEJ KIRAN BLDG", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "City Civil & Sessions Court", bar_association: "BOMBAY CITY CIVIL & SESSIONS COURT BAR" },
  { id: 10, sr_no: 110449, enrolment: "MAH/4500/2015", year: 2015, name: "KHADYE TULSHIDAS MAHADEO", sex: "Male", mobile: "9167531267", address: "ROOM NO 704 BLDG NO 5 SHIVSANKAR PANVEL", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Dadar", bar_association: "DADAR BAR ASSOCIATION, NAIGAUM, MUMBAI" },
  { id: 11, sr_no: 110450, enrolment: "MAH/6986/2015", year: 2015, name: "SAVLA MEETAL PARESH", sex: "Female", mobile: "9167645354", address: "C-WING, FLAT NO 105, VEENA BEENA APT, SEWRI", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Dadar", bar_association: "DADAR BAR ASSOCIATION, NAIGAUM, MUMBAI" },
  { id: 12, sr_no: 110451, enrolment: "MAH/4864/2015", year: 2015, name: "PARTE PRACHI ANIL", sex: "Female", mobile: "9167673727", address: "BLDG NO A/38, FLAT NO 407, B-WING", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "City Civil & Sessions Court", bar_association: "BOMBAY CITY & SESSIONS COURT BAR" },
  { id: 13, sr_no: 110452, enrolment: "MAH/43/2015", year: 2015, name: "MENON DEVIKA K V KRISHNAKUMAR", sex: "Female", mobile: "9167993239", address: "B/1302, AARADHYA ONE PESTOM SAGAR COLONY", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "", booth_name: "Mumbai University (Convocation Hall)", bar_association: "MUMBAI NO BAR" },
  { id: 14, sr_no: 110453, enrolment: "MAH/4821/2015", year: 2015, name: "KHAIRNAR ANAND TANGA", sex: "Male", mobile: "9172111573", address: "FLAT NO 103 F BLD LOKMANYA PAN BAZAR", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "", booth_name: "District & Sessions Court, Pune", bar_association: "PUNE DISTRICT BAR ASSOCIATION" },
  { id: 15, sr_no: 110454, enrolment: "MAH/5582/2015", year: 2015, name: "PANDEY DINESH RAMJIYAWAN", sex: "Male", mobile: "9221252662", address: "H NO 20, PRAYAG NAGAR SOC, L U GADKARI MARG", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Kurla", bar_association: "KURLA BAR ASSOCIATION, MUMBAI" },
  { id: 16, sr_no: 110455, enrolment: "MAH/1305/2015", year: 2015, name: "SHAIKH ZAIBUNISA JAFAR", sex: "Female", mobile: "9221858300", address: "PLOT NO 22 A/1 SHAKAR BAUG, PAYLIPADA, TROMBAY", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Kurla", bar_association: "KURLA BAR ASSOCIATION, MUMBAI" },
  { id: 17, sr_no: 110456, enrolment: "MAH/1059/2015", year: 2015, name: "THOKALE BAJIRAO TANPPA", sex: "Male", mobile: "9222197762", address: "D-5/MULUND SAHAKAR VISHWA CHS LTD, NAHUR ROAD", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Mulund", bar_association: "MULUND COURT BAR ASSOCIATION, MUMBAI" },
  { id: 18, sr_no: 110457, enrolment: "MAH/6932/2015", year: 2015, name: "ANSARI LUBNA SAMIR AHMED", sex: "Female", mobile: "9222222040", address: "ROOM NO. 02, WATER LANE, NEAR ARSIWALA BLDG", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "B.B.A (High Court Original Side)", bar_association: "BOMBAY BAR ASSOCIATION, MUMBAI" },
  { id: 19, sr_no: 110459, enrolment: "MAH/5945/2015", year: 2015, name: "ACHHRA GUL KACHHARAM", sex: "Male", mobile: "9320054533", address: "FLAT NO 2403, SILVER ARCH CHSL, SHASTRI NAGAR", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "Consumer Court, Mumbai", bar_association: "CONSUMER COURTS ADVOCATES ASSOCIATION" },
  { id: 20, sr_no: 110460, enrolment: "MAH/1017/2015", year: 2015, name: "VAIDYA KETAKI GANESH", sex: "Female", mobile: "9320993926", address: "FLAT NO 303 B WING HAWARE PAREKH CHAMBERS", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Vikhroli", bar_association: "VIKHROLI COURT BAR ASSOCIATION, MUMBAI" },
  { id: 21, sr_no: 110461, enrolment: "MAH/4470/2015", year: 2015, name: "RANE PRIYANKA HEMANT", sex: "Female", mobile: "9321032372", address: "25/A, UDAYSHREE CHS, BHANDUP EAST, MUMBAI 400042", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "Court of Small Causes, Mumbai", bar_association: "BOMBAY ADVOCATES ASSOCIATION OF SMALL CAUSES" },
  { id: 22, sr_no: 110462, enrolment: "MAH/4882/2015", year: 2015, name: "SAKHRANI SUNIL MANU", sex: "Male", mobile: "9322211589", address: "303, GORAI PRIYA CHS LTD, PLOT NO 4, RSC-6", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Borivali", bar_association: "BORIVALI ADVOCATES BAR ASSOCIATION, MUMBAI" },
  { id: 23, sr_no: 110463, enrolment: "MAH/4092/2015", year: 2015, name: "JADHAV VAIBHAV PANDURANG", sex: "Male", mobile: "9322223145", address: "ROOM NO 1/6, DADU SHINDE CHAWL, DAWARI NAGAR", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Bandra", bar_association: "BANDRA BAR ASSOCIATION, MUMBAI" },
  { id: 24, sr_no: 110464, enrolment: "MAH/2092/2015", year: 2015, name: "KHAN SHABANA AFZAL", sex: "Female", mobile: "9322639774", address: "ASLAM KHAN CHAWL NO 64/2, MOGRAPADA WEST", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Andheri", bar_association: "ANDHERI BAR ASSOCIATION, MUMBAI" },
  { id: 25, sr_no: 110467, enrolment: "MAH/5828/2015", year: 2015, name: "PATIL NEERAJ BALWANT", sex: "Male", mobile: "9323693201", address: "1101, E WING, DGS SHEETAL TAPOVAN RANI SATI MARG", taluka: "MUMBAI", district: "MUMBAI", cluster_bar: "MUMBAI BARS", booth_name: "MMC, Andheri", bar_association: "ANDHERI BAR ASSOCIATION, MUMBAI" },
];

const DEFAULT_CANDIDATE = {
  id: 1, name: "ADV. JAYANT D. JAIBHAVE", ballot_no: "61",
  tagline: "First Preference", phone: "919876543210", photo_url: null,
};

// ═══════════════════════════════════════════
//  STYLES — Luxury legal-tech dark theme
// ═══════════════════════════════════════════
const C = {
  bg: "var(--bg, #f4f6f8)", bgCard: "var(--bgCard, #ffffff)", bgHover: "var(--bgHover, #f0f2f5)",
  gold: "var(--gold, #b58e2a)", goldLight: "var(--goldLight, #c9a84c)", goldDim: "var(--goldDim, rgba(181,142,42,0.12))",
  goldBorder: "var(--goldBorder, rgba(181,142,42,0.25))", text: "var(--text, #1a202c)", textDim: "var(--textDim, #637381)",
  textMid: "var(--textMid, #454f5b)", green: "var(--green, #16a34a)", greenDim: "var(--greenDim, rgba(22,163,74,0.15))",
  border: "var(--border, rgba(0,0,0,0.08))", red: "var(--red, #dc2626)", blue: "var(--blue, #2563eb)",
};

const GlobalStyle = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    [data-theme="light"] {
      --bg: #f4f6f8; --bgCard: #ffffff; --bgHover: #f0f2f5;
      --gold: #b58e2a; --goldLight: #c9a84c; --goldDim: rgba(181,142,42,0.12);
      --goldBorder: rgba(181,142,42,0.25); --text: #1a202c; --textDim: #637381;
      --textMid: #454f5b; --green: #16a34a; --greenDim: rgba(22,163,74,0.15);
      --border: rgba(0,0,0,0.08); --red: #dc2626; --blue: #2563eb;
    }
    [data-theme="dark"] {
      --bg: #060a10; --bgCard: #0c1322; --bgHover: #111b2e;
      --gold: #c9a84c; --goldLight: #e8d48b; --goldDim: rgba(201,168,76,0.12);
      --goldBorder: rgba(201,168,76,0.18); --text: #d4dae6; --textDim: #5e6a82;
      --textMid: #8692a8; --green: #22c55e; --greenDim: rgba(34,197,94,0.12);
      --border: rgba(255,255,255,0.06); --red: #ef4444; --blue: #3b82f6;
    }
  `}} />
);

const font = `'Cormorant Garamond', Georgia, serif`;
const fontSans = `'DM Sans', 'Segoe UI', system-ui, sans-serif`;

// ═══════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════
const Icon = {
  Search: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  User: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  File: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  Hash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>,
  Phone: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
  WhatsApp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>,
  Download: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  Settings: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Chart: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  Scale: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v18M3 7l3-4 3 4M15 7l3-4 3 4M1 14h6M17 14h6M4 14l2-7M4 14l-2-7M20 14l2-7M20 14l-2-7" /></svg>,
  Back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>,
  Send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>,
  Filter: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
  Map: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  Sun: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

// ═══════════════════════════════════════════
//  LOCAL SEARCH (demo mode)
// ═══════════════════════════════════════════
const norm = s => (s || "").toLowerCase().replace(/[\s\/\-\.]/g, "");

function localSearch(q, type) {
  if (!q || q.trim().length < 2) return [];
  const n = norm(q);
  return DEMO_VOTERS.filter(v => {
    if (type === "name") return norm(v.name).includes(n);
    if (type === "enrolment") return norm(v.enrolment).includes(n);
    if (type === "sr") return String(v.sr_no).includes(q.trim());
    return norm(v.name).includes(n) || norm(v.enrolment).includes(n) || String(v.sr_no).includes(q.trim());
  });
}

// ═══════════════════════════════════════════
//  SHARED UI COMPONENTS
// ═══════════════════════════════════════════
const Btn = ({ children, onClick, style, variant = "default", ...props }) => {
  const base = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "12px 20px", borderRadius: 10, border: "none", cursor: "pointer",
    fontFamily: fontSans, fontSize: 14, fontWeight: 700, transition: "all 0.15s",
    lineHeight: 1.3, textDecoration: "none",
  };
  const variants = {
    default: { background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}` },
    gold: { background: `linear-gradient(135deg, ${C.gold}, #a68536)`, color: "#080c12" },
    green: { background: C.green, color: "#fff", boxShadow: `0 4px 14px rgba(34,197,94,0.3)` },
    greenOutline: { background: C.greenDim, color: C.green, border: `1px solid rgba(34,197,94,0.25)` },
    ghost: { background: "transparent", color: C.textMid },
  };
  return <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }} {...props}>{children}</button>;
};

const Badge = ({ children, color = C.gold }) => (
  <span style={{
    background: `linear-gradient(135deg, ${color}, ${color}dd)`,
    color: "#080c12", borderRadius: 6, padding: "3px 10px",
    fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
  }}>{children}</span>
);

const Modal = ({ children, onClose }) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(10px)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 1000, padding: 16,
  }} onClick={onClose}>
    <div style={{
      background: C.bgCard, borderRadius: 20, maxWidth: 480, width: "100%",
      maxHeight: "92vh", overflowY: "auto", position: "relative",
      boxShadow: `0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 ${C.goldBorder}`,
      border: `1px solid ${C.goldBorder}`,
    }} onClick={e => e.stopPropagation()}>{children}</div>
  </div>
);

const FieldLabel = ({ children }) => (
  <label style={{ display: "block", fontSize: 11, color: C.textMid, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.2, fontFamily: fontSans }}>{children}</label>
);

const TextInput = ({ value, onChange, placeholder, ...props }) => (
  <input value={value} onChange={onChange} placeholder={placeholder} style={{
    width: "100%", padding: "11px 14px", borderRadius: 9, border: `1px solid ${C.goldBorder}`,
    background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: fontSans,
  }} {...props} />
);

// ═══════════════════════════════════════════
//  VOTER SLIP CARD
// ═══════════════════════════════════════════
const VoterSlip = ({ voter, candidate, compact = false }) => (
  <div id="voter-slip-capture" style={{
    background: `linear-gradient(145deg, #0a1628, #101f3c, #0b1a30)`,
    borderRadius: compact ? 12 : 16, padding: compact ? 16 : 22, color: "#fff",
    fontFamily: fontSans, position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: -50, right: -50, width: 140, height: 140, borderRadius: "50%", background: "rgba(201,168,76,0.06)" }} />
    <div style={{ position: "absolute", bottom: -30, left: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(201,168,76,0.04)" }} />

    {/* Header */}
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: compact ? 12 : 16, position: "relative", zIndex: 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 16 : 19, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.25, fontFamily: font }}>{voter.name}</div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{voter.enrolment}</div>
      </div>
      <Badge>F-{voter.sr_no}</Badge>
    </div>

    {/* Candidate banner */}
    <div style={{
      background: C.goldDim, border: `1px solid ${C.goldBorder}`,
      borderRadius: 11, padding: compact ? 12 : 14, marginBottom: compact ? 12 : 14, position: "relative", zIndex: 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {candidate.photo_url ? (
          <img src={candidate.photo_url} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.gold}` }} />
        ) : (
          <div style={{ minWidth: 46, width: 46, height: 46, borderRadius: "50%", background: C.goldDim, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${C.gold}`, fontSize: 22, fontWeight: 800, color: C.gold, fontFamily: font }}>
            {candidate.ballot_no || candidate.name.charAt(0)}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5 }}>Your Candidate</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 1, fontFamily: font }}>{candidate.name}</div>
          <div style={{ fontSize: 11, color: C.textDim }}>Ballot No. {candidate.ballot_no}</div>
        </div>
      </div>
      <div style={{
        marginTop: 10, background: C.gold, color: "#080c12", borderRadius: 7,
        padding: "7px 0", textAlign: "center", fontWeight: 800, fontSize: 12, letterSpacing: 0.5,
      }}>
        Please vote as {candidate.tagline}
      </div>
    </div>

    {/* Details grid */}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, position: "relative", zIndex: 1 }}>
      {[
        { l: "District", v: voter.district }, { l: "Taluka", v: voter.taluka },
        { l: "Bar Association", v: voter.bar_association, full: true },
        { l: "Polling Booth", v: voter.booth_name, full: true },
      ].map((item, i) => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.025)", borderRadius: 7, padding: "8px 10px",
          gridColumn: item.full ? "1/-1" : undefined,
        }}>
          <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1.3, fontWeight: 600 }}>{item.l}</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color: "#c8d0e0", lineHeight: 1.35 }}>{item.v || "—"}</div>
        </div>
      ))}
    </div>

    {/* Footer */}
    <div style={{
      marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Icon.Scale />
        <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: 0.8 }}>BCMG ELECTION 2026</span>
      </div>
      <span style={{ fontSize: 10, color: C.textDim }}>24 March 2026</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════
//  VOTER DETAIL MODAL
// ═══════════════════════════════════════════
const VoterModal = ({ voter, candidate, onClose, onLogEvent }) => {
  useEffect(() => {
    onLogEvent?.("view_slip", { voterId: voter.id, voterName: voter.name, voterEnrolment: voter.enrolment, boothName: voter.booth_name, barAssociation: voter.bar_association, district: voter.district });
  }, []);

  const cleanMobile = (m) => { let c = (m || "").replace(/\D/g, ""); if (c.startsWith("91") && c.length > 10) c = c.slice(2); return c; };

  const genMsg = () => {
    return `*Respected ADV. ${voter.name}* ,\n\nWarm Greetings! 🙏\n\nAs you're aware, the BCMG elections are to be held on the 24th of March 2026. Thus, in order to make the process easier for you, I'm sharing your voting details herein below.\n\n*The details are as follows:*\n*Your Enrollment No:* ${voter.enrolment}\n*Your Polling Booth:* ${voter.booth_name}\n*Bar Association:* ${voter.bar_association}\n*Serial Number:* ${voter.sr_no}\n*Room Number:* ${voter.room_no || 'TBD'}\n\nOur legal fraternity needs strong, positive, and proactive representation. Therefore, I earnestly request your valuable support and your *1st Preference Vote* for *ADV. JAYANT D. JAIBHAVE* .\n\n*Voting Details for Adv. Jayant D. Jaibhave:*\n👉 *Ballot Serial No: 6️⃣1️⃣*\n\nA quick reminder for the voting process:\n✔️ Please write '1' or 'one' clearly against Serial No. 61.\n✔️ Please do not forget to give at least 5 preferences in total, otherwise, the vote may be considered invalid.\n\nI hope you're able to give some of your valuable time between 09:00 AM to 06:00 PM on 24th March to cast your vote.\n\nIf you need any help locating the booth or have any questions about the voting process, please feel free to get in touch with me.\n\nWarm regards,\n*ADV. JAYANT D. JAIBHAVE*\n*9503212602*\n\n📌 See Campaign Flyer: ${window.location.origin}/flyer.jpg`;
  };

  const sendToVoter = async () => {
    const m = cleanMobile(voter.mobile);
    if (!m) { alert("No mobile number available for this voter."); return; }
    
    const node = document.getElementById('voter-slip-capture');
    let sharedViaAPI = false;
    
    if (node && navigator.share && navigator.canShare) {
      try {
        const blob = await htmlToImage.toBlob(node, { quality: 0.95 });
        if (blob) {
          const file = new File([blob], `VoterSlip-${voter.name.replace(/\\s+/g, '_')}.png`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Voting Details',
              text: genMsg(),
              files: [file]
            });
            sharedViaAPI = true;
          }
        }
      } catch (e) {
        console.error('Share error', e);
      }
    }
    
    if (!sharedViaAPI) {
      window.open(`https://wa.me/91${m}?text=${encodeURIComponent(genMsg())}`, '_blank');
    }
    
    onLogEvent?.("whatsapp_send", { voterId: voter.id, voterName: voter.name, voterEnrolment: voter.enrolment, boothName: voter.booth_name, district: voter.district, barAssociation: voter.bar_association });
  };

  const downloadSlip = async () => {
    const node = document.getElementById('voter-slip-capture');
    if (!node) return;
    try {
      const dataUrl = await htmlToImage.toPng(node, { quality: 0.95 });
      const link = document.createElement('a');
      link.download = `VoterSlip-${voter.name.replace(/\\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
      onLogEvent?.("download_slip", { voterId: voter.id, voterName: voter.name, voterEnrolment: voter.enrolment, boothName: voter.booth_name, district: voter.district, barAssociation: voter.bar_association });
    } catch (e) {
      console.error('Error downloading slip', e);
    }
  };

  return (
    <Modal onClose={onClose}>
      <button onClick={onClose} style={{
        position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.08)",
        border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex",
        alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textMid, zIndex: 10,
      }}><Icon.X /></button>

      <div style={{ padding: 20 }}>
        <VoterSlip voter={voter} candidate={candidate} />

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
          <Btn variant="green" onClick={sendToVoter} style={{ padding: "14px 20px", fontSize: 15 }}>
            <Icon.WhatsApp /> Send to {voter.name.split(" ")[0]} on WhatsApp
          </Btn>
          <Btn variant="default" onClick={downloadSlip} style={{ padding: "13px 20px" }}>
            <Icon.Download /> Download Voting Slip
          </Btn>
        </div>

        {/* Voter details footer */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { icon: <Icon.File />, l: "Enrolment", v: voter.enrolment },
              { icon: <Icon.Map />, l: "District", v: voter.district },
              { icon: <Icon.Hash />, l: "Sr. No.", v: voter.sr_no },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ color: C.textDim, marginTop: 2 }}>{d.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{d.l}</div>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 1 }}>{d.v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ═══════════════════════════════════════════
//  CANDIDATE SETTINGS
// ═══════════════════════════════════════════
const CandidateSettings = ({ candidate, setCandidate, onClose }) => {
  const [f, setF] = useState({ ...candidate });
  const fileRef = useRef(null);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const r = new FileReader();
      r.onloadend = () => setF(prev => ({ ...prev, photo_url: r.result }));
      r.readAsDataURL(file);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0, fontFamily: font }}>Candidate Settings</h2>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textMid }}><Icon.X /></button>
        </div>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div onClick={() => fileRef.current?.click()} style={{
            width: 90, height: 90, borderRadius: "50%", margin: "0 auto", border: `2px dashed ${C.goldBorder}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: C.goldDim,
          }}>
            {f.photo_url ? <img src={f.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> :
              <span style={{ color: C.gold, fontSize: 12, fontWeight: 600, textAlign: "center", padding: 6 }}>Upload Photo</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>Click to upload</div>
        </div>

        {[
          { k: "name", l: "Candidate Name", p: "Enter full name" },
          { k: "ballot_no", l: "Ballot Number", p: "e.g. 5" },
          { k: "tagline", l: "Preference Message", p: "e.g. First / Best Preference" },
          { k: "phone", l: "WhatsApp Number (with 91)", p: "e.g. 919876543210" },
        ].map(field => (
          <div key={field.k} style={{ marginBottom: 14 }}>
            <FieldLabel>{field.l}</FieldLabel>
            <TextInput value={f[field.k] || ""} onChange={e => setF(p => ({ ...p, [field.k]: e.target.value }))} placeholder={field.p} />
          </div>
        ))}

        <Btn variant="gold" onClick={() => { setCandidate(f); onClose(); }} style={{ width: "100%", padding: 14, marginTop: 6 }}>
          Save Candidate Details
        </Btn>
      </div>
    </Modal>
  );
};

// ═══════════════════════════════════════════
//  ADMIN DASHBOARD
// ═══════════════════════════════════════════
const AdminDashboard = ({ stats, events, onBack }) => {
  const boothData = useMemo(() => {
    const map = {};
    DEMO_VOTERS.forEach(v => {
      if (!map[v.booth_name]) map[v.booth_name] = { booth: v.booth_name, total: 0, searched: 0, sent: 0 };
      map[v.booth_name].total++;
    });
    events.filter(e => e.type === "view_slip").forEach(e => {
      if (e.booth && map[e.booth]) map[e.booth].searched++;
    });
    events.filter(e => e.type === "whatsapp_send").forEach(e => {
      if (e.booth && map[e.booth]) map[e.booth].sent++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [events]);

  const recentEvents = useMemo(() => events.slice(-20).reverse(), [events]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 20px 60px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, paddingTop: 10 }}>
        <button onClick={onBack} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textMid }}>
          <Icon.Back />
        </button>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#fff", fontFamily: font }}>Campaign Dashboard</h2>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total Voters", value: stats.totalVoters?.toLocaleString("en-IN"), color: C.gold },
          { label: "Searches", value: stats.searches, color: C.blue },
          { label: "Slips Viewed", value: stats.slipsViewed, color: "#a78bfa" },
          { label: "WhatsApp Sent", value: stats.whatsappSent, color: C.green },
          { label: "Downloads", value: stats.downloads, color: "#f97316" },
        ].map((s, i) => (
          <div key={i} style={{ background: C.bgCard, borderRadius: 14, padding: "18px 16px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: font }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.3, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Booth Coverage */}
      <div style={{ background: C.bgCard, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: font }}>Booth-wise Coverage</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {boothData.map((b, i) => {
            const pct = b.total > 0 ? Math.round((b.sent / b.total) * 100) : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.booth}</div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.green}, #15803d)`, borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 70 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: pct > 50 ? C.green : pct > 20 ? C.gold : C.textDim }}>{pct}%</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>{b.sent}/{b.total}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ background: C.bgCard, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: font }}>Recent Activity</h3>
        {recentEvents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontSize: 13 }}>No activity yet. Start searching for voters!</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentEvents.map((e, i) => {
              const typeColors = { search: C.blue, view_slip: "#a78bfa", whatsapp_send: C.green, whatsapp_share: "#22d3ee", download_slip: "#f97316" };
              const typeLabels = { search: "Searched", view_slip: "Viewed Slip", whatsapp_send: "WhatsApp Sent", whatsapp_share: "Shared", download_slip: "Downloaded" };
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < recentEvents.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColors[e.type] || C.textDim, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{typeLabels[e.type] || e.type}</span>
                      <span style={{ fontSize: 12, color: C.textDim }}>{e.voterName || e.searchQuery || e.name || e.query || ""}</span>
                    </div>
                    {(e.barAssociation || e.district || e.boothName) && (
                      <div style={{ fontSize: 11, color: C.gold, marginTop: 4 }}>
                        {[e.barAssociation, e.district, e.boothName].filter(Boolean).join(" • ")}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, whiteSpace: "nowrap" }}>{e.time}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
//  MAIN APPLICATION
// ═══════════════════════════════════════════
export default function BCMGElectionPortal() {
  const [theme, setTheme] = useState("light");
  const [page, setPage] = useState("home"); // home | admin
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("name");
  const [results, setResults] = useState([]);
  const [selectedVoter, setSelectedVoter] = useState(null);
  const [candidate, setCandidate] = useState(DEFAULT_CANDIDATE);
  const [showSettings, setShowSettings] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const inputRef = useRef(null);

  const stats = useMemo(() => ({
    totalVoters: 196054,
    searches: events.filter(e => e.type === "search").length,
    slipsViewed: events.filter(e => e.type === "view_slip").length,
    whatsappSent: events.filter(e => e.type === "whatsapp_send").length,
    downloads: events.filter(e => e.type === "download_slip").length,
  }), [events]);

  const logEvent = useCallback((type, details = {}) => {
    const now = new Date();
    setEvents(prev => [...prev, {
      type, ...details,
      time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      timestamp: now.toISOString(),
    }]);
    if (!DEMO_MODE) {
      apiLogEvent(type, details);
    }
  }, []);

  const doSearch = useCallback(async () => {
    let formattedQuery = query.trim();
    if (formattedQuery.length < 2) { setResults([]); setHasSearched(false); return; }
    setLoading(true);

    if (searchType === "enrolment") {
      formattedQuery = formattedQuery.replace(/\s+/g, '/').toUpperCase();
    }

    if (DEMO_MODE) {
      setTimeout(() => {
        const found = localSearch(formattedQuery, searchType);
        setResults(found);
        setHasSearched(true);
        setLoading(false);
        logEvent("search", { searchQuery: formattedQuery, searchType, resultsCount: found.length });
      }, 200);
    } else {
      const { data } = await searchVoters(formattedQuery, searchType);
      setResults(data);
      setHasSearched(true);
      setLoading(false);
      logEvent("search", { searchQuery: formattedQuery, searchType, resultsCount: data ? data.length : 0 });
    }
  }, [query, searchType, logEvent]);

  useEffect(() => {
    const t = setTimeout(() => { if (query.trim().length >= 2) doSearch(); else { setResults([]); setHasSearched(false); } }, 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  const searchTypes = [
    { key: "name", label: "Name", icon: <Icon.User /> },
    { key: "enrolment", label: "Enrolment No.", icon: <Icon.File /> },
  ];

  // ─── GOOGLE FONTS ───
  useEffect(() => {
    if (!document.getElementById("bcmg-fonts")) {
      const link = document.createElement("link");
      link.id = "bcmg-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  if (page === "admin") {
    return (
      <div data-theme={theme} style={{ minHeight: "100vh", background: C.bg, fontFamily: fontSans, color: C.text }}>
        <GlobalStyle />
        <TopBar onSettings={() => setShowSettings(true)} onAdmin={() => setPage("home")} isAdmin theme={theme} toggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")} />
        <AdminDashboard stats={stats} events={events} onBack={() => setPage("home")} />
        {showSettings && <CandidateSettings candidate={candidate} setCandidate={setCandidate} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  return (
    <div data-theme={theme} style={{ minHeight: "100vh", background: C.bg, fontFamily: fontSans, color: C.text }}>
      <GlobalStyle />
      {/* Subtle dot pattern */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.02, backgroundImage: `radial-gradient(circle at 25% 25%, ${C.gold} 0.8px, transparent 0.8px), radial-gradient(circle at 75% 75%, ${C.gold} 0.8px, transparent 0.8px)`, backgroundSize: "50px 50px", pointerEvents: "none" }} />

      <TopBar onSettings={() => setShowSettings(true)} onAdmin={() => setPage("admin")} theme={theme} toggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")} />

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "44px 20px 16px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, borderRadius: "50%", background: `radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)`, pointerEvents: "none" }} />
        <h1 style={{ fontSize: 38, fontWeight: 700, margin: 0, fontFamily: font, color: C.goldLight, letterSpacing: -0.5, lineHeight: 1.15 }}>
          Find Your Voting Slip
        </h1>
        <p style={{ color: C.textDim, fontSize: 14, marginTop: 8, maxWidth: 460, margin: "8px auto 0", fontFamily: fontSans, lineHeight: 1.5 }}>
          Search the BCMG Electoral Roll 2026 — Bar Council of Maharashtra & Goa
        </p>
      </div>

      {/* Search Box */}
      <div style={{ maxWidth: 540, margin: "22px auto", padding: "0 20px", position: "relative", zIndex: 10 }}>
        <div style={{
          background: "rgba(12,19,34,0.95)", border: `1px solid ${C.goldBorder}`, borderRadius: 16, padding: 6,
          boxShadow: `0 10px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(201,168,76,0.08)`,
        }}>
          {/* Search type tabs */}
          <div style={{ display: "flex", gap: 3, padding: "4px 4px 0", flexWrap: "wrap" }}>
            {searchTypes.map(t => (
              <button key={t.key} onClick={() => { setSearchType(t.key); inputRef.current?.focus(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 7,
                  border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: fontSans,
                  background: searchType === t.key ? C.goldDim : "transparent",
                  color: searchType === t.key ? C.gold : C.textDim, transition: "all 0.15s",
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 14px" }}>
            <div style={{ color: C.textDim }}><Icon.Search /></div>
            <input
              ref={inputRef} value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder={
                searchType === "name" ? "Search by name..." :
                  searchType === "enrolment" ? "Enter MAH/XXXX/YYYY..." :
                    searchType === "mobile" ? "Enter mobile number..." :
                      "Enter serial number..."
              }
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 15, padding: "10px 0", fontFamily: fontSans }}
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setHasSearched(false); inputRef.current?.focus(); }}
                style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textMid }}>
                <Icon.X />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {(hasSearched || loading) && (
          <div style={{ marginTop: 12 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${C.goldDim}`, borderTopColor: C.gold, borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8, paddingLeft: 4, fontWeight: 600 }}>
                  {results.length} {results.length === 1 ? "result" : "results"} found
                </div>
                {results.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {results.map(v => (
                      <div key={v.id} onClick={() => setSelectedVoter(v)}
                        style={{
                          background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 13,
                          padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center",
                          justifyContent: "space-between", gap: 12, transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.goldBorder; e.currentTarget.style.background = C.bgHover; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bgCard; }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <Badge>F-{v.sr_no}</Badge>
                            <span style={{ fontWeight: 700, fontSize: 14, fontFamily: font }}>{v.name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                            {v.enrolment} · {v.booth_name} · {v.district}
                          </div>
                        </div>
                        <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>View →</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "36px 20px", background: C.bgCard, borderRadius: 14, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                    <div style={{ color: C.textMid, fontSize: 14 }}>No voters found</div>
                    <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Try a different name or enrolment number</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, maxWidth: 600, margin: "30px auto", padding: "0 20px" }}>
        {[
          { label: "Total Voters", value: "1,96,054", color: C.gold },
          { label: "Election Date", value: "24 Mar", color: "#60a5fa" },
          { label: "Election", value: "BCMG", sub: "Maha & Goa", color: "#a78bfa" },
          { label: "Searches", value: stats.searches, color: C.green },
        ].map((s, i) => (
          <div key={i} style={{ background: C.bgCard, borderRadius: 13, padding: "16px 14px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: font, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: C.textDim, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, marginTop: 5 }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, marginBottom: 6 }}>Features</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff", fontFamily: font }}>Campaign Portal Tools</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
          {[
            { icon: "🔍", title: "Voter Lookup", desc: "Search by name, enrolment, serial number, or mobile number instantly." },
            { icon: "🗳️", title: "Branded Slips", desc: "Every slip shows your candidate name, ballot number, and preference message." },
            { icon: "💬", title: "One-Click WhatsApp", desc: "Send personalised slips directly to voter's WhatsApp with a single tap." },
            { icon: "📊", title: "Admin Dashboard", desc: "Track searches, views, shares, and booth-wise campaign coverage in real time." },
          ].map((f, i) => (
            <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 18px" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5, fontFamily: font }}>{f.title}</div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "28px 20px", borderTop: `1px solid ${C.border}`, marginTop: 40 }}>
        <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>
          BCMG Election 2026 — Digital Voter Outreach Portal<br />
          Bar Council of Maharashtra & Goa
        </div>
      </div>

      {/* Modals */}
      {selectedVoter && <VoterModal voter={selectedVoter} candidate={candidate} onClose={() => setSelectedVoter(null)} onLogEvent={logEvent} />}
      {showSettings && <CandidateSettings candidate={candidate} setCandidate={setCandidate} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════
//  TOP BAR
// ═══════════════════════════════════════════
function TopBar({ onSettings, onAdmin, isAdmin = false, theme, toggleTheme }) {
  return (
    <div style={{
      background: "rgba(12,19,34,0.85)", backdropFilter: "blur(14px)",
      borderBottom: `1px solid ${C.goldBorder}`, padding: "10px 18px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon.Scale />
        <span style={{ fontWeight: 700, fontSize: 13, color: C.gold, letterSpacing: 0.3, fontFamily: fontSans }}>BCMG Election 2026</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: C.gold, fontWeight: 600, fontFamily: fontSans }}>24 March 2026</span>
        <button onClick={toggleTheme} title="Toggle Theme" style={{
          background: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: 9, width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.gold, marginLeft: 4,
        }}>
          {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
        </button>
        <button onClick={onAdmin} title={isAdmin ? "Back to Home" : "Admin Dashboard"} style={{
          background: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: 9, width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.gold, marginLeft: 4,
        }}>
          {isAdmin ? <Icon.Back /> : <Icon.Chart />}
        </button>
        <button onClick={onSettings} title="Candidate Settings" style={{
          background: C.goldDim, border: `1px solid ${C.goldBorder}`, borderRadius: 9, width: 36, height: 36,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.gold,
        }}>
          <Icon.Settings />
        </button>
      </div>
    </div>
  );
}
