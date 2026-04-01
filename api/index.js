import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();

// Configurações básicas
app.use(cors());
app.use(express.json());

// Conexão com o Supabase (Usando os nomes que estão na sua Vercel)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Rota de Teste (Health Check)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    database: !!supabaseUrl && !!supabaseKey 
  });
});

// Rota para receber inspeções do App
app.post('/api/inspection', async (req, res) => {
  try {
    const { machine_id, operator_name, checklist, status } = req.body;

    const { data, error } = await supabase
      .from('inspections')
      .insert([{ 
        machine_id, 
        operator_name, 
        checklist_json: checklist, 
        status 
      }]);

    if (error) throw error;

    res.status(201).json({ message: 'Sucesso!', data });
  } catch (err) {
    res.status(500).json({ error: 'Erro no servidor', details: err.message });
  }
});

export default app;
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// conexão com supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// exemplo de endpoint existente
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', database: true });
});
app.get('/api/inspections', async (req, res) => {
  try {
    // Paginação simples: ?page=1&limit=10
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Buscar inspeções no Supabase
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.status(200).json({
      page,
      limit,
      count: data.length,
      inspections: data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar inspeções', details: err.message });
  }
});
app.get('/api/inspections', async (req, res) => {
  try {
    // Paginação simples: ?page=1&limit=10
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Buscar inspeções no Supabase
    const { data, error } = await supabase
      .from('inspections')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.status(200).json({
      page,
      limit,
      count: data.length,
      inspections: data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar inspeções', details: err.message });
  }
});


