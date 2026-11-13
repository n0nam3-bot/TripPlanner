"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Database, KeyRound, LogOut, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { Brand } from "@/components/brand";

type DashboardData = {
  generatedAt: string;
  appUsage: { month: string; monthlyUsed: number; monthlyCap: number; monthlyRemaining: number; hourlyUsed: number; hourlyCap: number; todayReservedSearches: number };
  periodTotals: { events24h: number; apiCalls24h: number; accountChecks24h: number; cacheHits24h: number; staleCacheHits24h: number; failures24h: number; blocked24h: number; averageProviderMs: number | null; promptTokens24h: number; completionTokens24h: number; totalTokens24h: number };
  providerBreakdown: Array<{ provider: string; category: string; apiCalls: number; accountChecks: number; cacheHits: number; staleCacheHits: number; failures: number; averageMs: number | null; promptTokens: number; completionTokens: number; totalTokens: number }>;
  dailyTrend: Array<{ hour: string; apiCalls: number; cacheHits: number; failures: number }>;
  recentEvents: Array<{ id: number; provider: string; category: string; eventType: string; outcome: string; cacheStatus: string; httpStatus: number | null; durationMs: number | null; promptTokens: number | null; completionTokens: number | null; createdAt: string }>;
  geoapifyUsage: { configured: boolean; usedToday: number; dailyCap: number; remainingToday: number; visitorCreditsToday: number; activeVisitorsToday: number; clientDailyCap: number };
  aiUsage: { openRouter: { configured: boolean; usedToday: number; dailyCap: number; remainingToday: number; usedThisMinute: number; minuteCap: number }; gemini: { configured: boolean; usedToday: number; dailyCap: number; remainingToday: number; usedThisMinute: number; minuteCap: number }; clientDailyCap: number };
  cache: { totalEntries: number; validEntries: number; expiredEntries: number; lastUpdatedAt: string | null };
  clientUsage: { activeClientsToday: number; reservedSearchesToday: number };
  serpApiAccount: { configured: boolean; connected: boolean; remaining: number | null; monthlyLimit: number | null; renewalDate: string | null; hourlyUsed: number | null; hourlyLimit: number | null; error: string | null };
  warnings: string[];
};

function number(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";
}
function shortTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function eventLabel(type: string): string {
  return ({ provider_request: "Provider call", cache_hit: "Cache hit", provider_error: "Provider error", request_blocked: "Request blocked", account_check: "Account check", local_parse: "Local parse", provider_fallback: "Local fallback" } as Record<string, string>)[type] ?? type;
}

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState("");

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        setData(null);
        setError("Your admin session expired. Sign in again.");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Dashboard data could not be loaded.");
      setData(payload as DashboardData);
      setLastRefresh(new Date().toISOString());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard data could not be loaded.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!active) return;
        setAuthConfigured(Boolean(payload.configured));
        if (response.ok && payload.authenticated) setAuthenticated(true);
      })
      .catch(() => { if (active) setError("Unable to check the admin session."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    void loadDashboard(true);
    const timer = window.setInterval(() => void loadDashboard(true), 30000);
    return () => window.clearInterval(timer);
  }, [authenticated, loadDashboard]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoggingIn(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Admin sign-in failed.");
      setPassword("");
      setAuthenticated(true);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Admin sign-in failed.");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    setAuthenticated(false);
    setData(null);
  };

  const cacheRate = useMemo(() => {
    if (!data) return 0;
    const total = data.periodTotals.apiCalls24h + data.periodTotals.cacheHits24h;
    return total ? Math.round(data.periodTotals.cacheHits24h / total * 100) : 0;
  }, [data]);
  const maxCalls = Math.max(1, ...((data?.dailyTrend ?? []).map((item) => item.apiCalls + item.cacheHits)));

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div><Brand /><span className="admin-wordmark">OPERATIONS</span></div>
          {authenticated && <div className="admin-header-actions"><span className="admin-live-dot">Live monitoring</span><button className="admin-quiet-button" onClick={() => void loadDashboard()} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "admin-spin" : ""} />Refresh</button><button className="admin-quiet-button" onClick={() => void logout()}><LogOut size={15} />Sign out</button></div>}
        </header>

        {checking ? <section className="admin-login-card"><div className="admin-loading-line" />Checking secure admin session…</section> : !authenticated ? (
          <section className="admin-login-card">
            <div className="admin-login-icon"><ShieldCheck size={22} /></div>
            <p className="admin-eyebrow">RESTRICTED AREA</p>
            <h1>Tripfinder operations</h1>
            <p className="admin-muted">Sign in to view provider usage, API activity, cache performance and system errors.</p>
            {authConfigured === false && <div className="admin-alert admin-alert-error"><AlertTriangle size={17} />ADMIN_DASHBOARD_SECRET has not been configured in Vercel.</div>}
            <form onSubmit={login} className="admin-login-form">
              <label htmlFor="admin-password">Admin password</label>
              <div className="admin-password-wrap"><KeyRound size={16} /><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)} placeholder="Enter your admin secret" required /></div>
              <button className="admin-primary-button" disabled={loggingIn || authConfigured === false || !password}>{loggingIn ? "Signing in…" : "Sign in securely"}</button>
            </form>
            {error && <p className="admin-error-text">{error}</p>}
            <p className="admin-login-note">The dashboard is private. Your password is checked server-side and is never stored in the browser.</p>
          </section>
        ) : (
          <>
            <section className="admin-title-row">
              <div><p className="admin-eyebrow">SYSTEM OVERVIEW</p><h1>Usage &amp; performance</h1><p className="admin-muted">Provider calls, quotas and cache activity across Tripfinder.</p></div>
              <div className="admin-refresh-meta"><span>Auto-refresh every 30 seconds</span><strong>{lastRefresh ? `Updated ${shortTime(lastRefresh)}` : "Loading metrics…"}</strong></div>
            </section>

            {error && <div className="admin-alert admin-alert-error"><AlertTriangle size={17} />{error}</div>}
            {!data ? <section className="admin-loading-panel"><div className="admin-loading-line" />Loading operational data…</section> : <>
              {data.warnings.length > 0 && <section className="admin-alert-list">{data.warnings.map((warning) => <div className="admin-alert admin-alert-warning" key={warning}><AlertTriangle size={16} />{warning}</div>)}</section>}

              <section className="admin-metric-grid">
                <article className="admin-metric-card"><div className="admin-metric-head"><span>SerpApi searches remaining</span><Search size={16} /></div><strong>{number(data.serpApiAccount.remaining)}</strong><small>{data.serpApiAccount.monthlyLimit ? `of ${number(data.serpApiAccount.monthlyLimit)} monthly searches` : data.serpApiAccount.connected ? "Provider account connected" : "Provider account unavailable"}</small><div className="admin-progress"><i style={{ width: `${data.serpApiAccount.monthlyLimit && data.serpApiAccount.remaining !== null ? Math.max(0, Math.min(100, data.serpApiAccount.remaining / data.serpApiAccount.monthlyLimit * 100)) : 0}%` }} /></div></article>
                <article className="admin-metric-card"><div className="admin-metric-head"><span>Tripfinder monthly reservations</span><Activity size={16} /></div><strong>{number(data.appUsage.monthlyUsed)} <em>/ {number(data.appUsage.monthlyCap)}</em></strong><small>{number(data.appUsage.monthlyRemaining)} app-level searches remaining this month</small><div className="admin-progress"><i style={{ width: `${Math.min(100, data.appUsage.monthlyUsed / Math.max(1, data.appUsage.monthlyCap) * 100)}%` }} /></div></article>
                <article className="admin-metric-card"><div className="admin-metric-head"><span>Provider API calls · 24h</span><Clock3 size={16} /></div><strong>{number(data.periodTotals.apiCalls24h)}</strong><small>{number(data.periodTotals.failures24h)} errors · {number(data.periodTotals.blocked24h)} blocked · {number(data.periodTotals.accountChecks24h)} quota checks</small><small>AI tokens · {number(data.periodTotals.promptTokens24h)} input / {number(data.periodTotals.completionTokens24h)} output · {number(data.periodTotals.totalTokens24h)} total</small></article>
                <article className="admin-metric-card"><div className="admin-metric-head"><span>Cache hit rate · 24h</span><Database size={16} /></div><strong>{cacheRate}%</strong><small>{number(data.periodTotals.cacheHits24h)} cached responses · {number(data.periodTotals.staleCacheHits24h)} stale fallbacks · {number(data.cache.validEntries)} valid cache entries</small></article>
              </section>

              <section className="admin-section-grid">
                <article className="admin-panel admin-quota-panel">
                  <div className="admin-panel-heading"><div><p className="admin-eyebrow">PROVIDER ACCOUNT</p><h2>SerpApi quota</h2></div><span className={`admin-status ${data.serpApiAccount.connected ? "is-ok" : "is-warning"}`}>{data.serpApiAccount.connected ? <><CheckCircle2 size={13} />Connected</> : <><AlertTriangle size={13} />Unavailable</>}</span></div>
                  <div className="admin-quota-numbers"><div><small>Monthly searches left</small><strong>{number(data.serpApiAccount.remaining)}</strong></div><div><small>Used this hour</small><strong>{number(data.serpApiAccount.hourlyUsed)}{data.serpApiAccount.hourlyLimit !== null ? <em> / {number(data.serpApiAccount.hourlyLimit)}</em> : null}</strong></div></div>
                  <div className="admin-detail-line"><span>Plan renewal</span><strong>{data.serpApiAccount.renewalDate || "Not supplied"}</strong></div>
                  <div className="admin-detail-line"><span>Tripfinder hourly safety cap</span><strong>{number(data.appUsage.hourlyUsed)} / {number(data.appUsage.hourlyCap)}</strong></div>
                  {data.serpApiAccount.error && <p className="admin-muted admin-small">{data.serpApiAccount.error}</p>}
                  <p className="admin-footnote">Account status is retrieved from SerpApi’s account endpoint. Account checks do not consume search credits.</p>
                </article>

                <article className="admin-panel">
                  <div className="admin-panel-heading"><div><p className="admin-eyebrow">LAST 24 HOURS</p><h2>Request activity</h2></div><span className="admin-subtle-label">UTC</span></div>
                  {data.dailyTrend.length ? <div className="admin-chart" role="img" aria-label="Hourly provider calls and cache hits over the last 24 hours">{data.dailyTrend.slice(-24).map((item) => <div className="admin-chart-column" key={item.hour} title={`${shortTime(item.hour)}: ${item.apiCalls} provider calls, ${item.cacheHits} cache hits`}><div className="admin-chart-bars"><i className="api-bar" style={{ height: `${Math.max(item.apiCalls ? 4 : 0, item.apiCalls / maxCalls * 100)}%` }} /><i className="cache-bar" style={{ height: `${Math.max(item.cacheHits ? 4 : 0, item.cacheHits / maxCalls * 100)}%` }} /></div><span>{new Date(item.hour).toLocaleTimeString([], { hour: "numeric" })}</span></div>)}</div> : <div className="admin-empty-state">No provider events have been logged yet. New searches and cache hits will appear here.</div>}
                  <div className="admin-chart-legend"><span><i className="api-bar" /> Provider calls</span><span><i className="cache-bar" /> Cache hits</span></div>
                  <div className="admin-detail-line"><span>Average provider response time</span><strong>{data.periodTotals.averageProviderMs === null ? "—" : `${number(data.periodTotals.averageProviderMs)} ms`}</strong></div>
                </article>
              </section>

              <section className="admin-panel admin-table-panel">
                <div className="admin-panel-heading"><div><p className="admin-eyebrow">OPENSTREETMAP PLACES + ROUTING</p><h2>Geoapify daily credit budget</h2></div><div className="admin-dashboard-meta"><span className="admin-subtle-label">UTC day</span><span className={`admin-status ${data.geoapifyUsage.configured ? "is-ok" : "is-warning"}`}>{data.geoapifyUsage.configured ? <><CheckCircle2 size={13} />Configured</> : <><AlertTriangle size={13} />Not configured</>}</span></div></div>
                <div className="admin-quota-numbers"><div><small>Tripfinder credits reserved today</small><strong>{number(data.geoapifyUsage.usedToday)} <em>/ {number(data.geoapifyUsage.dailyCap)}</em></strong></div><div><small>Remaining within Tripfinder cap</small><strong>{number(data.geoapifyUsage.remainingToday)}</strong></div></div>
                <div className="admin-progress"><i style={{ width: `${Math.min(100, data.geoapifyUsage.usedToday / Math.max(1, data.geoapifyUsage.dailyCap) * 100)}%` }} /></div>
                <div className="admin-detail-line"><span>Per-visitor daily cap</span><strong>{number(data.geoapifyUsage.clientDailyCap)} credits</strong></div>
                <div className="admin-detail-line"><span>Visitor usage today</span><strong>{number(data.geoapifyUsage.visitorCreditsToday)} credits · {number(data.geoapifyUsage.activeVisitorsToday)} visitors</strong></div>
                <div className="admin-detail-line"><span>Place and route provider</span><strong>{data.geoapifyUsage.configured ? "Geoapify / OpenStreetMap" : "SerpApi Maps / Local fallback"}</strong></div>
                <p className="admin-footnote">These are credits reserved by Tripfinder before uncached calls; conservative reservations and failed attempts can make the count higher than provider-billed usage. The shared counter tracks requests made by this app using its Neon database; it cannot include other apps using the same Geoapify key. The provider Free plan currently lists 3,000 credits/day and up to 5 requests/second. Tripfinder reserves at most {number(data.geoapifyUsage.dailyCap)} credits/day, serializes uncached requests at a slower shared rate, and uses a 12-hour cache. See <a href="https://www.geoapify.com/pricing/" target="_blank" rel="noreferrer">Geoapify pricing</a> and retain the required <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap attribution</a>.</p>
                {!data.geoapifyUsage.configured && <p className="admin-muted admin-small">Optional provider is disabled until GEOAPIFY_API_KEY is added as a server-side Vercel environment variable. No Geoapify requests are being made.</p>}
              </section>

              <section className="admin-panel admin-table-panel">
                <div className="admin-panel-heading"><div><p className="admin-eyebrow">AI FREE-TIER USAGE</p><h2>Daily request limits</h2></div><span className="admin-subtle-label">UTC day · shared across visitors</span></div>
                <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Provider</th><th>Configured</th><th>Requests today</th><th>App daily cap</th><th>Remaining</th><th>Requests this minute</th><th>Minute cap</th></tr></thead><tbody>
                  <tr><td><strong>OpenRouter · free router</strong></td><td>{data.aiUsage.openRouter.configured ? "Yes" : "No"}</td><td>{number(data.aiUsage.openRouter.usedToday)}</td><td>{number(data.aiUsage.openRouter.dailyCap)}</td><td>{number(data.aiUsage.openRouter.remainingToday)}</td><td>{number(data.aiUsage.openRouter.usedThisMinute)}</td><td>{number(data.aiUsage.openRouter.minuteCap)}</td></tr>
                  <tr><td><strong>Gemini · free tier</strong></td><td>{data.aiUsage.gemini.configured ? "Yes" : "No"}</td><td>{number(data.aiUsage.gemini.usedToday)}</td><td>{number(data.aiUsage.gemini.dailyCap)}</td><td>{number(data.aiUsage.gemini.remainingToday)}</td><td>{number(data.aiUsage.gemini.usedThisMinute)}</td><td>{number(data.aiUsage.gemini.minuteCap)}</td></tr>
                </tbody></table></div>
                <p className="admin-footnote">These are Tripfinder's application request caps, not the providers' guaranteed quotas. Gemini's actual free allowance varies by project and model. Provider request/response token totals are shown in the breakdown and event log; input and output contents are never stored.</p>
              </section>

              <section className="admin-panel admin-table-panel">
                <div className="admin-panel-heading"><div><p className="admin-eyebrow">PROVIDER BREAKDOWN</p><h2>Usage by search category</h2></div><span className="admin-subtle-label">Last 30 days</span></div>
                {data.providerBreakdown.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Provider</th><th>Category</th><th>API calls</th><th>Quota checks</th><th>Cache hits</th><th>Stale fallbacks</th><th>Errors</th><th>Avg. time</th><th>Input tokens</th><th>Output tokens</th><th>Total tokens</th></tr></thead><tbody>{data.providerBreakdown.map((row) => <tr key={`${row.provider}-${row.category}`}><td><strong>{row.provider}</strong></td><td>{row.category}</td><td>{number(row.apiCalls)}</td><td>{number(row.accountChecks)}</td><td>{number(row.cacheHits)}</td><td>{number(row.staleCacheHits)}</td><td>{number(row.failures)}</td><td>{row.averageMs === null ? "—" : `${number(row.averageMs)} ms`}</td><td>{number(row.promptTokens)}</td><td>{number(row.completionTokens)}</td><td>{number(row.totalTokens)}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state">No provider requests recorded yet.</div>}
              </section>

              <section className="admin-panel admin-table-panel">
                <div className="admin-panel-heading"><div><p className="admin-eyebrow">REQUEST LOG</p><h2>Recent API activity</h2></div><span className="admin-subtle-label">Latest 60 events</span></div>
                {data.recentEvents.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Time</th><th>Provider</th><th>Category</th><th>Event</th><th>Result</th><th>Cache result</th><th>HTTP</th><th>Duration</th><th>Input tokens</th><th>Output tokens</th></tr></thead><tbody>{data.recentEvents.map((row) => <tr key={row.id}><td>{shortTime(row.createdAt)}</td><td><strong>{row.provider}</strong></td><td>{row.category}</td><td>{eventLabel(row.eventType)}</td><td><span className={`admin-outcome outcome-${row.outcome}`}>{row.outcome === "success" ? <CheckCircle2 size={12} /> : row.outcome === "blocked" ? <AlertTriangle size={12} /> : <XCircle size={12} />}{row.outcome}</span></td><td>{row.cacheStatus === "stale" ? "Stale fallback" : row.cacheStatus === "hit" ? "Fresh cache" : row.cacheStatus === "miss" ? "Live request" : "—"}</td><td>{row.httpStatus ?? "—"}</td><td>{row.durationMs === null ? "—" : `${number(row.durationMs)} ms`}</td><td>{row.promptTokens === null ? "—" : number(row.promptTokens)}</td><td>{row.completionTokens === null ? "—" : number(row.completionTokens)}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state">No API events logged yet. This log starts filling as visitors search and request forecasts.</div>}
              </section>

              <section className="admin-footer-grid">
                <article className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">NEON DATABASE</p><h2>Cache health</h2></div><Database size={17} /></div><div className="admin-detail-line"><span>Total cache records</span><strong>{number(data.cache.totalEntries)}</strong></div><div className="admin-detail-line"><span>Valid / unexpired</span><strong>{number(data.cache.validEntries)}</strong></div><div className="admin-detail-line"><span>Expired / awaiting cleanup</span><strong>{number(data.cache.expiredEntries)}</strong></div><div className="admin-detail-line"><span>Last cache write</span><strong>{data.cache.lastUpdatedAt ? shortTime(data.cache.lastUpdatedAt) : "No records"}</strong></div></article>
                <article className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">VISITOR LIMITS</p><h2>Uncached search usage</h2></div><ShieldCheck size={17} /></div><div className="admin-detail-line"><span>Active clients today</span><strong>{number(data.clientUsage.activeClientsToday)}</strong></div><div className="admin-detail-line"><span>Reserved searches today</span><strong>{number(data.clientUsage.reservedSearchesToday)}</strong></div><p className="admin-footnote">Client identifiers are stored as one-way hashes. The dashboard does not expose visitor IP addresses or search terms.</p></article>
              </section>
            </>}
          </>
        )}
        <footer className="admin-page-footer"><span>tripfinder. / Admin</span><span><a href="/">Open public site <ArrowUpRight size={12} /></a> · Private operations console</span></footer>
      </div>
    </main>
  );
}
