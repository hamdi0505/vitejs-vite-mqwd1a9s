import { useState } from "react";
import { loginAdmin, loginWorker } from "../services/authService";

function Login({ onLogin }) {
  const [role, setRole] = useState("admin"); // "admin" | "worker"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorText("");

    if (!username.trim() || !password.trim()) {
      setErrorText("Bitte Benutzername und Passwort eingeben.");
      return;
    }

    try {
      const result =
        role === "admin"
          ? await loginAdmin(username.trim(), password)
          : await loginWorker(username.trim(), password);

      if (!result.ok) {
        if (result.reason === "NOT_FOUND") {
          setErrorText("Benutzer nicht gefunden.");
          return;
        }
        if (result.reason === "WRONG_PASSWORD") {
          setErrorText("Falsches Passwort.");
          return;
        }
        setErrorText("Login fehlgeschlagen.");
        return;
      }

      if (onLogin) onLogin(result);
    } catch (err) {
      setErrorText("Login fehlgeschlagen (Server/DB).");
      console.error(err);
    }
  }

  return (
    <div style={wrapperStyle}>
      <h2>Login</h2>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={labelStyle}>
          Rolle
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={inputStyle}
          >
            <option value="admin">Admin</option>
            <option value="worker">Mitarbeiter</option>
          </select>
        </label>

        <label style={labelStyle}>
          Benutzername
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            autoComplete="username"
          />
        </label>

        <label style={labelStyle}>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
        </label>

        <button type="submit" style={buttonStyle}>
          Einloggen
        </button>

        {errorText ? <div style={errorStyle}>{errorText}</div> : null}
      </form>
    </div>
  );
}

const wrapperStyle = {
  marginTop: "20px",
  border: "1px solid black",
  padding: "12px"
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginTop: "10px"
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  fontSize: "13px"
};

const inputStyle = {
  padding: "6px",
  fontSize: "14px"
};

const buttonStyle = {
  padding: "6px 10px",
  fontSize: "14px"
};

const errorStyle = {
  marginTop: "4px",
  color: "red",
  fontSize: "13px"
};

export default Login;