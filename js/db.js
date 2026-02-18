// ═══════════════════════════════════════════════════════════════
// db.js — All Supabase read/write operations
// Uses `db` client from config.js
// ═══════════════════════════════════════════════════════════════

const DB = {

  async getAll() {
    try {
      const { data, error } = await db
        .from('scored_leads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[DB] getAll error:', error.message);
        return {};
      }
      return data.reduce((acc, row) => {
        acc[row.lead_id] = row;
        return acc;
      }, {});
    } catch (e) {
      console.error('[DB] getAll exception:', e);
      return {};
    }
  },

  async save({ leadId, leadName, leadCity, leadAlloc, scores, flags, notes, total, flagCount, status }) {
    try {
      const { data, error } = await db
        .from('scored_leads')
        .upsert({
          lead_id:    leadId,
          lead_name:  leadName,
          lead_city:  leadCity,
          lead_alloc: leadAlloc,
          scores,
          flags,
          notes,
          total,
          flag_count: flagCount,
          status,
          updated_at: new Date().toISOString()
        }, { onConflict: 'lead_id' })
        .select()
        .single();

      if (error) {
        console.error('[DB] save error:', error.message);
        return { success: false, error };
      }
      return { success: true, data };
    } catch (e) {
      console.error('[DB] save exception:', e);
      return { success: false, error: e };
    }
  },

  async remove(leadId) {
    try {
      const { error } = await db
        .from('scored_leads')
        .delete()
        .eq('lead_id', leadId);
      if (error) { console.error('[DB] remove error:', error.message); return false; }
      return true;
    } catch (e) {
      console.error('[DB] remove exception:', e);
      return false;
    }
  }
};