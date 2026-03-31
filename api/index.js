import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ─── Armazenamento em Memória (em produção, use banco de dados) ──────────────
const inspectionDatabase = [];
const qrCodeRegistry = {};

// ─── Rota: Health Check ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'HVI API - Heavy Vehicle Inspection',
  });
});

// ─── Rota: Receber dados do QR Code ──────────────────────────────────────────
/**
 * POST /api/qrcode
 * Recebe o ID da máquina capturado via QR Code
 * Body: { machineId: "CAT-320-01" }
 * Response: { success: true, machineId, sessionId, timestamp }
 */
app.post('/api/qrcode', (req, res) => {
  try {
    const { machineId } = req.body;

    // Validação
    if (!machineId || typeof machineId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'machineId é obrigatório e deve ser uma string',
      });
    }

    // Gerar ID de sessão único
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Registrar no banco de dados
    qrCodeRegistry[sessionId] = {
      machineId,
      sessionId,
      timestamp,
      status: 'ACTIVE',
    };

    console.log(`[QR Code Registrado] Machine: ${machineId} | Session: ${sessionId}`);

    res.status(200).json({
      success: true,
      machineId,
      sessionId,
      timestamp,
      message: `Máquina ${machineId} identificada com sucesso. Sessão iniciada.`,
    });
  } catch (error) {
    console.error('Erro ao processar QR Code:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao processar QR Code',
    });
  }
});

// ─── Rota: Enviar dados completos da inspeção ────────────────────────────────
/**
 * POST /api/inspection
 * Recebe o checklist completo da inspeção
 * Body: {
 *   sessionId: "uuid-xxx",
 *   machineId: "CAT-320-01",
 *   operatorName: "João Silva",
 *   checklist: [
 *     { id: "1", label: "Nível de Óleo", status: "CONFORME", obs: "", photo: "base64..." },
 *     ...
 *   ]
 * }
 * Response: { success: true, inspectionId, machineId, timestamp }
 */
app.post('/api/inspection', (req, res) => {
  try {
    const { sessionId, machineId, operatorName, checklist } = req.body;

    // Validação
    if (!sessionId || !machineId || !checklist || !Array.isArray(checklist)) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, machineId e checklist (array) são obrigatórios',
      });
    }

    // Verificar se a sessão existe
    if (!qrCodeRegistry[sessionId]) {
      return res.status(401).json({
        success: false,
        error: 'Sessão inválida ou expirada',
      });
    }

    // Gerar ID único da inspeção
    const inspectionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Contar falhas
    const failureCount = checklist.filter((item) => item.status === 'FALHA').length;
    const overallStatus = failureCount === 0 ? 'APROVADA' : 'RETIDA';

    // Criar registro de inspeção
    const inspectionRecord = {
      inspectionId,
      sessionId,
      machineId,
      operatorName: operatorName || 'Operador Desconhecido',
      timestamp,
      checklist,
      failureCount,
      overallStatus,
      dataUrl: req.get('origin') || 'localhost',
    };

    // Salvar no banco de dados
    inspectionDatabase.push(inspectionRecord);
    qrCodeRegistry[sessionId].status = 'COMPLETED';

    console.log(
      `[Inspeção Registrada] Machine: ${machineId} | ID: ${inspectionId} | Status: ${overallStatus}`
    );

    res.status(201).json({
      success: true,
      inspectionId,
      machineId,
      timestamp,
      overallStatus,
      failureCount,
      message: `Inspeção da máquina ${machineId} registrada com sucesso.`,
    });
  } catch (error) {
    console.error('Erro ao processar inspeção:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor ao processar inspeção',
    });
  }
});

// ─── Rota: Recuperar histórico de inspeções ──────────────────────────────────
/**
 * GET /api/inspections
 * Retorna todas as inspeções registradas (com paginação opcional)
 * Query params: ?limit=10&offset=0
 */
app.get('/api/inspections', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const total = inspectionDatabase.length;
    const paginated = inspectionDatabase.slice(offset, offset + limit);

    res.status(200).json({
      success: true,
      total,
      limit,
      offset,
      data: paginated,
    });
  } catch (error) {
    console.error('Erro ao recuperar inspeções:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// ─── Rota: Recuperar inspeção específica ─────────────────────────────────────
/**
 * GET /api/inspection/:inspectionId
 * Retorna detalhes de uma inspeção específica
 */
app.get('/api/inspection/:inspectionId', (req, res) => {
  try {
    const { inspectionId } = req.params;

    const inspection = inspectionDatabase.find((i) => i.inspectionId === inspectionId);

    if (!inspection) {
      return res.status(404).json({
        success: false,
        error: 'Inspeção não encontrada',
      });
    }

    res.status(200).json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    console.error('Erro ao recuperar inspeção:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// ─── Rota: Recuperar inspeções por máquina ───────────────────────────────────
/**
 * GET /api/machine/:machineId/inspections
 * Retorna todas as inspeções de uma máquina específica
 */
app.get('/api/machine/:machineId/inspections', (req, res) => {
  try {
    const { machineId } = req.params;

    const machineInspections = inspectionDatabase.filter((i) => i.machineId === machineId);

    if (machineInspections.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Nenhuma inspeção encontrada para a máquina ${machineId}`,
      });
    }

    res.status(200).json({
      success: true,
      machineId,
      total: machineInspections.length,
      data: machineInspections,
    });
  } catch (error) {
    console.error('Erro ao recuperar inspeções da máquina:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// ─── Rota: Estatísticas gerais ───────────────────────────────────────────────
/**
 * GET /api/stats
 * Retorna estatísticas gerais das inspeções
 */
app.get('/api/stats', (req, res) => {
  try {
    const total = inspectionDatabase.length;
    const approved = inspectionDatabase.filter((i) => i.overallStatus === 'APROVADA').length;
    const retained = inspectionDatabase.filter((i) => i.overallStatus === 'RETIDA').length;
    const totalFailures = inspectionDatabase.reduce((sum, i) => sum + i.failureCount, 0);

    const failureBreakdown = {};
    inspectionDatabase.forEach((inspection) => {
      inspection.checklist.forEach((item) => {
        if (item.status === 'FALHA') {
          failureBreakdown[item.label] = (failureBreakdown[item.label] || 0) + 1;
        }
      });
    });

    res.status(200).json({
      success: true,
      total,
      approved,
      retained,
      totalFailures,
      failureBreakdown,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
    });
  }
});

// ─── Rota: 404 ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    path: req.path,
  });
});

// ─── Exportar para Vercel ────────────────────────────────────────────────────
export default app;
