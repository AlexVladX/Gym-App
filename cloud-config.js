// Configurația contului în cloud (Supabase). Ambele valori sunt PUBLICE prin natura lor: adresa proiectului
// și cheia „publishable” (sb_publishable_…) sunt făcute să stea în aplicație; datele sunt protejate de regulile
// din baza de date (supabase/schema.sql), care lasă fiecare cont să-și vadă doar datele lui.
// NU pune aici cheia secretă (sb_secret_… sau service_role).
// Cât timp valorile sunt goale, aplicația merge exact ca înainte, doar pe dispozitiv.
const CONFIG_CLOUD = {
  url: 'https://ibxqtjxlhywkvejbizqk.supabase.co', // doar adresa proiectului, fără /rest/v1
  cheiePublica: 'sb_publishable_RhGCWrUXtjCOQ5F1fosihQ_pUpC66Z-',
};
