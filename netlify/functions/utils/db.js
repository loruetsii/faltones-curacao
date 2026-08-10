const { createClient } = require('@supabase/supabase-js');

let client = null;

function getDb() {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return client;
}

module.exports = { getDb };
