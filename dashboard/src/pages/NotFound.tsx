import { Link, useNavigate } from "react-router-dom";
import { AppShell, TopBar, btn, Ico } from "@/components/custom/squid-app";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <AppShell>
      <TopBar home="/" crumbs={[{ label: "404" }]} />
      <div
        style={{
          minHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          textAlign: "center",
          padding: "0 var(--sa-gut)",
        }}
      >
        <code
          className="sa-mono"
          style={{ font: "300 72px/1 var(--sa-f)", letterSpacing: "-0.03em", color: "var(--sa-dim)" }}
        >
          404
        </code>
        <p style={{ maxWidth: 420, margin: 0, color: "var(--sa-text-2)", fontSize: 14.5, lineHeight: 1.6 }}>
          No route answers here. This one 400s harder than a0 ever should.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/" className={btn("primary", "md")}>
            Back to a0 <Ico.Arrow size={14} />
          </Link>
          <button type="button" className={btn("default", "md")} onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </div>
    </AppShell>
  );
}
