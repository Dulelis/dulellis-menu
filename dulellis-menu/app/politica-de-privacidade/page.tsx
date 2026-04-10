import Link from "next/link";
import {
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_VERSION,
} from "@/lib/privacy-policy";

const secoes = [
  {
    titulo: "1. Identificação da controladora",
    itens: [
      "A presente Política de Privacidade regula o tratamento de dados pessoais realizado por Dulelis confeitaria, constituinte legal Edinelso Jose Pasa, inscrita no CNPJ sob o n. 43.782.331/0001-33.",
      "Para os fins da Lei Geral de Proteção de Dados Pessoais (Lei n. 13.709/2018 - LGPD), a empresa atua como controladora dos dados pessoais tratados no contexto do cadastro de clientes, autenticação de conta, realização de pedidos, entrega de produtos e atendimento.",
    ],
  },
  {
    titulo: "2. Dados pessoais tratados",
    itens: [
      "Podem ser tratados dados cadastrais e de identificação, tais como nome, número de WhatsApp, endereço de e-mail, data de nascimento e demais informações fornecidas diretamente pelo titular no momento do cadastro.",
      "Também podem ser tratados dados relacionados à entrega e ao atendimento, incluindo CEP, endereço, número, bairro, cidade, ponto de referência e observações eventualmente informadas pelo cliente.",
      "No contexto da compra, podem ser tratados dados referentes aos produtos solicitados, valores, forma de pagamento, status do pedido, histórico de compras e demais informações indispensáveis para a execução do serviço.",
      "Adicionalmente, poderão ser coletados e tratados dados técnicos e de segurança, como registros de acesso, endereço IP, identificadores de sessão e informações necessárias à prevenção de fraudes, abusos e incidentes de segurança.",
    ],
  },
  {
    titulo: "3. Finalidades do tratamento",
    itens: [
      "Os dados pessoais são tratados para possibilitar a criação e manutenção da conta do cliente, autenticar o acesso à área do usuário e permitir procedimentos de recuperação de senha, quando solicitados.",
      "As informações são igualmente utilizadas para receber, processar, confirmar e acompanhar pedidos, calcular taxas de entrega, organizar a logística operacional e prestar suporte ao cliente antes, durante e após a contratação.",
      "Os dados poderão ainda ser tratados para cumprimento de obrigações legais e regulatórias, exercício regular de direitos em procedimentos administrativos, arbitrais ou judiciais, bem como para garantir a segurança da plataforma e prevenir fraudes.",
    ],
  },
  {
    titulo: "4. Bases legais do tratamento",
    itens: [
      "O tratamento dos dados pessoais poderá ocorrer, conforme a finalidade aplicável, com fundamento na execução de contrato ou de procedimentos preliminares relacionados aos pedidos realizados pelo titular.",
      "Também poderá ser realizado com base no cumprimento de obrigação legal ou regulatória, no exercício regular de direitos e no legítimo interesse da controladora, sempre observados os princípios, limites e garantias previstos na LGPD.",
      "Quando determinada operação de tratamento depender de consentimento, este será solicitado de forma livre, informada e inequívoca, podendo ser revogado pelo titular, sem prejuízo da legalidade dos tratamentos anteriormente realizados.",
    ],
  },
  {
    titulo: "5. Compartilhamento com terceiros",
    itens: [
      "Os dados pessoais poderão ser compartilhados com operadores e prestadores de serviço estritamente necessários ao funcionamento da atividade, tais como provedores de hospedagem, banco de dados, serviços de e-mail, processamento de pagamentos, segurança e suporte tecnológico.",
      "O compartilhamento também poderá ocorrer quando necessário ao cumprimento de obrigação legal ou regulatória, por determinação de autoridade competente ou para o exercício regular de direitos da controladora.",
      "A controladora não realiza a comercialização de dados pessoais de seus clientes.",
    ],
  },
  {
    titulo: "6. Armazenamento, retenção e segurança",
    itens: [
      "Os dados pessoais serão armazenados pelo período necessário ao cumprimento das finalidades descritas nesta política, bem como para atendimento de obrigações legais, regulatórias, contratuais, de prestação de contas e defesa de direitos da controladora.",
      "Quando aplicável, registros de acesso a aplicações de internet poderão ser mantidos pelo prazo mínimo de 6 (seis) meses, observado o art. 15 da Lei n. 12.965/2014 (Marco Civil da Internet). Documentos e informações de natureza fiscal, contábil e comercial poderão ser conservados pelos prazos exigidos na legislação aplicável, que em determinadas hipóteses podem alcançar 5 (cinco) anos ou prazo superior, conforme a obrigação correspondente.",
      "A empresa adota medidas técnicas e administrativas razoáveis e compatíveis com a natureza do tratamento para proteger os dados pessoais contra acessos não autorizados, destruição, perda, alteração, comunicação ou qualquer forma de tratamento inadequado ou ilícito.",
      "Não obstante os cuidados empregados, nenhum sistema informatizado está integralmente imune a riscos, razão pela qual não é possível garantir segurança absoluta contra eventos externos, falhas operacionais ou condutas maliciosas de terceiros.",
    ],
  },
  {
    titulo: "7. Cookies e tecnologias semelhantes",
    itens: [
      "A plataforma pode utilizar cookies e tecnologias semelhantes estritamente necessários ao seu funcionamento, incluindo autenticação de sessão, segurança, manutenção do carrinho, prevenção a fraudes e estabilidade da navegação.",
      "Caso venham a ser utilizados cookies analíticos, de desempenho, personalização ou marketing, esta política e, se necessário, os mecanismos de consentimento da plataforma poderão ser atualizados para refletir essa utilização.",
      "O titular poderá, ainda, gerenciar parte dos cookies por meio das configurações do navegador, ciente de que a desativação de cookies essenciais poderá comprometer funcionalidades da plataforma.",
    ],
  },
  {
    titulo: "8. Direitos do titular",
    itens: [
      "Nos termos da LGPD e observadas as hipóteses legalmente aplicáveis, o titular poderá solicitar a confirmação da existência de tratamento, o acesso aos dados, a correção de dados incompletos, inexatos ou desatualizados, bem como a anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a legislação.",
      "O titular também poderá requerer informações sobre compartilhamento, portabilidade quando cabível, revogação do consentimento e eliminação dos dados tratados com base nessa autorização, ressalvadas as hipóteses legais de conservação.",
      "As solicitações serão analisadas e respondidas na forma e nos limites previstos na legislação aplicável.",
    ],
  },
  {
    titulo: "9. Transferência internacional de dados",
    itens: [
      "Em razão da utilização de determinados fornecedores de tecnologia, hospedagem em nuvem, envio de e-mails, armazenamento, monitoramento, segurança ou processamento de dados, poderá ocorrer transferência internacional de dados pessoais para servidores localizados fora do Brasil.",
      "Nessas hipóteses, a controladora buscará adotar medidas razoáveis para que a transferência ocorra em conformidade com a LGPD, inclusive mediante utilização de fornecedores que apresentem garantias adequadas de segurança e proteção de dados.",
    ],
  },
  {
    titulo: "10. Contato e atualizações desta política",
    itens: [
      "Para assuntos relacionados à privacidade, proteção de dados pessoais ou exercício de direitos do titular, o canal oficial de contato é administracao@dulelisdelivery.com.br.",
      "Esta Política de Privacidade poderá ser alterada a qualquer tempo para refletir atualizações legais, regulatórias, operacionais ou técnicas. A versão vigente permanecerá disponível nesta página, com indicação da respectiva data de vigência.",
    ],
  },
];

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="min-h-screen bg-white px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-500">
            Política de Privacidade
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
            Política de Privacidade
          </h1>
          <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
            Este documento estabelece, de forma transparente, as regras aplicáveis ao tratamento de
            dados pessoais realizado pela Dulelis confeitaria, constituinte legal Edinelso Jose Pasa,
            CNPJ 43.782.331/0001-33, no contexto do cadastro de clientes, autenticação de conta,
            atendimento e realização de pedidos.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black uppercase tracking-widest text-slate-500">
            <span className="rounded-full bg-slate-100 px-4 py-2">Versão {PRIVACY_POLICY_VERSION}</span>
            <span className="rounded-full bg-slate-100 px-4 py-2">Vigência {PRIVACY_POLICY_EFFECTIVE_DATE}</span>
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
