const SUPABASE_URL = 'https://gnwxtzumqrwbjhgrlapz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdud3h0enVtcXJ3YmpoZ3JsYXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDQzOTEsImV4cCI6MjA4ODQ4MDM5MX0.f-1IXh0IuF2huHP9TR7rg-FUqeJAidriw1JmKURO28M';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase };
