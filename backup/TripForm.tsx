import { useState, FormEvent } from 'react';
import { TripRequest } from '../types';

interface Props {
  onSubmit: (req: TripRequest) => void;
  disabled: boolean;
}

const PRESET_PLACES = [
  'Tokyo, Japan', 'Paris, France', 'Bali, Indonesia',
  'New York, USA', 'Barcelona, Spain', 'Rome, Italy',
  'Santorini, Greece', 'Dubai, UAE', 'Kyoto, Japan',
  'London, UK', 'Singapore', 'Sydney, Australia',
  'Mumbai, India', 'New Delhi, India', 'Bangkok, Thailand',
  'Amsterdam, Netherlands', 'Istanbul, Turkey', 'Cape Town, South Africa',
];

export function TripForm({ onSubmit, disabled }: Props) {
  const today = new Date();
  const defaultStart = new Date(today.getTime() + 30 * 86400000);
  const defaultEnd = new Date(today.getTime() + 37 * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(fmt(defaultStart));
  const [endDate, setEndDate] = useState(fmt(defaultEnd));
  const [budgetUsd, setBudgetUsd] = useState(3000);
  const [travelers, setTravelers] = useState(2);
  const [preferences, setPreferences] = useState('');
  const [showOriginPresets, setShowOriginPresets] = useState(false);
  const [showDestinationPresets, setShowDestinationPresets] = useState(false);

  const durationDays = Math.max(
    1,
    Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      duration_days: durationDays,
      budget_usd: budgetUsd,
      travelers,
      preferences: preferences.trim() || undefined,
    });
  }

  const placeDropdown = (
    filter: string,
    onSelect: (val: string) => void,
    exclude?: string
  ) => (
    <div style={{
      position: 'absolute',
      zIndex: 50,
      background: 'var(--c-bg-card)',
      border: '1.5px solid var(--c-border)',
      borderRadius: 'var(--r-md)',
      marginTop: 4,
      width: '100%',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}>
      {PRESET_PLACES
        .filter(p => p !== exclude && (!filter || p.toLowerCase().includes(filter.toLowerCase())))
        .slice(0, 6)
        .map((p) => (
          <div
            key={p}
            style={{
              padding: '10px 14px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              color: 'var(--c-text)',
              transition: 'background 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-accent-soft)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onMouseDown={() => onSelect(p)}
          >
            <span>🌍</span> {p}
          </div>
        ))
      }
    </div>
  );

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <p className="section-title">✈️ Plan Your Trip</p>

      {/* Route: Origin → Destination */}
      <div className="form-row form-group" style={{ alignItems: 'flex-start', gap: 12 }}>
        {/* Origin */}
        <div style={{ flex: 1, position: 'relative' }}>
          <label className="form-label" htmlFor="origin">Traveling From</label>
          <input
            id="origin"
            className="form-input"
            type="text"
            placeholder="e.g. Mumbai, India"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            onFocus={() => setShowOriginPresets(true)}
            onBlur={() => setTimeout(() => setShowOriginPresets(false), 180)}
            required
            disabled={disabled}
            autoComplete="off"
          />
          {showOriginPresets && placeDropdown(origin, setOrigin, destination)}
        </div>

        {/* Swap arrow */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 28,
          color: 'var(--c-accent)',
          fontSize: '1.2rem',
          flexShrink: 0,
        }}></div>

        {/* Destination */}
        <div style={{ flex: 1, position: 'relative' }}>
          <label className="form-label" htmlFor="destination">Traveling To</label>
          <input
            id="destination"
            className="form-input"
            type="text"
            placeholder="e.g. Tokyo, Japan"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onFocus={() => setShowDestinationPresets(true)}
            onBlur={() => setTimeout(() => setShowDestinationPresets(false), 180)}
            required
            disabled={disabled}
            autoComplete="off"
          />
          {showDestinationPresets && placeDropdown(destination, setDestination, origin)}
        </div>
      </div>

      {/* Dates */}
      <div className="form-row form-group">
        <div>
          <label className="form-label" htmlFor="start-date">Departure</label>
          <input
            id="start-date"
            className="form-input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            disabled={disabled}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="end-date">Return</label>
          <input
            id="end-date"
            className="form-input"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            disabled={disabled}
          />
        </div>
      </div>

      {durationDays > 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginTop: -10, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
          📅 {durationDays} day{durationDays !== 1 ? 's' : ''} trip
        </p>
      )}

      {/* Budget */}
      <div className="form-group">
        <div className="budget-display">
          <div>
            <span className="budget-value">${budgetUsd.toLocaleString()}</span>
            <span className="budget-label"> USD</span>
          </div>
          <span className="budget-label">per person · total budget</span>
        </div>
        <input
          id="budget-slider"
          className="form-range"
          type="range"
          min={500}
          max={20000}
          step={250}
          value={budgetUsd}
          onChange={(e) => setBudgetUsd(Number(e.target.value))}
          disabled={disabled}
          style={{ '--pct': `${((budgetUsd - 500) / 19500) * 100}%` } as any}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--c-text-dim)' }}>$500</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--c-text-dim)' }}>$20,000</span>
        </div>
      </div>

      {/* Travelers */}
      <div className="form-group">
        <label className="form-label">Travelers</label>
        <div className="traveler-counter">
          <button
            type="button"
            className="counter-btn"
            onClick={() => setTravelers(Math.max(1, travelers - 1))}
            disabled={disabled || travelers <= 1}
          >−</button>
          <span className="counter-value">{travelers}</span>
          <button
            type="button"
            className="counter-btn"
            onClick={() => setTravelers(Math.min(20, travelers + 1))}
            disabled={disabled || travelers >= 20}
          >+</button>
          <span style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
            {travelers === 1 ? 'Solo traveler' : `${travelers} people`}
          </span>
        </div>
      </div>

      {/* Preferences */}
      <div className="form-group">
        <label className="form-label" htmlFor="preferences">
          Preferences <span style={{ color: 'var(--c-text-dim)' }}>(optional)</span>
        </label>
        <textarea
          id="preferences"
          className="form-textarea"
          placeholder="e.g. vegetarian food, avoid crowds, love street art, family-friendly…"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          disabled={disabled}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={disabled || !origin.trim() || !destination.trim()}>
        {disabled ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>✦</span>
            Planning your trip…
          </span>
        ) : '🚀 Plan My Trip with AI'}
      </button>
    </form>
  );
}
