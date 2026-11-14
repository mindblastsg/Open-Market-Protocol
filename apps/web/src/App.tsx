import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Booking, ServiceListing } from "@omp/protocol";

interface ApiError {
  error?: string;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers },
  });
  const body = (await response.json()) as T & ApiError;
  if (!response.ok)
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  return body;
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    minor / 100,
  );
}

export function App() {
  const [listings, setListings] = useState<ServiceListing[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ listings: ServiceListing[] }>("/api/listings")
      .then(({ listings: nextListings }) => {
        setListings(nextListings);
        setSelectedId(nextListings[0]?.id ?? "");
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Failed"),
      )
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => listings.find((listing) => listing.id === selectedId),
    [listings, selectedId],
  );

  async function createBooking(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const accountResponse = await api<{ account: { id: string } }>(
        "/api/accounts",
        {
          method: "POST",
          body: JSON.stringify({ displayName, email }),
        },
      );
      const bookingResponse = await api<{ booking: Booking }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          accountId: accountResponse.account.id,
          listingId: selected.id,
        }),
      });
      setBooking(bookingResponse.booking);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to create booking",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function transition(state: "confirmed" | "completed" | "cancelled") {
    if (!booking) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await api<{ booking: Booking }>(
        `/api/bookings/${booking.id}/transitions`,
        { method: "POST", body: JSON.stringify({ state }) },
      );
      setBooking(response.booking);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update booking",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="hero">
        <p className="eyebrow">OPEN MARKET PROTOCOL · SINGLE-NODE DEMO</p>
        <h1>A market you can inspect.</h1>
        <p className="lede">
          Browse fictional local services, create a simulated booking, and
          follow every state change. No payment is collected and no real service
          is offered.
        </p>
      </header>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="services-title">
        <div className="section-heading">
          <div>
            <p className="section-number">01</p>
            <h2 id="services-title">Choose a fictional service</h2>
          </div>
          <p>{loading ? "Loading…" : `${listings.length} available`}</p>
        </div>
        <div className="listing-grid">
          {listings.map((listing) => (
            <button
              className={
                listing.id === selectedId ? "listing selected" : "listing"
              }
              key={listing.id}
              onClick={() => setSelectedId(listing.id)}
              type="button"
            >
              <span>{listing.title}</span>
              <strong>{money(listing.priceMinor, listing.currency)}</strong>
              <small>{listing.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="participant-title">
        <div className="section-heading">
          <div>
            <p className="section-number">02</p>
            <h2 id="participant-title">Request the service</h2>
          </div>
          <p>Simulation only</p>
        </div>
        <form onSubmit={createBooking}>
          <label>
            Display name
            <input
              required
              maxLength={120}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Alex Morgan"
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alex@example.test"
            />
          </label>
          <button
            className="primary"
            disabled={!selected || submitting}
            type="submit"
          >
            {submitting ? "Working…" : "Create simulated booking"}
          </button>
        </form>
      </section>

      {booking && (
        <section aria-labelledby="booking-title">
          <div className="section-heading">
            <div>
              <p className="section-number">03</p>
              <h2 id="booking-title">Booking record</h2>
            </div>
            <span className={`status status-${booking.status}`}>
              {booking.status}
            </span>
          </div>
          <div className="booking-summary">
            <div>
              <span>Service</span>
              <strong>{booking.listing?.title}</strong>
            </div>
            <div>
              <span>Agreed simulated price</span>
              <strong>
                {money(booking.agreedPriceMinor, booking.currency)}
              </strong>
            </div>
            <div>
              <span>Reference</span>
              <strong className="reference">{booking.id}</strong>
            </div>
          </div>
          <div className="actions" aria-label="Booking actions">
            {booking.status === "proposed" && (
              <button
                disabled={submitting}
                onClick={() => transition("confirmed")}
              >
                Confirm booking
              </button>
            )}
            {booking.status === "confirmed" && (
              <button
                disabled={submitting}
                onClick={() => transition("completed")}
              >
                Mark complete
              </button>
            )}
            {(booking.status === "proposed" ||
              booking.status === "confirmed") && (
              <button
                className="quiet"
                disabled={submitting}
                onClick={() => transition("cancelled")}
              >
                Cancel
              </button>
            )}
          </div>
          <ol className="timeline">
            {booking.events?.map((event) => (
              <li key={event.id}>
                <span>{event.sequence.toString().padStart(2, "0")}</span>
                <div>
                  <strong>{event.toState}</strong>
                  <time dateTime={event.occurredAt}>
                    {new Date(event.occurredAt).toLocaleString("en-GB")}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer>
        <strong>Local node · Pre-alpha</strong>
        <p>
          All identities, listings, prices, and bookings in this demo are
          fictional.
        </p>
      </footer>
    </main>
  );
}
