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
