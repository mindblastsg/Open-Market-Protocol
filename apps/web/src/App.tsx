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
  const [operatorToken, setOperatorToken] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingPrice, setListingPrice] = useState("25.00");

  async function loadListings() {
    const response = await api<{ listings: ServiceListing[] }>("/api/listings");
    setListings(response.listings);
    setSelectedId((current) =>
      response.listings.some((listing) => listing.id === current)
        ? current
        : (response.listings[0]?.id ?? ""),
    );
  }

  useEffect(() => {
    void loadListings()
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

  async function createListing(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api<{ listing: ServiceListing }>("/api/operator/listings", {
        method: "POST",
        headers: { authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({
          title: listingTitle,
          description: listingDescription,
          priceMinor: Math.round(Number(listingPrice) * 100),
          currency: "GBP",
        }),
      });
      setListingTitle("");
      setListingDescription("");
      await loadListings();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to create listing",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function withdrawListing(id: string) {
    setSubmitting(true);
    setError("");
    try {
      await api(`/api/operator/listings/${id}/withdraw`, {
        method: "POST",
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      await loadListings();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to withdraw listing",
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
          More choice without surrendering control. Browse fictional local
          services, lock the displayed price into a simulated booking, and
          follow every state change from one transparent record.
        </p>
      </header>

      <div className="benefits" aria-label="Consumer benefits">
        <div>
          <strong>Know the deal</strong>
          <span>The selected price is captured with the booking.</span>
        </div>
        <div>
          <strong>Keep your proof</strong>
          <span>Every state change has a visible sequence and time.</span>
        </div>
        <div>
          <strong>Choose beyond one gatekeeper</strong>
          <span>Federated discovery is the next milestone.</span>
        </div>
      </div>

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

      <section aria-labelledby="operator-title">
        <div className="section-heading">
          <div>
            <p className="section-number">04</p>
            <h2 id="operator-title">Operate the local market</h2>
          </div>
          <p>Development access</p>
        </div>
        <p className="operator-intro">
          Add or withdraw fictional services. Use the local operator token from
          your environment; this is not production authentication.
        </p>
        <form className="operator-form" onSubmit={createListing}>
          <label>
            Operator token
            <input
              required
              type="password"
              value={operatorToken}
              onChange={(event) => setOperatorToken(event.target.value)}
            />
          </label>
          <label>
            Service title
            <input
              required
              maxLength={160}
              value={listingTitle}
              onChange={(event) => setListingTitle(event.target.value)}
              placeholder="Neighbourhood repair clinic"
            />
          </label>
          <label className="wide">
            Description
            <input
              required
              value={listingDescription}
              onChange={(event) => setListingDescription(event.target.value)}
              placeholder="Describe the fictional service clearly."
            />
          </label>
          <label>
            Price in GBP
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={listingPrice}
              onChange={(event) => setListingPrice(event.target.value)}
            />
          </label>
          <button className="primary" disabled={submitting} type="submit">
            Publish fictional service
          </button>
        </form>
        {operatorToken && (
          <div className="operator-listings">
            {listings.map((listing) => (
              <div key={listing.id}>
                <span>{listing.title}</span>
                <button
                  disabled={submitting}
                  onClick={() => withdrawListing(listing.id)}
                  type="button"
                >
                  Withdraw
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

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
