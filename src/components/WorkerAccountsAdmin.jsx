import { useEffect, useState } from "react";
import {
  getWorkerAccounts,
  updateWorkerUsername,
  resetWorkerPassword,
  setWorkerAccountActive
} from "../services/supabaseService";
import { hashPassword } from "../services/authService";
import { on, EVENTS } from "../services/eventBus";

function WorkerAccountsAdmin() {
  const [accounts, setAccounts] = useState([]);
  const [usernameEdits, setUsernameEdits] = useState({});
  const [passwordEdits, setPasswordEdits] = useState({});
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getWorkerAccounts();
      setAccounts(data);

      const u = {};
      data.forEach((a) => {
        u[a.worker_id] = a.username || "";
      });
      setUsernameEdits(u);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const unsub = on(EVENTS.DATA_CHANGED, (info) => {
      if (info?.table === "worker_accounts" || info?.table === "workers") load();
    });
    return unsub;
  }, []);

  async function handleSaveUsername(workerId) {
    const newUsername = (usernameEdits[workerId] || "").trim();
    if (!newUsername) return;
    await updateWorkerUsername(workerId, newUsername);
  }

  async function handleResetPassword(workerId) {
    const newPw = (passwordEdits[workerId] || "").trim();
    if (!newPw) return;

    const newHash = await hashPassword(newPw);
    await resetWorkerPassword(workerId, newHash);

    setPasswordEdits((prev) => ({ ...prev, [workerId]: "" }));
  }

  async function handleToggleActive(workerId, currentActive) {
    await setWorkerAccountActive(workerId, !currentActive);
  }

  return (
    <div style={{ marginTop: "25px" }}>
      <h2>Arbeiter-Logins (Admin)</h2>

      <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "10px" }}>
        Hier kannst du Benutzernamen ändern, Passwörter zurücksetzen und Accounts aktiv/inaktiv schalten.
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
        <button onClick={load} style={btnStyle} disabled={loading}>
          {loading ? "Aktualisiere..." : "Logins aktualisieren"}
        </button>

        <div style={{ fontSize: "12px", opacity: 0.8 }}>
          Inaktive Accounts werden rot markiert und können sich nicht einloggen.
        </div>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={thStyle}>Mitarbeiter</th>
            <th style={thStyle}>Benutzername</th>
            <th style={thStyle}>Neues Passwort</th>
            <th style={thStyle}>Aktionen</th>
          </tr>
        </thead>

        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td style={tdStyle} colSpan={4}>
                Keine Worker-Accounts gefunden.
              </td>
            </tr>
          ) : (
            accounts.map((a) => {
              const workerName = a.workers?.name || "(ohne Name)";
              const wid = a.worker_id;
              const active = a.is_active !== false;

              return (
                <tr key={a.id} style={active ? undefined : inactiveRowStyle}>
                  <td style={tdStyle}>{workerName}</td>

                  <td style={tdStyle}>
                    <input
                      value={usernameEdits[wid] ?? ""}
                      onChange={(e) =>
                        setUsernameEdits((prev) => ({
                          ...prev,
                          [wid]: e.target.value
                        }))
                      }
                      style={{ padding: "4px", fontSize: "14px", width: "100%" }}
                    />
                  </td>

                  <td style={tdStyle}>
                    <input
                      type="password"
                      placeholder="Neues Passwort"
                      value={passwordEdits[wid] ?? ""}
                      onChange={(e) =>
                        setPasswordEdits((prev) => ({
                          ...prev,
                          [wid]: e.target.value
                        }))
                      }
                      style={{ padding: "4px", fontSize: "14px", width: "100%" }}
                    />
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <button onClick={() => handleSaveUsername(wid)} style={btnStyle}>
                        Username speichern
                      </button>

                      <button onClick={() => handleResetPassword(wid)} style={btnStyle}>
                        Passwort reset
                      </button>

                      <button
                        onClick={() => handleToggleActive(wid, active)}
                        style={btnStyle}
                      >
                        {active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  border: "1px solid black",
  padding: "6px",
  backgroundColor: "#f0f0f0",
  fontSize: "12px",
  textAlign: "left"
};

const tdStyle = {
  border: "1px solid black",
  padding: "6px",
  fontSize: "13px",
  verticalAlign: "top"
};

const btnStyle = {
  fontSize: "12px",
  padding: "6px 8px"
};

const inactiveRowStyle = {
  backgroundColor: "#ffd6d6"
};

export default WorkerAccountsAdmin;