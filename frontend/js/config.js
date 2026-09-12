const API_BASE = "/api";

function apiUrl(path) {
    if (!path.startsWith("/")) {
        path = "/" + path;
    }

    return API_BASE + path;
}


// ============================================================
// SIMPLE DEMO SESSION
// No JWT / Authorization header.
// ============================================================

function setSession(userId, role) {
    localStorage.setItem(
        "hackmarket_user_id",
        String(userId)
    );

    localStorage.setItem(
        "hackmarket_role",
        String(role).toUpperCase()
    );
}


function getUserId() {
    return localStorage.getItem(
        "hackmarket_user_id"
    );
}


function getRole() {
    return localStorage.getItem(
        "hackmarket_role"
    );
}


function clearSession() {
    localStorage.removeItem(
        "hackmarket_user_id"
    );

    localStorage.removeItem(
        "hackmarket_role"
    );
}


// ============================================================
// API REQUEST
// ============================================================

async function apiFetch(path, options = {}) {

    return fetch(
        apiUrl(path),
        {
            ...options,
            headers: {
                ...(options.headers || {})
            }
        }
    );

}
