import { useEffect, useState } from "react";
import { getWorkers, updateWorker, createWorkerWithAccount } from "../services/supabaseService";
import { hashPassword } from "../services/authService";

function WorkerTable() {
  const [workers, setWorkers] = useState([]);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [editWorkerId, setEditWorkerId] = useState(null);

  useEffect(() => {
    async function loadWorkers() {
      const data = await getWorkers();
      setWorkers(data);
    }
    loadWorkers();
  }, []);

  async function reloadWorkers() {
    const data = await getWorkers();
    setWorkers(data);
  }

  async function handleAddWorker() {
    if (!name.trim()) return;
    if (!username.trim()) return;
    if (!password.trim()) return;

    const pwHash = await hashPassword(password);
    await createWorkerWithAccount(name.trim(), username.trim(), pwHash);

    await reloadWorkers();

    setName("");
    setUsername("");
    setPassword("");
  }

  async function handleSave(worker) {
    await updateWorker(worker.id, {
      name: worker.name,
      monthly_hours: worker.monthly_hours,
      max_hours_per_day: worker.max_hours_per_day
    });

    setEditWorkerId(null);
    await reloadWorkers();
  }

  function handleChange(workerId, field, value) {
    setWorkers((prev) =>
      prev.map((w) =>
        w.id === workerId
          ? {
              ...w,
              [field]:
                field === "name"
                  ? value
                  : Number(value)
            }
          : w
      )
    );
  }

  return (
    <div>
      <h2>Mitarbeiter (Admin)</h2>

      <div style={{ marginBottom: "15px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ fontSize: "14px", padding: "4px" }}
        />

        <input
          placeholder="Benutzername"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ fontSize: "14px", padding: "4px" }}
        />

        <input
          placeholder="Passwort"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ fontSize: "14px", padding: "4px" }}
        />

        <button onClick={handleAddWorker} style={{ fontSize: "13px", padding: "4px 6px" }}>
          Hinzufügen
        </button>
      </div>

      <div style={{ marginBottom: "10px", fontSize: "12px", opacity: 0.8 }}>
        Hinweis: Mitarbeiter werden nicht gelöscht. Deaktivieren/aktivieren und Passwort-Reset machst du im Bereich{" "}
        <b>„Arbeiter-Logins (Admin)“</b>.
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "40%" }}>Name</th>
            <th style={{ ...thStyle, width: "20%" }}>Monat</th>
            <th style={{ ...thStyle, width: "20%" }}>Max/Tag</th>
            <th style={{ ...thStyle, width: "20%" }}>Aktionen</th>
          </tr>
        </thead>

        <tbody>
          {workers.map((worker) => (
            <tr key={worker.id}>
              <td style={nameStyle}>
                {editWorkerId === worker.id ? (
                  <input
                    value={worker.name}
                    onChange={(e) => handleChange(worker.id, "name", e.target.value)}
                    style={{ width: "100%", padding: "4px", fontSize: "14px" }}
                  />
                ) : (
                  worker.name.split(" ").map((part, i) => (
                    <span key={i}>
                      {part}
                      <br />
                    </span>
                  ))
                )}
              </td>

              <td style={tdStyle}>
                {editWorkerId === worker.id ? (
                  <input
                    type="number"
                    value={worker.monthly_hours}
                    onChange={(e) => handleChange(worker.id, "monthly_hours", e.target.value)}
                    style={{ width: "55px", fontSize: "13px" }}
                  />
                ) : (
                  worker.monthly_hours
                )}
              </td>

              <td style={tdStyle}>
                {editWorkerId === worker.id ? (
                  <input
                    type="number"
                    value={worker.max_hours_per_day}
                    onChange={(e) => handleChange(worker.id, "max_hours_per_day", e.target.value)}
                    style={{ width: "55px", fontSize: "13px" }}
                  />
                ) : (
                  worker.max_hours_per_day
                )}
              </td>

              <td style={tdStyle}>
                {editWorkerId === worker.id ? (
                  <button onClick={() => handleSave(worker)} style={buttonStyle}>
                    Speichern
                  </button>
                ) : (
                  <button onClick={() => setEditWorkerId(worker.id)} style={buttonStyle}>
                    Bearbeiten
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}>
        Hinweis: Username ändern + Passwort reset + Aktiv/Inaktiv kommt im Worker-Login Bereich.
      </div>
    </div>
  );
}

const thStyle = {
  border: "1px solid black",
  padding: "4px",
  backgroundColor: "#f0f0f0",
  textAlign: "left",
  fontSize: "11px"
};

const tdStyle = {
  border: "1px solid black",
  padding: "4px",
  fontSize: "13px",
  textAlign: "center"
};

const nameStyle = {
  border: "1px solid black",
  padding: "4px",
  fontSize: "13px",
  whiteSpace: "normal",
  wordBreak: "break-word"
};

const buttonStyle = {
  fontSize: "12px",
  padding: "3px 6px"
};

export default WorkerTable;