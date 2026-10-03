import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

// 1. Update font link in <head> to include Plus Jakarta Sans and Poppins
const oldFontLink = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">';
const newFontLink = '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

if (indexHtml.includes(oldFontLink)) {
  indexHtml = indexHtml.replace(oldFontLink, newFontLink);
}

// 2. Enhanced CSS Stylesheet for modern PC and Mobile UI
const modernStyles = `
  <style>
    /* ================= BASE & RESPONSIVE DESIGN SYSTEM ================= */
    :root {
      --primary: #00796b;
      --primary-dark: #004d40;
      --primary-hover: #00695c;
      --primary-light: #e6fffa;
      --primary-glow: rgba(0, 121, 107, 0.15);
      
      --accent: #2563eb;
      --accent-light: #eff6ff;
      --success: #16a34a;
      --success-light: #f0fdf4;
      --warning: #d97706;
      --warning-light: #fffbeb;
      --danger: #dc2626;
      --danger-light: #fef2f2;
      
      --bg-color: #f8fafc;
      --surface: #ffffff;
      --surface-subtle: #f1f5f9;
      --surface-hover: #f8fafc;
      
      --text-main: #0f172a;
      --text-secondary: #334155;
      --text-muted: #64748b;
      --text-subtle: #94a3b8;
      
      --border-color: #e2e8f0;
      --border-subtle: #cbd5e1;
      
      --radius-sm: 6px;
      --radius: 12px;
      --radius-lg: 16px;
      --radius-full: 9999px;
      
      --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
      --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
      --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05);
      --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04);
      --shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04);
      
      --bottom-nav-height: 64px;
      --sidebar-width: 265px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Poppins', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      padding: 18px 16px 28px 16px;
      -webkit-tap-highlight-color: transparent;
      line-height: 1.5;
      font-size: 14px;
      min-height: 100vh;
    }

    /* Tabular Numerals for Vertical Alignment of Data */
    .tabular-nums, .count, .value, .master-kpi-value, td, th {
      font-variant-numeric: tabular-nums;
    }

    /* Smooth focus outline */
    a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible {
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }

    /* ================= DESKTOP HEADER & TOP BAR ================= */
    .app-header {
      max-width: 1440px;
      margin: 0 auto 16px auto;
      background: linear-gradient(135deg, #004d40 0%, #00796b 55%, #00897b 100%);
      color: #ffffff;
      padding: 16px 24px;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      position: relative;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
    }
    
    .header-title-box {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    
    .header-emblem-badge {
      width: 46px;
      height: 46px;
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(8px);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
      flex-shrink: 0;
    }

    .header-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.25;
      color: #ffffff;
    }

    .header-sub {
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
      margin-top: 2px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .header-chip {
      background: rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(6px);
      padding: 6px 12px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid rgba(255, 255, 255, 0.22);
      transition: background 0.15s ease;
    }
    .header-chip:hover {
      background: rgba(255, 255, 255, 0.24);
    }

    .header-btn {
      background: rgba(255, 255, 255, 0.95);
      color: var(--primary-dark);
      border: none;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      transition: all 0.15s ease;
    }
    .header-btn:hover {
      background: #ffffff;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .header-btn:active {
      transform: translateY(0);
    }

    /* ================= MOBILE TOP APP BAR ================= */
    .mobile-appbar {
      display: none;
      position: sticky;
      top: 0;
      z-index: 1000;
      background: linear-gradient(135deg, #004d40 0%, #00796b 100%);
      color: #ffffff;
      padding: 10px 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      margin: -18px -16px 14px -16px;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .mobile-appbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mobile-menu-btn {
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.25);
      color: #ffffff;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      font-size: 19px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .mobile-menu-btn:active {
      background: rgba(255, 255, 255, 0.35);
      transform: scale(0.96);
    }

    .mobile-appbar-title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
      color: #ffffff;
    }
    .mobile-appbar-sub {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 500;
    }

    /* ================= MOBILE SLIDE-OUT DRAWER ================= */
    .mobile-drawer-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .mobile-drawer-overlay.open {
      display: block;
      opacity: 1;
    }

    .mobile-drawer {
      position: fixed;
      top: 0;
      left: 0;
      width: 300px;
      max-width: 84%;
      height: 100%;
      background: #ffffff;
      z-index: 10002;
      box-shadow: 6px 0 30px rgba(0, 0, 0, 0.25);
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .mobile-drawer.open {
      transform: translateX(0);
    }

    .mobile-drawer-header {
      background: linear-gradient(135deg, #004d40 0%, #00796b 100%);
      color: #ffffff;
      padding: 18px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .mobile-drawer-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: #ffffff;
      font-size: 18px;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-drawer-nav {
      padding: 12px 10px 30px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .mobile-drawer-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
      text-align: left;
      cursor: pointer;
      width: 100%;
      min-height: 48px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .mobile-drawer-btn:active, .mobile-drawer-btn.active {
      background: var(--primary-light);
      color: var(--primary-dark);
      font-weight: 700;
    }

    .mobile-drawer-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      padding: 10px 14px 4px 14px;
      margin-top: 6px;
    }

    /* ================= MOBILE BOTTOM NAVIGATION BAR ================= */
    .mobile-bottom-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: var(--bottom-nav-height);
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px);
      border-top: 1px solid var(--border-color);
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
      z-index: 9999;
      justify-content: space-around;
      align-items: center;
      padding: 4px 6px;
      padding-bottom: env(safe-area-inset-bottom, 4px);
    }

    .bottom-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 2px;
      min-height: 48px;
      min-width: 48px;
      border-radius: 8px;
      transition: color 0.15s ease, transform 0.1s ease;
    }
    .bottom-nav-item:active {
      transform: scale(0.92);
    }
    .bottom-nav-item.active {
      color: var(--primary);
      font-weight: 800;
    }
    .bottom-nav-item.active .bottom-nav-icon {
      transform: scale(1.12);
      filter: drop-shadow(0 2px 4px rgba(0, 121, 107, 0.25));
    }
    .bottom-nav-icon {
      font-size: 19px;
      line-height: 1;
      margin-bottom: 3px;
      transition: transform 0.15s ease;
    }
    .bottom-nav-label {
      font-size: 10.5px;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    /* ================= DESKTOP MAIN LAYOUT WRAPPER ================= */
    .dashboard-wrapper {
      display: flex;
      gap: 20px;
      max-width: 1440px;
      margin: 0 auto;
      align-items: flex-start;
    }

    /* ================= DESKTOP SIDEBAR ================= */
    .sidebar.tab-nav {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      background: var(--surface);
      border-radius: var(--radius);
      padding: 16px 12px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: sticky;
      top: 18px;
      max-height: calc(100vh - 36px);
      overflow-y: auto;
    }

    .sidebar-title {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 8px 12px 4px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
    }
    .sidebar-title:first-child {
      margin-top: 0;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      color: var(--text-secondary);
      text-align: left;
      cursor: pointer;
      width: 100%;
      position: relative;
      transition: all 0.15s ease;
      min-height: 42px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tab-btn:hover {
      background: var(--surface-subtle);
      color: var(--text-main);
    }
    .tab-btn.active {
      background: linear-gradient(90deg, var(--primary-light) 0%, rgba(230, 255, 250, 0.4) 100%);
      color: var(--primary-dark);
      font-weight: 700;
      box-shadow: inset 3px 0 0 var(--primary);
    }

    /* ================= MAIN CONTENT CANVAS ================= */
    .main-content {
      flex: 1;
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px 28px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--border-color);
      min-width: 0; /* Prevent flex blowout */
      min-height: 600px;
    }

    .tab-pane {
      display: none;
      animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .tab-pane.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ================= KPI STATS CARDS ================= */
    .stats-container {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 16px 18px;
      box-shadow: var(--shadow-xs);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      position: relative;
      overflow: hidden;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-subtle);
    }

    .stat-card h4 {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .stat-card .value {
      font-size: 28px;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .stat-card .sub-text {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .master-kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .master-kpi-card {
      background: var(--surface);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 12px 14px;
      box-shadow: var(--shadow-xs);
      transition: all 0.15s ease;
    }
    .master-kpi-card:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow-sm);
    }
    .master-kpi-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .master-kpi-value {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-main);
      margin-top: 2px;
    }

    /* ================= SUBTABS & FILTER CONTROLS ================= */
    .table-subtabs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
      margin-bottom: 18px;
    }

    .subtab-btn {
      padding: 9px 16px;
      background: var(--surface-subtle);
      border: 1px solid transparent;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      min-height: 38px;
      white-space: nowrap;
    }
    .subtab-btn:hover {
      background: #e2e8f0;
      color: var(--text-main);
    }
    .subtab-btn.active {
      background: var(--primary);
      color: #ffffff;
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(0, 121, 107, 0.25);
    }

    /* ================= DATA TABLES & HIGH DENSITY GRIDS ================= */
    .table-container {
      width: 100%;
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-xs);
      margin-top: 12px;
      background: #ffffff;
    }

    .app-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }

    .app-table thead {
      background: #f1f5f9;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .app-table th {
      padding: 10px 14px;
      font-weight: 700;
      font-size: 12px;
      color: #334155;
      border-bottom: 1px solid #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    .app-table td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-main);
      font-size: 13px;
    }

    .app-table tbody tr:hover {
      background-color: #f8fafc;
    }

    .app-table tbody tr:last-child td {
      border-bottom: none;
    }

    /* ================= FORM CONTROLS & INPUTS ================= */
    .form-group {
      margin-bottom: 14px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 5px;
    }

    input[type="text"],
    input[type="number"],
    input[type="date"],
    select,
    textarea {
      width: 100%;
      padding: 9px 12px;
      border: 1.5px solid var(--border-color);
      border-radius: 8px;
      font-family: inherit;
      font-size: 13.5px;
      color: var(--text-main);
      background-color: #ffffff;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px var(--primary-glow);
    }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 2px 4px rgba(0, 121, 107, 0.2);
      transition: all 0.15s ease;
      min-height: 42px;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
      box-shadow: 0 4px 8px rgba(0, 121, 107, 0.28);
      transform: translateY(-1px);
    }
    .btn-primary:active {
      transform: translateY(0);
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid var(--border-color);
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.15s ease;
      min-height: 42px;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    /* ================= FOOTER ================= */
    .app-footer {
      max-width: 1440px;
      margin: 24px auto 0 auto;
      text-align: center;
      font-size: 12.5px;
      color: var(--text-muted);
      border-top: 1px solid var(--border-color);
      padding: 16px 12px;
    }

    /* ================= RESPONSIVE BREAKPOINTS (Mobile, Tablet, PC) ================= */
    
    /* TABLET (768px - 1080px) */
    @media (min-width: 768px) and (max-width: 1080px) {
      body { padding: 14px 10px; }
      .dashboard-wrapper { gap: 14px; }
      .sidebar.tab-nav { width: 220px; min-width: 220px; padding: 12px 8px; }
      .tab-btn { font-size: 13px; padding: 9px 10px; }
      .main-content { padding: 20px 18px; }
      .stats-container { grid-template-columns: repeat(2, 1fr); }
      .master-kpi-grid { grid-template-columns: repeat(3, 1fr); }
    }

    /* MOBILE (< 768px) */
    @media (max-width: 767px) {
      body {
        padding: 0 0 calc(var(--bottom-nav-height) + 20px) 0;
        background-color: #f8fafc;
      }
      
      .app-header { display: none; }
      .mobile-appbar { display: flex; }
      .mobile-bottom-nav { display: flex; }

      .dashboard-wrapper {
        flex-direction: column;
        gap: 12px;
        padding: 0 10px;
      }
      
      .sidebar.tab-nav { display: none; }

      .main-content {
        padding: 16px 14px;
        border-radius: 12px;
        box-shadow: var(--shadow-sm);
        border: 1px solid var(--border-color);
        min-height: 480px;
      }

      .stats-container {
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 16px;
      }
      .stat-card { padding: 12px 14px; }
      .stat-card .value { font-size: 22px; }
      .stat-card h4 { font-size: 11.5px; }

      .master-kpi-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 14px;
      }
      .master-kpi-card { padding: 10px 12px; }
      .master-kpi-value { font-size: 20px; }

      /* Inputs - 16px on mobile prevents iOS viewport auto-zoom */
      input[type="text"],
      input[type="number"],
      input[type="date"],
      select,
      textarea {
        font-size: 16px !important;
        padding: 11px 12px;
        border-radius: 8px;
      }

      .entry-section { padding: 14px 12px; margin-bottom: 14px; }
      
      .table-subtabs {
        gap: 4px;
        margin-bottom: 12px;
      }
      .subtab-btn {
        padding: 8px 12px;
        font-size: 12px;
      }

      .filter-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px;
      }
      .filter-inputs { flex-direction: column; width: 100%; gap: 6px; }
      .filter-search, .filter-select { width: 100%; min-width: 100%; }

      .table-scroll-hint { display: block; }
      .app-table th, .app-table td { padding: 8px 10px; font-size: 12px; }

      .photo-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .photo-card img { height: 110px; }

      .sheet-card { padding: 12px; }
      .sheet-actions { width: 100%; justify-content: stretch; }
      .sheet-btn { flex: 1; justify-content: center; font-size: 12px; }

      .sheet-modal { padding: 8px; }
      .sheet-modal-body {
        padding: 16px 14px;
        border-radius: 12px;
        max-height: 94vh;
      }

      .chart-box { min-height: 240px; padding: 10px; }
      .app-footer { margin: 16px auto 0 auto; font-size: 11.5px; padding: 12px 10px; }
    }
  </style>
`;

// Replace stylesheet block in index.html
const styleStart = indexHtml.indexOf('<style>');
const styleEnd = indexHtml.indexOf('</style>');

if (styleStart !== -1 && styleEnd !== -1) {
  indexHtml = indexHtml.slice(0, styleStart) + modernStyles.trim() + indexHtml.slice(styleEnd + 8);
  console.log('✅ Modern PC and Mobile Stylesheet Injected into index.html');
}

fs.writeFileSync(path.join(rootDir, 'index.html'), indexHtml, 'utf8');
fs.writeFileSync(path.join(rootDir, 'Form.html'), indexHtml, 'utf8');
console.log('✅ Synchronized index.html & Form.html with modern UI design');
