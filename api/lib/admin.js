// api/lib/admin.js
// Lista emailurilor cu drepturi de administrator. Verificarea se face direct
// pe email (nu pe un flag stocat in Redis), ca sa functioneze indiferent daca
// contul a fost deja creat sau nu la momentul deployului.

const ADMIN_EMAILS = ["sergiuburlea37@gmail.com"];

export function isAdminEmail(email) {
    if (!email) return false;
    return ADMIN_EMAILS.includes(String(email).trim().toLowerCase());
}
