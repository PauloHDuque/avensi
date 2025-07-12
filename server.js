const express = require("express");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const multer = require("multer");
require("dotenv").config();
const gerarHtmlContrato = require("./js/gerarHtml.js"); // Importa a função de geração de HTML

const app = express();
const PORT = process.env.PORT || 3000;

const resultadosProcessados = new Map();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/images", express.static(path.join(__dirname, "images")));

app.get("/api", (req, res) => {
  res.send(`Api funcionando! na porta ${PORT}`);
});

// Endpoint para criar pagamento
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

app.post("/criar-preferencia", async (req, res) => {
  const {
    titulo,
    preco,
    cpf,
    nome,
    rg,
    endereco,
    planoEscolhido,
    formaPagamento,
    email,
    cidade,
  } = req.body;

  console.log("Dados recebidos para criar preferência:", {
    titulo,
    preco,
    cpf,
    nome,
    rg,
    endereco,
    planoEscolhido,
    formaPagamento,
    email,
    cidade,
  });

  const preferenceData = {
    items: [
      {
        title: titulo,
        unit_price: preco / 100, // Preço em reais
        description: "Relatório de Planejamento Financeiro",
        currency_id: "BRL",
        quantity: 1,
      },
    ],
    external_reference: cpf,
    back_urls: {
      success: `${process.env.BASE_URL}/aguardando.html`,
      failure: `${process.env.BASE_URL}/pagamento-falhou.html`,
      pending: `${process.env.BASE_URL}/pagamento-pendente.html`,
    },
    notification_url: `${process.env.BASE_URL}/webhook`,
    auto_return: "approved",
    metadata: {
      nome,
      rg,
      endereco,
      planoEscolhido,
      valorPago: preco,
      formaPagamento,
      email,
      cidade,
    },
  };

  try {
    const preference = new Preference(client);
    const response = await preference.create({ body: preferenceData });
    res.json({ init_point: response.init_point });
  } catch (error) {
    console.error("Erro ao criar preferência:", error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// Endpoint chamado após pagamento aprovado
app.get("/pagamento-concluido", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pagamento-concluido.html"));
});

// Cache em memória para guardar os payments aprovados
const pagamentosAprovados = new Map();

// Webhook para notificações do Mercado Pago
app.post("/webhook", express.json(), async (req, res) => {
  const { type, data } = req.body;

  if (type === "payment") {
    const paymentId = data.id;

    try {
      // Evita reprocessamento
      if (resultadosProcessados.has(paymentId.toString())) {
        return res.sendStatus(200);
      }

      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        }
      );
      const pagamento = await response.json();

      if (pagamento.status === "approved") {
        console.log(
          `[WEBHOOK] Pagamento ${paymentId} aprovado. Iniciando processamento...`
        );

        if (!pagamento.metadata) {
          console.error(
            `[WEBHOOK] ERRO CRÍTICO: Metadata não encontrado no pagamento ${paymentId}`
          );
          return res.sendStatus(200); // Responde OK para não receber de novo.
        }

        const dados = {
          cpf: pagamento.external_reference,
          nome: pagamento.metadata.nome,
          rg: pagamento.metadata.rg,
          endereco: pagamento.metadata.endereco,
          planoEscolhido: pagamento.metadata.planoEscolhido,
          valorPago: pagamento.metadata.valorPago,
          formaPagamento: pagamento.metadata.formaPagamento,
          email: pagamento.metadata.email,
          cidade: pagamento.metadata.cidade,
        };

        // 1. Gerar PDF
        const htmlContent = gerarHtmlContrato(dados);
        const browser = await puppeteer.launch({
          headless: "new",
          executablePath: "/usr/bin/google-chrome-stable",
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
          ],
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
        });
        await browser.close();
        console.log(`[WEBHOOK] PDF para ${paymentId} gerado.`);

        // 2. Enviar Email
        const linksFormularios = {
          start360: "https://forms.gle/FORM_START",
          essencial360: "https://forms.gle/FORM_ESSENCIAL",
          prime360: "https://forms.gle/FORM_PRIME",
        };
        const linkFormulario =
          linksFormularios[
            Object.keys(linksFormularios).find((key) =>
              dados.planoEscolhido.toLowerCase().includes(key)
            )
          ] || "https://controlefinanceiro360.com.br";

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_REMETENTE,
            pass: process.env.EMAIL_SENHA,
          },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_REMETENTE,
          to: dados.email,
          subject: "Seu contrato foi gerado com sucesso!",
          html: `<h2>Olá, ${dados.nome}!</h2><p>Recebemos seu pagamento e seu contrato foi gerado com sucesso.</p><p>Faça o preenchimento do formulário final por meio do link abaixo:</p><p><a href="${linkFormulario}" target="_blank">Clique aqui para preencher o formulário</a></p><p>Em até 10 dias nossa equipe entrará em contato com seu diagnóstico.</p><hr /><p>Qualquer dúvida, envie um email para suporte@controlefinanceiro360.com.br.</p>`,
          attachments: [{ filename: "contrato.pdf", content: pdfBuffer }],
        });
        console.log(`[WEBHOOK] E-mail para ${dados.email} enviado.`);

        // 3. Marcar como processado
        resultadosProcessados.set(paymentId.toString(), { success: true });
      }
      res.sendStatus(200);
    } catch (error) {
      console.error(
        `[WEBHOOK] Erro ao processar pagamento ${paymentId}:`,
        error
      );
      res.sendStatus(500); // Envia erro para o MP tentar de novo, se for o caso.
    }
  } else {
    res.sendStatus(200);
  }
});

// NOVA ROTA: Para o front-end verificar se o webhook já terminou o trabalho
app.get("/verifica-processamento", (req, res) => {
  const { payment_id } = req.query;
  if (!payment_id) {
    return res.status(400).json({ erro: "ID do pagamento não fornecido." });
  }

  if (resultadosProcessados.has(payment_id)) {
    res.json({ processado: true });
  } else {
    res.json({ processado: false });
  }
});

app.get("/verifica-pagamento", (req, res) => {
  const { payment_id } = req.query;

  if (!payment_id) {
    return res.status(400).json({ erro: "ID do pagamento não fornecido." });
  }

  if (pagamentosAprovados.has(payment_id)) {
    return res.json({ aprovado: true });
  } else {
    return res.json({ aprovado: false });
  }
});

app.get("/pagamento-pendente", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "aguardando.html"));
});

app.get("/pagamento-falhou", (req, res) => {
  res.sendFile(__dirname + "/public/pagamento-falhou.html");
});

app.get("/contrato", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "contract.html"));
});

app.post("/gerar-pdf", async (req, res) => {
  const dados = req.body;
  console.log("Dados recebidos:", dados);

  // Validação do plano
  const planosValidos = ["Start 360", "Essencial 360", "Prime 360"];
  if (!planosValidos.includes(dados.planoEscolhido)) {
    return res.status(400).send("Plano inválido.");
  }

  try {
    const htmlContent = gerarHtmlContrato(dados);

    const browser = await puppeteer.launch({
      headless: "new",
      // Caminho para o executável do Chrome que instalamos
      executablePath: "/usr/bin/google-chrome-stable",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=contrato.pdf",
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    res.status(500).send("Erro ao gerar contrato");
  }
});

// Pasta onde os arquivos ficarão salvos
const uploadFolder = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Configurando o multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

app.post("/api/finalizar", upload.single("contrato"), async (req, res) => {
  const { nome, email, telefone, idade, renda, despesas, dividas, objetivos } =
    req.body;
  const contratoPath = req.file.path;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_REMETENTE,
      pass: process.env.EMAIL_SENHA,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_REMETENTE,
    to: process.env.EMAIL_DESTINO,
    subject: "Novo envio de contrato assinado",
    html: `
      <h3>Informações do usuário:</h3>
      <p><strong>Nome:</strong> ${nome}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Telefone:</strong> ${telefone}</p>
      <p><strong>Idade:</strong> ${idade}</p>
      <p><strong>Renda:</strong> R$${renda}</p>
      <p><strong>Despesas:</strong> R$${despesas}</p>
      <p><strong>Possui Dívidas?:</strong> ${dividas}</p>
      <p><strong>Objetivos:</strong> ${objetivos}</p>
      <br>`,
    attachments: [
      {
        filename: req.file.originalname,
        path: contratoPath,
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    fs.unlinkSync(contratoPath);
    res.sendFile(__dirname + "/public/finalizado.html");
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    res.status(500).send("Erro ao enviar o email.");
  }
});

let contratosSalvos = {};

app.post("/upload-contrato", upload.single("contratoAssinado"), (req, res) => {
  const { email } = req.body;
  if (!req.file || !email)
    return res.status(400).send("Arquivo ou email ausente.");

  contratosSalvos[email] = req.file.path;
  console.log(`📎 Contrato salvo para ${email}: ${req.file.path}`);
  res.status(200).send("Contrato enviado com sucesso!");
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
