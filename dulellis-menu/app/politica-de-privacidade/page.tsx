import Link from "next/link";
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_VERSION,
} from "@/lib/privacy-policy";

const secoes = [
  {
    titulo: "1. Identificacao da controladora",
    itens: [
      "A presente Politica de Privacidade regula o tratamento de dados pessoais realizado por Dulelis confeitaria, constituinte legal Edinelso Jose Pasa, inscrita no CNPJ sob o n. 43.782.331/0001-33.",
      "Para os fins da Lei Geral de Protecao de Dados Pessoais (Lei n. 13.709/2018 - LGPD), a empresa atua como controladora dos dados pessoais tratados no contexto do cadastro de clientes, autenticacao de conta, realizacao de pedidos, entrega de produtos e atendimento.",
    ],
  },
  {
    titulo: "2. Dados pessoais tratados",
    itens: [
      "Podem ser tratados dados cadastrais e de identificacao, tais como nome, numero de WhatsApp, endereco de e-mail, data de nascimento e demais informacoes fornecidas diretamente pelo titular no momento do cadastro.",
      "Tambem podem ser tratados dados relacionados a entrega e atendimento, incluindo CEP, endereco, numero, bairro, cidade, ponto de referencia e observacoes eventualmente informadas pelo cliente.",
      "No contexto da compra, podem ser tratados dados referentes aos produtos solicitados, valores, forma de pagamento, status do pedido, historico de compras e demais informacoes indispensaveis para a execucao do servico.",
      "Adicionalmente, poderao ser coletados e tratados dados tecnicos e de seguranca, como registros de acesso, endereco IP, identificadores de sessao e informacoes necessarias a prevencao de fraudes, abusos e incidentes de seguranca.",
    ],
  },
  {
    titulo: "3. Finalidades do tratamento",
    itens: [
      "Os dados pessoais sao tratados para possibilitar a criacao e manutencao da conta do cliente, autenticar o acesso a area do usuario e permitir procedimentos de recuperacao de senha, quando solicitados.",
      "As informacoes sao igualmente utilizadas para receber, processar, confirmar e acompanhar pedidos, calcular taxas de entrega, organizar a logistica operacional e prestar suporte ao cliente antes, durante e apos a contratacao.",
      "Os dados poderao ainda ser tratados para cumprimento de obrigacoes legais e regulatorias, exercicio regular de direitos em procedimentos administrativos, arbitrais ou judiciais, bem como para garantir a seguranca da plataforma e prevenir fraudes.",
    ],
  },
  {
    titulo: "4. Bases legais do tratamento",
    itens: [
      "O tratamento dos dados pessoais podera ocorrer, conforme a finalidade aplicavel, com fundamento na execucao de contrato ou de procedimentos preliminares relacionados aos pedidos realizados pelo titular.",
      "Tambem podera ser realizado com base no cumprimento de obrigacao legal ou regulatoria, no exercicio regular de direitos e no legitimo interesse da controladora, sempre observados os principios, limites e garantias previstos na LGPD.",
      "Quando determinada operacao de tratamento depender de consentimento, este sera solicitado de forma livre, informada e inequívoca, podendo ser revogado pelo titular, sem prejuizo da legalidade dos tratamentos anteriormente realizados.",
    ],
  },
  {
    titulo: "5. Compartilhamento com terceiros",
    itens: [
      "Os dados pessoais poderao ser compartilhados com operadores e prestadores de servico estritamente necessarios ao funcionamento da atividade, tais como provedores de hospedagem, banco de dados, servicos de e-mail, processamento de pagamentos, seguranca e suporte tecnologico.",
      "O compartilhamento tambem podera ocorrer quando necessario ao cumprimento de obrigacao legal ou regulatoria, por determinacao de autoridade competente ou para o exercicio regular de direitos da controladora.",
      "A controladora nao realiza a comercializacao de dados pessoais de seus clientes.",
    ],
  },
  {
    titulo: "6. Armazenamento, retencao e seguranca",
    itens: [
      "Os dados pessoais serao armazenados pelo periodo necessario ao cumprimento das finalidades descritas nesta politica, bem como para atendimento de obrigacoes legais, regulatorias, contratuais, de prestacao de contas e defesa de direitos da controladora.",
      "Quando aplicavel, registros de acesso a aplicacoes de internet poderao ser mantidos pelo prazo minimo de 6 (seis) meses, observado o art. 15 da Lei n. 12.965/2014 (Marco Civil da Internet). Documentos e informacoes de natureza fiscal, contábil e comercial poderao ser conservados pelos prazos exigidos na legislacao aplicavel, que em determinadas hipoteses podem alcancar 5 (cinco) anos ou prazo superior, conforme a obrigacao correspondente.",
      "A empresa adota medidas tecnicas e administrativas razoaveis e compativeis com a natureza do tratamento para proteger os dados pessoais contra acessos nao autorizados, destruicao, perda, alteracao, comunicacao ou qualquer forma de tratamento inadequado ou ilicito.",
      "Nao obstante os cuidados empregados, nenhum sistema informatizado esta integralmente imune a riscos, razao pela qual nao e possivel garantir seguranca absoluta contra eventos externos, falhas operacionais ou condutas maliciosas de terceiros.",
    ],
  },
  {
    titulo: "7. Cookies e tecnologias semelhantes",
    itens: [
      "A plataforma pode utilizar cookies e tecnologias semelhantes estritamente necessarios ao seu funcionamento, incluindo autenticacao de sessao, seguranca, manutencao do carrinho, prevencao a fraudes e estabilidade da navegacao.",
      "Caso venham a ser utilizados cookies analiticos, de desempenho, personalizacao ou marketing, esta politica e, se necessario, os mecanismos de consentimento da plataforma poderao ser atualizados para refletir essa utilizacao.",
      "O titular podera, ainda, gerenciar parte dos cookies por meio das configuracoes do navegador, ciente de que a desativacao de cookies essenciais podera comprometer funcionalidades da plataforma.",
    ],
  },
  {
    titulo: "8. Direitos do titular",
    itens: [
      "Nos termos da LGPD e observadas as hipoteses legalmente aplicaveis, o titular podera solicitar a confirmacao da existencia de tratamento, o acesso aos dados, a correcao de dados incompletos, inexatos ou desatualizados, bem como a anonimização, o bloqueio ou a eliminacao de dados desnecessarios, excessivos ou tratados em desconformidade com a legislacao.",
      "O titular tambem podera requerer informacoes sobre compartilhamento, portabilidade quando cabivel, revogacao do consentimento e eliminacao dos dados tratados com base nessa autorizacao, ressalvadas as hipoteses legais de conservacao.",
      "As solicitacoes serao analisadas e respondidas na forma e nos limites previstos na legislacao aplicavel.",
    ],
  },
  {
    titulo: "9. Transferencia internacional de dados",
    itens: [
      "Em razao da utilizacao de determinados fornecedores de tecnologia, hospedagem em nuvem, envio de e-mails, armazenamento, monitoramento, seguranca ou processamento de dados, podera ocorrer transferencia internacional de dados pessoais para servidores localizados fora do Brasil.",
      "Nessas hipoteses, a controladora buscara adotar medidas razoaveis para que a transferencia ocorra em conformidade com a LGPD, inclusive mediante utilizacao de fornecedores que apresentem garantias adequadas de seguranca e protecao de dados.",
    ],
  },
  {
    titulo: "10. Contato e atualizacoes desta politica",
    itens: [
      "Para assuntos relacionados a privacidade, protecao de dados pessoais ou exercicio de direitos do titular, o canal oficial de contato e administracao@dulelisdelivery.com.br.",
      "Esta Politica de Privacidade podera ser alterada a qualquer tempo para refletir atualizacoes legais, regulatorias, operacionais ou tecnicas. A versao vigente permanecera disponivel nesta pagina, com indicacao da respectiva data de vigencia.",
    ],
  },
];

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#ffffff_30%,#fff1f2_100%)] px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-500">
            Politica de Privacidade
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
            Politica de Privacidade
          </h1>
          <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
            Este documento estabelece, de forma transparente, as regras aplicaveis ao tratamento de
            dados pessoais realizado pela Dulelis confeitaria, constituinte legal Edinelso Jose Pasa,
            CNPJ 43.782.331/0001-33, no contexto do cadastro de clientes, autenticacao de conta,
            atendimento e realizacao de pedidos.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black uppercase tracking-widest text-slate-500">
            <span className="rounded-full bg-slate-100 px-4 py-2">Versao {PRIVACY_POLICY_VERSION}</span>
            <span className="rounded-full bg-slate-100 px-4 py-2">Vigencia {PRIVACY_POLICY_EFFECTIVE_DATE}</span>
          </div>
        </div>

        <div className="mt-6 rounded-[2rem] border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-bold leading-6 text-rose-700">
          Controladora dos dados: Dulelis confeitaria, constituinte legal Edinelso Jose Pasa, CNPJ
          43.782.331/0001-33. Contato para assuntos de privacidade e atendimento ao titular:
          administracao@dulelisdelivery.com.br.
        </div>

        <div className="mt-8 space-y-5">
          {secoes.map((secao) => (
            <section key={secao.titulo} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-800">{secao.titulo}</h2>
              <ul className="mt-4 space-y-3 text-sm font-medium leading-7 text-slate-600">
                {secao.itens.map((item) => (
                  <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-2xl bg-pink-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white"
          >
            Voltar para o pedido
          </Link>
        </div>
      </div>
    </main>
  );
}
