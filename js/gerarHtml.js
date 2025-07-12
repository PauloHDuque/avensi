function gerarHtmlContrato(dados) {
  console.log("cheguei em gerarHtmlContrato com: ", dados);
  try {
    const {
      nome,
      cpf,
      rg,
      endereco,
      planoEscolhido,
      valorPago,
      formaPagamento,
      cidade,
    } = dados;

    const valorPagoContrato = (valorPago / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    let vigencia = "";
    switch (planoEscolhido) {
      case "Start 360":
        vigencia = "30 dias";
        break;
      case "Essencial 360":
        vigencia = "3 meses";
        break;
      case "Prime 360":
        vigencia = "12 meses";
        break;
      default:
        vigencia = "30 dias";
    }

    const dataHoje = new Date().toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const html = `
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
      <p>4.1 Pelos serviços contratados, o CONTRATANTE pagou ao CONTRATADO o valor de ${valorPagoContrato}, via ${formaPagamento}, no ato da contratação.</p>
      <p>4.2 O pagamento não será reembolsável, salvo em caso de não prestação do serviço por parte do CONTRATADO, desde que o CONTRATANTE tenha cumprido todas as suas obrigações.</p>
      <h3>CLÁUSULA 5 – PRAZO DE ENTREGA</h3>
      <p>5.1 O prazo para entrega do relatório será de até 10 dias, contados <strong>a partir da data de recebimento completo</strong> das informações solicitadas ao CONTRATANTE.</p>
      <h3>CLÁUSULA 6 – DA RESPONSABILIDADE</h3>
      <p>6.1 O CONTRATADO não se responsabiliza por decisões financeiras tomadas pelo CONTRATANTE com base no relatório entregue.</p>
      <p>6.2 O serviço prestado tem caráter consultivo e informativo, não se caracterizando como garantia de resultados futuros.</p>
      <h3>CLÁUSULA 7 – DA RESCISÃO E VIGÊNCIA</h3>
      <p>7.1 Este contrato poderá ser rescindido dentro prazo de 7 dias corridos após a confirmação de pagamento, mediante notificação por escrito no e-mail suporte@controlefinanceiro360.com.br </p>
      <p>7.2 O presente contrato terá vigência de ${vigencia} após a confirmação de pagamento.</p>
      <h3>CLÁUSULA 8 – DO FORO</h3>
      <p>8.1 Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da Comarca de São Paulo - SP com renúncia a qualquer outro, por mais privilegiado que seja.</p>
      <p>E por estarem assim justos e contratados, firmam o presente instrumento em meio digital.</p>
      <p>Local: ${cidade}</p>
      <p>Data: ${dataHoje}</p>
      <h3>CONTRATANTE:</h3>
      <p>Eu ${nome}, confirmo que li, compreendi e aceito os termos estabelecidos neste contrato. </p>
      <p>Nome completo:</p>
      <h3>CONTRATADO:</h3>
      <p>Assinatura: AVENSI</p>
      <p>CNPJ/CPF: 60.849.761/0001-44</p>
    </body>
    </html>
  `;
    console.log("HTML gerado com sucesso");
    return html;
  } catch (error) {
    console.error("Erro ao gerar HTML do contrato:", error);
    throw new Error("Erro ao gerar HTML do contrato");
  }
}

module.exports = gerarHtmlContrato;
