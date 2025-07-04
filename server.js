const express = require("express");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");
const fs = require("fs");
const multer = require("multer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

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
const { titulo, preco, cpf } = req.body;

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
      success: `${process.env.BASE_URL}/pagamento-concluido`,
      failure: `${process.env.BASE_URL}/pagamento-falhou`,
      pending: `${process.env.BASE_URL}/verifica-pagamento`,
    },
    notification_url: `${process.env.BASE_URL}/webhook`,
    auto_return: "approved",
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
app.get('/pagamento-concluido', async (req, res) => {
  const { payment_id } = req.query;

  if (!payment_id) {
    return res.status(400).send('ID do pagamento não fornecido.');
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
      }
    });

    const pagamento = await response.json();

    if (pagamento.status === 'approved') {
      // Dados úteis
      const nomeComprador = pagamento.payer?.first_name || 'Cliente';
      const emailComprador = pagamento.payer?.email || 'sem email';

      // Enviar email para o comprador
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_REMETENTE,
          pass: process.env.EMAIL_SENHA,
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_REMETENTE,
        to: emailComprador,
        subject: 'Pagamento Aprovado - Obrigado pela sua compra!',
        html: `
            <h2>Olá, ${nomeComprador}!</h2>
            <p>Recebemos seu pagamento com sucesso! 🎉</p>
            <p>Obrigado por contratar nossos serviços. Em até 10 dias entraremos em contato com mais informações.</p>
            <hr />
            <p>Se tiver dúvidas, basta entrar em contato atráves de ${process.env.EMAIL_DESTINO}.</p>
            <br>
            <img src="cid:imgEmail" alt="Avensi" title="Avensi" style="height: auto;">
          `,
      });

      console.log(`Pagamento confirmado e email enviado para ${emailComprador}`);
      res.sendFile(path.join(__dirname, 'public', 'pagamento-concluido.html'));
    } else {
      return res.redirect('/aguardando.html');
    }


  } catch (err) {
    console.error('Erro ao verificar pagamento:', err);
    res.status(500).send('Erro interno ao verificar pagamento.');
  }
});

// Cache em memória para guardar os payments aprovados
const pagamentosAprovados = new Map();

// Webhook para notificações do Mercado Pago
app.post('/webhook', express.json(), async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const paymentId = data.id;

    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
        }
      });

      const pagamento = await response.json();

    if (pagamento.status === "approved") {
      const cpf = pagamento.external_reference;
      pagamentosAprovados.set(cpf, true);
      console.log(`Pagamento aprovado via webhook | CPF: ${cpf}`);
    }
      res.sendStatus(200);
    } catch (error) {
      console.error('Erro ao consultar pagamento no webhook:', error);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(200); // Ignora outros tipos de notificação
  }
});

app.get('/verifica-pagamento', (req, res) => {
  const { payment_id } = req.query;

  if (!payment_id) {
    return res.status(400).send('ID do pagamento não fornecido.');
  }

  if (pagamentosAprovados.has(payment_id)) {
    // Redireciona para o formulário final
    return res.redirect('/pagamento-concluido.html');
  } else {
    // Redireciona para uma página avisando que o pagamento ainda não foi aprovado
    return res.redirect('/aguardando.html');
  }
});

app.get("/pagamento-pendente", (req, res) => {
  res.sendFile(__dirname + "/public/aguardando.html");
});

app.get("/pagamento-falhou", (req, res) => {
  res.sendFile(__dirname + "/public/pagamento-falhou.html");
});

app.get("/contrato", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "contract.html"));
});

app.post("/gerar-pdf", async (req, res) => {
  const {
    nome,
    cpf,
    rg,
    endereco,
    planoEscolhido,
    valorPago,
    formaPagamento
  } = req.body;
  console.log(req.body);
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="icon" type="image/x-icon" href="/images/favicon.ico">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
      rel="stylesheet">
      <title>Contrato - Controle Financeiro 360</title>
      <style>
        body { font-family: Roboto, sans-serif; padding: 30px; }
        h2 { text-align: center; }
      </style>
    </head>
    <body>
      <h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PLANEJAMENTO FINANCEIRO</h2>
      <p>Pelo presente instrumento particular, as partes:</p>
      <p><strong>CONTRATANTE:</strong> ${nome}, portador do CPF nº ${cpf} e RG nº ${rg}, residente e domiciliado à ${endereco};</p>
      <p><strong>CONTRATADO</strong> AVENSI, CNPJ 60.849.761/0001-44, com sede à Rua Sergio Antunes de Andrade, 363 – Sala 2 – Jardim das Oliveiras – CEP 08122-110, São Paulo - SP;</p>
      <p>Têm entre si, justo e contratado, o seguinte:</p>
      <h3>CLÁUSULA 1 – OBJETO</h3>
      <p>1.1 O presente contrato tem por objeto a prestação de serviços de planejamento financeiro pessoal, conforme plano ${planoEscolhido}, elaborado com base nas informações fornecidas pelo CONTRATANTE.</p>
      <h3>CLÁUSULA 2 – DAS OBRIGAÇÕES DO CONTRATADO</h3>
      <p>2.1 Prestar os serviços contratados com zelo, diligência e profissionalismo, dentro dos padrões técnicos adequados.</p>
      <p>2.2 Disponibilizar ao CONTRATANTE, em meio digital, o relatório de planejamento financeiro personalizado, <strong>após o recebimento integral das informações solicitadas</strong> por meio de formulário eletrônico fornecido pela CONTRATADO.</p>
      <p>2.3 Manter sigilo absoluto sobre todas as informações fornecidas pelo CONTRATANTE.</p>
      <h3>CLÁUSULA 3 – DAS OBRIGAÇÕES DO CONTRATANTE</h3>
      <p>3.1 Fornecer, de forma completa e fidedigna, todas as informações solicitadas pelo CONTRATADO, necessárias para a elaboração do relatório.</p>
      <p>3.2 Reconhecer que a não entrega, entrega incompleta ou envio com erros de informações solicitadas poderá impactar no prazo, qualidade ou mesmo inviabilizar a entrega do relatório final.</p>
      <h3>CLÁUSULA 4 – DA REMUNERAÇÃO</h3>
      <p>4.1 Pelos serviços contratados, o CONTRATANTE pagou ao CONTRATADO o valor de R$ ${valorPago}, via ${formaPagamento}, no ato da contratação.</p>
      <p>4.2 O pagamento não será reembolsável, salvo em caso de não prestação do serviço por parte do CONTRATADO, desde que o CONTRATANTE tenha cumprido todas as suas obrigações.</p>
      <h3>CLÁUSULA 5 – PRAZO DE ENTREGA</h3>
      <p>5.1 O prazo para entrega do relatório será de até 10 dias, contados <strong>a partir da data de recebimento completo</strong> das informações solicitadas ao CONTRATANTE.</p>
      <h3>CLÁUSULA 6 – DA RESPONSABILIDADE</h3>
      <p>6.1 O CONTRATADO não se responsabiliza por decisões financeiras tomadas pelo CONTRATANTE com base no relatório entregue.</p>
      <p>6.2 O serviço prestado tem caráter consultivo e informativo, não se caracterizando como garantia de resultados futuros.</p>
      <h3>CLÁUSULA 7 – DA RESCISÃO E VIGÊNCIA</h3>
      <p>7.1 Este contrato poderá ser rescindido dentro prazo de 7 dias corridos após a confirmação de pagamento, mediante notificação por escrito no e-mail suporte@controlefinanceiro360.com.br </p>
      <p>7.2 O presente contrato terá vigência do plano escolhido após a confirmação de pagamento.</p>
      <h3>CLÁUSULA 8 – DO FORO</h3>
      <p>8.1 Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da Comarca de São Paulo - SP com renúncia a qualquer outro, por mais privilegiado que seja.</p>
      <p>E por estarem assim justos e contratados, firmam o presente instrumento em meio digital.</p>
      <p>Local:</p>
      <p>Data:</p>
      <h3>CONTRATANTE:</h3>
      <p>Assinatura: </p>
      <p>Nome completo:</p>
      <h3>CONTRATADO:</h3>
      <p>Assinatura: AVENSI</p>
      <p>CNPJ/CPF: 60.849.761/0001-44</p>
    </body>
    </html>
  `;

  try {
    const browser = await puppeteer.launch({ headless: "new" });
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

app.post('/api/finalizar', upload.single('contrato'), async (req, res) => {
  const { nome, email, telefone, idade, renda, despesas, dividas, objetivos } = req.body;
  const contratoPath = req.file.path;

  const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
      user: process.env.EMAIL_REMETENTE,
      pass: process.env.EMAIL_SENHA, 
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_REMETENTE,
    to: process.env.EMAIL_DESTINO,
    subject: 'Novo envio de contrato assinado',
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
        path: contratoPath
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    fs.unlinkSync(contratoPath);
    res.sendFile(__dirname + "/public/finalizado.html");
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    res.status(500).send('Erro ao enviar o email.');
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
