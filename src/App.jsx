import { useEffect, useState } from "react";
import { testConnection } from "./services/supabaseService";

import Login from "./components/Login";

import WorkerTable from "./components/WorkerTable";
import WorkerAccountsAdmin from "./components/WorkerAccountsAdmin";
import MonthSelector from "./components/MonthSelector";
import ClosedDaysTable from "./components/ClosedDaysTable";
import SickDaysManager from "./components/SickDaysManager";
import ScheduleArchive from "./components/ScheduleArchive";
import PlanGenerator from "./components/PlanGenerator";
import OpeningHoursSettings from "./components/OpeningHoursSettings";
import ShiftSettings from "./components/ShiftSettings";

function App() {
  const [selected, setSelected] = useState(null);
  const [authState, setAuthState] = useState(null);
  const [page, setPage] = useState("edit");

  useEffect(() => {
    async function checkConnection() {
      try {
        const data = await testConnection();
        console.log("Supabase connected:", data);
      } catch (err) {
        console.error("Connection failed");
      }
    }

    checkConnection();
  }, []);

  function handleLogin(result) {
    setAuthState(result);
    setSelected(null);

    if (result.role === "admin") setPage("edit");
    else setPage("sick");
  }

  function logout() {
    setAuthState(null);
    setSelected(null);
    setPage("edit");
  }

  if (!authState) {
    return (
      <>
        <h1>Planner App</h1>
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <div style={topBarStyle}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {authState.role === "admin" ? (
            <>
              <button
                style={page === "plan" ? activeBtnStyle : btnStyle}
                onClick={() => setPage("plan")}
              >
                Plan erstellen
              </button>

              <button
                style={page === "edit" ? activeBtnStyle : btnStyle}
                onClick={() => setPage("edit")}
              >
                Bearbeiten (Admin)
              </button>

              <button
                style={page === "archive" ? activeBtnStyle : btnStyle}
                onClick={() => setPage("archive")}
              >
                Pläne (Archiv)
              </button>
            </>
          ) : (
            <>
              <button
                style={page === "sick" ? activeBtnStyle : btnStyle}
                onClick={() => setPage("sick")}
              >
                Kranktage
              </button>

              <button
                style={page === "archive" ? activeBtnStyle : btnStyle}
                onClick={() => setPage("archive")}
              >
                Pläne (Archiv)
              </button>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ fontSize: "12px", opacity: 0.85 }}>
            Eingeloggt als: <b>{authState.username}</b> ({authState.role})
          </div>
          <button style={btnStyle} onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <h1>Planner App</h1>

      {/* ADMIN PAGES */}
      {authState.role === "admin" && page === "plan" ? <PlanGenerator /> : null}

      {authState.role === "admin" && page === "edit" ? (
        <>
          <details style={detailsStyle}>
            <summary style={summaryStyle}>
              <span style={arrowStyle} className="arrow">
                ►
              </span>
              Mitarbeiter + Worker Login
            </summary>
            <div style={detailsContentStyle}>
              <WorkerTable />
              <WorkerAccountsAdmin />
            </div>
          </details>

          <details style={detailsStyle}>
            <summary style={summaryStyle}>
              <span style={arrowStyle} className="arrow">
                ►
              </span>
              Monat auswählen + Geschlossene Tage + Öffnungszeiten + Schichten
            </summary>
            <div style={detailsContentStyle}>
              <MonthSelector onChange={setSelected} />

              {selected ? (
                <>
                  <OpeningHoursSettings />
                  <ClosedDaysTable year={selected.year} month={selected.month} />
                  <ShiftSettings />
                </>
              ) : (
                <div style={{ marginTop: "10px", fontSize: "13px", opacity: 0.8 }}>
                  Bitte zuerst einen Monat auswählen, dann erscheinen die Monats-Tools.
                </div>
              )}
            </div>
          </details>

          <details style={detailsStyle}>
            <summary style={summaryStyle}>
              <span style={arrowStyle} className="arrow">
                ►
              </span>
              Kranktage
            </summary>
            <div style={detailsContentStyle}>
              {selected ? (
                <SickDaysManager year={selected.year} month={selected.month} />
              ) : (
                <div style={{ fontSize: "13px", opacity: 0.8 }}>
                  Bitte zuerst oben einen Monat auswählen.
                </div>
              )}
            </div>
          </details>
        </>
      ) : null}

      {authState.role === "admin" && page === "archive" ? (
        <ScheduleArchive mode="admin" currentUsername={authState.username} />
      ) : null}

      {/* WORKER PAGES */}
      {authState.role === "worker" && page === "sick" ? (
        <>
          <details style={detailsStyle}>
            <summary style={summaryStyle}>
              <span style={arrowStyle} className="arrow">
                ►
              </span>
              Monat auswählen
            </summary>
            <div style={detailsContentStyle}>
              <MonthSelector onChange={setSelected} />
            </div>
          </details>

          {selected ? (
            <details style={detailsStyle}>
              <summary style={summaryStyle}>
                <span style={arrowStyle} className="arrow">
                  ►
                </span>
                Meine Kranktage
              </summary>
              <div style={detailsContentStyle}>
                <SickDaysManager
                  year={selected.year}
                  month={selected.month}
                  workerId={authState.workerId}
                />
              </div>
            </details>
          ) : null}
        </>
      ) : null}

      {authState.role === "worker" && page === "archive" ? (
        <ScheduleArchive
          mode="worker"
          workerId={authState.workerId}
          currentUsername={authState.username}
        />
      ) : null}

      {/* Inline CSS nur für Pfeil-Umschalten */}
      <style>{`
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
        details[open] .arrow { transform: rotate(90deg); }
      `}</style>
    </>
  );
}

const topBarStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  alignItems: "center",
  border: "1px solid black",
  padding: "8px",
  marginBottom: "10px"
};

const btnStyle = {
  fontSize: "12px",
  padding: "6px 8px"
};

const activeBtnStyle = {
  ...btnStyle,
  fontWeight: 700
};

const detailsStyle = {
  marginTop: "14px",
  border: "1px solid black",
  padding: "8px"
};

const summaryStyle = {
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px"
};

const arrowStyle = {
  display: "inline-block",
  transition: "transform 120ms ease",
  width: "14px"
};

const detailsContentStyle = {
  marginTop: "10px"
};

export default App;