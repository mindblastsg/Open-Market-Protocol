import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main>
      <p className="eyebrow">OPEN MARKET PROTOCOL · FOUNDATION</p>
      <h1>Markets without gatekeepers.</h1>
      <p className="lede">
        The reference application is being built in public. Marketplace,
        federation, and accounting features are not implemented yet.
      </p>
      <section aria-labelledby="status-title">
        <h2 id="status-title">Current status</h2>
        <dl>
          <div>
            <dt>Web shell</dt>
            <dd>Available</dd>
          </div>
          <div>
            <dt>API health check</dt>
            <dd>Available</dd>
          </div>
          <div>
            <dt>Marketplace demo</dt>
            <dd>Planned</dd>
          </div>
          <div>
            <dt>Federated booking</dt>
            <dd>Planned</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

